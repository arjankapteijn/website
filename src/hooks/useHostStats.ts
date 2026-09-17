import { useEffect, useState } from 'react'
import { hosting } from '../config'

// ─── Live server-status van de homelab-machine ──────────────────────────
// Zelfde opbouw als useSolar (module-level cache + gedeelde promise tegen
// dubbele fetches vanuit menubalk + modal), maar - anders dan bij solar -
// wél gepolld: geen SolarEdge-daglimiet hier, en dit icoontje hoort juist
// live te voelen. `promise` wordt na elke afronding gereset zodat de
// volgende poll-tick weer een verse fetch doet.

export interface HostData {
  cpu: number // cpu-gebruik in %
  memPercent: number
  memUsedGb: number
  memTotalGb: number
  diskAvailGb: number
  uptimeSec: number
  updatedAt: string
}

let cached: HostData | null = null
let promise: Promise<HostData | null> | null = null

function getHost(): Promise<HostData | null> {
  promise ??= fetch(hosting.endpoint)
    .then((r) => (r.ok ? (r.json() as Promise<HostData>) : null))
    .then((d) => (cached = d ?? cached))
    .catch(() => cached)
    .finally(() => {
      promise = null
    })
  return promise
}

export function useHostStats(): HostData | null {
  const [data, setData] = useState<HostData | null>(cached)
  useEffect(() => {
    let alive = true
    const load = () => void getHost().then((d) => alive && d && setData(d))
    load()
    const id = setInterval(load, hosting.pollMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])
  return data
}
