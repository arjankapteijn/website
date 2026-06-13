// Zero-dependency productieserver:
//   - serveert de gebouwde site uit dist/
//   - POST /api/log    → scheepslogboek (nieuwste bovenaan, publiek op /terminal.log)
//   - POST /api/email  → verstuurt e-mail via SMTP2GO (zie server/smtp.js)
//   - GET  /healthz    → healthcheck voor Docker
//
//   npm run build && npm start
//
// Configuratie via environment (zie .env.example):
//   PORT       (default 8080)
//   DATA_DIR   map voor terminal.log (default: dist/) — mount in Docker
//   SMTP_HOST  default mail-eu.smtp2go.com
//   SMTP_PORT  default 465 (impliciete TLS)
//   SMTP_USER / SMTP_PASS   zonder deze twee is /api/email uitgeschakeld
//   MAIL_TO    default info@arjankapteijn.nl
//   MAIL_FROM  default Station AK-01 <noreply@arjankapteijn.nl>
//
// Bezoekers-IP's staan onverkort in het openbare logboek (bewuste keuze);
// e-mailinhoud bereikt het logboek nooit.

import http from 'node:http'
import zlib from 'node:zlib'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendMail } from './smtp.js'

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const DATA_DIR = process.env.DATA_DIR || DIST
const LOG_FILE = path.join(DATA_DIR, 'terminal.log')
const PORT = Number(process.env.PORT) || 8080
const MAX_LOG_LINES = 2000
const LOG_RATE_LIMIT = 30 // posts per minuut per IP
const MAIL_RATE_LIMIT = 4 // mails per minuut per IP

const SMTP = {
  host: process.env.SMTP_HOST || 'mail-eu.smtp2go.com',
  port: Number(process.env.SMTP_PORT) || 465,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  to: process.env.MAIL_TO || 'info@arjankapteijn.nl',
  from: process.env.MAIL_FROM || 'Station AK-01 <noreply@arjankapteijn.nl>',
}

// ─── Security-headers (internet.nl) ─────────────────────────────────────
// CSP-randvoorwaarden van deze site: React/drei zetten inline
// style-attributen ('unsafe-inline' in style-src), de DRACO-decoder draait
// als blob-worker met WASM ('wasm-unsafe-eval' + worker-src blob:) en de
// site praat met de ISS- en IP-API's (connect-src).
const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    // blob: — GLTFLoader laadt texturen die in het .glb-model zitten als blob-URL
    "img-src 'self' data: blob:",
    // blob: — three.js haalt model-texturen met fetch() op via blob-URL's
    "connect-src 'self' blob: https://api.wheretheiss.at https://api.ipify.org",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // HSTS bewust NIET hier: TLS termineert bij Nginx Proxy Manager, en die zet
  // de Strict-Transport-Security-header al. Hier óók zetten = dubbele header
  // (browsers negeren 'm dan; SSL Labs markeert het als invalid).
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.hdr': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
}

// ─── Compressie ─────────────────────────────────────────────────────────
// Tekst-achtige assets brotli/gzip'en scheelt fors op trage verbindingen
// (de JS-bundle ~1,3 MB → ~0,3 MB). Onveranderlijke /assets/-bestanden
// (Vite-hash in de naam) cachen we in het geheugen zodat we maar één keer
// op kwaliteit 11 hoeven te comprimeren.
const COMPRESSIBLE_EXT = new Set(['.js', '.css', '.html', '.svg', '.json', '.txt', '.log', '.wasm'])
const compCache = new Map()

function compress(data, filePath, immutable, accept) {
  if (data.length < 1024 || !COMPRESSIBLE_EXT.has(path.extname(filePath))) return { body: data }
  const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null
  if (!enc) return { body: data }
  const key = filePath + '\0' + enc
  if (immutable && compCache.has(key)) return { body: compCache.get(key), enc }
  const body =
    enc === 'br'
      ? zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } })
      : zlib.gzipSync(data, { level: 9 })
  if (immutable) compCache.set(key, body)
  return { body, enc }
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  const raw = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket.remoteAddress || ''
  return raw.replace(/^::ffff:/, '')
}

