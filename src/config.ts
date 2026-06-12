// ─── Persoonlijke gegevens (taalonafhankelijk) ──────────────────────────
// Teksten per taal (bio, titel, skills) staan in src/i18n.ts.

export const profile = {
  name: 'Arjan Kapteijn',

  // Let op: een mailto-adres op een publieke site kan door
  // spam-scrapers worden opgepikt.
  email: 'info@arjankapteijn.nl',

  linkedin: 'https://www.linkedin.com/in/arjankapteijn/',

  photo: '/photo.jpg',
}

// E-mail wordt server-side verstuurd via SMTP2GO (zie server/server.js);
// als dat endpoint niet bestaat (bijv. statische hosting) valt de
// terminal terug op een mailto-link.
export const emailEndpoint = '/api/email'

// ─── Scheepslogboek ─────────────────────────────────────────────────────
// Getypte commando's worden weggeschreven naar een plat logbestand,
// nieuwste bovenaan, raadpleegbaar op /terminal.log (niet gelinkt vanuit
// de interface). Lokaal regelt een Vite-plugin dit (public/terminal.log);
// in productie server/server.js. Zonder server staat het logboek
// vanzelf uit. NB: e-mailinhoud wordt bewust NOOIT gelogd en
// IP-adressen worden gemaskeerd opgeslagen.
export const logging = {
  endpoint: '/api/log',
}
