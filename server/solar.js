// Live opbrengst van de zonnepanelen via de SolarEdge Monitoring API V2
// (SolarEdge ONE Developer Platform). V1 (monitoringapi.solaredge.com/site/…
// ?api_key=) stopt op 1 november 2026; V1-keys werken niet op V2.
//
// Authenticatie: V2 kent voor huiseigenaren geen statische API-key meer,
// alleen OAuth "Site Access". Eénmalig doorloop je de consent-flow (zie
// README en server/solaredge-auth.js) en krijg je een refresh token. Daarmee
// haalt deze module access tokens (2 uur geldig). Let op: élke refresh
// levert een NIEUW refresh token op en maakt het oude ongeldig - het nieuwe
// moet dus persistent bewaard worden (SOLAREDGE_TOKEN_FILE), anders werkt
// het na een herstart niet meer. Een refresh token verloopt na 30 dagen
// zonder gebruik; keepAlive() ververst daarom periodiek.
//
// Credits: Free-tier = 2.000 calls/maand (~67/dag), 10/minuut. Per
// verversing kost dit 2 calls (/power + /energy per dag), lifetime 1 call per
// 6 uur en de site-metadata 1 call per proces. Met de standaard cache van
// 60 minuten ≈ 53 calls/dag.
//
// Docs: https://api-docs.solaredge.com/docs/developer-platform/df8kx5j4z9vi0-homeowner-and-self-access-guide

import { promises as defaultFs } from 'node:fs'
import path from 'node:path'

export const API_BASE = 'https://monitoringapi.solaredge.com/v2'
export const TOKEN_URL = `${API_BASE}/oauth2/token`
export const AUTHORIZE_URL = 'https://connect.solaredge.com/authorize'

const LIFETIME_TTL_MS = 6 * 60 * 60_000
const KEEPALIVE_AFTER_MS = 7 * 24 * 60 * 60_000
const TOKEN_MARGIN_MS = 60_000

const ENERGY_TO_WH = { WH: 1, KWH: 1e3, MWH: 1e6, GWH: 1e9 }
const POWER_TO_W = { W: 1, KW: 1e3, MW: 1e6 }

