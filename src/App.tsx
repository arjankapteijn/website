import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Loader } from '@react-three/drei'
import Scene from './components/Scene'
import PhotoModal from './components/PhotoModal'
import SolarModal from './components/SolarModal'
import { profile } from './config'
import { detectLang, saveLang, strings, type Lang } from './i18n'
import { ISS_INTERVAL_MS, useIss } from './hooks/useIss'

export default function App() {
  const [photoOpen, setPhotoOpen] = useState(false)
  const [solarOpen, setSolarOpen] = useState(false)
  const [lang, setLangState] = useState<Lang>(() => detectLang())
  const iss = useIss()
  const t = strings[lang]

  const setLang = (l: Lang) => {
    saveLang(l)
    setLangState(l)
  }

  // aftellen naar de volgende ISS-meting; iedere nieuwe meting reset de teller
  const [nextIn, setNextIn] = useState(ISS_INTERVAL_MS / 1000)
  useEffect(() => {
    if (!iss) return
    const arrived = Date.now()
    const id = setInterval(
      () => setNextIn(Math.max(0, Math.round((ISS_INTERVAL_MS - (Date.now() - arrived)) / 1000))),
      500,
    )
    return () => clearInterval(id)
  }, [iss])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // de accu in de menubalk (op het 3D-scherm) opent de zonnepanelen-popup
  useEffect(() => {
    const open = () => setSolarOpen(true)
    window.addEventListener('ak:open-solar', open)
    return () => window.removeEventListener('ak:open-solar', open)
  }, [])

  const fmt = (n: number, digits = 0) =>
    n.toLocaleString(t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })

  // Fallback-waarden tot de eerste live ISS-meting binnen is
  const altitude = iss ? fmt(iss.altitude, 1) : '408'
  const velocity = iss ? fmt(iss.velocity) : fmt(27580)

  return (
    <>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 1.5, 24], fov: 38 }}>
        <Suspense fallback={null}>
          <Scene lang={lang} setLang={setLang} iss={iss} onOpenPhoto={() => setPhotoOpen(true)} />
        </Suspense>
      </Canvas>
      <Loader />

      <div className="vignette" />

      <div className="hud hud--tl">
        <strong>{profile.name}</strong>
        {t.hud.station}
      </div>
      <div className="hud hud--tr">
        {t.hud.altitude} {altitude} km
        <br />
        {t.hud.speed} {velocity} {t.hud.perHour}
        <br />
        {iss ? (
          <>
            {iss.latitude.toFixed(1)}° {iss.longitude.toFixed(1)}° ·{' '}
            {iss.visibility === 'daylight' ? `☀ ${t.hud.daylight}` : `● ${t.hud.eclipsed}`}
            <br />
            <span className="hud-live">
              {t.hud.live} · {t.hud.nextUpdate} {String(nextIn).padStart(2, '0')}s
            </span>
          </>
        ) : (
          <span className="hud-live hud-live--connecting">{t.hud.connecting}</span>
        )}
      </div>
      <div className="hud hud--bl">{t.hud.gravity}</div>
      <div className="hud hud--br hud--social">
        <a href={profile.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" title="LinkedIn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
          </svg>
        </a>
        <a href={profile.github} target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub — broncode">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
        </a>
      </div>

      <div className="hint">
        <span className="hint-drag">{t.hintDrag} · </span>
        {t.hintAction}
      </div>

      {photoOpen && (
        <PhotoModal
          lang={lang}
          onClose={() => setPhotoOpen(false)}
          onEmail={() => {
            // modal dicht en de e-mailflow in de terminal starten
            setPhotoOpen(false)
            window.dispatchEvent(new Event('ak:start-email'))
          }}
        />
      )}

      {solarOpen && <SolarModal lang={lang} onClose={() => setSolarOpen(false)} />}

      {/* Voor zoekmachines en screenreaders — tevens het main-landmark */}
      <main className="visually-hidden">
        <h1>{profile.name}</h1>
        <p>{t.bio.join(' ')}</p>
        <a href={profile.linkedin}>LinkedIn — {profile.name}</a>
        <a href={`mailto:${profile.email}`}>E-mail — {profile.name}</a>
      </main>
    </>
  )
}
