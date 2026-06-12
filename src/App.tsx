import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Loader } from '@react-three/drei'
import Scene from './components/Scene'
import PhotoModal from './components/PhotoModal'
import { profile } from './config'
import { detectLang, saveLang, strings, type Lang } from './i18n'
import { useIss } from './hooks/useIss'

export default function App() {
  const [photoOpen, setPhotoOpen] = useState(false)
  const [lang, setLangState] = useState<Lang>(() => detectLang())
  const iss = useIss()
  const t = strings[lang]

  const setLang = (l: Lang) => {
    saveLang(l)
    setLangState(l)
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const fmt = (n: number, digits = 0) =>
    n.toLocaleString(t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })

  // Fallback-waarden tot de eerste live ISS-meting binnen is
  const altitude = iss ? fmt(iss.altitude, 1) : '408'
  const velocity = iss ? fmt(iss.velocity) : fmt(27580)

  return (
    <>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 1.5, 24], fov: 38 }}>
        <Suspense fallback={null}>
          <Scene lang={lang} setLang={setLang} onOpenPhoto={() => setPhotoOpen(true)} />
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
            <span className="hud-live">{t.hud.live}</span>
          </>
        )}
      </div>
      <div className="hud hud--bl">{t.hud.gravity}</div>
      <div className="hud hud--br">
        <a href={profile.linkedin} target="_blank" rel="noreferrer">
          linkedin
        </a>
      </div>

      <div className="hint">{t.hint}</div>

      {photoOpen && <PhotoModal lang={lang} onClose={() => setPhotoOpen(false)} />}

      {/* Voor zoekmachines en screenreaders */}
      <div className="visually-hidden">
        <h1>{profile.name}</h1>
        <p>{t.bio.join(' ')}</p>
        <a href={profile.linkedin}>LinkedIn — {profile.name}</a>
        <a href={`mailto:${profile.email}`}>E-mail — {profile.name}</a>
      </div>
    </>
  )
}
