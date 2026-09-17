import { useEffect } from 'react'
import { hosting } from '../config'
import { strings, type Lang } from '../i18n'
import { useHostStats } from '../hooks/useHostStats'
import { formatUptime } from '../lib/format'

interface HostModalProps {
  lang: Lang
  onClose: () => void
}

export default function HostModal({ lang, onClose }: HostModalProps) {
  const t = strings[lang].hosting
  const locale = strings[lang].locale
  const data = useHostStats()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="photo-modal-backdrop" onClick={onClose}>
      <div className="photo-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="photo-modal__close" onClick={onClose} aria-label={lang === 'nl' ? 'Sluiten' : 'Close'}>
          ×
        </button>
        <div className="photo-modal__header">
          <div className="photo-modal__icon" aria-hidden="true">
            🏠
          </div>
          <div>
            <h2>{t.title}</h2>
            <p className="photo-modal__sub">{t.subtitle}</p>
          </div>
        </div>
        <p className="photo-modal__bio">{t.intro}</p>
        <dl className="photo-modal__stats">
          <dt>{t.machine}</dt>
          <dd>{hosting.machine}</dd>
          <dt>{t.specCpu}</dt>
          <dd>
            {hosting.cpu}
            {data && ` (${Math.round(data.cpu)}%)`}
          </dd>
          <dt>{t.specRam}</dt>
          <dd>
            {hosting.ram}
            {data && ` (${data.memPercent}%)`}
          </dd>
          <dt>{t.specStorage}</dt>
          <dd>
            {hosting.storage}
            {data && ` (${Math.round((1 - data.diskAvailGb / hosting.storageTotalGb) * 100)}%)`}
          </dd>
          {data && (
            <>
              <dt>{t.uptime}</dt>
              <dd>{formatUptime(data.uptimeSec, t.uptimeUnit, t.sinceLaunch)}</dd>
            </>
          )}
        </dl>
        {!data && <p className="photo-modal__bio">{t.noData}</p>}
        <p className="photo-modal__source">
          {t.source}
          {data?.updatedAt && (
            <>
              <br />
              {t.updated}: {new Date(data.updatedAt).toLocaleTimeString(locale)}
            </>
          )}
        </p>
      </div>
    </div>
  )
}
