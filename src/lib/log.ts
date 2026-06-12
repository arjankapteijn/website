import { useEffect, useState } from 'react'
import { logging } from '../config'

// ─── IP van de bezoeker ─────────────────────────────────────────────────

let cachedIp: string | null = null
let ipPromise: Promise<string | null> | null = null

export function getIp(): Promise<string | null> {
  if (cachedIp) return Promise.resolve(cachedIp)
  ipPromise ??= fetch('https://api.ipify.org?format=json')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      cachedIp = j?.ip ?? null
      return cachedIp
    })
    .catch(() => null)
  return ipPromise
}

/** Het volledige IP is alleen voor de bezoeker zelf zichtbaar (prompt). */
export function useIp(): string | null {
  const [ip, setIp] = useState<string | null>(cachedIp)
  useEffect(() => {
    let alive = true
    void getIp().then((v) => alive && setIp(v))
    return () => {
      alive = false
    }
  }, [])
  return ip
}

// ─── Openbaar scheepslogboek ────────────────────────────────────────────
// De server (of de Vite-plugin in dev) schrijft regels bovenaan een plat
// logbestand en maskeert daarbij zelf het IP. Publiek raadpleegbaar op
// logging.file (/terminal.log). Faalt stil: het logboek mag de site
// nooit breken, en op statische hosting bestaat het endpoint simpelweg niet.

export function logCommand(command: string, lang: string): void {
  void fetch(logging.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: command.slice(0, 200), lang }),
  }).catch(() => {})
}
