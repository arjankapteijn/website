# Plan — TLS 1.2 uitschakelen (alleen nog TLS 1.3)

> **STATUS: live & geverifieerd op 2026-06-13.** Optie A toegepast — in
> `/etc/nginx/conf.d/include/ssl-ciphers.conf` staat nu `ssl_protocols
> TLSv1.3;`, en alle proxy hosts (`/data/nginx/proxy_host/*.conf`, nrs 1–16)
> én de default server (`/etc/nginx/conf.d/default.conf`) includen dat bestand.
> Lokaal bevestigd: TLS 1.2 → `alert 70` (geweigerd), TLS 1.3 →
> `TLS_AES_256_GCM_SHA384` (werkt). Resteert alleen: internet.nl opnieuw
> draaien ter bevestiging dat SHA224 weg is.
>
> **De reload bleef eerst stil falen** — de config op schijf was al TLSv1.3,
> maar de draaiende workers herlaadden niet. Oorzaak bleek **niet** TLS maar de
> cert-key: onze handmatige `certbot --force-renewal` (als root) had
> `archive/npm-22/privkey2.pem` als `root:npm 600` weggeschreven, en de
> nginx-master draait als user `npm` → kon de key niet lezen → **élke** reload
> brak af met `[emerg] cannot load certificate key … Permission denied` en de
> oude workers bleven draaien. Fix: `docker exec -u 0 … chown -R npm:npm
> /etc/letsencrypt/archive/npm-22`, dán HUP-reload (workers kregen nieuwe
> starttijd = geslaagd). Zie het geheugen-runbook (npm-truenas-certbot-restart)
> voor de volledige valkuil.
>
> **Reset bij NPM-app-update** (image-laag) → dan sed + HUP opnieuw (zie
> §4A/§5). Herladen kan **alleen** met `kill -HUP <master-host-PID>` vanaf de
> TrueNAS-host (host-PID via `docker top`) — en die reload slaagt enkel als alle
> cert-keys door user `npm` leesbaar zijn.

> internet.nl-bevinding: _"Je webserver ondersteunt een hashfunctie voor
> sleuteluitwisseling die zou moeten worden uitgefaseerd (SHA224)."_
> **Keuze:** TLS 1.2 helemaal uitzetten i.p.v. de signature-algoritmes
> bijschaven. De SHA224-melding geldt alléén voor TLS 1.2; met alleen TLS 1.3
> verdwijnt hij volledig en is meteen de strengste NCSC-stand bereikt.

## 0. ⚠️ Operationele waarschuwing (incident juni 2026)

Een handmatige `docker restart` van de NPM-container legde een latente bug
bloot: de certbot-venv is gedrift (`OpenSSL.crypto has no attribute
'X509Extension'`), waardoor de s6-stap `prepare` crasht en **nginx niet meer
opstart** → site `ERR_CONNECTION_REFUSED`. Daarom:

- **Herlaad nginx niet met `docker exec … nginx -s reload`** (faalt met
  `kill … Operation not permitted`, geen CAP_KILL) en **herstart de container
  niet zomaar** tot de certbot-drift is opgelost (container opnieuw aanmaken
  vanaf de image reset de venv).
- **Noodherstel** als de site plat ligt: `docker exec -d
  ix-nginx-proxy-manager-npm-1 nginx` (mét `-d`; NPM draait nginx `daemon
  off`). Verifieer: `curl -skI https://127.0.0.1 | head -n 1`.
