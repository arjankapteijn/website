import { useEffect } from 'react'
import { profile } from '../config'
import { strings, type Lang } from '../i18n'
import { renderMarkdownLinks } from '../lib/markdown'

interface PhotoModalProps {
  lang: Lang
  onClose: () => void
  onEmail: () => void
}

export default function PhotoModal({ lang, onClose, onEmail }: PhotoModalProps) {
  const t = strings[lang]

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
          <img className="photo-modal__img" src={profile.photo} alt={profile.name} />
          <div>
            <h2>{profile.name}</h2>
            <p className="photo-modal__sub">
              {t.title} · {t.location}
            </p>
          </div>
        </div>
        <p className="photo-modal__bio">{renderMarkdownLinks(t.bio.join(' '))}</p>
        <div className="photo-modal__actions">
          <a href={profile.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          <button type="button" onClick={onEmail}>
            E-mail
          </button>
        </div>
      </div>
    </div>
  )
}
