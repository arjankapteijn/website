# arjankapteijn.nl / arjankapteijn.com

Persoonlijke site van Arjan Kapteijn: een zwevende MacBook in een baan om de
aarde, met een interactieve terminal die bezoekers zelf kunnen bedienen.
De HUD toont **live telemetrie van het echte ISS** en de site is tweetalig
(Nederlands op `.nl`, Engels op `.com`).

*Personal site of Arjan Kapteijn — a floating MacBook in low Earth orbit with
an interactive terminal. Dutch on `.nl`, English on `.com`.*

## Stack

| Onderdeel | Technologie |
|---|---|
| Build & dev server | [Vite](https://vite.dev) + TypeScript |
| UI | React 19 |
| 3D | [Three.js](https://threejs.org) via [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) + [@react-three/drei](https://github.com/pmndrs/drei) |
| Terminal op het scherm | drei `<Html transform occlude>` + eigen React-component |
| Live ISS-data | [wheretheiss.at API](https://wheretheiss.at/w/developer) (satelliet 25544, geen key nodig) |
| E-mail | `mailto:` (geen backend) |
| Hosting | DigitalOcean App Platform (statische site, zie hieronder) |

Alle assets (3D-model, textures, DRACO-decoder, HDR) worden lokaal geserveerd
— geen runtime-afhankelijkheden van externe CDN's behalve de ISS-API.

## Terminal-commando's

Klik op het MacBook-scherm en typ:

| Commando | Doet |
|---|---|
| `help` | lijst met commando's |
| `about` / `bio` | wie is Arjan? |
| `whoami` | naam + titel |
| `skills` | vaardigheden |
| `contact` | e-mail & LinkedIn |
| `email` | stuur een e-mail vanuit de terminal (onderwerp → bericht → bevestigen, opent je mailprogramma) |
| `photo` / `open arjan.jpg` | opent de foto op het bureaublad |
| `linkedin` | opent het LinkedIn-profiel |
| `iss` | live positie, hoogte en snelheid van het échte ISS |
| `lang en` / `lang nl` | wissel van taal (wordt onthouden) |
| `neofetch` | systeeminfo van deze MacBook (M1 Max 😉) |
| `date`, `pwd`, `ls`, `cat`, `echo` | doen wat je verwacht |
| `clear` | scherm leegmaken |
| `sudo …`, `exit` | probeer maar 😄 |

Pijltje omhoog/omlaag bladert door de commandogeschiedenis. De foto op het
bureaublad is ook direct aanklikbaar.

## Ontwikkelen

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # productiebuild in dist/
npm run preview  # test de productiebuild lokaal
```

## Personaliseren

- **Identiteit & links** — `src/config.ts` (naam, e-mail, LinkedIn, foto-pad).
- **Teksten per taal** — `src/i18n.ts` (bio, titel, skills, alle UI- en
  terminalteksten; de TODO-markers wachten op echte content).
- **Foto** — vervang `public/photo.svg` door een echte foto (vierkant werkt
  het mooist) en pas `photo` in `src/config.ts` aan.
- **Terminal-commando's** — `src/components/Terminal.tsx`.

### Taaldetectie

`.nl`-domein → Nederlands, `.com`-domein → Engels. Daarbuiten (bijv. lokaal)
volgt de site de browsertaal. Overschrijven kan met `?lang=en|nl` in de URL
of het `lang`-commando in de terminal (opgeslagen in localStorage).

## Deployen op DigitalOcean App Platform

De app-spec staat in [`.do/app.yaml`](.do/app.yaml). Statische sites zijn
gratis op App Platform (max. 3 per account).

1. **Via het control panel**: [Apps → Create App](https://cloud.digitalocean.com/apps/new)
   → GitHub → kies deze repo, branch `main`. Controleer: build command
   `npm run build`, output directory `dist`. Deploy.
2. **Of via de CLI**: `doctl apps create --spec .do/app.yaml`
3. **Domeinen**: wijs de DNS van `arjankapteijn.nl` en `arjankapteijn.com`
   naar DigitalOcean (CNAME naar de app-URL of nameservers naar DO DNS),
   un-comment daarna het `domains:`-blok in `.do/app.yaml` en deploy opnieuw.
   De taal van de site volgt automatisch het domein.

Elke push naar `main` triggert daarna automatisch een nieuwe deploy.

## Live ISS-data

De hoogte/snelheid in de HUD en het `iss`-commando komen van
`https://api.wheretheiss.at/v1/satellites/25544` (gratis, ±1 request/seconde
toegestaan; de site pollt elke 15 s). Valt de API weg, dan toont de HUD
statische fallback-waarden.

## Credits & licenties

- **MacBook-model** — `mac-draco.glb` uit de officiële
  [pmndrs/examples](https://github.com/pmndrs/examples) (floating-laptop demo),
  CC-BY-4.0.
- **Aarde-textures** — uit de [three.js-voorbeelden](https://threejs.org/examples/)
  (gebaseerd op NASA Blue Marble-beeldmateriaal).
- **HDR-omgeving** — `potsdamer_platz_1k.hdr` via
  [pmndrs/drei-assets](https://github.com/pmndrs/drei-assets) (Poly Haven, CC0).
- **ISS-telemetrie** — [wheretheiss.at](https://wheretheiss.at).
