// ─── Persoonlijke gegevens (taalonafhankelijk) ──────────────────────────
// Teksten per taal (bio, titel, skills) staan in src/i18n.ts.

export const profile = {
  name: 'Arjan Kapteijn',

  // Let op: een mailto-adres op een publieke site kan door
  // spam-scrapers worden opgepikt.
  email: 'info@arjankapteijn.nl',

  linkedin: 'https://www.linkedin.com/in/arjankapteijn/',
  github: 'https://github.com/arjankapteijn/website',

  photo: '/photo.webp',
}

// E-mail wordt server-side verstuurd via SMTP2GO (zie server/server.js);
// als dat endpoint niet bestaat (bijv. statische hosting) valt de
// terminal terug op een mailto-link.
export const emailEndpoint = '/api/email'

// ─── Scheepslogboek ─────────────────────────────────────────────────────
// Getypte commando's worden als Signal-bericht gepusht (server-side via
// de signal-cli-rest-api; zie server/server.js). Zowel lokaal (Vite-plugin)
// als in productie; zonder Signal-config staat het logboek vanzelf uit.
// NB: e-mailinhoud wordt bewust NOOIT gelogd.
export const logging = {
  endpoint: '/api/log',
}

// ─── Zonnepanelen ───────────────────────────────────────────────────────
// Het accupercentage in de menubalk is het actuele vermogen van de echte
// zonnepanelen, server-side opgehaald bij SolarEdge (zie server/server.js).
export const solar = {
  endpoint: '/api/solar',
  inverter: 'SolarEdge HD-Wave 3000',
  panels: 9,
  panelType: 'Heckert NeMo 2.0',
  panelWatt: 300, // Wp per paneel
  peakWatt: 2700, // 9 × 300 Wp = 2,7 kWp
}

// ─── Hosting / homelab ──────────────────────────────────────────────────
// Het icoontje in de menubalk toont live cpu-gebruik van de machine die
// deze site host; klikken opent een modal met specs + cpu/geheugen/schijf,
// rechtstreeks via /proc (zie server/host.js) - geen cloud-API, geen
// credentials.
export const hosting = {
  endpoint: '/api/host',
  pollMs: 15_000,
  // Specs opgevraagd via SSH op de homelab-machine zelf (2026-09-17,
  // ram bijgewerkt na de uitbreiding diezelfde middag)
  machine: 'Lenovo ThinkCentre M710q',
  cpu: 'Intel i5-7500T @ 2,70GHz',
  ram: '16 GB DDR4',
  storage: '1 TB NVME',
  // Werkelijke bruikbare pool-capaciteit (used+available via `zfs get`) - ZFS
  // geeft via de gewone filesystem-call geen totale pool-grootte terug, dus
  // dit staat hier als vaste waarde, net als de rest van de specs hierboven
  storageTotalGb: 915,
}
