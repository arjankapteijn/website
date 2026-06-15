import { beforeEach, describe, expect, it } from 'vitest'
import { detectLang, saveLang, strings } from './i18n'

// jsdom kan niet echt navigeren en location.hostname is niet herdefinieerbaar,
// dus vervangen we window.location in z'n geheel door een plat object.
// navigator.language gaat wél via defineProperty (de setter zelf gooit).
function stubLocation(search: string, hostname: string) {
  Object.defineProperty(window, 'location', { configurable: true, value: { search, hostname } })
}
function setLanguage(language: string) {
  Object.defineProperty(window.navigator, 'language', { configurable: true, value: language })
}

// jsdom in Vitest 4 levert geen localStorage; een Map-backed stub volstaat
// voor wat detectLang/saveLang gebruiken (getItem/setItem/clear).
class MemoryStorage {
  private store = new Map<string, string>()
  clear() { this.store.clear() }
  getItem(key: string) { return this.store.get(key) ?? null }
  setItem(key: string, value: string) { this.store.set(key, String(value)) }
  removeItem(key: string) { this.store.delete(key) }
}
Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() })

describe('detectLang', () => {
  beforeEach(() => {
    window.localStorage.clear()
    stubLocation('', 'localhost')
  })

  it('laat ?lang voorgaan op alles', () => {
    stubLocation('?lang=en', 'arjankapteijn.nl')
    window.localStorage.setItem('lang', 'nl')
    expect(detectLang()).toBe('en')
  })

  it('valt terug op een opgeslagen voorkeur', () => {
    stubLocation('', 'example.org')
    window.localStorage.setItem('lang', 'nl')
    expect(detectLang()).toBe('nl')
  })

  it('kiest Engels op een .com-host', () => {
    stubLocation('', 'arjankapteijn.com')
    expect(detectLang()).toBe('en')
  })

  it('kiest Nederlands op een .nl-host', () => {
    stubLocation('', 'arjankapteijn.nl')
    expect(detectLang()).toBe('nl')
  })

  it('valt terug op de browsertaal bij een neutrale host', () => {
    stubLocation('', 'localhost')
    setLanguage('nl-NL')
    expect(detectLang()).toBe('nl')
    setLanguage('en-US')
    expect(detectLang()).toBe('en')
  })

  it('negeert een ongeldige opgeslagen waarde', () => {
    stubLocation('', 'localhost')
    setLanguage('en-US')
    window.localStorage.setItem('lang', 'de')
    expect(detectLang()).toBe('en')
  })
})

describe('saveLang', () => {
  it('bewaart de taal in localStorage', () => {
    window.localStorage.clear()
    saveLang('en')
    expect(window.localStorage.getItem('lang')).toBe('en')
  })
})

describe('strings', () => {
  it('bevat precies beide talen', () => {
    expect(Object.keys(strings).sort()).toEqual(['en', 'nl'])
  })

  it('houdt de term-sleutels van nl en en gelijk', () => {
    expect(Object.keys(strings.en.term).sort()).toEqual(Object.keys(strings.nl.term).sort())
  })
})

describe('term-bouwers', () => {
  it('formatteert een live ISS-rapport', () => {
    const lines = strings.en.term.issReport({
      latitude: 12.34,
      longitude: -67.89,
      altitude: 420.5,
      velocity: 27500,
      visibility: 'daylight',
    })
    const text = lines.map((l) => l.text).join('\n')
    expect(text).toContain('12.34°, -67.89°')
    expect(text).toContain('420.5 km')
    expect(text).toContain('yes ☀️')
  })

  it('markeert het ISS als in de schaduw buiten daglicht', () => {
    const lines = strings.nl.term.issReport({
      latitude: 0,
      longitude: 0,
      altitude: 0,
      velocity: 0,
      visibility: 'eclipsed',
    })
    expect(lines.some((l) => l.text.includes('schaduw'))).toBe(true)
  })

  it('toont het bezoekers-IP in whoami als dat bekend is', () => {
    expect(strings.en.term.whoamiYou('203.0.113.5')).toContain('203.0.113.5')
    expect(strings.en.term.whoamiYou(null)).toContain('nameless')
  })

  it('echoot het onbekende commando in notFound', () => {
    expect(strings.en.term.notFound('foobar')[0].text).toContain('foobar')
  })
})
