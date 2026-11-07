import assert from 'node:assert/strict'
import test from 'node:test'
import { EXPORT_URL } from '../lib/export.js'
import { createService, handle } from '../lib/service.js'

const line = JSON.stringify({
  vid: '1rZ-JorHJEY',
  title: 'Hacking with Andrew and Brad',
  channel: 'The Go Programming Language',
  url: 'https://evil.example/run',
  duration_s: 90,
  thumbnail: 'https://i.ytimg.com/vi/1rZ-JorHJEY/mqdefault.jpg',
})

const small = { minBytes: 1, minLines: 1, maxLines: 10 }

function deferred() {
  let resolve
  const promise = new Promise((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function bodyOf(text, { status = 200, length } = {}) {
  const bytes = new TextEncoder().encode(text)
  let offset = 0
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-length' ? String(length ?? bytes.byteLength) : null
      },
    },
    body: {
      getReader() {
        return {
          async read() {
            if (offset >= bytes.byteLength) return { done: true }
            const value = bytes.subarray(offset, Math.min(bytes.byteLength, offset + 32))
            offset += value.byteLength
            return { done: false, value }
          },
          async cancel() {
            offset = bytes.byteLength
          },
        }
      },
    },
  }
}

function guard(url) {
  if (String(url).includes('/api/feed') || String(url).includes('ytimg.com') || String(url).includes('youtube.com')) {
    throw new Error(`unexpected request ${url}`)
  }
}

test('load reads the official export once and does not touch the live feed', async () => {
  const gate = deferred()
  const seen = []
  const writes = []
  const service = createService({
    ...small,
    platform: 'linux',
    readCache: async () => '',
    writeCache: async (text) => writes.push(text),
    async fetch(url, options) {
      guard(url)
      seen.push({ url, redirect: options.redirect })
      await gate.promise
      return bodyOf(`${line}\n`)
    },
  })
  const first = service.load()
  const second = service.load()
  assert.equal(service.view().mode, 'loading')
  gate.resolve()
  const view = await first
  assert.equal(await second, view)
  assert.deepEqual(seen, [{ url: EXPORT_URL, redirect: 'error' }])
  assert.equal(writes.length, 1)
  assert.equal(view.mode, 'ready')
  assert.equal(view.items[0].watchUrl, 'https://www.youtube.com/watch?v=1rZ-JorHJEY')
  assert.equal(view.items[0].channel, 'The Go Programming Language')
  assert.equal(view.items[0].thumbnailUrl, undefined)
  assert.equal(view.items[0].durationLabel, undefined)
})

test('a failed refresh keeps the previous list and does not replace the cache', async () => {
  let attempt = 0
  const writes = []
  const service = createService({
    ...small,
    platform: 'linux',
    readCache: async () => '',
    writeCache: async (text) => writes.push(text),
    async fetch(url) {
      guard(url)
      attempt += 1
      if (attempt === 1) return bodyOf(`${line}\n`)
      throw new Error('network down')
    },
  })
  assert.equal((await service.load()).mode, 'ready')
  const again = await service.load()
  assert.equal(again.mode, 'stale')
  assert.equal(again.banner, '连不上导出文件')
  assert.equal(again.items[0].title, 'Hacking with Andrew and Brad')
  assert.equal(writes.length, 1)
})

test('offline with no cache says the export could not be read', async () => {
  const service = createService({
    ...small,
    readCache: async () => '',
    writeCache: async () => {
      throw new Error('should not write')
    },
    async fetch() {
      throw new Error('offline')
    },
  })
  const view = await service.load()
  assert.equal(view.mode, 'failed')
  assert.equal(view.banner, '连不上导出文件')
  assert.deepEqual(view.items, [])
})

test('a failed first download can still show a previously saved export', async () => {
  const service = createService({
    ...small,
    readCache: async () => `${line}\n`,
    writeCache: async () => {
      throw new Error('should not write')
    },
    async fetch() {
      throw new Error('offline')
    },
  })
  const view = await service.load()
  assert.equal(view.mode, 'stale')
  assert.equal(view.items[0].title, 'Hacking with Andrew and Brad')
})

test('an oversized export is stopped and not cached', async () => {
  const writes = []
  const service = createService({
    ...small,
    maxBytes: 8,
    readCache: async () => '',
    writeCache: async (text) => writes.push(text),
    async fetch() {
      return bodyOf(`${line}\n`, { length: 99999 })
    },
  })
  const view = await service.load()
  assert.equal(view.mode, 'failed')
  assert.equal(view.banner, '导出大小对不上')
  assert.equal(writes.length, 0)
})

test('open ignores a caller-supplied url and does not launch off macOS', async () => {
  const launches = []
  const service = createService({
    platform: 'linux',
    launch(file, args) {
      launches.push({ file, args })
    },
  })
  const blocked = await handle(service, 'POST', '/api/hackertube/open', {
    vid: '1rZ-JorHJEY',
    url: 'https://evil.example/run',
  })
  assert.equal(blocked.status, 400)
  assert.equal(blocked.json.code, 'not-mac')
  assert.equal(blocked.json.url, 'https://www.youtube.com/watch?v=1rZ-JorHJEY')
  assert.deepEqual(launches, [])
  const bad = await handle(service, 'POST', '/api/hackertube/open', { url: 'https://www.youtube.com/watch?v=1rZ-JorHJEY' })
  assert.equal(bad.json.code, 'bad-target')
})

test('open on macOS launches Chrome with the built watch url', async () => {
  const launches = []
  const service = createService({
    platform: 'darwin',
    launch(file, args) {
      launches.push({ file, args })
    },
  })
  const opened = await service.open('1rZ-JorHJEY')
  assert.equal(opened.ok, true)
  assert.deepEqual(launches, [{
    file: 'open',
    args: ['-a', 'Google Chrome', 'https://www.youtube.com/watch?v=1rZ-JorHJEY'],
  }])
})

test('unknown routes and list reads do not fetch', async () => {
  let calls = 0
  const service = createService({
    fetch() {
      calls += 1
      throw new Error('should not fetch')
    },
  })
  const missing = await handle(service, 'GET', '/api/hackertube/open', null)
  assert.equal(missing.status, 404)
  const current = await handle(service, 'GET', '/api/hackertube/list', null)
  assert.equal(current.json.mode, 'loading')
  assert.equal(calls, 0)
})
