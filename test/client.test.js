import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const domain = readFileSync(new URL('../lib/domain.js', import.meta.url), 'utf8')
const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8')

test('the prompt uses the same rule as showPrompt and names no video', () => {
  assert.match(domain, /running === true && sidebarVisible !== true/)
  assert.match(client, /running === true && sidebarVisible !== true/)
  assert.match(client, /useSession\(\(snapshot\) => snapshot\.running === true\)/)
  assert.match(client, /data-sidebar-right-open/)
  assert.match(client, /visibleW >= 8 && visibleH >= 8/)
  const prompt = client.slice(client.indexOf('function Prompt'), client.indexOf('function FooterButton'))
  assert.equal(prompt.includes('useSessionStatus'), false)
  assert.equal(prompt.includes('.title'), false)
  assert.equal(prompt.includes('thumbnail'), false)
  assert.match(prompt, /看首页视频/)
})

test('the client never opens a browser itself', () => {
  assert.equal(/window\.open|xdg-open|execFile|child_process|Google Chrome/.test(client), false)
  assert.match(client, /\/api\/hackertube\/open/)
  assert.match(client, /复制链接/)
  assert.match(client, /没有封面/)
})

test('the host does not choose the system browser', () => {
  assert.equal(/xdg-open|cmd/.test(host), false)
  assert.match(host, /createService/)
})
