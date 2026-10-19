// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  TOKEN_URL,
  buildSolarBody,
  createSolarCache,
  createSolarClient,
  isSolarConfigured,
  localStamp,
  solarConfigFromEnv,
  utcStamp,
  zonedMidnight,
} from './solar.js'

// Vormen volgens de V2-docs (Measurements-envelope, site-metadata)
const SITE = { siteId: 994149, location: { timezone: 'Europe/Amsterdam' } }
const POWER = {
  unit: 'W',
  resolution: 'QUARTER_HOUR',
  values: [
    { timestamp: '2026-10-19T13:30:00+02:00', value: 1210.5 },
    { timestamp: '2026-10-19T13:45:00+02:00', value: 1340 },
    { timestamp: '2026-10-19T14:00:00+02:00', value: null },
  ],
}
const MONTH = {
  unit: 'KWH',
  resolution: 'DAY',
  values: [
    { timestamp: '2026-10-01T00:00:00+02:00', value: 6.5 },
    { timestamp: '2026-10-18T00:00:00+02:00', value: 4 },
    { timestamp: '2026-10-19T00:00:00+02:00', value: 2.25 },
  ],
}
const LIFETIME = { energy: 4.5, unit: 'MWH', lastUpdateTime: '2026-10-19T13:45:00+02:00' }

const CFG = {
  clientId: 'cid',
  clientSecret: 'secret',
  siteId: '994149',
  refreshToken: 'rt-env',
  tokenFile: '/data/solaredge/token.json',
  ttlMs: 60 * 60_000,
}
const NOW = Date.parse('2026-10-19T12:05:00Z') // 14:05 in Amsterdam

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

function memFs(initial = {}) {
  const files = { ...initial }
  return {
    files,
    readFile: vi.fn(async (p) => {
      if (!(p in files)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      return files[p]
    }),
    writeFile: vi.fn(async (p, data) => {
      files[p] = data
    }),
    rename: vi.fn(async (from, to) => {
      files[to] = files[from]
      delete files[from]
    }),
    mkdir: vi.fn(async () => {}),
  }
}

/** Fake SolarEdge: token-endpoint roteert refresh tokens, data-endpoints vast. */
function fakeApi({ overrides = {} } = {}) {
  let n = 0
  const calls = []
  const fetchFn = vi.fn(async (input, init = {}) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    if (String(input) === TOKEN_URL) {
      n++
      return json({ access_token: `at-${n}`, expires_in: 7200, refresh_token: `rt-${n}` })
    }
    const key = url.pathname.endsWith('/power')
      ? 'power'
      : url.pathname.endsWith('/lifetime-energy')
        ? 'lifetime'
        : url.pathname.endsWith('/energy')
          ? 'month'
          : 'site'
    if (overrides[key]) return overrides[key](url, init)
    return json({ power: POWER, month: MONTH, lifetime: LIFETIME, site: SITE }[key])
  })
  return { fetchFn, calls }
}

const quietLog = { warn: () => {}, error: () => {} }

describe('solarConfigFromEnv / isSolarConfigured', () => {
  it('leest de V2-variabelen en default 60 min cache', () => {
    const cfg = solarConfigFromEnv({
      SOLAREDGE_CLIENT_ID: 'a',
      SOLAREDGE_CLIENT_SECRET: 'b',
      SOLAREDGE_SITE_ID: '1',
      SOLAREDGE_TOKEN_FILE: '/x',
    })
    expect(cfg.ttlMs).toBe(60 * 60_000)
    expect(isSolarConfigured(cfg)).toBe(true)
  })

  it('is niet geconfigureerd met alleen de oude V1-key', () => {
    expect(isSolarConfigured(solarConfigFromEnv({ SOLAREDGE_API_KEY: 'x', SOLAREDGE_SITE_ID: '1' }))).toBe(false)
  })
})

describe('tijdstempels', () => {
  it('localStamp geeft site-lokale wandtijd', () => {
    expect(localStamp(new Date(NOW), 'Europe/Amsterdam')).toBe('2026-10-19T14:05:00')
  })

  it('utcStamp geeft UTC mét zone en zonder ms (V2 weigert zoneloze waarden)', () => {
    expect(utcStamp(new Date(NOW + 123))).toBe('2026-10-19T12:05:00Z')
  })

  it('zonedMidnight rekent lokale middernacht om naar UTC, ook rond zomertijd', () => {
    expect(zonedMidnight('2026-10-01', 'Europe/Amsterdam').toISOString()).toBe('2026-09-30T22:00:00.000Z')
    expect(zonedMidnight('2026-11-01', 'Europe/Amsterdam').toISOString()).toBe('2026-10-31T23:00:00.000Z')
    expect(zonedMidnight('2026-03-29', 'Europe/Amsterdam').toISOString()).toBe('2026-03-28T23:00:00.000Z')
  })
})

