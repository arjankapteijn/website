// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseGeo, isPublicIp } from './geo.js'

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

describe('parseGeo', () => {
  it('maakt { location: "Stad, LL", isp } van een geslaagde respons', () => {
    expect(
      parseGeo({ status: 'success', city: 'Amsterdam', countryCode: 'NL', country: 'The Netherlands', isp: 'KPN B.V.' }),
    ).toEqual({ location: 'Amsterdam, NL', isp: 'KPN B.V.' })
  })

  it('valt terug op de landnaam als de code ontbreekt', () => {
    expect(parseGeo({ status: 'success', city: 'Berlin', country: 'Germany' })).toEqual({
      location: 'Berlin, Germany',
      isp: null,
    })
  })

  it('geeft alleen het land als de stad ontbreekt', () => {
    expect(parseGeo({ status: 'success', countryCode: 'FR' })).toEqual({ location: 'FR', isp: null })
  })

  it('geeft null-velden bij een mislukte of lege respons', () => {
    expect(parseGeo({ status: 'fail', message: 'reserved range' })).toEqual({ location: null, isp: null })
    expect(parseGeo({})).toEqual({ location: null, isp: null })
    expect(parseGeo(null)).toEqual({ location: null, isp: null })
  })
})
