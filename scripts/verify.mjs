import { spawnSync } from 'node:child_process'
import { feedUrl, parseFeed } from '../lib/domain.js'

const platform = process.platform
console.log(`platform ${platform}`)
console.log(`node ${process.version}`)

const tests = spawnSync(process.execPath, ['--test'], { stdio: 'inherit' })
if (tests.status !== 0) {
  console.error('unit tests failed')
  process.exit(tests.status ?? 1)
}

const url = feedUrl(1)
const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000) })
if (!response.ok) {
  console.error(`live feed HTTP ${response.status}`)
  process.exit(1)
}
const payload = await response.json()
const items = parseFeed(payload)
const titles = payload
  .filter((row) => row && typeof row.title === 'string' && row.title.trim())
  .map((row) => row.title.trim())
if (items.map((item) => item.title).join('\n') !== titles.join('\n')) {
  console.error('live feed parse changed titles or order')
  process.exit(1)
}
if (!items.length) {
  console.error('live feed parsed to an empty list')
  process.exit(1)
}
const acao = response.headers.get('access-control-allow-origin')
console.log(`live feed ${items.length} items, first: ${items[0].title}`)
console.log(`live watch ${items[0].watchUrl}`)
console.log(`live cors ${acao ?? 'none'}`)

const dsh = spawnSync('sh', ['-c', 'command -v dsh'], { encoding: 'utf8' })
const chrome = spawnSync('sh', ['-c', 'command -v google-chrome || command -v chromium || true'], { encoding: 'utf8' })
console.log(`dsh ${dsh.stdout.trim() || 'not-installed'}`)
console.log(`chrome-on-this-machine ${chrome.stdout.trim() || 'not-installed'}`)
console.log('mac harness acceptance NOT RUN')
if (platform !== 'darwin') {
  console.log('this process is not macOS, so Chrome was not launched')
}
