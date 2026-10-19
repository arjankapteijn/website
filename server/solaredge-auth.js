// Eénmalige OAuth-koppeling met SolarEdge V2 (Site Access) - draai je zelf.
//
//   1. node server/solaredge-auth.js
//      → print de authorize-URL. Open die, log in met je mySolarEdge-account
//        en keur goed. Je belandt op de redirect-URI met ?code=…&site_id=…
//        (een "kan geen verbinding maken"-pagina is prima; het gaat om de URL).
//   2. node server/solaredge-auth.js '<volledige redirect-URL of alleen de code>'
//      → wisselt de code in. Met SOLAREDGE_TOKEN_FILE gezet wordt het refresh
//        token daar weggeschreven (aanrader: draai dit in de container, dan
//        landt het direct op het volume); anders wordt het geprint voor .env.
//
// Leest SOLAREDGE_CLIENT_ID, SOLAREDGE_CLIENT_SECRET, SOLAREDGE_REDIRECT_URI
// (default http://localhost:8080/oauth/callback) en SOLAREDGE_TOKEN_FILE uit
// de environment of uit .env in de huidige map.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { AUTHORIZE_URL, TOKEN_URL } from './solar.js'

try {
  process.loadEnvFile('.env')
} catch {
  /* geen .env - alleen process.env */
}

const clientId = process.env.SOLAREDGE_CLIENT_ID
const clientSecret = process.env.SOLAREDGE_CLIENT_SECRET
const redirectUri = process.env.SOLAREDGE_REDIRECT_URI || 'http://localhost:8080/oauth/callback'
const tokenFile = process.env.SOLAREDGE_TOKEN_FILE
const arg = process.argv[2]

if (!clientId) {
  console.error('SOLAREDGE_CLIENT_ID ontbreekt')
  process.exit(1)
}

if (!arg) {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', 'SITE_DATA')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', randomBytes(8).toString('hex'))
  url.searchParams.set('access_duration', '24') // maanden, maximum
  console.log(`Open deze URL, log in en keur goed:\n\n${url}\n`)
  console.log('Draai daarna: node server/solaredge-auth.js \'<redirect-URL>\'')
  process.exit(0)
}

if (!clientSecret) {
  console.error('SOLAREDGE_CLIENT_SECRET ontbreekt')
  process.exit(1)
}

let code = arg
let siteId = null
try {
  const u = new URL(arg)
  code = u.searchParams.get('code') ?? ''
  siteId = u.searchParams.get('site_id')
} catch {
  /* geen URL - het argument is de code zelf */
}

const r = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  }),
})
const body = await r.json().catch(() => ({}))
if (!r.ok || !body.refresh_token) {
  console.error(`Inwisselen mislukt: ${r.status} ${body.error ?? ''} ${body.error_description ?? ''}`)
  process.exit(1)
}

if (siteId) console.log(`site_id uit de callback: ${siteId} (→ SOLAREDGE_SITE_ID)`)
if (tokenFile) {
  await fs.mkdir(path.dirname(tokenFile), { recursive: true })
  await fs.writeFile(tokenFile, JSON.stringify({ refreshToken: body.refresh_token, savedAt: Date.now() }), {
    mode: 0o600,
  })
  console.log(`Refresh token opgeslagen in ${tokenFile}. Herstart de container.`)
} else {
  console.log('Geen SOLAREDGE_TOKEN_FILE gezet. Zet dit in .env (wordt bij de eerste refresh vervangen):')
  console.log(`SOLAREDGE_REFRESH_TOKEN=${body.refresh_token}`)
}
