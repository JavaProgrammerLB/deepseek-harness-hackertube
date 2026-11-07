import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { failureMessage, feedUrl, launchPlan, parseFeed, reduceList, viewModel } from './domain.js'

const execFileAsync = promisify(execFile)

export function createService(options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const platform = options.platform ?? process.platform
  const launch = options.launch ?? defaultLaunch
  const nextSeed = options.nextSeed ?? (() => Math.floor(Math.random() * 1e9))
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
      const url = feedUrl(nextSeed())
      const response = await fetchImpl(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`首页请求失败（${response.status}）`)
      const items = parseFeed(await response.json())
      state = reduceList(state, { type: 'success', items })
    } catch (error) {
      state = reduceList(state, { type: 'failure', message: failureMessage(error) })
    }
    return viewModel(state)
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
