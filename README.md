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
| Scheepslogboek | zero-dependency Node-server (`server/server.js`) → publiek `/terminal.log` |
| Hosting | DigitalOcean App Platform (zie hieronder) |

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

De app-spec staat in [`.do/app.yaml`](.do/app.yaml) en draait standaard als
kleine **Node-service** (±$5/maand), zodat het scheepslogboek werkt. Wil je
het zonder logboek gratis hosten, gebruik dan het `static_sites:`-blok dat
als commentaar in de spec staat.

1. **Via het control panel**: [Apps → Create App](https://cloud.digitalocean.com/apps/new)
   → GitHub → kies deze repo, branch `main`. Controleer: build command
   `npm run build`, run command `node server/server.js`, poort 8080.
2. **Of via de CLI**: `doctl apps create --spec .do/app.yaml`
3. **Domeinen**: wijs de DNS van `arjankapteijn.nl` en `arjankapteijn.com`
   naar DigitalOcean (CNAME naar de app-URL of nameservers naar DO DNS),
   un-comment daarna het `domains:`-blok in `.do/app.yaml` en deploy opnieuw.
   De taal van de site volgt automatisch het domein.

Elke push naar `main` triggert daarna automatisch een nieuwe deploy.
Lokaal de productieversie testen: `npm run build && npm start`
(→ http://localhost:8080).

## Live ISS-data

De site gebruikt `https://api.wheretheiss.at/v1/satellites/25544` (gratis,
±1 request/seconde toegestaan; de site pollt elke 15 s):

- **HUD** — echte hoogte, snelheid, positie en of het ISS in het zonlicht
  of in de aardschaduw vliegt.
- **ISS-marker op de globe** — een pulserende groene reticle op de actuele
  positie, met een spoor van eerdere posities. De globe draait langzaam mee
  met het ISS, alsof station AK-01 ernaast meevliegt.
- **Echte zonnestand** — het zonlicht op de aarde volgt het sub-solaire punt
  (`solar_lat`/`solar_lon`), dus de dag/nacht-grens op de globe klopt met de
  werkelijkheid. De laptop heeft eigen sfeerverlichting (three.js layers),
  zodat die er altijd goed uitziet.
- **`iss`-commando** — live rapport in de terminal.

Valt de API weg, dan toont de HUD statische fallback-waarden en blijft de
globe in de laatste stand staan.

## Openbaar scheepslogboek

Alles wat bezoekers in de terminal typen wordt weggeschreven naar een plat
logbestand, **nieuwste bovenaan**, publiek raadpleegbaar op **`/terminal.log`**
(bijv. `https://arjankapteijn.nl/terminal.log`). Regelformaat:

```
[2026-06-12 11:42:07 UTC] 86.82.x.x (nl) % neofetch
```

Hoe het werkt:

- **Lokaal (`npm run dev`)** — een Vite-plugin (zie `vite.config.ts`)
  schrijft naar `public/terminal.log` (genegeerd door git).
- **Productie (`npm run build && npm start`)** — `server/server.js`
  (zero-dependency Node) serveert `dist/` én handelt `POST /api/log` af;
  het logbestand leeft in `dist/terminal.log`. Max. 2000 regels,
  30 posts/minuut per IP.
- **Puur statische hosting** — geen server, dus geen logboek; de site
  werkt verder gewoon en de opstartmelding verschijnt dan niet.

Privacy: de bezoeker ziet zijn eigen volledige IP in de prompt, maar in het
logboek wordt het **gemaskeerd** opgeslagen (`86.82.x.x`) en e-mailinhoud
(onderwerp/bericht) wordt **nooit** gelogd. De terminal meldt het loggen
zelf bij het opstarten. **Let op (AVG):** ook gemaskeerde IP's + tijdstippen
kunnen persoonsgegevens zijn — vermeld het loggen in een privacyverklaring.
En bedenk: wat bezoekers typen is publiek zichtbaar op `/terminal.log`.
NB: op App Platform is het containerbestandssysteem niet persistent — het
log wordt geleegd bij elke deploy. Voor een blijvend logboek: draai
`server.js` op een Droplet of eigen server.

## Credits & licenties

- **MacBook-model** — `mac-draco.glb` uit de officiële
  [pmndrs/examples](https://github.com/pmndrs/examples) (floating-laptop demo),
  CC-BY-4.0.
- **Aarde-textures** — uit de [three.js-voorbeelden](https://threejs.org/examples/)
  (gebaseerd op NASA Blue Marble-beeldmateriaal).
- **HDR-omgeving** — `potsdamer_platz_1k.hdr` via
  [pmndrs/drei-assets](https://github.com/pmndrs/drei-assets) (Poly Haven, CC0).
- **ISS-telemetrie** — [wheretheiss.at](https://wheretheiss.at).
