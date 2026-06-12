// ─── Persoonlijke gegevens (taalonafhankelijk) ──────────────────────────
// Teksten per taal (bio, titel, skills) staan in src/i18n.ts.

export const profile = {
  name: 'Arjan Kapteijn',

  // Let op: een mailto-adres op een publieke site kan door
  // spam-scrapers worden opgepikt.
  email: 'info@arjankapteijn.nl',

  linkedin: 'https://www.linkedin.com/in/arjankapteijn/',

  // Vervang public/photo.svg door een echte foto (bijv. public/photo.jpg)
  // en pas dit pad aan.
  photo: '/photo.svg',
}

// ─── Openbaar scheepslogboek ────────────────────────────────────────────
// Getypte commando's worden weggeschreven naar een plat logbestand,
// nieuwste bovenaan, publiek raadpleegbaar op /terminal.log.
// Lokaal regelt een Vite-plugin dit (schrijft naar public/terminal.log);
// in productie doet server/server.js dat. Op puur statische hosting
// (zonder server) staat het logboek vanzelf uit.
// NB: e-mailinhoud (onderwerp/bericht) wordt bewust NOOIT gelogd en
// IP-adressen worden gemaskeerd opgeslagen.
export const logging = {
  endpoint: '/api/log',
  file: '/terminal.log',
}
