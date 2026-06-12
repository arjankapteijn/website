import { useEffect, useState } from 'react'

export interface IssData {
  latitude: number
  longitude: number
  altitude: number // km
  velocity: number // km/h
  visibility: 'daylight' | 'eclipsed' | string
  timestamp: number
  solar_lat: number // sub-solaire punt: waar de zon recht boven staat
  solar_lon: number
}

export const ISS_API = 'https://api.wheretheiss.at/v1/satellites/25544'

// Pollinterval — de HUD telt hiernaar af
export const ISS_INTERVAL_MS = 15_000

export async function fetchIss(): Promise<IssData | null> {
  try {
    const res = await fetch(ISS_API)
    if (!res.ok) return null
    return (await res.json()) as IssData
  } catch {
    return null
  }
}

/**
 * Pollt de positie van het echte ISS via wheretheiss.at.
 * Geeft null terug zolang er (nog) geen data is — de UI valt dan
 * terug op statische waarden.
 */
export function useIss(intervalMs = ISS_INTERVAL_MS): IssData | null {
  const [data, setData] = useState<IssData | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const d = await fetchIss()
      if (alive && d) setData(d)
    }
    load()
    const id = setInterval(load, intervalMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [intervalMs])

  return data
}
