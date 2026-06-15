import { describe, expect, it, vi } from 'vitest'
import { mailtoUrl, sendEmail } from './mail'
import { profile } from '../config'

describe('mailtoUrl', () => {
  it('bouwt een correct ge-encodeerde mailto-link', () => {
    const url = mailtoUrl({ subject: 'Hallo & tot ziens', body: 'Regel 1\nRegel 2' })
    expect(url.startsWith(`mailto:${profile.email}?`)).toBe(true)
    expect(url).toContain('subject=Hallo%20%26%20tot%20ziens')
    expect(url).toContain('body=Regel%201%0ARegel%202')
  })
})

describe('sendEmail', () => {
  it('geeft true terug als het endpoint de mail accepteert', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const ok = await sendEmail({ subject: 's', body: 'b', replyTo: 'a@b.nl' }, 'nl')
    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/email')
    expect(JSON.parse(init.body)).toMatchObject({ subject: 's', body: 'b', replyTo: 'a@b.nl', lang: 'nl' })
  })

  it('geeft false terug bij een niet-ok respons', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await sendEmail({ subject: 's', body: 'b' }, 'en')).toBe(false)
  })

  it('geeft false terug als fetch faalt (statische hosting)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await sendEmail({ subject: 's', body: 'b' }, 'en')).toBe(false)
  })
})
