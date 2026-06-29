import type { ReactNode } from 'react'

// Zet [label](url)-markdown in i18n-teksten om in klikbare links. Wordt overal
// gebruikt waar bio/teksten getoond worden (terminal, foto-modal, SEO-main),
// zodat de markdown nergens als platte tekst doorlekt.

const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

// Laat de browser-URL-parser het schema bepalen (robuuster dan een regex:
// normaliseert spaties, control-chars en hoofdletters). Alleen expliciet
// veilige schema's worden een link; zo kan teruggeëchote bezoekersinvoer geen
// javascript:/data:-link injecteren.
export function isSafeHref(url: string): boolean {
  try {
    return SAFE_SCHEMES.has(new URL(url, window.location.origin).protocol)
  } catch {
    return false
  }
}

export function renderMarkdownLinks(text: string, linkClassName?: string): ReactNode {
  if (!text.includes('](')) return text
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(MD_LINK_RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(text.slice(last, idx))
    if (isSafeHref(m[2])) {
      out.push(
        <a
          key={idx}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          onClick={(e) => e.stopPropagation()}
        >
          {m[1]}
        </a>,
      )
    } else {
      // onveilig schema: laat de markdown ongemoeid als platte tekst staan
      out.push(m[0])
    }
    last = idx + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
