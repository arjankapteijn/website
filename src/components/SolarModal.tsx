import { useEffect } from 'react'
import { solar } from '../config'
import { strings, type Lang } from '../i18n'
import { solarPercent, useSolar } from '../hooks/useSolar'

interface SolarModalProps {
  lang: Lang
  onClose: () => void
}

export default function SolarModal({ lang, onClose }: SolarModalProps) {
  const t = strings[lang].solar
  const locale = strings[lang].locale
  const data = useSolar()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const kwh = (wh: number, digits = 1) =>
    `${(wh / 1000).toLocaleString(locale, { maximumFractionDigits: digits })} kWh`
  const peakKwp = (solar.peakWatt / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })

  return (
    <div className="photo-modal-backdrop" onClick={onClose}>
      <div className="photo-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="photo-modal__close" onClick={onClose} aria-label={lang === 'nl' ? 'Sluiten' : 'Close'}>
          ×
        </button>
        <div className="photo-modal__header">
          <div className="solar-modal__icon" aria-hidden="true">
            ☀️
          </div>
          <div>
            <h2>{t.title}</h2>
            <p className="photo-modal__sub">{t.subtitle}</p>
          </div>
        </div>
        <p className="photo-modal__bio">{t.intro}</p>
        {data ? (
          <dl className="solar-stats">
            <dt>{t.current}</dt>
            <dd>
              {Math.round(data.power).toLocaleString(locale)} W · {solarPercent(data)}% {t.ofPeak}
            </dd>
            <dt>{t.today}</dt>
            <dd>{kwh(data.today)}</dd>
            <dt>{t.month}</dt>
            <dd>{kwh(data.month)}</dd>
            <dt>{t.lifetime}</dt>
            <dd>{kwh(data.lifetime, 0)}</dd>
            <dt>{t.system}</dt>
            <dd>
              {solar.panels} × {solar.panelType} ({solar.panelWatt} Wp) · {peakKwp} kWp
            </dd>
          </dl>
        ) : (
          <p className="photo-modal__bio">{t.noData}</p>
        )}
        <p className="solar-source">
          {t.source}
          {data?.updatedAt ? ` · ${t.updated}: ${data.updatedAt}` : ''}
        </p>
      </div>
    </div>
  )
}
