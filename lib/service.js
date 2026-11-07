import { execFile } from 'node:child_process'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { failureMessage, launchPlan, reduceList, viewModel } from './domain.js'
import { EXPORT_URL, parseExportJsonl, readCappedBody } from './export.js'

const execFileAsync = promisify(execFile)

export function cacheFile(dir) {
  const root = dir
    || (process.env.DSH_PLUGIN_DATA_DIR
      ? join(process.env.DSH_PLUGIN_DATA_DIR, 'dsh-hackertube')
      : join(homedir(), '.dsh', 'plugin-data', 'dsh-hackertube'))
  return join(root, 'videos.jsonl')
}

export function createService(options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const platform = options.platform ?? process.platform
  const launch = options.launch ?? defaultLaunch
  const limits = {
    maxBytes: options.maxBytes,
    minBytes: options.minBytes,
    minLines: options.minLines,
    maxLines: options.maxLines,
    limit: options.limit,
  }
  const readCache = options.readCache ?? (async () => {
    try {
      return await readFile(cacheFile(options.cacheDir), 'utf8')
    } catch {
      return ''
    }
  })
  const writeCache = options.writeCache ?? (async (text) => {
    const file = cacheFile(options.cacheDir)
    await mkdir(dirname(file), { recursive: true })
    const temporary = `${file}.tmp`
    await writeFile(temporary, text)
    await rename(temporary, file)
  })
  let state = { status: 'idle' }
  let pending = null

  return {
    view() {
      return viewModel(state)
    },
    load() {
      if (pending) return pending
      state = reduceList(state, { type: 'start' })
      pending = runLoad().finally(() => {
        pending = null
      })
      return pending
    },
    async open(vid) {
      const plan = launchPlan(platform, vid)
      if (!plan.ok) return plan
      try {
        await launch(plan.file, plan.args)
        return { ok: true, url: plan.url }
      } catch {
        return { ok: false, code: 'chrome-failed', url: plan.url }
      }
    },
  }

  async function runLoad() {
    try {
      const response = await fetchImpl(EXPORT_URL, {
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
        headers: { accept: 'application/x-ndjson, text/plain, application/json' },
      })
      const text = await readCappedBody(response, limits)
      const items = parseExportJsonl(text, limits)
      try {
        await writeCache(text)
      } catch {
        // The list is already checked. A cache write failure still shows it.
      }
      state = reduceList(state, { type: 'success', items })
    } catch (error) {
      let previous = state.status === 'loading' ? state.previous : null
      if (!previous?.length) previous = await cachedItems()
      state = { status: 'failed', message: failureMessage(error), previous }
    }
    return viewModel(state)
  }

  async function cachedItems() {
    try {
      const text = await readCache()
      if (!text) return null
      return parseExportJsonl(text, limits)
    } catch {
      return null
    }
  }
}

export function defaultLaunch(file, args) {
  return execFileAsync(file, args, { timeout: 8000 })
}

export async function handle(service, method, pathname, body) {
  if (method === 'GET' && pathname === '/api/hackertube/list') {
    return { status: 200, json: service.view() }
  }
  if (method === 'POST' && pathname === '/api/hackertube/load') {
    return { status: 200, json: await service.load() }
  }
  if (method === 'POST' && pathname === '/api/hackertube/open') {
    const vid = body && typeof body.vid === 'string' ? body.vid : ''
    const result = await service.open(vid)
    return { status: result.ok ? 200 : 400, json: result }
  }
  return { status: 404, json: { error: '没有这个地址' } }
}
