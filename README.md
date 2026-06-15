# arjankapteijn.nl / arjankapteijn.com

Persoonlijke site van Arjan Kapteijn: een zwevende MacBook in een baan om de
aarde, met een interactieve terminal die bezoekers zelf kunnen bedienen.
De HUD toont **live telemetrie van het echte ISS** en de site is tweetalig
(Nederlands op `.nl`, Engels op `.com`).

*Personal site of Arjan Kapteijn — a floating MacBook in low Earth orbit with
an interactive terminal. Dutch on `.nl`, English on `.com`.*

[![CI](https://github.com/arjankapteijn/website/actions/workflows/ci.yml/badge.svg)](https://github.com/arjankapteijn/website/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/Node-24_LTS-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?logo=threedotjs&logoColor=white)

## Stack

| Onderdeel | Technologie |
|---|---|
| Build & dev server | [Vite](https://vite.dev) + TypeScript |
| UI | React 19 |
| 3D | [Three.js](https://threejs.org) via [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) + [@react-three/drei](https://github.com/pmndrs/drei) |
| Terminal op het scherm | drei `<Html transform occlude>` + eigen React-component |
| Live ISS-data | [wheretheiss.at API](https://wheretheiss.at/w/developer) (satelliet 25544, geen key nodig) |
| E-mail | server-side via [SMTP2GO](https://www.smtp2go.com) (`server/smtp.js`, zero-dependency); fallback `mailto:` |
| Scheepslogboek | getypte commando's als Signal-push via [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api) (`server/signal.js`) |
| Hosting | Docker-container op TrueNAS, achter Nginx Proxy Manager (Let's Encrypt) |

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
| `email` | stuur een e-mail vanuit de terminal (onderwerp → bericht → optioneel antwoordadres → bevestigen; verzonden via SMTP2GO) |
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
- **Foto** — `public/photo.jpg` (vierkant, 800×800).
- **Terminal-commando's** — `src/components/Terminal.tsx`.

### Taaldetectie

`.nl`-domein → Nederlands, `.com`-domein → Engels. Daarbuiten (bijv. lokaal)
volgt de site de browsertaal. Overschrijven kan met `?lang=en|nl` in de URL
of het `lang`-commando in de terminal (opgeslagen in localStorage).

## Deployen op TrueNAS (Docker + Nginx Proxy Manager)

De site draait als kleine, gehardende Docker-container
([Dockerfile](Dockerfile) + [docker-compose.yml](docker-compose.yml)):
multi-stage build (geen node_modules in het eindimage), draait als
niet-root (uid 10001), `read_only` rootfs, alle capabilities gedropt,
`no-new-privileges`, geheugen- en pids-limiet, en een healthcheck op
`/healthz`. De rootfs is volledig read-only — er wordt niets weggeschreven
(het logboek gaat via Signal).

Het image wordt door **GitHub Actions** gebouwd en als privé-image naar
**ghcr.io** gepusht (`ghcr.io/arjankapteijn/website`, zie
[docker-publish.yml](.github/workflows/docker-publish.yml)). Op TrueNAS
hoef je dus niet meer te klonen of te bouwen — alleen te pullen.

### Eenmalig: inloggen bij ghcr.io

Omdat het image privé is, moet de TrueNAS-host één keer inloggen bij de
registry. Maak op GitHub een **Personal Access Token (classic)** met enkel
de scope `read:packages` en log in via SSH:

```bash
echo <TOKEN> | docker login ghcr.io -u arjankapteijn --password-stdin
```

De credentials komen in `~/.docker/config.json` te staan en blijven geldig
voor toekomstige pulls.

### Eerste keer uitrollen

```bash
# op de TrueNAS-host (SSH), bijv. in /mnt/<pool>/apps:
git clone https://github.com/arjankapteijn/website.git arjankapteijn
cd arjankapteijn
cp .env.example .env && nano .env   # SMTP2GO-wachtwoord invullen
docker compose pull                 # haalt het image van ghcr.io
docker compose up -d
curl http://localhost:8090/healthz  # → ok
```

NB: een container die je zo via SSH start draait prima (en herstart
automatisch dankzij `restart: unless-stopped`), maar verschijnt **niet**
op de Apps-pagina van TrueNAS — die toont alleen apps die via de eigen
middleware zijn geïnstalleerd. De "Containers"-toggle (Incus-virtualisatie
voor VM's/LXC) staat hier ook los van en kan gewoon uit blijven.

### Optioneel: zichtbaar maken in de TrueNAS Apps-UI

Wil je een start/stop-knop, status én een **Update-knop** in de
webinterface, registreer de container dan als custom app via
**Apps → Discover Apps → ⋮ → Install via YAML**, naam `arjankapteijn`,
met deze inhoud (absolute paden, kant-en-klaar image van ghcr.io):

```yaml
services:
  website:
    image: ghcr.io/arjankapteijn/website:latest
    container_name: arjankapteijn-website
    restart: unless-stopped
    ports:
      - '8090:8080'
    env_file: /mnt/<pool>/apps/arjankapteijn/.env
    read_only: true
    cap_drop: [ALL]
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:size=8m
    mem_limit: 256m
    pids_limit: 64
```

(De host-login bij ghcr.io uit de vorige stap geldt ook hier.) Zodra
GitHub Actions een nieuw image onder de `latest`-tag pusht, toont TrueNAS
bij de app een **Update**-knop — één klik en de nieuwe versie draait.

### Achter Nginx Proxy Manager (Let's Encrypt)

1. NPM → **Hosts → Proxy Hosts → Add**:
   domains `arjankapteijn.nl, www.arjankapteijn.nl`,
   scheme `http`, forward host = IP van je TrueNAS, forward port `8090`
   (de host-poort uit `docker-compose.yml`).
   Vink **Block Common Exploits** aan (websockets niet nodig).
2. Tab **SSL**: *Request a new SSL certificate* (Let's Encrypt),
   **Force SSL** + **HTTP/2** aan.
3. Herhaal voor `arjankapteijn.com, www.arjankapteijn.com` (zelfde
   forward) — de site toont dan automatisch Engels.
4. DNS van beide domeinen → je publieke IP (A-record), en poort 80/443
   geforward naar NPM.

NPM stuurt `X-Forwarded-For` standaard mee, zodat de prompt en de
Signal-melding het echte bezoekers-IP zien.

### Updaten

Push je naar `main`, dan bouwt GitHub Actions automatisch een nieuw image.
Uitrollen kan dan op twee manieren — geen `git pull`, geen lokale build:

- **TrueNAS Apps-UI:** klik op de **Update**-knop bij de app.
- **Via SSH:**
  ```bash
  cd /mnt/<pool>/apps/arjankapteijn
  docker compose pull && docker compose up -d
  ```

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

## E-mail via SMTP2GO

Het `email`-commando POST naar `/api/email`; `server/server.js` verstuurt
de mail via SMTP2GO (impliciete TLS, poort 465) naar `MAIL_TO`. Het
optionele antwoordadres van de bezoeker komt in de `Reply-To`-header,
dus beantwoorden werkt gewoon vanuit je mailprogramma. Configuratie via
`.env` (zie [.env.example](.env.example)); max. 4 mails per minuut per
IP. Zonder SMTP-configuratie (of op statische hosting) valt de terminal
automatisch terug op een `mailto:`-link.

**Let op:** het `MAIL_FROM`-domein moet in SMTP2GO als sender domain
geverifieerd zijn, en commit `.env` nooit (staat in `.gitignore`).

## Scheepslogboek (Signal)

Alles wat bezoekers in de terminal typen wordt als los **Signal-bericht**
gepusht via een zelf-gehoste [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api).
`server/server.js` handelt `POST /api/log` af en stuurt via `server/signal.js`
een `POST /v2/send`. Berichtformaat:

```
[2026-06-12 11:42:07 UTC] 86.82.123.45 (nl) % neofetch
```

Hoe het werkt:

- **Config** (`.env`, zie [.env.example](.env.example)): `SIGNAL_API_URL`,
  `SIGNAL_NUMBER` (het geregistreerde afzendernummer) en optioneel
  `SIGNAL_RECIPIENTS` (komma-gescheiden; leeg = note-to-self). Ontbreekt de
  config, dan staat het logboek vanzelf uit (`501`, de client faalt stil).
- **Lokaal én productie** delen dezelfde `sendSignal()` (een Vite-plugin
  spiegelt in dev het productiegedrag). Max. 30 posts/minuut per IP.

**Privacy / AVG:** het volledige bezoekers-IP gaat **onverkort** mee in de
Signal-melding (bewuste keuze). E-mailinhoud (onderwerp/bericht) wordt
**nooit** gelogd. IP's + tijdstippen zijn persoonsgegevens, en de interface
meldt niet dát er gelogd wordt — vermeld dit dus zelf in een
privacyverklaring. Houd er rekening mee dat je hiermee bezoekers-IP's naar
een Signal-kanaal stuurt.

## Credits & licenties

- **MacBook-model** — `mac-draco.glb` uit de officiële
  [pmndrs/examples](https://github.com/pmndrs/examples) (floating-laptop demo),
  CC-BY-4.0.
- **Aarde-textures** — uit de [three.js-voorbeelden](https://threejs.org/examples/)
  (gebaseerd op NASA Blue Marble-beeldmateriaal).
- **HDR-omgeving** — `potsdamer_platz_1k.hdr` via
  [pmndrs/drei-assets](https://github.com/pmndrs/drei-assets) (Poly Haven, CC0).
- **ISS-telemetrie** — [wheretheiss.at](https://wheretheiss.at).
