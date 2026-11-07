import assert from 'node:assert/strict'
import test from 'node:test'
import { createService, handle } from '../lib/service.js'

const video = {
  vid: '1rZ-JorHJEY',
  title: 'Hacking with Andrew and Brad',
  channel: 'The Go Programming Language',
  duration_s: 90,
  thumbnail: 'https://i.ytimg.com/vi/1rZ-JorHJEY/mqdefault.jpg',
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('load requests the homepage once and a second caller waits for it', async () => {
  const gate = deferred()
  const seen = []
  const service = createService({
    platform: 'linux',
    nextSeed: () => 7,
    async fetch(url, options) {
      seen.push({ url, redirect: options.redirect })
      await gate.promise
      return { ok: true, status: 200, async json() { return [video] } }
    },
  })
  const first = service.load()
  const second = service.load()
  assert.equal(service.view().mode, 'loading')
  gate.resolve()
  const view = await first
  assert.equal(await second, view)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].redirect, 'error')
  assert.match(seen[0].url, /n=36/)
  assert.match(seen[0].url, /seed=7/)
  assert.equal(view.mode, 'ready')
  assert.equal(view.items[0].watchUrl, 'https://www.youtube.com/watch?v=1rZ-JorHJEY')
})

test('a failed refresh keeps the previous list', async () => {
  let attempt = 0
  const service = createService({
    platform: 'linux',
    nextSeed: () => 1,
    async fetch() {
      attempt += 1
      if (attempt === 1) return { ok: true, status: 200, async json() { return [video] } }
      throw new Error('network down')
    },
  })
  assert.equal((await service.load()).mode, 'ready')
  const again = await service.load()
  assert.equal(again.mode, 'stale')
  assert.equal(again.banner, '连不上 HackTube')
  assert.equal(again.items[0].title, video.title)
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
  assert.equal(bad.json.url, undefined)
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
  const failed = createService({
    platform: 'darwin',
    launch() {
      throw new Error('Unable to find application named Google Chrome')
    },
  })
  const result = await failed.open('1rZ-JorHJEY')
  assert.equal(result.ok, false)
  assert.equal(result.code, 'chrome-failed')
  assert.equal(result.url, 'https://www.youtube.com/watch?v=1rZ-JorHJEY')
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
