// Live cpu/geheugengebruik van de machine die deze site host (het homelab).
// Leest rechtstreeks /proc/stat, /proc/meminfo en /proc/uptime - geen
// cloud-API, geen key, geen extra dependency. Op onze eigen Arcane/Docker-
// setup is geen bind-mount nodig: een gewone container ziet daar al de
// host-wide cijfers (geverifieerd via SSH, zie README "Serverstatus"). Zou
// dat elders wél nodig zijn (cgroup-limieten, lxcfs), dan wijzen de
// HOST_PROC_*-env-vars naar een alternatief pad. Bestaat /proc niet (bv.
// macOS-dev), dan gooien de readFns - de caller vangt dat op en toont de
// "geen live data"-fallback. DATA_DIR (voor de statfs-call) is dezelfde
// env-var als de rest van de app al gebruikt (zie Dockerfile), geen
// apart HOST_-voorvoegsel.

import { readFile as defaultReadFile, statfs as defaultStatfs } from 'node:fs/promises'

const PROC_STAT = process.env.HOST_PROC_STAT ?? '/proc/stat'
const PROC_MEMINFO = process.env.HOST_PROC_MEMINFO ?? '/proc/meminfo'
const PROC_UPTIME = process.env.HOST_PROC_UPTIME ?? '/proc/uptime'
const DATA_DIR = process.env.DATA_DIR ?? '/data'

/**
 * Parseert de eerste regel van /proc/stat ("cpu  user nice system idle …")
 * tot { idle, total } in jiffies. Pure functie, goed te testen.
 */
export function parseCpuLine(raw) {
  const line = raw.split('\n')[0] ?? ''
  const parts = line.trim().split(/\s+/).slice(1).map(Number)
  if (parts.length < 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error('onverwacht /proc/stat-formaat')
  }
  const idle = parts[3] + (parts[4] ?? 0) // idle + iowait
  const total = parts.reduce((a, b) => a + b, 0)
  return { idle, total }
}

/**
 * Parseert /proc/meminfo tot { usedKb, totalKb, percent }. MemAvailable
 * (schat vrij geheugen incl. reclaimbare caches) is nauwkeuriger dan
 * MemFree; valt terug op MemFree als MemAvailable ontbreekt (oude kernels).
 */
export function parseMemInfo(raw) {
  const kb = {}
  for (const line of raw.split('\n')) {
    const m = /^(\w+):\s+(\d+)/.exec(line)
    if (m) kb[m[1]] = Number(m[2])
  }
  const totalKb = kb.MemTotal
  if (!totalKb) throw new Error('onverwacht /proc/meminfo-formaat')
  const availKb = kb.MemAvailable ?? kb.MemFree ?? 0
  const usedKb = totalKb - availKb
  return { usedKb, totalKb, percent: Math.round((usedKb / totalKb) * 100) }
}

/**
 * Parseert /proc/uptime ("12345.67 98765.43", uptime + idle-tijd in
 * seconden) tot hele seconden sinds boot.
 */
export function parseUptime(raw) {
  const seconds = parseFloat(raw.trim().split(/\s+/)[0])
  if (Number.isNaN(seconds)) throw new Error('onverwacht /proc/uptime-formaat')
  return Math.floor(seconds)
}

/**
 * Beschikbare ruimte (GB) op de ZFS-pool waar DATA_DIR op leeft. ZFS'
 * statfs geeft geen bruikbare "totale pool-grootte" terug (elke dataset
 * toont zijn éígen used + de gedeelde pool-vrije-ruimte als "size", een
 * bekende ZFS-eigenaardigheid) - vandaar dat alleen het beschikbare aantal
 * bytes hier vandaan komt; het totaal staat als vaste spec in config.ts,
 * net als het cpu-model en de ram-grootte.
 */
export async function readDiskAvailGb({ statfsImpl = defaultStatfs } = {}) {
  const s = await statfsImpl(DATA_DIR)
  return Math.round((s.bavail * s.bsize) / 1_073_741_824 * 10) / 10
}

/**
 * Cpu-gebruik in % over een interval (zelfde aanpak als `mpstat 1 1`):
 * /proc/stat is cumulatief sinds boot, dus twee metingen na elkaar. 1
 * seconde (niet 200ms) is bewust: op een host met een paar containers
 * die af en toe pieken (Immich, Vaultwarden, ...) gaf een kort venster
 * een wild schommelend, onbetrouwbaar getal (1%, 18%, zelfs 48% in
 * losse metingen); 1s geeft dezelfde stabiele ~3-5% als `mpstat`.
 */
export async function readCpuPercent({ readFileImpl = defaultReadFile, sampleMs = 1000 } = {}) {
  const a = parseCpuLine(await readFileImpl(PROC_STAT, 'utf8'))
  await new Promise((resolve) => setTimeout(resolve, sampleMs))
  const b = parseCpuLine(await readFileImpl(PROC_STAT, 'utf8'))
  const totalDelta = b.total - a.total
  const idleDelta = b.idle - a.idle
  return totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0
}

/** Combineert cpu + geheugen + schijf + uptime tot de payload die `/api/host` teruggeeft. */
export async function getHostStats({ readFileImpl = defaultReadFile, statfsImpl = defaultStatfs, sampleMs } = {}) {
  const [cpu, mem, uptimeSec, diskAvailGb] = await Promise.all([
    readCpuPercent({ readFileImpl, sampleMs }),
    readFileImpl(PROC_MEMINFO, 'utf8').then(parseMemInfo),
    readFileImpl(PROC_UPTIME, 'utf8').then(parseUptime),
    readDiskAvailGb({ statfsImpl }),
  ])
  return {
    cpu,
    memPercent: mem.percent,
    memUsedGb: Math.round((mem.usedKb / 1_048_576) * 10) / 10,
    memTotalGb: Math.round((mem.totalKb / 1_048_576) * 10) / 10,
    uptimeSec,
    diskAvailGb,
    updatedAt: new Date().toISOString(),
  }
}