describe('buildSolarBody', () => {
  it('zet V2-responses om naar de bestaande frontend-vorm', () => {
    expect(buildSolarBody({ power: POWER, monthEnergy: MONTH, lifetimeWh: 4.5e6, todayDate: '2026-10-19' })).toEqual({
      power: 1340,
      today: 2250,
      month: 12750,
      lifetime: 4.5e6,
      updatedAt: '2026-10-19T13:45:00+02:00',
    })
  })

  it('herkent vandaag ook als de API UTC-timestamps teruggeeft', () => {
    const utcMonth = {
      unit: 'WH',
      values: [
        { timestamp: '2026-10-17T22:00:00Z', value: 4000 },
        { timestamp: '2026-10-18T22:00:00Z', value: 2250 },
      ],
    }
    expect(buildSolarBody({ power: POWER, monthEnergy: utcMonth, lifetimeWh: 0, todayDate: '2026-10-19' }).today).toBe(2250)
  })

  it('valt terug op nullen bij lege responses', () => {
    expect(buildSolarBody({ power: {}, monthEnergy: {}, lifetimeWh: null, todayDate: '2026-10-19' })).toEqual({
      power: 0,
      today: 0,
      month: 0,
      lifetime: 0,
      updatedAt: null,
    })
  })
})

describe('createSolarClient', () => {
  it('haalt token + data op met Bearer-auth en de juiste vensters', async () => {
    const { fetchFn, calls } = fakeApi()
    const fs = memFs()
    const client = createSolarClient(CFG, { fetchFn, now: () => NOW, fs, log: quietLog })

    expect(await client.fetchSolar()).toEqual({
      power: 1340,
      today: 2250,
      month: 12750,
      lifetime: 4.5e6,
      updatedAt: '2026-10-19T13:45:00+02:00',
    })

    const token = calls.find((c) => String(c.url) === TOKEN_URL)
    expect(JSON.parse(token.init.body)).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'rt-env' })
    const power = calls.find((c) => c.url.pathname.endsWith('/power'))
    expect(power.init.headers.Authorization).toBe('Bearer at-1')
    expect(Object.fromEntries(power.url.searchParams)).toEqual({
      resolution: 'QUARTER_HOUR',
      unit: 'W',
      from: '2026-10-19T11:05:00Z',
      to: '2026-10-19T12:05:00Z',
    })
    const month = calls.find((c) => c.url.searchParams.get('resolution') === 'DAY')
    expect(month.url.searchParams.get('from')).toBe('2026-09-30T22:00:00Z') // 1 okt 00:00 Amsterdam
    expect(calls.filter((c) => c.url.pathname.endsWith('/lifetime-energy'))).toHaveLength(1)
    // geen secrets in URL's
    for (const c of calls) expect(String(c.url)).not.toMatch(/secret|rt-|at-/)
  })

  it('bewaart het geroteerde refresh token en gebruikt het na een herstart', async () => {
    const api = fakeApi()
    const fs = memFs()
    await createSolarClient(CFG, { fetchFn: api.fetchFn, now: () => NOW, fs, log: quietLog }).fetchSolar()
    expect(JSON.parse(fs.files[CFG.tokenFile])).toEqual({ refreshToken: 'rt-1', savedAt: NOW })

    // "herstart": nieuwe client, zelfde bestand
    const api2 = fakeApi()
    await createSolarClient(CFG, { fetchFn: api2.fetchFn, now: () => NOW, fs, log: quietLog }).fetchSolar()
    const token = api2.calls.find((c) => String(c.url) === TOKEN_URL)
    expect(JSON.parse(token.init.body).refresh_token).toBe('rt-1')
  })

  it('hergebruikt het access token en vraagt lifetime maar eens per 6 uur op', async () => {
    const { fetchFn, calls } = fakeApi()
    let now = NOW
    const client = createSolarClient(CFG, { fetchFn, now: () => now, fs: memFs(), log: quietLog })
    await client.fetchSolar()
    now += 60 * 60_000
    await client.fetchSolar()
    expect(calls.filter((c) => String(c.url) === TOKEN_URL)).toHaveLength(1)
    expect(calls.filter((c) => c.url.pathname.endsWith('/lifetime-energy'))).toHaveLength(1)
    expect(calls.filter((c) => c.url.pathname === '/v2/sites/994149')).toHaveLength(1)
  })

  it('ververst parallelle requests met één token-call', async () => {
    const { fetchFn, calls } = fakeApi()
    const client = createSolarClient(CFG, { fetchFn, now: () => NOW, fs: memFs(), log: quietLog })
    await Promise.all([client.fetchSolar(), client.fetchSolar()])
    expect(calls.filter((c) => String(c.url) === TOKEN_URL)).toHaveLength(1)
  })

  it('probeert bij 401 één keer opnieuw met een vers token', async () => {
    let first = true
    const { fetchFn, calls } = fakeApi({
      overrides: {
        power: () => {
          if (first) {
            first = false
            return json({ title: 'Unauthorized' }, 401)
          }
          return json(POWER)
        },
      },
    })
    const client = createSolarClient(CFG, { fetchFn, now: () => NOW, fs: memFs(), log: quietLog })
    expect((await client.fetchSolar()).power).toBe(1340)
    expect(calls.filter((c) => String(c.url) === TOKEN_URL)).toHaveLength(2)
  })

  it('neemt de Problem Details-detail van SolarEdge op in de fout', async () => {
    const { fetchFn } = fakeApi({
      overrides: { power: () => json({ title: 'Bad Request', detail: "'from' must include a time zone" }, 400) },
    })
    const client = createSolarClient(CFG, { fetchFn, now: () => NOW, fs: memFs(), log: quietLog })
    await expect(client.fetchSolar()).rejects.toThrow("/sites/994149/power status 400: 'from' must include a time zone")
  })

  it('geeft bij 429 (maandtegoed op) een lange retryAfter mee', async () => {
    const { fetchFn } = fakeApi({
      overrides: { power: () => json({}, 429, { 'x-ratelimit-remaining-minute': '7' }) },
    })
    const client = createSolarClient(CFG, { fetchFn, now: () => NOW, fs: memFs(), log: quietLog })
    await expect(client.fetchSolar()).rejects.toMatchObject({ status: 429, retryAfterMs: 6 * 60 * 60_000 })
  })

  it('meldt een mislukte token-refresh zonder het secret te lekken', async () => {
    const fetchFn = vi.fn(async () => json({ error: 'invalid_grant', error_description: 'expired' }, 400))
    const client = createSolarClient(CFG, { fetchFn, now: () => NOW, fs: memFs(), log: quietLog })
    const err = await client.fetchSolar().catch((e) => e)
    expect(err.message).toBe('token-refresh 400 invalid_grant expired')
    expect(err.message).not.toContain('secret')
  })

  it('keepAlive ververst alleen een token ouder dan 7 dagen', async () => {
    const { fetchFn, calls } = fakeApi()
    const fs = memFs({ [CFG.tokenFile]: JSON.stringify({ refreshToken: 'rt-old', savedAt: NOW - 8 * 86_400_000 }) })
    const client = createSolarClient(CFG, { fetchFn, now: () => NOW, fs, log: quietLog })
    await client.keepAlive()
    await client.keepAlive()
    expect(calls).toHaveLength(1)
    expect(JSON.parse(calls[0].init.body).refresh_token).toBe('rt-old')
  })
})

