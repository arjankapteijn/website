// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getHostStats, parseCpuLine, parseMemInfo, parseUptime, readCpuPercent, readDiskAvailGb } from './host.js'

const STAT_A = 'cpu  100 0 50 800 10 0 0 0 0 0\ncpu0 100 0 50 800 10 0 0 0 0 0\n'
const STAT_B = 'cpu  120 0 60 850 12 0 0 0 0 0\ncpu0 120 0 60 850 12 0 0 0 0 0\n'
const MEMINFO = 'MemTotal:       16384000 kB\nMemFree:         2048000 kB\nMemAvailable:    4096000 kB\n'
const UPTIME = '1234567.89 987654.32\n'
const STATFS = { bavail: 1_000_000, bsize: 131_072 }

describe('parseCpuLine', () => {
  it('haalt idle en total uit de cpu-regel', () => {
    expect(parseCpuLine(STAT_A)).toEqual({ idle: 810, total: 960 })
  })

  it('gooit bij een onverwacht formaat', () => {
    expect(() => parseCpuLine('garbage')).toThrow()
  })
})

describe('parseMemInfo', () => {
  it('berekent gebruikt geheugen op basis van MemAvailable', () => {
    expect(parseMemInfo(MEMINFO)).toEqual({ usedKb: 12288000, totalKb: 16384000, percent: 75 })
  })

  it('valt terug op MemFree zonder MemAvailable', () => {
    const raw = 'MemTotal:       16384000 kB\nMemFree:         4096000 kB\n'
    expect(parseMemInfo(raw)).toEqual({ usedKb: 12288000, totalKb: 16384000, percent: 75 })
  })

  it('gooit zonder MemTotal', () => {
    expect(() => parseMemInfo('MemFree: 100 kB\n')).toThrow()
  })
})

describe('parseUptime', () => {
  it('rondt af naar hele seconden', () => {
    expect(parseUptime(UPTIME)).toBe(1234567)
  })

  it('gooit bij een onverwacht formaat', () => {
    expect(() => parseUptime('garbage')).toThrow()
  })
})

describe('readDiskAvailGb', () => {
  it('rekent bavail × bsize om naar GB', async () => {
    const statfsImpl = async () => STATFS
    // 1_000_000 × 131_072 bytes / 1_073_741_824 ≈ 122.1 GB
    expect(await readDiskAvailGb({ statfsImpl })).toBe(122.1)
  })
})

describe('readCpuPercent', () => {
  it('leidt het percentage af uit twee metingen', async () => {
    let call = 0
    const readFileImpl = async () => (call++ === 0 ? STAT_A : STAT_B)
    const pct = await readCpuPercent({ readFileImpl, sampleMs: 0 })
    // delta total = 1042 - 960 = 82, delta idle = 862 - 810 = 52 → (1 - 52/82) * 100 ≈ 37%
    expect(pct).toBe(37)
  })
})

describe('getHostStats', () => {
  it('combineert cpu, geheugen, schijf en uptime tot één payload', async () => {
    let call = 0
    const readFileImpl = async (path) => {
      if (path.includes('meminfo')) return MEMINFO
      if (path.includes('uptime')) return UPTIME
      return call++ === 0 ? STAT_A : STAT_B
    }
    const statfsImpl = async () => STATFS
    const stats = await getHostStats({ readFileImpl, statfsImpl, sampleMs: 0 })
    expect(stats).toMatchObject({
      cpu: 37,
      memPercent: 75,
      memUsedGb: 11.7,
      memTotalGb: 15.6,
      uptimeSec: 1234567,
      diskAvailGb: 122.1,
    })
    expect(typeof stats.updatedAt).toBe('string')
  })
})
