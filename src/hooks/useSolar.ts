import { useEffect, useState } from 'react'
import { solar } from '../config'

// ─── Live opbrengst van de echte zonnepanelen ───────────────────────────
// Eénmalige momentopname via /api/solar (bewust niet gepolld); de server
// cachet en bewaakt de SolarEdge-daglimiet. Zonder endpoint (statische
// hosting of geen key) blijft het null en toont de menubalk een statisch
// accupercentage.

export interface SolarData {
  power: number // huidig vermogen in W
  today: number // opbrengst vandaag in Wh
  month: number // deze maand in Wh
  lifetime: number // totaal in Wh
  updatedAt: string | null
}

let cached: SolarData | null = null
let promise: Promise<SolarData | null> | null = null

function getSolar(): Promise<SolarData | null> {
  if (cached) return Promise.resolve(cached)
  promise ??= fetch(solar.endpoint)
    .then((r) => (r.ok ? (r.json() as Promise<SolarData>) : null))
    .then((d) => (cached = d))
    .catch(() => null)
  return promise
}

export function useSolar(): SolarData | null {
  const [data, setData] = useState<SolarData | null>(cached)
  useEffect(() => {
    let alive = true
    void getSolar().then((d) => alive && d && setData(d))
    return () => {
      alive = false
    }
  }, [])
  return data
}

/** Huidig vermogen als percentage van het piekvermogen (2,7 kWp). */
export function solarPercent(d: SolarData): number {
  return Math.min(100, Math.max(0, Math.round((d.power / solar.peakWatt) * 100)))
}
