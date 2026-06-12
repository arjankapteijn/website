# Projectgeheugen

Contextnotities van Claude Code over dit project — handig voor wie (mens of AI)
later aan deze site verder werkt.

## Doel

arjankapteijn.nl verwees tot juni 2026 door naar het LinkedIn-profiel van
Arjan Kapteijn (https://www.linkedin.com/in/arjankapteijn/). Deze site vervangt
die redirect door een persoonlijke 3D-site: een zwevende MacBook met een
interactieve terminal, met de aarde en een ruimtestation op de achtergrond.

## Belangrijke beslissingen

- **Stack**: Vite + React + TypeScript + Three.js via @react-three/fiber en
  @react-three/drei — de de-facto standaard voor dit soort scènes.
- **MacBook-model**: `mac-draco.glb` uit de officiële pmndrs/examples
  (floating-laptop demo), lokaal geserveerd vanuit `public/models/`.
- **Alles self-hosted**: 3D-model, Earth-textures, DRACO-decoder en HDR staan
  in `public/` — geen runtime-afhankelijkheid van externe CDN's.
- **Terminal**: het scherm is een drei `<Html transform occlude>` op de
  schermmesh; de terminal is een eigen React-component (geen xterm.js —
  bewust licht gehouden).
- **E-mail**: via `mailto:` naar info@arjankapteijn.nl, zonder backend. Het
  e-mailcommando toont een privacymelding (geen onnodige persoonsgegevens
  delen).
- **Tweetalig**: NL/EN op basis van domein (.nl → Nederlands, .com → Engels),
  te overschrijven met het `lang`-commando of `?lang=`.
- **Live data**: hoogte/snelheid in de HUD, de ISS-marker op de globe én de
  zonnestand (dag/nacht-grens) komen van het echte ISS via de wheretheiss.at
  API (satelliet 25544), met statische fallback-waarden. De globe draait mee
  met de ISS-positie.
- **Bezoekers-IP**: de terminalprompt toont het IP van de bezoeker zelf
  (api.ipify.org).
- **Scheepslogboek**: getypte commando's gaan naar een plat logbestand,
  nieuwste bovenaan, publiek op /terminal.log. Géén externe dienst (Arjan
  wilde expliciet geen Supabase): lokaal schrijft een Vite-plugin naar
  public/terminal.log, in productie doet server/server.js (zero-dependency
  Node, serveert ook dist/) dat. IP's gemaskeerd, e-mailinhoud nooit gelogd.
  Logboek hoeft niet in de site-interface te zien te zijn (geen log-commando).

## Openstaande punten voor Arjan

- Bio verder aanvullen in `src/i18n.ts` (titel + skills staan er al, op
  basis van LinkedIn: IT-consultant & softwaredeveloper bij ContactCare).
- Loggen vermelden in een privacyverklaring (AVG).
- `public/photo.svg` vervangen door een echte foto.
- DNS van arjankapteijn.nl en arjankapteijn.com naar DigitalOcean wijzen en
  de domeinen activeren in `.do/app.yaml`.
- info@arjankapteijn.nl als mailbox/alias instellen.