describe('createSolarCache', () => {
  it('cachet succes gedurende de ttl', async () => {
    let now = 0
    const load = vi.fn(async () => ({ power: 1 }))
    const cache = createSolarCache({ load, ttlMs: 1000, now: () => now, log: quietLog })
    expect(await cache.get()).toBe('{"power":1}')
    now = 999
    await cache.get()
    expect(load).toHaveBeenCalledTimes(1)
    now = 1000
    await cache.get()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('backt ook zonder cache af na een fout (geen retry per request)', async () => {
    let now = 0
    const load = vi.fn(async () => {
      throw new Error('503')
    })
    const cache = createSolarCache({ load, ttlMs: 1000, now: () => now, baseBackoffMs: 100, maxBackoffMs: 250, log: quietLog })
    expect(await cache.get()).toBeNull()
    expect(await cache.get()).toBeNull()
    now = 99
    await cache.get()
    expect(load).toHaveBeenCalledTimes(1)
    now = 100 // backoff 100 verstreken → poging 2, daarna 200
    await cache.get()
    expect(load).toHaveBeenCalledTimes(2)
    now = 299
    await cache.get()
    expect(load).toHaveBeenCalledTimes(2)
    now = 300 // poging 3, daarna begrensd op 250
    await cache.get()
    now = 549
    await cache.get()
    expect(load).toHaveBeenCalledTimes(3)
    now = 550
    await cache.get()
    expect(load).toHaveBeenCalledTimes(4)
  })

  it('serveert oude data tijdens een storing en respecteert retryAfter', async () => {
    let now = 0
    let fail = false
    const load = vi.fn(async () => {
      if (fail) throw Object.assign(new Error('429'), { retryAfterMs: 5000 })
      return { power: 2 }
    })
    const cache = createSolarCache({ load, ttlMs: 10, now: () => now, baseBackoffMs: 100, log: quietLog })
    await cache.get()
    fail = true
    now = 10
    expect(await cache.get()).toBe('{"power":2}')
    now = 4999
    await cache.get()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('deelt één lopende load tussen gelijktijdige requests', async () => {
    let resolve
    const load = vi.fn(() => new Promise((r) => (resolve = r)))
    const cache = createSolarCache({ load, ttlMs: 1000, now: () => 0, log: quietLog })
    const a = cache.get()
    const b = cache.get()
    resolve({ power: 3 })
    expect(await Promise.all([a, b])).toEqual(['{"power":3}', '{"power":3}'])
    expect(load).toHaveBeenCalledTimes(1)
  })
})
