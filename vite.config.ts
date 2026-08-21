import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'

import siteConfiguration from './.figma/make/site.json'

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // .figma/make/deploy-preview passes `--mode development` for cached-preview builds.
  const emitSourcemaps = mode === 'development'

  return {
    base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : '/',
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    plugins: [
      react(),
      tailwindcss(),
      cloudUploadPlugin(),
      figmaSiteConfiguration(siteConfiguration),
      figmaErrorOverlayReplay(),
      figmaReactRefreshBoundaryFallback(),
      figmaMakeKitPlugin({ storiesGlob: '/src/**/*.stories.{ts,tsx,js,jsx}' }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
      strictPort: false,
      allowedHosts: true,
      watch: { ignored: ['**/.figma/**'] },
    },
    preview: {
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
      allowedHosts: true,
    },
  }
})

type FigmaSiteConfiguration = {
  title?: string
  description?: string
  language?: string
  robots?: {
    index?: boolean
  }
  icons?: {
    icon?: string
  }
  openGraph?: {
    image?: string
  }
  analytics?: {
    googleAnalyticsId?: string
  }
  customScripts?: {
    headStart?: string
    headEnd?: string
    bodyStart?: string
    bodyEnd?: string
  }
  accessibility?: {
    addBypassLinks?: boolean
  }
}