// simpele rate limit per IP per doel
const buckets = new Map()
function rateLimited(key, limit) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + 60_000 })
    return false
  }
  b.count += 1
  return b.count > limit
}

async function readBody(req, res, maxBytes = 4096) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > maxBytes) {
      res.writeHead(413).end()
      return null
    }
  }
  try {
    return JSON.parse(body)
  } catch {
    res.writeHead(400).end()
    return null
  }
}

// ─── Scheepslogboek ─────────────────────────────────────────────────────

// schrijfacties serialiseren zodat gelijktijdige posts elkaar niet overschrijven
let writeQueue = Promise.resolve()
function appendLog(line) {
  writeQueue = writeQueue.then(async () => {
    let existing = ''
    try {
      existing = await fs.readFile(LOG_FILE, 'utf8')
    } catch {
      /* bestand bestaat nog niet */
    }
    const lines = (line + '\n' + existing).split('\n').slice(0, MAX_LOG_LINES)
    await fs.writeFile(LOG_FILE, lines.join('\n'))
  })
  return writeQueue
}

async function handleLogPost(req, res) {
  const ip = clientIp(req)
  if (rateLimited('log:' + ip, LOG_RATE_LIMIT)) {
    res.writeHead(429).end()
    return
  }
  const parsed = await readBody(req, res, 2048)
  if (!parsed) return
  const command = String(parsed.command ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .trim()
    .slice(0, 200)
  const lang = String(parsed.lang ?? '?').slice(0, 5)
  if (!command) {
    res.writeHead(400).end()
    return
  }
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  await appendLog(`[${stamp}] ${ip} (${lang}) % ${command}`)
  res.writeHead(204).end()
}

// ─── E-mail via SMTP2GO ─────────────────────────────────────────────────

async function handleEmailPost(req, res) {
  if (!SMTP.user || !SMTP.pass) {
    res.writeHead(501).end() // niet geconfigureerd → client valt terug op mailto
    return
  }
  const ip = clientIp(req)
  if (rateLimited('mail:' + ip, MAIL_RATE_LIMIT)) {
    res.writeHead(429).end()
    return
  }
  const parsed = await readBody(req, res, 8192)
  if (!parsed) return

  const subject = String(parsed.subject ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, 200)
  const body = String(parsed.body ?? '').trim().slice(0, 4000)
  const replyTo = String(parsed.replyTo ?? '').trim().slice(0, 200)
  const lang = String(parsed.lang ?? '?').slice(0, 5)
  if (!subject || !body || (replyTo && !/^\S+@\S+\.\S+$/.test(replyTo))) {
    res.writeHead(400).end()
    return
  }

  const text = [
    body,
    '',
    '—',
    `Verzonden via de terminal op arjankapteijn.nl/.com`,
    `IP: ${ip} · taal: ${lang} · ${new Date().toISOString()}`,
    replyTo ? `Antwoorden kan naar: ${replyTo}` : 'Geen antwoordadres opgegeven.',
  ].join('\n')

  try {
    await sendMail({
      host: SMTP.host,
      port: SMTP.port,
      user: SMTP.user,
      pass: SMTP.pass,
      from: SMTP.from,
      to: SMTP.to,
      subject: `[AK-01] ${subject}`,
      text,
      replyTo: replyTo || undefined,
    })
    res.writeHead(204).end()
  } catch (err) {
    console.error('e-mail mislukt:', err?.message ?? err)
    res.writeHead(502).end()
  }
}

// ─── Zonnepanelen via SolarEdge ─────────────────────────────────────────
// SolarEdge hanteert een daglimiet (~300 calls); de server cachet daarom
// 15 minuten en de API-key blijft hier — nooit richting de browser.

const SOLAR = {
  key: process.env.SOLAREDGE_API_KEY || '',
  site: process.env.SOLAREDGE_SITE_ID || '',
  ttlMs: 15 * 60_000,
}
let solarCache = { at: 0, body: null }

async function handleSolarGet(req, res) {
  if (!SOLAR.key || !SOLAR.site) {
    res.writeHead(501).end() // niet geconfigureerd → client toont statisch percentage
    return
  }
  if (Date.now() - solarCache.at > SOLAR.ttlMs) {
    try {
      const r = await fetch(
        `https://monitoringapi.solaredge.com/site/${SOLAR.site}/overview?api_key=${SOLAR.key}`,
      )
      if (!r.ok) throw new Error(`status ${r.status}`)
      const { overview } = await r.json()
      solarCache.body = JSON.stringify({
        power: overview?.currentPower?.power ?? 0, // W
        today: overview?.lastDayData?.energy ?? 0, // Wh
        month: overview?.lastMonthData?.energy ?? 0,
        lifetime: overview?.lifeTimeData?.energy ?? 0,
        updatedAt: overview?.lastUpdateTime ?? null,
      })
      solarCache.at = Date.now()
    } catch (err) {
      console.error('solaredge mislukt:', err?.message ?? err)
      if (!solarCache.body) {
        res.writeHead(502).end()
        return
      }
      solarCache.at = Date.now() // bij storing niet elke request opnieuw proberen
    }
  }
  res
    .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' })
    .end(solarCache.body)
}

// ─── Statische bestanden ────────────────────────────────────────────────

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost')

  // het logboek leeft in DATA_DIR (persistent volume in Docker)
  let filePath =
    url.pathname === '/terminal.log'
      ? LOG_FILE
      : path.normalize(path.join(DIST, decodeURIComponent(url.pathname)))
  if (!filePath.startsWith(DIST) && filePath !== LOG_FILE) {
    res.writeHead(403).end()
    return
  }
  try {
    const stat = await fs.stat(filePath)
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html')
  } catch {
    if (filePath === LOG_FILE) {
      res.writeHead(404).end()
      return
    }
    filePath = path.join(DIST, 'index.html') // SPA-fallback
  }
  try {
    const data = await fs.readFile(filePath)
    const type = MIME[path.extname(filePath)] ?? 'application/octet-stream'
    const noCache = filePath.endsWith('.log') || filePath.endsWith('index.html')
    // Vite-assets dragen een content-hash in hun naam → onbeperkt cachebaar
    const immutable = url.pathname.startsWith('/assets/')
    const cacheControl = noCache
      ? 'no-store'
      : immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600'
    const { body, enc } = compress(data, filePath, immutable, req.headers['accept-encoding'] || '')
    const headers = { 'Content-Type': type, 'Cache-Control': cacheControl }
    if (enc) {
      headers['Content-Encoding'] = enc
      headers['Vary'] = 'Accept-Encoding'
    }
    res.writeHead(200, headers)
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch {
    res.writeHead(404).end('not found')
  }
}

// logbestand klaarzetten zodat het direct publiek bestaat
await fs.mkdir(DATA_DIR, { recursive: true })
try {
  await fs.access(LOG_FILE)
} catch {
  await fs.writeFile(LOG_FILE, '')
}

http
  .createServer((req, res) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value)
    if (req.method === 'POST' && req.url === '/api/log') {
      handleLogPost(req, res).catch(() => res.writeHead(500).end())
    } else if (req.method === 'POST' && req.url === '/api/email') {
      handleEmailPost(req, res).catch(() => res.writeHead(500).end())
    } else if (req.method === 'GET' && req.url === '/api/solar') {
      handleSolarGet(req, res).catch(() => res.writeHead(500).end())
    } else if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok')
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req, res).catch(() => res.writeHead(500).end())
    } else {
      res.writeHead(405).end()
    }
  })
  .listen(PORT, () => console.log(`AK-01 draait op http://localhost:${PORT}`))
