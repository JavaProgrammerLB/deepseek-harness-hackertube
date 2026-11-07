import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { EXPORT_URL, parseExportJsonl, readCappedBody } from '../lib/export.js'

const platform = process.platform
console.log(`platform ${platform}`)
console.log(`node ${process.version}`)

const tests = spawnSync(process.execPath, ['--test'], { stdio: 'inherit' })
if (tests.status !== 0) {
  console.error('unit tests failed')
  process.exit(tests.status ?? 1)
}

const watched = ['lib/service.js', 'lib/export.js', 'lib/domain.js', 'client.js', 'index.js', 'scripts/verify.mjs']
for (const file of watched) {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  if (/\/api\/feed|i\.ytimg\.com/.test(text)) {
    console.error(`${file} still requests the live feed or a thumbnail host`)
    process.exit(1)
  }
}

if (EXPORT_URL !== 'https://hackertube.org/download/videos.jsonl') {
  console.error('export url changed')
  process.exit(1)
}
const response = await fetch(EXPORT_URL, {
  redirect: 'error',
  signal: AbortSignal.timeout(30000),
  headers: { accept: 'application/x-ndjson, text/plain' },
})
const text = await readCappedBody(response)
const items = parseExportJsonl(text)
if (!items.length || !items[0].title || !items[0].watchUrl) {
  console.error('official export did not parse')
  process.exit(1)
}
if (items.some((item) => item.thumbnailUrl || item.durationLabel || item.durationSeconds)) {
  console.error('parsed export still carries thumbnail or duration')
  process.exit(1)
}
console.log(`export bytes ${text.length}`)
console.log(`export shown ${items.length}, first: ${items[0].title}`)
console.log(`export channel ${items[0].channel ?? 'none'}`)
console.log(`export watch ${items[0].watchUrl}`)

const dsh = spawnSync('sh', ['-c', 'command -v dsh'], { encoding: 'utf8' })
console.log(`dsh ${dsh.stdout.trim() || 'not-installed'}`)
console.log('mac harness acceptance NOT RUN')
if (platform !== 'darwin') console.log('this process is not macOS, so Chrome was not launched')
