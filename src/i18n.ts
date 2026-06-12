// ─── Tweetaligheid ──────────────────────────────────────────────────────
// arjankapteijn.nl → Nederlands, arjankapteijn.com → Engels.
// Bezoekers kunnen wisselen met het `lang`-commando in de terminal
// (wordt onthouden in localStorage) of met ?lang=en / ?lang=nl.

export type Lang = 'nl' | 'en'

export type TermLine = { text: string; cls?: string }

export function detectLang(): Lang {
  const param = new URLSearchParams(window.location.search).get('lang')
  if (param === 'nl' || param === 'en') return param
  const stored = window.localStorage.getItem('lang')
  if (stored === 'nl' || stored === 'en') return stored
  const host = window.location.hostname
  if (host.endsWith('.com')) return 'en'
  if (host.endsWith('.nl')) return 'nl'
  return navigator.language?.toLowerCase().startsWith('nl') ? 'nl' : 'en'
}

export function saveLang(lang: Lang) {
  window.localStorage.setItem('lang', lang)
}

const nl = {
  locale: 'nl-NL',
  title: 'Maker van digitale dingen', // TODO: jouw functietitel
  location: 'Nederland',
  // TODO: schrijf hier je eigen bio
  bio: [
    'Hoi! Ik ben Arjan Kapteijn.',
    'Welkom aan boord van mijn persoonlijke ruimtestation.',
    'Hier vertel ik binnenkort meer over wie ik ben en wat ik doe.',
    'Tot die tijd: kijk gerust rond, of stuur me een bericht.',
  ],
  // TODO: vul je eigen skills in
  skills: ['Klantcontact & CX', 'Procesoptimalisatie', 'Technologie & tooling', 'Team leadership'],

  hud: {
    station: 'station ak-01 · lage baan om de aarde',
    altitude: 'hoogte',
    speed: 'snelheid',
    perHour: 'km/u',
    live: 'live iss-data',
    daylight: 'in het zonlicht',
    eclipsed: 'in de schaduw',
    gravity: 'zwaartekracht: uit · koffie: aan boord',
  },
  hint: 'sleep om rond te kijken · klik op het scherm en typ ‘help’',
  loading: 'Verbinding maken met station AK-01…',
  menubar: ['Archief', 'Bewerk', 'Weergave', 'Help'],
  photoAlt: 'Foto van Arjan openen',

  term: {
    boot: [
      { text: 'AK-OS 1.0 — verbinding met station AK-01…', cls: 'dim' },
      { text: '[ ok ] zonnepanelen uitgelijnd', cls: 'ok' },
      { text: '[ ok ] zwaartekracht uitgeschakeld', cls: 'ok' },
      { text: '[ ok ] koffie aan boord', cls: 'ok' },
      { text: '' },
      { text: 'Welkom aan boord. Dit is de persoonlijke site van Arjan Kapteijn.' },
      { text: "Typ 'help' voor een lijst met commando's.", cls: 'accent' },
      { text: '' },
    ] as TermLine[],
    help: [
      { text: 'Beschikbare commando’s:', cls: 'accent' },
      { text: '  about      wie is Arjan?' },
      { text: '  skills     waar is hij goed in?' },
      { text: '  contact    e-mail & LinkedIn' },
      { text: '  email      stuur een e-mail vanuit de terminal' },
      { text: '  photo      open de foto op het bureaublad' },
      { text: '  linkedin   open het LinkedIn-profiel' },
      { text: '  iss        live positie van het échte ISS' },
      { text: '  lang       switch language (lang en / lang nl)' },
      { text: '  neofetch   systeeminfo van deze MacBook' },
      { text: '  clear      maak het scherm leeg' },
      { text: '' },
      { text: '  …en wat je verder op een Mac zou proberen (ls, cat, whoami, sudo…)', cls: 'dim' },
    ] as TermLine[],
    emailIntro: 'Nieuwe e-mail aan',
    emailPrivacy: 'ℹ️  Privacy: deel geen gevoelige of onnodige persoonsgegevens.',
    emailSubjectAsk: 'Wat is het onderwerp? (Enter om te bevestigen, Ctrl+C om te annuleren)',
    emailSubjectEmpty: 'Een leeg onderwerp komt niet door de luchtsluis. Probeer opnieuw.',
    emailBodyAsk: 'En je bericht? (één regel, Enter om te bevestigen)',
    emailBodyEmpty: 'Leeg bericht — toch iets typen graag.',
    emailTo: 'Aan',
    emailSubject: 'Onderwerp',
    emailBody: 'Bericht',
    emailSending: 'Je e-mailprogramma wordt geopend… 📡',
    emailCancelled: 'Verzending geannuleerd.',
    promptSubject: 'onderwerp> ',
    promptBody: 'bericht> ',
    promptConfirm: 'verzenden? (j/n) ',
    yes: ['j', 'ja', 'y', 'yes'],
    linkedinOpening: 'LinkedIn wordt geopend in een nieuw tabblad…',
    photoOpening: 'arjan.jpg wordt geopend…',
    openNotFound: (arg: string) => `open: kan '${arg || '?'}' niet vinden`,
    lsFiles: 'arjan.jpg     over-mij.txt     .geheimen',
    catSecret: 'cat: .geheimen: toegang geweigerd 🔒',
    catPhoto: "cat: arjan.jpg is een afbeelding — probeer 'open arjan.jpg'",
    catNotFound: (arg: string) => `cat: ${arg || '?'}: bestand niet gevonden`,
    catAboutFile: 'over-mij.txt',
    issFetching: 'Live ISS-data ophalen via wheretheiss.at…',
    issError: 'Kon het ISS even niet bereiken. Probeer het zo nog eens.',
    issReport: (d: { latitude: number; longitude: number; altitude: number; velocity: number; visibility: string }) =>
      [
        { text: 'Internationaal ruimtestation (ISS) — live:', cls: 'accent' },
        { text: `  positie    ${d.latitude.toFixed(2)}°, ${d.longitude.toFixed(2)}°` },
        { text: `  hoogte     ${d.altitude.toFixed(1)} km` },
        { text: `  snelheid   ${Math.round(d.velocity).toLocaleString('nl-NL')} km/u` },
        { text: `  zonlicht   ${d.visibility === 'daylight' ? 'ja ☀️' : 'nee, in de schaduw van de aarde 🌑'}` },
        { text: '' },
        { text: '  bron: api.wheretheiss.at', cls: 'dim' },
      ] as TermLine[],
    langCurrent: 'Huidige taal: Nederlands. Gebruik: lang en / lang nl',
    langSwitched: 'Taal ingesteld op Nederlands. 🇳🇱',
    pwd: '/ruimte/laag-baan/ak-01/thuis',
    sudo: [
      { text: 'bezoeker staat niet in het sudoers-bestand.', cls: 'err' },
      { text: 'Dit incident wordt gerapporteerd aan Houston. 🛰️', cls: 'dim' },
      { text: '' },
    ] as TermLine[],
    exit: [
      { text: 'Ontsnappen aan een baan om de aarde kost 7,9 km/s.', cls: 'warn' },
      { text: "Makkelijker: typ 'linkedin'.", cls: 'dim' },
      { text: '' },
    ] as TermLine[],
    notFound: (name: string) =>
      [
        { text: `zsh: command not found: ${name}`, cls: 'err' },
        { text: "Typ 'help' voor de mogelijkheden.", cls: 'dim' },
        { text: '' },
      ] as TermLine[],
    skillsHeader: 'Skills:',
    contactTip: "Tip: typ 'email' om direct vanuit de terminal te mailen.",
    neofetchLines: [
      'Host: MacBook Pro 16" (M1 Max)',
      'Chip: Apple M1 Max · 10-core',
      'Geheugen: 64 GB unified',
      'OS: AK-OS 1.0 (macOS-compatibel)',
      'Shell: zsh 5.9',
      'Locatie: ±420 km boven zeeniveau',
      'Snelheid: ±27.500 km/u',
      'Uptime: sinds lancering',
      'Zwaartekracht: n.v.t.',
    ],
  },
}

