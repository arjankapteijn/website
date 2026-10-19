import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// gedeeld met de productieserver; JS-module zonder eigen typings
// @ts-expect-error - geen .d.ts voor server/signal.js
import { sendSignal, formatLogMessage } from './server/signal.js'
// @ts-expect-error - geen .d.ts voor server/host.js
import { getHostStats } from './server/host.js'
// @ts-expect-error - geen .d.ts voor server/solar.js
import { createSolarCache, createSolarClient, isSolarConfigured, solarConfigFromEnv } from './server/solar.js'

function getGitVersion(): string {
  try {
    return execFileSync('git', ['describe', '--tags', '--always', '--dirty'], {
      encoding: 'utf8',
    })
      .trim()
      .replace(/^v/, '')
  } catch {
    return 'dev'
  }
}

// Dev-versie van het scheepslogboek: pusht getypte commando's als Signal-
// bericht, net als server/server.js in productie. Config uit .env
// (SIGNAL_API_URL / SIGNAL_NUMBER / SIGNAL_RECIPIENTS); zonder die env
// faalt het stil (204), zodat dev zonder Signal gewoon werkt.
function terminalLog(): Plugin {
  return {
    name: 'terminal-log',
    configureServer(server) {
      server.middlewares.use('/api/log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          void (async () => {
            try {
              process.loadEnvFile(path.join(__dirname, '.env'))
            } catch {
              /* geen .env */
            }
            try {
              const { command = '', lang = '?' } = JSON.parse(body)
              const clean = String(command).replace(/[\r\n\t]/g, ' ').trim().slice(0, 200)
              if (!clean) throw new Error('leeg')
              const url = process.env.SIGNAL_API_URL
              const number = process.env.SIGNAL_NUMBER
              const recipients = (process.env.SIGNAL_RECIPIENTS || number || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
              if (url && number && recipients.length) {
                const ip = (req.socket.remoteAddress || '?').replace(/^::ffff:/, '')
                const message = formatLogMessage({ ip, lang: String(lang).slice(0, 5), command: clean })
                await sendSignal({ url, number, recipients, message, textMode: 'styled' })
              }
              res.statusCode = 204
            } catch {
              res.statusCode = 400
            }
            res.end()
          })()
        })
      })
    },
  }
}

// Dev-versie van /api/solar: zelfde module als server/server.js - config uit
// .env, cache + backoff, credentials blijven server-side. Let op: dev en
// productie delen géén refresh token (elke refresh maakt het vorige
// ongeldig); geef dev een eigen SOLAREDGE_TOKEN_FILE of laat het uit.
function solarProxy(): Plugin {
  let cache: { get: () => Promise<string | null> } | null = null
  return {
    name: 'solar-proxy',
    configureServer(server) {
      server.middlewares.use('/api/solar', (req, res) => {
        void (async () => {
          if (!cache) {
            try {
              process.loadEnvFile(path.join(__dirname, '.env'))
            } catch {
              /* geen .env */
            }
            const cfg = solarConfigFromEnv()
            if (isSolarConfigured(cfg)) {
              cache = createSolarCache({ load: createSolarClient(cfg).fetchSolar, ttlMs: cfg.ttlMs })
            }
          }
          if (req.method !== 'GET' || !cache) {
            res.statusCode = 501
            return res.end()
          }
          const body = await cache.get()
          if (!body) {
            res.statusCode = 502
            return res.end()
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(body)
        })()
      })
    },
  }
}

// Dev-versie van /api/host: zelfde gedrag als server/server.js - leest /proc
// rechtstreeks (geen key nodig). Op macOS bestaat /proc niet, dus dit blijft
// hier altijd 501; op een Linux-dev-machine (of met /proc gemount) werkt het.
function hostProxy(): Plugin {
  let cache = { at: 0, body: '' }
  return {
    name: 'host-proxy',
    configureServer(server) {
      server.middlewares.use('/api/host', (req, res) => {
        void (async () => {
          if (req.method !== 'GET') {
            res.statusCode = 405
            return res.end()
          }
          if (Date.now() - cache.at > 15_000) {
            try {
              cache = { at: Date.now(), body: JSON.stringify(await getHostStats()) }
            } catch {
              if (!cache.body) {
                res.statusCode = 501
                return res.end()
              }
            }
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(cache.body)
        })()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), terminalLog(), solarProxy(), hostProxy()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.VITE_APP_VERSION || getGitVersion()),
  },
})
