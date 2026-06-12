import { useEffect, useState } from 'react'
import Terminal from './Terminal'
import { profile } from '../config'
import { strings, type Lang } from '../i18n'
import { useIp } from '../lib/log'
import { solarPercent, useSolar } from '../hooks/useSolar'
import './screen.css'

function MenuClock({ locale }: { locale: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const day = now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <span>
      {day} {time}
    </span>
  )
}

interface ScreenProps {
  lang: Lang
  setLang: (lang: Lang) => void
  onOpenPhoto: () => void
}

export default function Screen({ lang, setLang, onOpenPhoto }: ScreenProps) {
  const t = strings[lang]
  const ip = useIp()
  const solar = useSolar()
  return (
    <div className="screen-desktop">
      {/* macOS-menubalk */}
      <div className="screen-menubar">
        <div className="screen-menubar__left">
          <span className="screen-menubar__apple"></span>
          <strong>Terminal</strong>
          {t.menubar.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="screen-menubar__right">
          <span>📶</span>
          {solar ? (
            // het accupercentage = live vermogen van de echte zonnepanelen
            <button
              className="menubar-battery"
              title={t.solar.batteryTitle}
              onClick={() => window.dispatchEvent(new Event('ak:open-solar'))}
            >
              🔋 {solarPercent(solar)}%
            </button>
          ) : (
            <span>🔋 84%</span>
          )}
          <MenuClock locale={t.locale} />
        </div>
      </div>

      {/* foto op het bureaublad */}
      <button className="desktop-photo" onClick={onOpenPhoto} title="arjan.jpg" aria-label={t.photoAlt}>
        <img src={profile.photo} alt={profile.name} draggable={false} />
        <span>arjan.jpg</span>
      </button>

      {/* terminalvenster */}
      <div className="term-window">
        <div className="term-titlebar">
          <span className="term-dot term-dot--red" />
          <span className="term-dot term-dot--yellow" />
          <span className="term-dot term-dot--green" />
          <span className="term-title">{ip ?? (lang === 'nl' ? 'bezoeker' : 'visitor')}@ak-01 — zsh</span>
        </div>
        <Terminal lang={lang} setLang={setLang} onOpenPhoto={onOpenPhoto} />
      </div>
    </div>
  )
}
