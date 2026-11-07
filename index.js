import { createService, handle } from './lib/service.js'

export const name = 'dsh-hackertube'

const PREFIX = '/api/hackertube'

export function apply(ctx) {
  const service = createService()
  const logger = ctx.logger ?? { warn() {} }
  ctx.inject(['webServer'], (web) => {
    const dispose = ctx.effect(() => {
      const stop = web.webServer.register({
        kind: 'prefix',
        path: PREFIX,
        handler(request, response) {
          Promise.resolve(serve(service, request, response)).catch((error) => {
            logger.warn?.(`[hackertube] ${error?.stack ?? error}`)
            if (!response.headersSent) response.statusCode = 500
            response.end()
          })
        },
      })
      return () => stop()
    }, 'hackertube: routes')
    return dispose
  })
}

async function serve(service, request, response) {
  const url = new URL(request.url, 'http://localhost')
  const body = request.method === 'POST' ? await readJson(request) : null
  const result = await handle(service, request.method, url.pathname, body)
  response.statusCode = result.status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify(result.json))
}

async function readJson(request) {
  let raw = ''
  for await (const chunk of request) {
    raw += chunk
    if (raw.length > 4096) return {}
  }
  try {
    const value = JSON.parse(raw || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}
