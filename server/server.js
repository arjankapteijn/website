// Zero-dependency productieserver: serveert de gebouwde site uit dist/
// en schrijft terminal-commando's naar het openbare scheepslogboek
// (dist/terminal.log, nieuwste bovenaan, publiek op /terminal.log).
//
//   npm run build && npm start
//
// IP-adressen worden gemaskeerd opgeslagen; e-mailinhoud bereikt dit
// endpoint nooit (de client logt alleen getypte commando's).

import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const LOG_FILE = path.join(DIST, 'terminal.log')
const PORT = Number(process.env.PORT) || 8080
const MAX_LOG_LINES = 2000
const RATE_LIMIT = 30 // posts per minuut per IP

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

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  const raw = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket.remoteAddress || ''
  return raw.replace(/^::ffff:/, '')
}

function maskIp(ip) {
  if (ip.includes(':')) {
    const parts = ip.split(':')
    return `${parts[0]}:${parts[1] ?? ''}:…`
  }
  const parts = ip.split('.')
  return `${parts[0]}.${parts[1]}.x.x`
}

// simpele rate limit per IP
const buckets = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const b = buckets.get(ip)
  if (!b || now > b.reset) {
    buckets.set(ip, { count: 1, reset: now + 60_000 })
    return false
  }
  b.count += 1
  return b.count > RATE_LIMIT
}

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
  if (rateLimited(ip)) {
    res.writeHead(429).end()
    return
  }
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 2048) {
      res.writeHead(413).end()
      return
    }
  }
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    res.writeHead(400).end()
    return
  }
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
  await appendLog(`[${stamp}] ${maskIp(ip)} (${lang}) % ${command}`)
  res.writeHead(204).end()
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost')
  let filePath = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end()
    return
  }
  try {
    const stat = await fs.stat(filePath)
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html')
  } catch {
    filePath = path.join(DIST, 'index.html') // SPA-fallback
  }
  try {
    const data = await fs.readFile(filePath)
    const type = MIME[path.extname(filePath)] ?? 'application/octet-stream'
    const noCache = filePath.endsWith('.log') || filePath.endsWith('index.html')
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': noCache ? 'no-store' : 'public, max-age=3600',
    })
    res.end(data)
  } catch {
    res.writeHead(404).end('not found')
  }
}

// logbestand klaarzetten zodat het direct publiek bestaat
try {
  await fs.access(LOG_FILE)
} catch {
  await fs.writeFile(LOG_FILE, '')
}

http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/log') {
      handleLogPost(req, res).catch(() => res.writeHead(500).end())
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req, res).catch(() => res.writeHead(500).end())
    } else {
      res.writeHead(405).end()
    }
  })
  .listen(PORT, () => console.log(`AK-01 draait op http://localhost:${PORT}`))
