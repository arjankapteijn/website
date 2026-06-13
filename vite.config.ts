import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// gedeeld met de productieserver; JS-module zonder eigen typings
// @ts-expect-error - geen .d.ts voor server/signal.js
import { sendSignal } from './server/signal.js'

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
                const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
                const ip = (req.socket.remoteAddress || '?').replace(/^::ffff:/, '')
                const message = `[${stamp}] ${ip} (${String(lang).slice(0, 5)}) % ${clean}`
                await sendSignal({ url, number, recipients, message })
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

// Dev-versie van /api/solar: zelfde gedrag als server/server.js — key uit
// .env, 15 minuten cache (SolarEdge heeft een daglimiet), key blijft server-side.
function solarProxy(): Plugin {
  let cache = { at: 0, body: '' }
  return {
    name: 'solar-proxy',
    configureServer(server) {
      server.middlewares.use('/api/solar', (req, res) => {
        void (async () => {
          try {
            process.loadEnvFile(path.join(__dirname, '.env'))
          } catch {
            /* geen .env */
          }
          const key = process.env.SOLAREDGE_API_KEY
          const site = process.env.SOLAREDGE_SITE_ID
          if (req.method !== 'GET' || !key || !site) {
            res.statusCode = 501
            return res.end()
          }
          if (Date.now() - cache.at > 15 * 60_000) {
            try {
              const r = await fetch(`https://monitoringapi.solaredge.com/site/${site}/overview?api_key=${key}`)
              if (!r.ok) throw new Error(`status ${r.status}`)
              const { overview } = (await r.json()) as {
                overview?: {
                  currentPower?: { power?: number }
                  lastDayData?: { energy?: number }
                  lastMonthData?: { energy?: number }
                  lifeTimeData?: { energy?: number }
                  lastUpdateTime?: string
                }
              }
              cache = {
                at: Date.now(),
                body: JSON.stringify({
                  power: overview?.currentPower?.power ?? 0,
                  today: overview?.lastDayData?.energy ?? 0,
                  month: overview?.lastMonthData?.energy ?? 0,
                  lifetime: overview?.lifeTimeData?.energy ?? 0,
                  updatedAt: overview?.lastUpdateTime ?? null,
                }),
              }
            } catch {
              if (!cache.body) {
                res.statusCode = 502
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
  plugins: [react(), terminalLog(), solarProxy()],
})
