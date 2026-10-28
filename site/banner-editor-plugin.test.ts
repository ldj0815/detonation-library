import { expect, test } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import { readFile } from 'node:fs/promises'
import { bannerEditorPlugin } from './banner-editor-plugin'

test('the local save endpoint rejects foreign origins, missing tokens and invalid input without writing', async () => {
  type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>
  let handler: Handler = async () => { throw new Error('Middleware was not installed') }
  const plugin = bannerEditorPlugin()
  const configure = plugin.configureServer as (server: ViteDevServer) => void
  configure({ middlewares: { use: (_path: string, fn: Handler) => { handler = fn } } } as unknown as ViteDevServer)
  async function request({ method = 'POST', path = '/settings', origin = 'http://localhost:5174', token = '', host = 'localhost:5174', peer = '127.0.0.1', body = '{}' } = {}) {
    const req = Object.assign(Readable.from([Buffer.from(body)]), {
      method, url: path, headers: { host, origin, 'x-banner-editor-token': token, 'content-type': 'application/json' }, socket: { remoteAddress: peer },
    }) as unknown as IncomingMessage
    let output = ''
    const response = { statusCode: 200, setHeader() {}, end(value: string) { output = value } }
    await handler(req, response as unknown as ServerResponse, () => { throw new Error('Unexpected fallthrough') })
    return { code: response.statusCode, body: JSON.parse(output) }
  }
  const file = new URL('./src/components/banner/settings.json', import.meta.url)
  const before = await readFile(file, 'utf8')
  const { body: { token } } = await request({ method: 'GET', path: '/status' })
  expect(typeof token).toBe('string')
  expect((await request({ token, origin: 'https://other.example' })).code).toBe(403)
  expect((await request()).code).toBe(403)
  expect((await request({ token, host: 'other.example', origin: 'http://other.example' })).code).toBe(403)
  expect((await request({ token, peer: '192.0.2.1' })).code).toBe(403)
  expect((await request({ token, body: '{"version":9}' })).code).toBe(400)
  expect((await request({ token, body: ' '.repeat(17000) })).code).toBe(413)
  expect(await readFile(file, 'utf8')).toBe(before)
})
