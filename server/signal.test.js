// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { formatLogMessage, sendSignal } from './signal.js'

describe('formatLogMessage', () => {
  it('rendert een styled regel: vette kop, commando in monospace, meta eronder', () => {
    const msg = formatLogMessage({ ip: '203.0.113.9', lang: 'nl', command: 'help' })
    expect(msg).toBe('🛰️ **AK-01 · scheepslogboek**\n`help`\n203.0.113.9 · nl')
  })

  it('voegt de locatie toe aan de meta-regel als die is meegegeven', () => {
    const msg = formatLogMessage({ ip: '203.0.113.9', lang: 'nl', command: 'help', location: 'Amsterdam, NL' })
    expect(msg).toBe('🛰️ **AK-01 · scheepslogboek**\n`help`\n203.0.113.9 · nl · 📍 Amsterdam, NL')
  })
})

describe('sendSignal', () => {
  it('post naar /v2/send met getrimde base-url en optionele text_mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await sendSignal({
      url: 'http://signal:8080///',
      number: '+31600000000',
      recipients: ['+31600000000'],
      message: 'hi',
      textMode: 'styled',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://signal:8080/v2/send')
    expect(JSON.parse(init.body)).toEqual({
      message: 'hi',
      number: '+31600000000',
      recipients: ['+31600000000'],
      text_mode: 'styled',
    })
  })

  it('laat text_mode weg als die niet is meegegeven', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await sendSignal({ url: 'http://signal:8080', number: '+31', recipients: ['+31'], message: 'hi' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('text_mode')
  })

  it('gooit een Error bij een niet-2xx-respons', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }))
    await expect(
      sendSignal({ url: 'http://signal:8080', number: '+31', recipients: ['+31'], message: 'hi' }),
    ).rejects.toThrow('Signal-API status 500')
  })
})
