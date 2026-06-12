import { emailEndpoint, profile } from '../config'

export interface EmailDraft {
  subject: string
  body: string
  replyTo?: string
}

/**
 * Verstuur de e-mail via de server (SMTP2GO). Geeft true terug bij succes.
 * Bij false valt de terminal terug op een mailto-link, zodat de
 * functionaliteit ook op statische hosting blijft werken.
 */
export async function sendEmail(draft: EmailDraft, lang: string): Promise<boolean> {
  try {
    const res = await fetch(emailEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, lang }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function mailtoUrl(draft: EmailDraft): string {
  return `mailto:${profile.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
}
