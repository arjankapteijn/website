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
// vanzelf uit. NB: e-mailinhoud wordt bewust NOOIT gelogd.
export const logging = {
  endpoint: '/api/log',
}

// ─── Zonnepanelen ───────────────────────────────────────────────────────
// Het accupercentage in de menubalk is het actuele vermogen van de echte
// zonnepanelen, server-side opgehaald bij SolarEdge (zie server/server.js).
export const solar = {
  endpoint: '/api/solar',
  panels: 9,
  panelType: 'Heckert Nemo 2.0',
  panelWatt: 300, // Wp per paneel
  peakWatt: 2700, // 9 × 300 Wp = 2,7 kWp
}
