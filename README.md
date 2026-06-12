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
| E-mail | server-side via [SMTP2GO](https://www.smtp2go.com) (`server/smtp.js`, zero-dependency); fallback `mailto:` |
| Scheepslogboek | zero-dependency Node-server (`server/server.js`) → `/terminal.log` |
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
`/healthz`. Alleen het `/data`-volume (scheepslogboek) is schrijfbaar.

### Eerste keer uitrollen

```bash
# op de TrueNAS-host (SSH), bijv. in /mnt/<pool>/apps:
git clone https://github.com/arjankapteijn/website.git arjankapteijn
cd arjankapteijn
cp .env.example .env && nano .env   # SMTP2GO-wachtwoord invullen
docker compose up -d --build
curl http://localhost:8090/healthz  # → ok
```

NB: een container die je zo via SSH start draait prima (en herstart
automatisch dankzij `restart: unless-stopped`), maar verschijnt **niet**
op de Apps-pagina van TrueNAS — die toont alleen apps die via de eigen
middleware zijn geïnstalleerd. De "Containers"-toggle (Incus-virtualisatie
voor VM's/LXC) staat hier ook los van en kan gewoon uit blijven.

### Optioneel: zichtbaar maken in de TrueNAS Apps-UI

Wil je een start/stop-knop en status in de webinterface, registreer de
container dan als custom app:

```bash
cd /mnt/<pool>/apps/arjankapteijn
docker compose down          # stop de CLI-versie
docker compose build         # image lokaal bouwen/verversen
```

Dan **Apps → Discover Apps → ⋮ → Install via YAML**, naam
`arjankapteijn`, met deze inhoud (absolute paden, vooraf gebouwd image):

```yaml
services:
  website:
    image: arjankapteijn-website
    container_name: arjankapteijn-website
    restart: unless-stopped
    ports:
      - '8090:8080'
    env_file: /mnt/<pool>/apps/arjankapteijn/.env
    volumes:
      - /mnt/<pool>/apps/arjankapteijn/data:/data
    read_only: true
    cap_drop: [ALL]
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:size=8m
    mem_limit: 256m
    pids_limit: 64
```

Updaten gaat dan met `git pull && docker compose build` gevolgd door een
restart van de app in de UI.

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

NPM stuurt `X-Forwarded-For` standaard mee, zodat de prompt en het
logboek het echte bezoekers-IP zien.

### Updaten

```bash
cd /mnt/<pool>/apps/arjankapteijn
git pull && docker compose up -d --build
```

Het logboek in `./data/` blijft staan. Lokaal de productieversie testen:
`npm run build && npm start` (→ http://localhost:8080).

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

## Scheepslogboek

Alles wat bezoekers in de terminal typen wordt weggeschreven naar een plat
logbestand, **nieuwste bovenaan**, raadpleegbaar op **`/terminal.log`**
(bijv. `https://arjankapteijn.nl/terminal.log` — bewust niet gelinkt of
gemeld in de interface). Regelformaat:

```
[2026-06-12 11:42:07 UTC] 86.82.x.x (nl) % neofetch
```

Hoe het werkt:

- **Lokaal (`npm run dev`)** — een Vite-plugin (zie `vite.config.ts`)
  schrijft naar `public/terminal.log` (genegeerd door git).
- **Productie** — `server/server.js` handelt `POST /api/log` af; het
  logbestand leeft in `DATA_DIR` (in Docker het `/data`-volume, dus
  persistent over herstarts en updates heen). Max. 2000 regels,
  30 posts/minuut per IP.

Privacy: de bezoeker ziet zijn eigen volledige IP in de prompt, maar in
het logboek wordt het **gemaskeerd** opgeslagen (`86.82.x.x`) en
e-mailinhoud (onderwerp/bericht) wordt **nooit** gelogd. **Let op (AVG):**
ook gemaskeerde IP's + tijdstippen kunnen persoonsgegevens zijn, en de
interface meldt niet dát er gelogd wordt — vermeld dit dus zelf in een
privacyverklaring.

## Credits & licenties

- **MacBook-model** — `mac-draco.glb` uit de officiële
  [pmndrs/examples](https://github.com/pmndrs/examples) (floating-laptop demo),
  CC-BY-4.0.
- **Aarde-textures** — uit de [three.js-voorbeelden](https://threejs.org/examples/)
  (gebaseerd op NASA Blue Marble-beeldmateriaal).
- **HDR-omgeving** — `potsdamer_platz_1k.hdr` via
  [pmndrs/drei-assets](https://github.com/pmndrs/drei-assets) (Poly Haven, CC0).
- **ISS-telemetrie** — [wheretheiss.at](https://wheretheiss.at).
