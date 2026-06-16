// Zet een bezoekers-IP om naar een grove locatie ("Amsterdam, NL") + ISP
// voor in het scheepslogboek. Server-side, zero-dependency: leunt op globale
// fetch. Gebruikt ip-api.com (gratis, geen key, 45 req/min). Het gratis plan
// is HTTP-only; server-side is dat prima (geen mixed-content, CSP geldt alleen
// in de browser). Faalt stil — lukt de lookup niet, dan gaat de logregel
// gewoon zónder herkomst door.

const GEO_URL = process.env.GEO_API_URL ?? 'http://ip-api.com/json'
const GEO_FIELDS = 'status,message,country,countryCode,city,isp'
const TTL_MS = 6 * 60 * 60_000 // zelfde bezoeker → 6 uur uit cache
const cache = new Map() // ip → { at, value }
const EMPTY = { location: null, isp: null }

/**
 * Privé/loopback/link-local IP's hebben geen zinnige geo-locatie en hoeven
 * niet naar de externe API (scheelt requests en lekt geen interne adressen).
 */
export function isPublicIp(ip) {
  if (!ip || typeof ip !== 'string') return false
  if (ip === '::1') return false // IPv6 loopback
  if (/^fe80:/i.test(ip)) return false // IPv6 link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return false // IPv6 unique-local (fc00::/7)
  if (/^127\./.test(ip)) return false // IPv4 loopback
  if (/^10\./.test(ip)) return false // IPv4 privé
  if (/^192\.168\./.test(ip)) return false // IPv4 privé
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false // IPv4 privé
  if (/^169\.254\./.test(ip)) return false // IPv4 link-local
  return true
}

/**
 * Vorm de ip-api.com-respons om tot { location, isp }: location is
 * "Stad, LL" (of alleen het land als de stad ontbreekt), isp de provider.
 * Pure functie → goed te testen. Velden die ontbreken worden null.
 */
export function parseGeo(data) {
  if (!data || data.status !== 'success') return EMPTY
  const city = typeof data.city === 'string' ? data.city.trim() : ''
  const code = typeof data.countryCode === 'string' ? data.countryCode.trim() : ''
  const country = typeof data.country === 'string' ? data.country.trim() : ''
  const parts = [city, code || country].filter(Boolean)
  const isp = typeof data.isp === 'string' && data.isp.trim() ? data.isp.trim() : null
  return { location: parts.length ? parts.join(', ') : null, isp }
}

/**
 * Resolve een IP naar { location, isp }. Cachet per IP, kapt af op een korte
 * time-out en slikt elke fout (de logregel mag er nooit op stuklopen) → dan
 * { location: null, isp: null }. GEO_API_URL leeg gezet → lookup volledig uit.
 */
export async function lookupGeo(ip, { fetchImpl = fetch, timeoutMs = 3000 } = {}) {
  if (!GEO_URL || !isPublicIp(ip)) return EMPTY
  const hit = cache.get(ip)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  try {
    const res = await fetchImpl(
      `${GEO_URL.replace(/\/+$/, '')}/${encodeURIComponent(ip)}?fields=${GEO_FIELDS}`,
      { signal: AbortSignal.timeout(timeoutMs) },
    )
    if (!res.ok) return EMPTY
    const value = parseGeo(await res.json())
    cache.set(ip, { at: Date.now(), value })
    return value
  } catch {
    return EMPTY
  }
}
