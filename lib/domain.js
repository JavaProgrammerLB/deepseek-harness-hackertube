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

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

export function launchPlan(platform, vid) {
  if (typeof vid !== 'string' || !YOUTUBE_ID.test(vid)) {
    return { ok: false, code: 'bad-target' }
  }
  const url = `https://www.youtube.com/watch?v=${vid}`
  if (platform !== 'darwin') return { ok: false, code: 'not-mac', url }
  return { ok: true, url, file: 'open', args: ['-a', 'Google Chrome', url] }
}

export function failureMessage(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return '读取导出超时'
  if (typeof error?.message === 'string' && (error.message.startsWith('导出') || error.message.startsWith('读取导出'))) {
    return error.message
  }
  return '连不上导出文件'
}

function presentItem(item) {
  return {
    title: item.title,
    vid: item.vid,
    channel: item.channel,
    watchUrl: item.watchUrl,
  }
}

function retainedItems(state) {
  if (state.status === 'ready') return state.items
  if (state.status === 'loading' || state.status === 'failed') return state.previous
  return null
}