const en: typeof nl = {
  locale: 'en-GB',
  title: 'Maker of digital things', // TODO: your job title
  location: 'The Netherlands',
  // TODO: write your own bio
  bio: [
    "Hi! I'm Arjan Kapteijn.",
    'Welcome aboard my personal space station.',
    "Soon I'll share more here about who I am and what I do.",
    'Until then: feel free to look around, or send me a message.',
  ],
  // TODO: fill in your own skills
  skills: ['Customer contact & CX', 'Process optimisation', 'Technology & tooling', 'Team leadership'],

  hud: {
    station: 'station ak-01 · low earth orbit',
    altitude: 'altitude',
    speed: 'velocity',
    perHour: 'km/h',
    live: 'live iss data',
    daylight: 'in daylight',
    eclipsed: 'in shadow',
    gravity: 'gravity: off · coffee: on board',
  },
  hint: 'drag to look around · click the screen and type ‘help’',
  loading: 'Connecting to station AK-01…',
  menubar: ['File', 'Edit', 'View', 'Help'],
  photoAlt: "Open Arjan's photo",

  term: {
    boot: [
      { text: 'AK-OS 1.0 — connecting to station AK-01…', cls: 'dim' },
      { text: '[ ok ] solar panels aligned', cls: 'ok' },
      { text: '[ ok ] gravity disabled', cls: 'ok' },
      { text: '[ ok ] coffee on board', cls: 'ok' },
      { text: '' },
      { text: 'Welcome aboard. This is the personal site of Arjan Kapteijn.' },
      { text: "Type 'help' for a list of commands.", cls: 'accent' },
      { text: '' },
    ],
    help: [
      { text: 'Available commands:', cls: 'accent' },
      { text: '  about      who is Arjan?' },
      { text: '  skills     what is he good at?' },
      { text: '  contact    e-mail & LinkedIn' },
      { text: '  email      send an e-mail from the terminal' },
      { text: '  photo      open the photo on the desktop' },
      { text: '  linkedin   open the LinkedIn profile' },
      { text: '  iss        live position of the real ISS' },
      { text: '  lang       switch language (lang en / lang nl)' },
      { text: '  neofetch   system info for this MacBook' },
      { text: '  clear      clear the screen' },
      { text: '' },
      { text: '  …plus whatever else you’d try on a Mac (ls, cat, whoami, sudo…)', cls: 'dim' },
    ],
    emailIntro: 'New e-mail to',
    emailPrivacy: 'ℹ️  Privacy: please don’t share sensitive or unnecessary personal data.',
    emailSubjectAsk: 'What is the subject? (Enter to confirm, Ctrl+C to cancel)',
    emailSubjectEmpty: 'An empty subject won’t make it through the airlock. Try again.',
    emailBodyAsk: 'And your message? (one line, Enter to confirm)',
    emailBodyEmpty: 'Empty message — please type something.',
    emailTo: 'To',
    emailSubject: 'Subject',
    emailBody: 'Message',
    emailSending: 'Opening your e-mail client… 📡',
    emailCancelled: 'Sending cancelled.',
    promptSubject: 'subject> ',
    promptBody: 'message> ',
    promptConfirm: 'send? (y/n) ',
    yes: ['y', 'yes', 'j', 'ja'],
    linkedinOpening: 'Opening LinkedIn in a new tab…',
    photoOpening: 'Opening arjan.jpg…',
    openNotFound: (arg: string) => `open: cannot find '${arg || '?'}'`,
    lsFiles: 'arjan.jpg     about-me.txt     .secrets',
    catSecret: 'cat: .secrets: permission denied 🔒',
    catPhoto: "cat: arjan.jpg is an image — try 'open arjan.jpg'",
    catNotFound: (arg: string) => `cat: ${arg || '?'}: file not found`,
    catAboutFile: 'about-me.txt',
    issFetching: 'Fetching live ISS data via wheretheiss.at…',
    issError: 'Couldn’t reach the ISS just now. Try again in a moment.',
    issReport: (d) =>
      [
        { text: 'International Space Station (ISS) — live:', cls: 'accent' },
        { text: `  position   ${d.latitude.toFixed(2)}°, ${d.longitude.toFixed(2)}°` },
        { text: `  altitude   ${d.altitude.toFixed(1)} km` },
        { text: `  velocity   ${Math.round(d.velocity).toLocaleString('en-GB')} km/h` },
        { text: `  sunlight   ${d.visibility === 'daylight' ? 'yes ☀️' : 'no, in Earth’s shadow 🌑'}` },
        { text: '' },
        { text: '  source: api.wheretheiss.at', cls: 'dim' },
      ],
    langCurrent: 'Current language: English. Usage: lang en / lang nl',
    langSwitched: 'Language set to English. 🇬🇧',
    pwd: '/space/low-earth-orbit/ak-01/home',
    sudo: [
      { text: 'visitor is not in the sudoers file.', cls: 'err' },
      { text: 'This incident will be reported to Houston. 🛰️', cls: 'dim' },
      { text: '' },
    ],
    exit: [
      { text: 'Escaping Earth orbit takes 7.9 km/s.', cls: 'warn' },
      { text: "Easier: type 'linkedin'.", cls: 'dim' },
      { text: '' },
    ],
    notFound: (name: string) => [
      { text: `zsh: command not found: ${name}`, cls: 'err' },
      { text: "Type 'help' to see what's possible.", cls: 'dim' },
      { text: '' },
    ],
    skillsHeader: 'Skills:',
    contactTip: "Tip: type 'email' to send a mail straight from the terminal.",
    neofetchLines: [
      'Host: MacBook Pro 16" (M1 Max)',
      'Chip: Apple M1 Max · 10-core',
      'Memory: 64 GB unified',
      'OS: AK-OS 1.0 (macOS-compatible)',
      'Shell: zsh 5.9',
      'Location: ±420 km above sea level',
      'Velocity: ±27,500 km/h',
      'Uptime: since launch',
      'Gravity: n/a',
    ],
  },
}

export const strings: Record<Lang, typeof nl> = { nl, en }
