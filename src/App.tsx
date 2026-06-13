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
        {iss && (
          <>
            <br />
            {iss.latitude.toFixed(1)}° {iss.longitude.toFixed(1)}° ·{' '}
            {iss.visibility === 'daylight' ? `☀ ${t.hud.daylight}` : `● ${t.hud.eclipsed}`}
            <br />
            <span className="hud-live">
              {t.hud.live} · {t.hud.nextUpdate} {String(nextIn).padStart(2, '0')}s
            </span>
          </>
        )}
      </div>
      <div className="hud hud--bl">{t.hud.gravity}</div>
      <div className="hud hud--br">
        <a href={profile.linkedin} target="_blank" rel="noreferrer">
          linkedin
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
