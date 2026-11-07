import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const domain = readFileSync(new URL('../lib/domain.js', import.meta.url), 'utf8')
const service = readFileSync(new URL('../lib/service.js', import.meta.url), 'utf8')
const catalog = readFileSync(new URL('../lib/export.js', import.meta.url), 'utf8')
const verify = readFileSync(new URL('../scripts/verify.mjs', import.meta.url), 'utf8')
const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8')

test('the prompt uses the same rule as showPrompt and names no video', () => {
  assert.match(domain, /running === true && sidebarVisible !== true/)
  assert.match(client, /running === true && sidebarVisible !== true/)
  assert.match(client, /useSession\(\(snapshot\) => snapshot\.running === true\)/)
  assert.match(client, /data-sidebar-right-open/)
  const prompt = client.slice(client.indexOf('function Prompt'), client.indexOf('function FooterButton'))
  assert.equal(prompt.includes('.title'), false)
  assert.equal(prompt.includes('thumbnail'), false)
  assert.match(prompt, /看视频列表/)
})

test('the client shows the export credit and no pictures', () => {
  assert.match(client, /https:\/\/hackertube\.org\//)
  assert.match(client, /https:\/\/opendatacommons\.org\/licenses\/by\/1-0\//)
  assert.match(client, /https:\/\/huggingface\.co\/datasets\/open-index\/hacker-news/)
  assert.match(client, /独立第三方/)
  assert.equal(/<img|ytimg|thumbnailUrl|durationLabel|\/api\/feed/.test(client), false)
})

test('default code does not call the live feed or YouTube image hosts', () => {
  const runtime = `${service}\n${catalog}\n${domain}\n${verify}\n${host}\n${client}`
  assert.equal(/\/api\/feed|i\.ytimg\.com|duration_s/.test(runtime), false)
  assert.match(catalog, /https:\/\/hackertube\.org\/download\/videos\.jsonl/)
})

test('the client never opens a browser itself', () => {
  assert.equal(/window\.open|xdg-open|execFile|child_process|Google Chrome/.test(client), false)
  assert.match(client, /\/api\/hackertube\/open/)
  assert.match(client, /复制链接/)
})

test('the host does not choose the system browser', () => {
  assert.equal(/xdg-open|cmd/.test(host), false)
  assert.match(host, /createService/)
})