/** Fout van SolarEdge, met status en (bij 429) een minimale wachttijd. */
export class SolarEdgeError extends Error {
  constructor(message, { status = 0, retryAfterMs = 0 } = {}) {
    super(message)
    this.name = 'SolarEdgeError'
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

/** Leest de SolarEdge-config uit de environment (gedeeld met vite.config.ts). */
export function solarConfigFromEnv(env = process.env) {
  return {
    clientId: env.SOLAREDGE_CLIENT_ID || '',
    clientSecret: env.SOLAREDGE_CLIENT_SECRET || '',
    siteId: env.SOLAREDGE_SITE_ID || '',
    refreshToken: env.SOLAREDGE_REFRESH_TOKEN || '',
    tokenFile: env.SOLAREDGE_TOKEN_FILE || '',
    ttlMs: (Number(env.SOLAREDGE_CACHE_MINUTES) || 60) * 60_000,
  }
}

export function isSolarConfigured(cfg) {
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.siteId && (cfg.refreshToken || cfg.tokenFile))
}

/** Waarde × eenheid → basiseenheid (Wh of W); null bij onbekende eenheid. */
export function toBase(value, unit, table) {
  const factor = table[String(unit ?? '').toUpperCase()]
  return typeof value === 'number' && factor ? value * factor : null
}

/**
 * Datum → "YYYY-MM-DDTHH:MM:SS" in de lokale tijd van de site, zonder
 * offset - het formaat dat V2 voor from/to verwacht.
 */
export function localStamp(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

/** Laatste niet-lege waarde (met timestamp) uit een Measurements-envelope. */
export function latestSample(body) {
  const values = Array.isArray(body?.values) ? body.values : []
  for (let i = values.length - 1; i >= 0; i--) {
    if (typeof values[i]?.value === 'number') return values[i]
  }
  return null
}

/**
 * Zet de V2-responses om naar de vorm die de frontend al kent
 * ({ power, today, month, lifetime, updatedAt }, in W en Wh).
 * Pure functie, goed te testen.
 */
export function buildSolarBody({ power, monthEnergy, lifetimeWh, todayDate }) {
  const sample = latestSample(power)
  const energyUnit = monthEnergy?.unit
  const days = Array.isArray(monthEnergy?.values) ? monthEnergy.values : []
  let month = 0
  let today = 0
  for (const d of days) {
    const wh = toBase(d?.value, energyUnit, ENERGY_TO_WH)
    if (wh === null) continue
    month += wh
    if (String(d.timestamp ?? '').startsWith(todayDate)) today = wh
  }
  return {
    power: (sample && toBase(sample.value, power?.unit ?? 'W', POWER_TO_W)) ?? 0, // W
    today, // Wh
    month,
    lifetime: lifetimeWh ?? 0,
    updatedAt: sample?.timestamp ?? null,
  }
}

/**
 * V2-client voor één site. Afhankelijkheden (fetch, klok, fs) zijn
 * injecteerbaar voor de tests.
 */
export function createSolarClient(cfg, { fetchFn = fetch, now = Date.now, fs = defaultFs, log = console } = {}) {
  let access = null // { token, expiresAt }
  let refresh = null // { refreshToken, savedAt } - in geheugen leidend
  let refreshing = null
  let site = null // { timeZone, installationDate }
  let lifetime = null // { wh, at }
  let warnedNoFile = false

  async function loadRefreshToken() {
    if (refresh) return refresh
    if (cfg.tokenFile) {
      try {
        const saved = JSON.parse(await fs.readFile(cfg.tokenFile, 'utf8'))
        if (saved?.refreshToken) return (refresh = saved)
      } catch {
        /* nog geen bestand - val terug op de env-seed */
      }
    }
    if (!cfg.refreshToken) throw new SolarEdgeError('geen refresh token (SOLAREDGE_REFRESH_TOKEN of SOLAREDGE_TOKEN_FILE)')
    return (refresh = { refreshToken: cfg.refreshToken, savedAt: 0 })
  }

  async function saveRefreshToken(next) {
    refresh = next
    if (!cfg.tokenFile) {
      if (!warnedNoFile) log.warn('solaredge: SOLAREDGE_TOKEN_FILE niet gezet - nieuw refresh token overleeft geen herstart')
      warnedNoFile = true
      return
    }
    try {
      await fs.mkdir(path.dirname(cfg.tokenFile), { recursive: true })
      const tmp = `${cfg.tokenFile}.tmp`
      await fs.writeFile(tmp, JSON.stringify(next), { mode: 0o600 })
      await fs.rename(tmp, cfg.tokenFile)
    } catch (err) {
      log.error('solaredge: refresh token opslaan mislukt:', err?.message ?? err)
    }
  }

  // Eén refresh tegelijk: het oude refresh token is na gebruik ongeldig,
  // dus twee parallelle refreshes zouden elkaar buitensluiten.
  function refreshAccessToken() {
    refreshing ??= (async () => {
      const { refreshToken } = await loadRefreshToken()
      const r = await fetchFn(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
        }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok || !body.access_token) {
        // error/error_description (RFC 6749) bevatten geen secrets
        throw new SolarEdgeError(`token-refresh ${r.status} ${body.error ?? ''} ${body.error_description ?? ''}`.trim(), {
          status: r.status,
        })
      }
      access = { token: body.access_token, expiresAt: now() + (Number(body.expires_in) || 7200) * 1000 }
      if (body.refresh_token) await saveRefreshToken({ refreshToken: body.refresh_token, savedAt: now() })
      return access.token
    })().finally(() => {
      refreshing = null
    })
    return refreshing
  }

  async function accessToken() {
    if (access && access.expiresAt - TOKEN_MARGIN_MS > now()) return access.token
    return refreshAccessToken()
  }

  async function apiGet(pathname, params = {}, retried = false) {
    const url = new URL(`${API_BASE}${pathname}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const r = await fetchFn(url, {
      headers: { Authorization: `Bearer ${await accessToken()}`, Accept: 'application/json' },
    })
    if (r.status === 401 && !retried) {
      access = null // token ingetrokken of verlopen → één keer opnieuw
      return apiGet(pathname, params, true)
    }
    if (!r.ok) {
      let retryAfterMs = 0
      if (r.status === 429) {
        const remainingMinute = r.headers.get('x-ratelimit-remaining-minute')
        // >0 resterend per minuut = maandtegoed op → lang wachten
        retryAfterMs =
          remainingMinute && remainingMinute.trim() !== '0'
            ? 6 * 60 * 60_000
            : (Number(r.headers.get('retry-after')) || 60) * 1000
      }
      throw new SolarEdgeError(`${pathname} status ${r.status}`, { status: r.status, retryAfterMs })
    }
    return r.json()
  }

  async function siteInfo() {
    if (site) return site
    const body = await apiGet(`/sites/${cfg.siteId}`)
    site = {
      timeZone: body?.location?.timezone || 'Europe/Amsterdam',
      installationDate: String(body?.installationDate ?? '2010-01-01').slice(0, 10),
    }
    return site
  }

  /** Haalt een verse momentopname op in het frontend-formaat. */
  async function fetchSolar() {
    const { timeZone, installationDate } = await siteInfo()
    const nowDate = new Date(now())
    const nowLocal = localStamp(nowDate, timeZone)
    const todayDate = nowLocal.slice(0, 10)
    const hourAgo = localStamp(new Date(now() - 60 * 60_000), timeZone)
    const lifetimeStale = !lifetime || now() - lifetime.at > LIFETIME_TTL_MS

    const [power, monthEnergy, yearEnergy] = await Promise.all([
      // laatste kwartierwaarde = "huidig" vermogen (V2 heeft geen live-W op Free)
      apiGet(`/sites/${cfg.siteId}/power`, { resolution: 'QUARTER_HOUR', unit: 'W', from: hourAgo, to: nowLocal }),
      // dagbuckets van deze maand → maandtotaal én vandaag in één call
      apiGet(`/sites/${cfg.siteId}/energy`, {
        resolution: 'DAY',
        unit: 'WH',
        from: `${todayDate.slice(0, 8)}01T00:00:00`,
        to: nowLocal,
      }),
      // YEAR is de enige resolutie zonder maximale periode
      lifetimeStale
        ? apiGet(`/sites/${cfg.siteId}/energy`, {
            resolution: 'YEAR',
            unit: 'WH',
            from: `${installationDate}T00:00:00`,
            to: nowLocal,
          })
        : null,
    ])

    if (yearEnergy) {
      const wh = (yearEnergy.values ?? []).reduce(
        (sum, v) => sum + (toBase(v?.value, yearEnergy.unit, ENERGY_TO_WH) ?? 0),
        0,
      )
      lifetime = { wh, at: now() }
    }
    return buildSolarBody({ power, monthEnergy, lifetimeWh: lifetime?.wh, todayDate })
  }

  /** Ververst het refresh token als het langer dan 7 dagen niet gebruikt is. */
  async function keepAlive() {
    const current = await loadRefreshToken()
    if (now() - (current.savedAt || 0) > KEEPALIVE_AFTER_MS) await refreshAccessToken()
  }

  return { fetchSolar, keepAlive }
}

/**
 * Cache met negatieve cache/backoff. Succes → ttlMs geldig. Mislukt →
 * exponentiële backoff (base, ×2, tot max), óók als er nog niets gecachet
 * is - anders roept elke request SolarEdge opnieuw aan en is de daglimiet
 * zo op. Gelijktijdige requests delen één lopende load.
 */
export function createSolarCache({
  load,
  ttlMs,
  now = Date.now,
  baseBackoffMs = 5 * 60_000,
  maxBackoffMs = 6 * 60 * 60_000,
  log = console,
}) {
  let body = null
  let nextAt = 0
  let failures = 0
  let inflight = null

  async function reload() {
    try {
      body = JSON.stringify(await load())
      failures = 0
      nextAt = now() + ttlMs
    } catch (err) {
      failures++
      const backoff = Math.min(maxBackoffMs, baseBackoffMs * 2 ** (failures - 1))
      nextAt = now() + Math.max(backoff, err?.retryAfterMs ?? 0)
      log.error(`solaredge mislukt (poging ${failures}, opnieuw over ${Math.round((nextAt - now()) / 60_000)} min):`, err?.message ?? err)
    }
  }

  /** De gecachte JSON-body, of null als er (nog) niets beschikbaar is. */
  async function get() {
    if (now() >= nextAt) {
      inflight ??= reload().finally(() => {
        inflight = null
      })
      await inflight
    }
    return body
  }

  return { get }
}
