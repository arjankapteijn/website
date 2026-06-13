// Minimale client voor de signal-cli-rest-api (bbernhard): één POST naar
// /v2/send met {message, number, recipients}. Zero-dependency — leunt op
// de globale fetch (Node 18+). Een note-to-self bereik je door het eigen
// geregistreerde nummer als recipient mee te geven.

/**
 * Verstuur één Signal-bericht. Gooit een Error bij een niet-2xx-respons
 * of een time-out (15 s).
 * opts: { url, number, recipients: string[], message }
 */
export async function sendSignal({ url, number, recipients, message }) {
  const res = await fetch(`${url.replace(/\/+$/, '')}/v2/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, number, recipients }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Signal-API status ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
}
