// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatLocation, isPublicIp } from './geo.js'

describe('isPublicIp', () => {
  it('accepteert publieke adressen', () => {
    expect(isPublicIp('203.0.113.9')).toBe(true)
    expect(isPublicIp('8.8.8.8')).toBe(true)
    expect(isPublicIp('2a02:1810:1234::1')).toBe(true)
  })

  it('weigert privé/loopback/link-local en lege waarden', () => {
    expect(isPublicIp('127.0.0.1')).toBe(false)
    expect(isPublicIp('10.1.2.3')).toBe(false)
    expect(isPublicIp('192.168.1.1')).toBe(false)
    expect(isPublicIp('172.16.0.1')).toBe(false)
    expect(isPublicIp('172.31.255.255')).toBe(false)
    expect(isPublicIp('169.254.0.1')).toBe(false)
    expect(isPublicIp('::1')).toBe(false)
    expect(isPublicIp('fe80::1')).toBe(false)
    expect(isPublicIp('fd00::1')).toBe(false)
    expect(isPublicIp('')).toBe(false)
    expect(isPublicIp(undefined)).toBe(false)
  })

  it('laat 172.15/172.32 (buiten de privé-range) wél door', () => {
    expect(isPublicIp('172.15.0.1')).toBe(true)
    expect(isPublicIp('172.32.0.1')).toBe(true)
  })
})

describe('formatLocation', () => {
  it('maakt "Stad, LL" van een geslaagde respons', () => {
    expect(
      formatLocation({ status: 'success', city: 'Amsterdam', countryCode: 'NL', country: 'The Netherlands' }),
    ).toBe('Amsterdam, NL')
  })

  it('valt terug op de landnaam als de code ontbreekt', () => {
    expect(formatLocation({ status: 'success', city: 'Berlin', country: 'Germany' })).toBe('Berlin, Germany')
  })

  it('geeft alleen het land als de stad ontbreekt', () => {
    expect(formatLocation({ status: 'success', countryCode: 'FR' })).toBe('FR')
  })

  it('geeft null bij een mislukte of lege respons', () => {
    expect(formatLocation({ status: 'fail', message: 'reserved range' })).toBeNull()
    expect(formatLocation({})).toBeNull()
    expect(formatLocation(null)).toBeNull()
  })
})
