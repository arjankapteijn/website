import { promises as fs } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-versie van het scheepslogboek: schrijft getypte commando's naar
// public/terminal.log (nieuwste bovenaan), net als server/server.js dat
// in productie doet. Vite serveert public/ → het bestand is direct te
// bekijken op http://localhost:5173/terminal.log
function terminalLog(): Plugin {
  const logFile = path.join(__dirname, 'public', 'terminal.log')
  let queue = Promise.resolve()
  return {
    name: 'terminal-log',
    // het lokale dev-log mag nooit mee de build in
    async closeBundle() {
      await fs.rm(path.join(__dirname, 'dist', 'terminal.log'), { force: true })
    },
    async configureServer(server) {
      try {
        await fs.access(logFile)
      } catch {
        await fs.writeFile(logFile, '')
      }
      server.middlewares.use('/api/log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const { command = '', lang = '?' } = JSON.parse(body)
            const clean = String(command).replace(/[\r\n\t]/g, ' ').trim().slice(0, 200)
            if (!clean) throw new Error('leeg')
            const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
            const ip = (req.socket.remoteAddress || '?').replace(/^::ffff:/, '')
            const line = `[${stamp}] ${ip} (${String(lang).slice(0, 5)}) % ${clean}`
            queue = queue.then(async () => {
              const existing = await fs.readFile(logFile, 'utf8').catch(() => '')
              await fs.writeFile(logFile, (line + '\n' + existing).split('\n').slice(0, 2000).join('\n'))
            })
            res.statusCode = 204
          } catch {
            res.statusCode = 400
          }
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), terminalLog()],
})
