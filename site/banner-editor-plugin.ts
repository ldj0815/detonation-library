import type { Plugin } from 'vite'
import { randomBytes } from 'node:crypto'
import { writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseBannerSettings } from './src/components/banner/settings-schema'

/** Local-only, fixed-file save endpoint. It never commits or publishes. */
export function bannerEditorPlugin(): Plugin {
  const token = randomBytes(24).toString('hex')
  const destination = fileURLToPath(new URL('./src/components/banner/settings.json', import.meta.url))
  let saving = false
  return {
    name: 'local-banner-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__banner-editor', async (req, res, next) => {
        if (req.url !== '/status' && req.url !== '/settings') return next()
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        const reply = (status: number, value: unknown) => { res.statusCode = status; res.end(JSON.stringify(value)) }
        const peer = req.socket.remoteAddress
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer ?? '')) return reply(403, { error: 'Open the editor on this computer.' })
        const hostname = new URL(`http://${req.headers.host}`).hostname
        if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return reply(403, { error: 'Use a localhost address for this editor.' })
        if (req.url === '/status' && req.method === 'GET') return reply(200, { token })
        if (req.url !== '/settings' || req.method !== 'POST') return reply(405, { error: 'Unsupported request.' })
        const expected = `http://${req.headers.host}`
        if (req.headers.origin !== expected || req.headers['x-banner-editor-token'] !== token || !req.headers['content-type']?.startsWith('application/json')) {
          return reply(403, { error: 'Refresh the local editor before saving.' })
        }
        if (saving) return reply(409, { error: 'A save is already in progress.' })
        saving = true
        try {
          const chunks: Buffer[] = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 16384) return reply(413, { error: 'The settings file is too large.' })
            chunks.push(Buffer.from(chunk))
          }
          const settings = parseBannerSettings(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          await writeFile(`${destination}.tmp`, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
          await rename(`${destination}.tmp`, destination)
          reply(200, { saved: true, settings })
        } catch (error) {
          reply(400, { error: error instanceof Error ? error.message : 'Could not save these settings.' })
        } finally { saving = false }
      })
    },
  }
}
