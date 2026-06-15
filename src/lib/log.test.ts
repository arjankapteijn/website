import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('logCommand', () => {
  it('post het commando en knipt het af op 200 tekens', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { logCommand } = await import('./log')
    logCommand('x'.repeat(500), 'nl')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/log')
    const payload = JSON.parse(init.body)
    expect(payload.command).toHaveLength(200)
    expect(payload.lang).toBe('nl')
  })

  it('gooit nooit als het endpoint onbereikbaar is', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('nope')))
    const { logCommand } = await import('./log')
    expect(() => logCommand('help', 'en')).not.toThrow()
  })
})

describe('getIp', () => {
  // verse module-state per test, want getIp cachet het IP op module-niveau
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.resetModules())

  it('haalt het IP één keer op en cachet daarna', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ip: '203.0.113.7' }) })
    vi.stubGlobal('fetch', fetchMock)
    const { getIp } = await import('./log')
    expect(await getIp()).toBe('203.0.113.7')
    expect(await getIp()).toBe('203.0.113.7')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('resolvet naar null als het verzoek faalt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { getIp } = await import('./log')
    expect(await getIp()).toBeNull()
  })
})