- De wijziging in §4 zit in de **image-laag** (`/etc/nginx/...`) → verdwijnt
  zodra je de container opnieuw aanmaakt. Pas hem dus toe ná de herstel-fix en
  laat NPM zelf herladen (NPM's interne "Reloading Nginx" werkt wél).

## 1. Context

- De TLS-terminatie gebeurt in **Nginx Proxy Manager** (NPM) op TrueNAS, niet
  in de applicatie. De fix zit dus volledig in de NPM/nginx-laag.
- Vrijwel elke client van na ~2018 ondersteunt TLS 1.3 (alle moderne browsers,
  curl, mobiele apps). Een bezoeker die deze WebGL/Three.js-site kan draaien,
  ondersteunt sowieso TLS 1.3.
- **Let op — meerdere hosts:** deze NPM bedient ~16 proxy hosts. De TLS-versie
  staat bij NPM in een gedeeld include-bestand, dus de directe ingreep (§4)
  geldt voor **alle** hosts. Prima als je die allemaal met moderne apparaten
  benadert; benadert een andere host oude clients/IoT/webhooks, kies dan de
  per-host-route (§4, optie B) of houd voor die ene host TLS 1.2 aan.

## 2. Doel

`ssl_protocols TLSv1.3;` — TLS 1.2 (en alles ouder) weigeren. Aan de
TLS 1.3-cijfersuites hoeft niets te gebeuren; die zijn los van `ssl_ciphers`
en de defaults zijn goed.

## 3. NPM-container vinden + huidige instelling lokaliseren

```bash
# 1) containernaam (TrueNAS): meestal iets met 'nginx-proxy-manager'
docker ps --format '{{.Names}}' | grep -i nginx

# 2) waar staat ssl_protocols nu? (bepaalt welke bewerking je doet)
NPM=<containernaam-uit-stap-1>
docker exec "$NPM" grep -rn 'ssl_protocols' /etc/nginx /data/nginx 2>/dev/null
```

> **Bevestigd in deze setup** (grep, 2026-06): de regel staat in
> `/etc/nginx/conf.d/include/ssl-ciphers.conf` →
> `ssl_protocols TLSv1.2 TLSv1.3;`. Container op TrueNAS:
> `ix-nginx-proxy-manager-npm-1`. Dat is het gedeelde include → **Optie A**.
> (De `pod/`- en `resty.index`-treffers zijn image-documentatie, geen
> actieve config.)

De grep-uitslag bepaalt de route:
- **Staat in een gedeeld include** (hier
  `/etc/nginx/conf.d/include/ssl-ciphers.conf`) → **Optie A** (§4). Dit is het
  gangbare geval bij NPM en geldt voor álle hosts.
- **Staat alléén op http-niveau** (in de hoofdconfig, niet in een
  `server { }`-blok) → dan kan **Optie B** (per host) schoon overschrijven.

## 4. De wijziging

### Optie A — gedeeld include aanpassen (alle hosts, gangbaar)

Pas in het bestand uit de grep de `ssl_protocols`-regel aan naar alleen 1.3:

```bash
NPM=<containernaam>
FILE=/etc/nginx/conf.d/include/ssl-ciphers.conf   # of het pad uit de grep

# huidige regel bekijken
docker exec "$NPM" grep -n ssl_protocols "$FILE"

# back-up en aanpassen naar alleen TLS 1.3
docker exec "$NPM" sh -c "cp '$FILE' '$FILE.bak' && sed -i 's/^\s*ssl_protocols .*/ssl_protocols TLSv1.3;/' '$FILE'"
```

### Optie B — per host via de NPM-UI (alleen deze site)

Alleen schoon als de grep liet zien dat `ssl_protocols` **niet** al in het
`server`-blok staat (anders krijg je "duplicate directive" — `nginx -t` vangt
dat af, zie §5).

1. NPM → _Hosts → Proxy Hosts_ → `www.arjankapteijn.nl` bewerken.
2. Tab **Advanced → Custom Nginx Configuration**:
   ```nginx
   ssl_protocols TLSv1.3;
   ```
3. **Save** (NPM bewaart dit in zijn database → overleeft renewals).

## 5. Toepassen — altijd eerst testen

```bash
docker exec "$NPM" nginx -t          # config geldig? (breekt niets)
```

**Herladen — `nginx -s reload` werkt NIET in deze container** (`kill … Operation
not permitted`, geen CAP_KILL). Stuur in plaats daarvan een HUP vanaf de
TrueNAS-host (die heeft wél de rechten), zónder container-herstart:

```bash
docker top "$NPM" | grep 'nginx: master'   # host-PID = 2e kolom
kill -HUP <PID>                            # graceful reload, nul downtime
```

- `nginx -t` faalt op "duplicate ssl_protocols" → dan stond hij al in het
  server-blok: gebruik Optie A i.p.v. B (of draai B terug).
- Alternatief reload: een willekeurige proxy host in de NPM-UI openen en
  **Save** — NPM herlaadt nginx dan zelf (dat mechanisme werkt wél).
- Een mislukte reload laat de **oude** config gewoon draaien → geen downtime.

## 6. Verifiëren

```bash
# TLS 1.2 moet nu FALEN (handshake failure / no protocols):
echo | openssl s_client -connect www.arjankapteijn.nl:443 \
  -servername www.arjankapteijn.nl -tls1_2 2>&1 \
  | grep -Ei 'CONNECTED|handshake failure|no protocols|alert'

# TLS 1.3 moet WERKEN (CONNECTED + Protocol: TLSv1.3):
echo | openssl s_client -connect www.arjankapteijn.nl:443 \
  -servername www.arjankapteijn.nl -tls1_3 2>&1 \
  | grep -Ei 'CONNECTED|Protocol|subject='
```

Daarna **internet.nl opnieuw draaien** → de SHA224-bevinding hoort weg te zijn.
Controleer ook even de site zelf in de browser (TLS 1.3 staat al jaren aan,
dus dit is een formaliteit).

## 7. Persistentie (belangrijk bij Optie A)

`ssl-ciphers.conf` zit in de **image** (`/etc/nginx/...`, niet onder `/data`),
dus de wijziging **reset bij een NPM-update / container-recreate**. Opties:

- **Simpel:** na een NPM-update de `sed` uit §4A opnieuw draaien (1 commando).
- **Blijvend (bind-mount):** een eigen kopie over het image-bestand hangen.
  1. Huidige (al aangepaste) versie naar het persistente volume kopiëren:
     ```bash
     docker cp ix-nginx-proxy-manager-npm-1:/etc/nginx/conf.d/include/ssl-ciphers.conf \
       /mnt/.ix-apps/app_mounts/nginx-proxy-manager/data/nginx/ssl-ciphers.conf
     ```
  2. Dit is een door TrueNAS beheerde **ix-app**, dus niet via een los
     compose-bestand maar via de UI: _Apps → nginx-proxy-manager → Edit →
     Storage → Add → Host Path_, met host-pad
     `/mnt/.ix-apps/app_mounts/nginx-proxy-manager/data/nginx/ssl-ciphers.conf`
     → mount-pad `/etc/nginx/conf.d/include/ssl-ciphers.conf`, read-only aan.
  3. App opslaan/redeployen. Let op: een latere NPM-versie die de
     cipher-defaults wijzigt wordt nu door jouw bestand overschreven — bij een
     grote update even het origineel vergelijken.

Optie B (NPM-UI, §4B) overleeft updates wél, want NPM bewaart dat in zijn
database — maar dat kon hier niet omdat `ssl_protocols` al in het server-blok
zit (zou "duplicate" geven).

## 8. Terugrollen

- **Optie A:** `docker exec "$NPM" sh -c "mv '$FILE.bak' '$FILE'" && docker exec "$NPM" nginx -s reload`
- **Optie B:** Advanced-veld leegmaken → Save.

## 9. Checklist

- [ ] NPM-container + huidig `ssl_protocols`-pad gevonden (§3)
- [ ] Beslist: alle hosts (A) of alleen deze site (B) — let op de ~16 hosts
- [ ] `ssl_protocols TLSv1.3;` gezet
- [ ] `nginx -t` OK → `nginx -s reload`
- [ ] TLS 1.2 faalt, TLS 1.3 werkt (§6)
- [ ] internet.nl opnieuw gedraaid → SHA224 weg
- [ ] Persistentie geregeld of genoteerd voor na NPM-updates (§7)

---

## Bijlage — alternatief dat hier bewust niet gekozen is

TLS 1.2 áánhouden maar SHA1/SHA224 als signature-hash weigeren:

```nginx
ssl_conf_command SignatureAlgorithms ECDSA+SHA256:ECDSA+SHA384:ECDSA+SHA512:RSA-PSS+SHA256:RSA-PSS+SHA384:RSA-PSS+SHA512:RSA+SHA256:RSA+SHA384:RSA+SHA512:ed25519:ed448;
```

Meer compatibiliteit met oude clients, maar minder streng en bewerkelijker.
Vereist nginx ≥ 1.19.4 + OpenSSL ≥ 1.1.1. Alleen relevant als je TLS 1.2 om
een specifieke reden moet behouden.
