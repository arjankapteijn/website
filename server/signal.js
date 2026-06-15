// Minimale client voor de signal-cli-rest-api (bbernhard): één POST naar
// /v2/send met {message, number, recipients}. Zero-dependency — leunt op
// de globale fetch (Node 18+). Een note-to-self bereik je door het eigen
// geregistreerde nummer als recipient mee te geven.

/**
 * Verstuur één Signal-bericht. Gooit een Error bij een niet-2xx-respons
 * of een time-out (15 s).
 * opts: { url, number, recipients: string[], message, textMode? }
 * textMode 'styled' → Signal rendert Markdown (**vet**, *cursief*,
 * ~~doorhalen~~, `monospace`, ||spoiler||).
 */
export async function sendSignal({ url, number, recipients, message, textMode }) {
  const body = { message, number, recipients }
  if (textMode) body.text_mode = textMode
  const res = await fetch(`${url.replace(/\/+$/, '')}/v2/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Signal-API status ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
}

/**
 * Eén logboekregel als styled Signal-bericht: vette kop, commando in
 * monospace, meta-regel eronder. Tijd/datum laten we weg — die toont
 * Signal zelf al. Verstuur met textMode 'styled'.
 * location (optioneel) → grove herkomst, bijv. "📍 Amsterdam, NL".
 */
export function formatLogMessage({ ip, lang, command, location }) {
  let meta = `${ip} · ${lang}`
  if (location) meta += ` · 📍 ${location}`
  return `🛰️ **AK-01 · scheepslogboek**\n\`${command}\`\n${meta}`
}
