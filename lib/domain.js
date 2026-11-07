/** First page size used by the HackTube homepage before infinite scroll. */
export const HOME_PAGE_SIZE = 36

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

export function feedUrl(seed) {
  const cleaned = String(seed).replace(/[^0-9]/g, '')
  if (!cleaned) throw new Error('seed')
  const params = new URLSearchParams({
    offset: '0',
    n: String(HOME_PAGE_SIZE),
    seed: cleaned,
  })
  return `https://hackertube.org/api/feed?${params}`
}

export function parseFeed(payload) {
  if (!Array.isArray(payload)) throw new Error('首页响应不是列表')
  const items = []
  for (const row of payload) {
    if (!row || typeof row !== 'object') continue
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!title) continue
    const vid = typeof row.vid === 'string' && YOUTUBE_ID.test(row.vid) ? row.vid : null
    items.push({
      title,
      vid,
      channel: cleanText(row.channel),
      durationSeconds: cleanDuration(row.duration_s),
      thumbnailUrl: cleanHttps(row.thumbnail),
      watchUrl: vid ? `https://www.youtube.com/watch?v=${vid}` : null,
    })
  }
  return items
}

export function formatDuration(seconds) {
  if (!Number.isInteger(seconds) || seconds <= 0) return null
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remain = seconds % 60
  const pad = (value) => String(value).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(remain)}`
  return `${minutes}:${pad(remain)}`
}

export function reduceList(state, event) {
  if (event.type === 'start') {
    return { status: 'loading', previous: retainedItems(state) }
  }
  if (event.type === 'success') {
    if (event.items.length === 0) return { status: 'empty' }
    return { status: 'ready', items: event.items }
  }
  if (event.type === 'failure') {
    const previous = state.status === 'loading' ? state.previous : retainedItems(state)
    return { status: 'failed', message: event.message, previous }
  }
  return state
}

export function viewModel(state) {
  if (state.status === 'ready') {
    return { mode: 'ready', banner: null, items: state.items.map(presentItem) }
  }
  if (state.status === 'empty') return { mode: 'empty', banner: null, items: [] }
  if (state.status === 'loading') {
    if (!state.previous) return { mode: 'loading', banner: null, items: [] }
    return { mode: 'refreshing', banner: null, items: state.previous.map(presentItem) }
  }
  if (state.status === 'failed') {
    if (state.previous?.length) {
      return { mode: 'stale', banner: state.message, items: state.previous.map(presentItem) }
    }
    return { mode: 'failed', banner: state.message, items: [] }
  }
  return { mode: 'loading', banner: null, items: [] }
}

export function showPrompt({ running, sidebarVisible }) {
  return running === true && sidebarVisible !== true
}

export function launchPlan(platform, vid) {
  if (typeof vid !== 'string' || !YOUTUBE_ID.test(vid)) {
    return { ok: false, code: 'bad-target' }
  }
  const url = `https://www.youtube.com/watch?v=${vid}`
  if (platform !== 'darwin') return { ok: false, code: 'not-mac', url }
  return { ok: true, url, file: 'open', args: ['-a', 'Google Chrome', url] }
}

export function failureMessage(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return '读取首页超时'
  if (error?.message === '首页响应不是列表') return error.message
  if (typeof error?.message === 'string' && error.message.startsWith('首页请求失败')) return error.message
  return '连不上 HackTube'
}

function presentItem(item) {
  return {
    title: item.title,
    vid: item.vid,
    channel: item.channel,
    thumbnailUrl: item.thumbnailUrl,
    watchUrl: item.watchUrl,
    durationLabel: formatDuration(item.durationSeconds),
  }
}

function retainedItems(state) {
  if (state.status === 'ready') return state.items
  if (state.status === 'loading' || state.status === 'failed') return state.previous
  return null
}

function cleanText(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text || null
}

function cleanDuration(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function cleanHttps(value) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}