/** Applies /.figma/make/site.json to the generated document shell. */
function figmaSiteConfiguration(config: FigmaSiteConfiguration): Plugin {
  function sanitizeHtmlValue(value: string | undefined): string {
    return value?.replace(/[^a-zA-Z0-9_-]/g, '') || ''
  }
  function escapeHtmlText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function replaceHtmlCommentSlot(html: string, slotName: string, content: string): string {
    return html.replace(`<!-- ${slotName} -->`, content)
  }

  const title = config.title ?? "IT GUILD Photobooth"
  const description = config.description ?? ''
  const favicon = config.icons?.icon ?? ''
  const socialImage = config.openGraph?.image ?? ''
  const language = sanitizeHtmlValue(config.language) || 'en'
  const googleAnalyticsId = sanitizeHtmlValue(config.analytics?.googleAnalyticsId)
  const headStart = config.customScripts?.headStart ?? ''
  const headEnd = config.customScripts?.headEnd ?? ''
  const bodyStart = config.customScripts?.bodyStart ?? ''
  const bodyEnd = config.customScripts?.bodyEnd ?? ''
  const robotsTxt = config.robots?.index === false ? 'User-agent: *\nDisallow: /\n' : ''

  return {
    name: 'figma-site-configuration',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!robotsTxt || req.url?.split('?')[0] !== '/robots.txt') return next()

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(robotsTxt)
      })
    },
    generateBundle() {
      if (!robotsTxt) return

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robotsTxt,
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let result = html
        result = replaceHtmlCommentSlot(result, 'figma:lang', language)
        result = replaceHtmlCommentSlot(result, 'figma:title', escapeHtmlText(title))
        result = replaceHtmlCommentSlot(result, 'figma:head-start', headStart)
        result = replaceHtmlCommentSlot(result, 'figma:head-end', headEnd)
        result = replaceHtmlCommentSlot(result, 'figma:body-start', bodyStart)
        result = replaceHtmlCommentSlot(result, 'figma:body-end', bodyEnd)

        const tags: HtmlTagDescriptor[] = []
        if (description) {
          tags.push({ tag: 'meta', attrs: { name: 'description', content: description }, injectTo: 'head' })
        }
        if (config.robots?.index === false) {
          tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' })
        }
        if (favicon) {
          tags.push({ tag: 'link', attrs: { rel: 'icon', href: favicon }, injectTo: 'head' })
        }
        if (title) {
          tags.push({ tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' })
        }
        if (description) {
          tags.push({ tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' })
        }
        if (socialImage) {
          tags.push(
            { tag: 'meta', attrs: { property: 'og:image', content: socialImage }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:image', content: socialImage }, injectTo: 'head' },
          )
        }

        if (googleAnalyticsId) {
          tags.push(
            {
              tag: 'script',
              attrs: {
                async: true,
                src: `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`,
              },
              injectTo: 'head',
            },
            {
              tag: 'script',
              children: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', ${JSON.stringify(googleAnalyticsId)});
`,
              injectTo: 'head',
            },
          )
        }

        if (config.accessibility?.addBypassLinks) {
          tags.push(
            {
              tag: 'style',
              children: `
  .figma-bypass-link {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 2147483647;
    transform: translateY(-150%);
    border-radius: 6px;
    background: #111827;
    color: #fff;
    padding: 8px 12px;
    font: 600 14px/1.2 system-ui, sans-serif;
    text-decoration: none;
  }
  .figma-bypass-link:focus {
    transform: translateY(0);
  }
`,
              injectTo: 'head',
            },
            {
              tag: 'a',
              attrs: { class: 'figma-bypass-link', href: '#root' },
              children: 'Skip to content',
              injectTo: 'body-prepend',
            },
          )
        }

        return {
          html: result,
          tags,
        }
      },
    },
  }
}

/**
 * Replay the most recent build error to clients that connect after
 * it was first broadcast. Vite buffers an error payload only while
 * no clients are connected and clears the buffer on the first
 * reconnect (see `bufferedMessage` in `createWebSocketServer`), so
 * if the preview iframe reloads after Vite already delivered an
 * error to a live socket, the new socket misses the payload and
 * the overlay stays hidden even though the build is still broken.
 * We intercept `ws.send` to remember the latest error and replay
 * it on every new connection; the cache clears on a successful
 * `update` or `full-reload` so a stale overlay can't survive a
 * fixed build.
 */
function figmaErrorOverlayReplay(): Plugin {
  return {
    name: 'figma-error-overlay-replay',
    apply: 'serve',
    configureServer(server) {
      let lastError: object | null = null

      const origSend = server.ws.send.bind(server.ws) as (...args: any[]) => void
      server.ws.send = ((...args: any[]) => {
        const payload = args[0]
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const type = (payload as { type?: string }).type
          if (type === 'error') {
            lastError = payload as object
          } else if (type === 'update' || type === 'full-reload') {
            lastError = null
          }
        }
        return origSend(...args)
      }) as typeof server.ws.send

      server.ws.on('connection', (socket) => {
        if (lastError !== null) {
          socket.send(JSON.stringify(lastError))
        }
      })
    },
  }
}

/**
 * Reload when a module that previously defined a React Refresh boundary stops
 * defining one. This happens when an agent moves a component into a new file
 * and replaces the old module with a re-export:
 *
 *   export { default } from './app/App'
 *
 * Vite otherwise accepts the update using the previous module's HMR boundary,
 * but the re-export-only transform no longer registers a replacement for the
 * mounted component family. React reports a successful refresh while leaving
 * the old tree mounted until the page is reloaded.
 */
function figmaReactRefreshBoundaryFallback(): Plugin {
  const hadRefreshBoundary = new Map<string, boolean>()
  let sendFullReload: (() => void) | null = null

  return {
    name: 'figma-react-refresh-boundary-fallback',
    apply: 'serve',
    enforce: 'post',
    configureServer(server) {
      sendFullReload = () => server.ws.send({ type: 'full-reload', path: '*' })
    },
    transform(code, id) {
      if (!/\.[jt]sx?(?:\?|$)/.test(id) || id.includes('/node_modules/')) return null

      const moduleId = id.split('?')[0] ?? id
      const hasRefreshBoundary = code.includes('registerExportsForReactRefresh')
      const previousHadRefreshBoundary = hadRefreshBoundary.get(moduleId)
      hadRefreshBoundary.set(moduleId, hasRefreshBoundary)

      if (previousHadRefreshBoundary && !hasRefreshBoundary) {
        queueMicrotask(() => sendFullReload?.())
      }

      return null
    },
  }
}

/**
 * Serves a blank render-target page at /.figma/make/kit.html that
 * the Figma preview script drives directly. The page exposes a
 * registry of every file matching `storiesGlob` on
 * window.__FIGMA__.stories so the design surface can dynamically
 * import + mount each entry into its own grid view.
 *
 * Dev-only: `apply: 'serve'` gates the plugin to `vite dev`. Prod
 * builds (`vite build`) skip it entirely so the route doesn't leak
 * into shipped bundles.
 */
function figmaMakeKitPlugin(options: { storiesGlob: string | string[] }): Plugin {
  const storiesGlob = Array.isArray(options.storiesGlob) ? options.storiesGlob : [options.storiesGlob]
  const ROUTE = '/.figma/make/kit.html'
  const VIRTUAL_ID = 'virtual:figma-stories'
  const RESOLVED_ID = '\0' + VIRTUAL_ID
  const STORIES_MODULE = `export const stories = import.meta.glob(${JSON.stringify(storiesGlob)})`
  const HTML_BOOTSTRAP = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<div id="figma-make-kit-root"></div>
<script type="module">
  import { stories } from 'virtual:figma-stories'
  window.__FIGMA__ = Object.assign(window.__FIGMA__ ?? {}, { stories })
  window.dispatchEvent(new CustomEvent('figma.ready'))
</script>
</body>
</html>`

  return {
    name: 'figma-make-kit',
    apply: 'serve',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
      return null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      return STORIES_MODULE
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (url.split('?')[0] !== ROUTE) return next()

        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await server.transformIndexHtml(url, HTML_BOOTSTRAP))
        } catch (err) {
          next(err as Error)
        }
      })
    },
  }
}

function cloudUploadPlugin(): Plugin {
  const photoCache = new Map<string, Buffer>()
  const dataDir = path.resolve(__dirname, './.data')

  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true })
    } catch {}
  }

  function readJson(filename: string, defaultValue: any) {
    try {
      const filePath = path.join(dataDir, filename)
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      }
    } catch {}
    return defaultValue
  }

  function writeJson(filename: string, data: any) {
    try {
      const filePath = path.join(dataDir, filename)
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) {
      console.warn(`Failed to write ${filename}:`, e)
    }
  }

  function parseJsonBody(req: any): Promise<any> {
    return new Promise((resolve) => {
      let body = ''
      req.on('data', (chunk: any) => (body += chunk))
      req.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          resolve({})
        }
      })
    })
  }

  function getLocalLanIp() {
    try {
      const os = require('node:os')
      const ifaces = os.networkInterfaces()
      for (const dev in ifaces) {
        for (const details of ifaces[dev]) {
          if (details.family === 'IPv4' && !details.internal) {
            return details.address
          }
        }
      }
    } catch {}
    return '127.0.0.1'
  }

  function getBaseUrl(req: any) {
    if (process.env.PUBLIC_URL) {
      return process.env.PUBLIC_URL.replace(/\/$/, '')
    }
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    }
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'http'
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host
    if (host && !host.includes('127.0.0.1') && !host.includes('localhost')) {
      const proto = host.includes('railway.app') ? 'https' : forwardedProto
      return `${proto}://${host}`
    }
    const port = process.env.PORT || '8443'
    return `http://${getLocalLanIp()}:${port}`
  }

  function setupMiddlewares(middlewares: any) {
    // 0. Universal CORS and JSON Headers Helper
    middlewares.use('/api/', (req: any, res: any, next: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
      }
      next()
    })

    // 1. Sync All Server Assets (GET /api/sync/all)
    middlewares.use('/api/sync/all', (req: any, res: any) => {
      const archive = readJson('archive.json', [])
      const props = readJson('props.json', [])
      const stickers = readJson('stickers.json', [])
      const backgrounds = readJson('backgrounds.json', [])
      const hidden = readJson('hidden.json', { props: [], stickers: [], backgrounds: [] })
      const settings = readJson('settings.json', null)

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ archive, props, stickers, backgrounds, hidden, settings }))
    })

    // 2. Custom Stickers Sync (GET, POST, DELETE)
    middlewares.use('/api/sync/stickers', async (req: any, res: any, next: any) => {
      const url = req.url || ''
      if (url.includes('/delete') && req.method === 'POST') {
        const { id } = await parseJsonBody(req)
        const stickers = readJson('stickers.json', [])
        const filtered = stickers.filter((s: any) => s.id !== id)
        writeJson('stickers.json', filtered)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, stickers: filtered }))
        return
      }

      if (req.method === 'GET') {
        const stickers = readJson('stickers.json', [])
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(stickers))
        return
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req)
        const sticker = body.sticker || body
        if (sticker && sticker.id) {
          const stickers = readJson('stickers.json', [])
          const idx = stickers.findIndex((s: any) => s.id === sticker.id)
          if (idx >= 0) stickers[idx] = sticker
          else stickers.push(sticker)
          writeJson('stickers.json', stickers)
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
        return
      }

      next()
    })

    // 3. Custom Props Sync (GET, POST, DELETE)
    middlewares.use('/api/sync/props', async (req: any, res: any, next: any) => {
      const url = req.url || ''
      if (url.includes('/delete') && req.method === 'POST') {
        const { id } = await parseJsonBody(req)
        const props = readJson('props.json', [])
        const filtered = props.filter((p: any) => p.id !== id)
        writeJson('props.json', filtered)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, props: filtered }))
        return
      }

      if (req.method === 'GET') {
        const props = readJson('props.json', [])
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(props))
        return
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req)
        const prop = body.prop || body
        if (prop && prop.id) {
          const props = readJson('props.json', [])
          const idx = props.findIndex((p: any) => p.id === prop.id)
          if (idx >= 0) props[idx] = prop
          else props.push(prop)
          writeJson('props.json', props)
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
        return
      }

      next()
    })

    // 4. Custom Backgrounds Sync (GET, POST, DELETE)
    middlewares.use('/api/sync/backgrounds', async (req: any, res: any, next: any) => {
      const url = req.url || ''
      if (url.includes('/delete') && req.method === 'POST') {
        const { id } = await parseJsonBody(req)
        const backgrounds = readJson('backgrounds.json', [])
        const filtered = backgrounds.filter((b: any) => b.id !== id)
        writeJson('backgrounds.json', filtered)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, backgrounds: filtered }))
        return
      }

      if (req.method === 'GET') {
        const backgrounds = readJson('backgrounds.json', [])
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(backgrounds))
        return
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req)
        const bg = body.background || body
        if (bg && bg.id) {
          const backgrounds = readJson('backgrounds.json', [])
          const idx = backgrounds.findIndex((b: any) => b.id === bg.id)
          if (idx >= 0) backgrounds[idx] = bg
          else backgrounds.push(bg)
          writeJson('backgrounds.json', backgrounds)
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
        return
      }

      next()
    })

    // 5. Photo Archive Sync (GET, POST, DELETE, CLEAR, FAVORITE)
    middlewares.use('/api/sync/archive', async (req: any, res: any, next: any) => {
      const url = req.url || ''
      if (url.includes('/clear') && req.method === 'POST') {
        writeJson('archive.json', [])
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
        return
      }

      if (url.includes('/delete') && req.method === 'POST') {
        const { id } = await parseJsonBody(req)
        const archive = readJson('archive.json', [])
        const filtered = archive.filter((a: any) => a.id !== id)
        writeJson('archive.json', filtered)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, archive: filtered }))
        return
      }

      if (url.includes('/favorite') && req.method === 'POST') {
        const { id } = await parseJsonBody(req)
        const archive = readJson('archive.json', [])
        let fav = false
        const updated = archive.map((a: any) => {
          if (a.id === id) {
            fav = !a.favorite
            return { ...a, favorite: fav }
          }
          return a
        })
        writeJson('archive.json', updated)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, favorite: fav }))
        return
      }

      if (req.method === 'GET') {
        const archive = readJson('archive.json', [])
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(archive))
        return
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req)
        const item = body.item || body
        if (item && item.id) {
          const archive = readJson('archive.json', [])
          const idx = archive.findIndex((a: any) => a.id === item.id)
          if (idx >= 0) archive[idx] = item
          else archive.unshift(item)
          writeJson('archive.json', archive)
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
        return
      }

      next()
    })

    // 6. Hidden Assets Sync (GET, POST)
    middlewares.use('/api/sync/hidden', async (req: any, res: any, next: any) => {
      if (req.method === 'GET') {
        const hidden = readJson('hidden.json', { props: [], stickers: [], backgrounds: [] })
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(hidden))
        return
      }

      if (req.method === 'POST') {
        const body = await parseJsonBody(req)
        const current = readJson('hidden.json', { props: [], stickers: [], backgrounds: [] })
        if (body.type && body.id) {
          const list: string[] = current[body.type] || []
          const nextList = list.includes(body.id)
            ? list.filter((x: string) => x !== body.id)
            : [...list, body.id]
          current[body.type] = nextList
          writeJson('hidden.json', current)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, hidden: current }))
          return
        }
        if (body.hidden) {
          writeJson('hidden.json', body.hidden)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
          return
        }
      }

      next()
    })

    // 7. Upload & Cache Image for QR
    middlewares.use('/api/upload', async (req: any, res: any, next: any) => {
      if (req.method !== 'POST') return next()

      try {
        const { dataUrl } = await parseJsonBody(req)
        const base64Data = dataUrl.split(',')[1] || dataUrl
        const buffer = Buffer.from(base64Data, 'base64')
        const id = `photo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

        photoCache.set(id, buffer)

        const baseUrl = getBaseUrl(req)
        const mobileUrl = `${baseUrl}/photo/${id}`

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ url: mobileUrl, id }))
      } catch (err: any) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: err.message }))
      }
    })

    // 8. Direct Raw Image Stream
    middlewares.use('/api/raw/', (req: any, res: any, next: any) => {
      const id = req.url?.replace('/', '').split('?')[0] || ''
      const buffer = photoCache.get(id)
      if (buffer) {
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Cache-Control', 'public, max-age=86400')
        res.end(buffer)
      } else {
        res.statusCode = 404
        res.end('Photo not found')
      }
    })

    // 9. Direct Image Download Attachment
    middlewares.use('/api/download/', (req: any, res: any, next: any) => {
      const id = req.url?.replace('/', '').split('?')[0] || ''
      const buffer = photoCache.get(id)
      if (buffer) {
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Content-Disposition', `attachment; filename="itguild-${id}.png"`)
        res.end(buffer)
      } else {
        res.statusCode = 404
        res.end('Photo not found')
      }
    })

    // 10. Mobile Web Photo Viewer Page
    middlewares.use('/photo/', (req: any, res: any, next: any) => {
      const id = req.url?.replace('/', '').split('?')[0] || ''
      const buffer = photoCache.get(id)
      if (!buffer) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/html')
        res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>IT GUILD - Photo Not Found</title>
  <style>
    body { background: #eaf4ff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; color: #5b7fcb; }
    .box { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); max-width: 320px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Photo Expired or Not Found</h2>
    <p>Please take a new photo in the booth.</p>
  </div>
</body>
</html>`)
        return
      }

      const rawImgUrl = `/api/raw/${id}`
      const downloadUrl = `/api/download/${id}`

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>IT GUILD - Your Photo</title>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Nunito:wght@700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: linear-gradient(180deg, #eaf4ff 0%, #91b5ff 100%) fixed;
      min-height: 100vh;
      font-family: 'Nunito', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      padding: 12px;
      border-radius: 12px;
      box-shadow: 0 12px 36px rgba(91, 111, 188, 0.35);
      max-width: 380px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      animation: fadeIn 0.4s ease-out;
    }
    .photo-img {
      width: 100%;
      height: auto;
      border-radius: 4px;
      display: block;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .btn {
      margin-top: 16px;
      background: #8198ed;
      color: white;
      text-decoration: none;
      font-family: 'Press Start 2P', monospace;
      font-size: 11px;
      padding: 14px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 0 #5b6fbc;
      text-align: center;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: transform 0.1s, background 0.1s;
    }
    .btn:active {
      transform: translateY(2px);
      box-shadow: 0 2px 0 #5b6fbc;
    }
    .hint {
      margin-top: 12px;
      font-size: 12px;
      color: #5b6fbc;
      font-weight: bold;
      text-align: center;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <div class="card">
    <img src="${rawImgUrl}" alt="Your Photobooth Strip" class="photo-img" />
    <a href="${downloadUrl}" download="itguild-photo.png" class="btn">
      <span>💾</span>
      <span>Save to Phone</span>
    </a>
    <p class="hint">Long-press image to save to Camera Roll!</p>
  </div>
</body>
</html>`

      res.setHeader('Content-Type', 'text/html')
      res.end(html)
    })
  }

  return {
    name: 'cloud-upload-middleware',
    configureServer(server) {
      setupMiddlewares(server.middlewares)
    },
    configurePreviewServer(server) {
      setupMiddlewares(server.middlewares)
    },
  }
}

