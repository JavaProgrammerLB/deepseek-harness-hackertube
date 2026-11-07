export const EXPORT_URL = 'https://hackertube.org/download/videos.jsonl'
export const EXPORT_MAX_BYTES = 12_000_000
export const EXPORT_MIN_BYTES = 1_000_000
export const EXPORT_MIN_LINES = 1000
export const EXPORT_MAX_LINES = 30_000
export const LIST_LIMIT = 36

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

export function parseExportJsonl(text, options = {}) {
  if (typeof text !== 'string') throw new Error('导出不是文本')
  const minLines = options.minLines ?? EXPORT_MIN_LINES
  const maxLines = options.maxLines ?? EXPORT_MAX_LINES
  const limit = options.limit ?? LIST_LIMIT
  const items = []
  let parsed = 0
  let bad = 0
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    parsed += 1
    if (parsed > maxLines) throw new Error('导出内容无法核对')
    let row
    try {
      row = JSON.parse(trimmed)
    } catch {
      bad += 1
      continue
    }
    const item = exportItem(row)
    if (item) items.push(item)
  }
  if (parsed < minLines || bad > parsed * 0.01) throw new Error('导出内容无法核对')
  if (items.length === 0) throw new Error('导出里没有可显示的标题')
  return items.slice(0, limit)
}

export async function readCappedBody(response, options = {}) {
  const maxBytes = options.maxBytes ?? EXPORT_MAX_BYTES
  const minBytes = options.minBytes ?? EXPORT_MIN_BYTES
  if (!response?.ok) throw new Error(`导出请求失败（${response?.status ?? '未知'}）`)
  const declared = Number(response.headers?.get?.('content-length'))
  if (Number.isFinite(declared) && (declared < minBytes || declared > maxBytes)) {
    throw new Error('导出大小对不上')
  }
  const reader = response.body?.getReader?.()
  if (!reader) throw new Error('导出不是文本')
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error('导出比预期大，已停止')
    }
    chunks.push(value)
  }
  if (total < minBytes) throw new Error('导出内容太短')
  if (Number.isFinite(declared) && declared !== total) throw new Error('导出大小对不上')
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

function exportItem(row) {
  if (!row || typeof row !== 'object') return null
  const title = typeof row.title === 'string' ? row.title.trim() : ''
  if (!title) return null
  const vid = typeof row.vid === 'string' && YOUTUBE_ID.test(row.vid) ? row.vid : null
  const channel = typeof row.channel === 'string' && row.channel.trim() ? row.channel.trim() : null
  return {
    title,
    vid,
    channel,
    watchUrl: vid ? `https://www.youtube.com/watch?v=${vid}` : null,
  }
}
