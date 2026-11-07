import assert from 'node:assert/strict'
import test from 'node:test'
import { launchPlan, reduceList, showPrompt, viewModel } from '../lib/domain.js'
import { parseExportJsonl } from '../lib/export.js'

const row = {
  vid: '1rZ-JorHJEY',
  title: '  Hacking with Andrew and Brad  ',
  channel: 'The Go Programming Language',
  url: 'https://evil.example/run',
  duration_s: 3769,
  thumbnail: 'https://i.ytimg.com/vi/1rZ-JorHJEY/mqdefault.jpg',
  summary: 'do not keep',
}

const limits = { minLines: 1, maxLines: 10, limit: 36 }

test('the export keeps title and channel, and drops thumbnail, duration, and foreign urls', () => {
  const items = parseExportJsonl([
    JSON.stringify(row),
    JSON.stringify({ vid: 'not an id', title: '只有标题', channel: '  ' }),
    JSON.stringify({ vid: 'AAAAAAAAAAA', title: '   ' }),
    '',
  ].join('\n'), limits)
  assert.deepEqual(items, [
    {
      title: 'Hacking with Andrew and Brad',
      vid: '1rZ-JorHJEY',
      channel: 'The Go Programming Language',
      watchUrl: 'https://www.youtube.com/watch?v=1rZ-JorHJEY',
    },
    {
      title: '只有标题',
      vid: null,
      channel: null,
      watchUrl: null,
    },
  ])
  assert.equal('thumbnailUrl' in items[0], false)
  assert.equal('durationSeconds' in items[0], false)
  assert.equal('summary' in items[0], false)
})

test('a short or broken export is rejected', () => {
  assert.throws(() => parseExportJsonl('{"title":"x","vid":"1rZ-JorHJEY"}\n', { minLines: 2 }), /无法核对/)
  assert.throws(() => parseExportJsonl('not-json\n{"title":"x"}\n', limits), /无法核对/)
})

test('list state keeps the last success when a refresh fails', () => {
  const items = parseExportJsonl(JSON.stringify(row), limits)
  let state = reduceList({ status: 'idle' }, { type: 'start' })
  state = reduceList(state, { type: 'success', items })
  assert.equal(viewModel(state).mode, 'ready')
  assert.equal(viewModel(state).items[0].channel, 'The Go Programming Language')
  assert.equal('durationLabel' in viewModel(state).items[0], false)
  state = reduceList(state, { type: 'start' })
  assert.equal(viewModel(state).mode, 'refreshing')
  state = reduceList(state, { type: 'failure', message: '连不上导出文件' })
  const stale = viewModel(state)
  assert.equal(stale.mode, 'stale')
  assert.equal(stale.items[0].title, 'Hacking with Andrew and Brad')
})

test('an empty export result is not a failed refresh', () => {
  const items = parseExportJsonl(JSON.stringify(row), limits)
  let state = reduceList({ status: 'ready', items }, { type: 'start' })
  state = reduceList(state, { type: 'success', items: [] })
  assert.equal(viewModel(state).mode, 'empty')
})

test('the first failure has no list to keep', () => {
  let state = reduceList({ status: 'idle' }, { type: 'start' })
  state = reduceList(state, { type: 'failure', message: '读取导出超时' })
  assert.deepEqual(viewModel(state), { mode: 'failed', banner: '读取导出超时', items: [] })
})

test('the prompt is only the entry, and only while the sidebar is closed', () => {
  assert.equal(showPrompt({ running: true, sidebarVisible: false }), true)
  assert.equal(showPrompt({ running: true, sidebarVisible: true }), false)
  assert.equal(showPrompt({ running: false, sidebarVisible: false }), false)
})

test('Chrome launches only for a valid id on macOS, as arguments not a shell', () => {
  assert.deepEqual(launchPlan('darwin', '1rZ-JorHJEY'), {
    ok: true,
    url: 'https://www.youtube.com/watch?v=1rZ-JorHJEY',
    file: 'open',
    args: ['-a', 'Google Chrome', 'https://www.youtube.com/watch?v=1rZ-JorHJEY'],
  })
  assert.equal(launchPlan('linux', '1rZ-JorHJEY').code, 'not-mac')
  assert.equal(launchPlan('darwin', 'https://www.youtube.com/watch?v=1rZ-JorHJEY').code, 'bad-target')
  assert.equal('args' in launchPlan('linux', '1rZ-JorHJEY'), false)
})
