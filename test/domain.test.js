import assert from 'node:assert/strict'
import test from 'node:test'
import {
  feedUrl,
  formatDuration,
  launchPlan,
  parseFeed,
  reduceList,
  showPrompt,
  viewModel,
} from '../lib/domain.js'

const row = {
  vid: '1rZ-JorHJEY',
  title: '  Hacking with Andrew and Brad  ',
  channel: 'The Go Programming Language',
  duration_s: 3769,
  thumbnail: 'https://i.ytimg.com/vi/1rZ-JorHJEY/mqdefault.jpg',
  summary: 'do not keep',
}

test('parseFeed keeps homepage order and only the fields we show', () => {
  const items = parseFeed([
    row,
    { vid: 'not an id', title: '只有标题', channel: '  ', duration_s: '12', thumbnail: 'http://evil.test/a.jpg' },
    { vid: 'AAAAAAAAAAA', title: '   ' },
    null,
  ])
  assert.deepEqual(items.map((item) => item.title), ['Hacking with Andrew and Brad', '只有标题'])
  assert.deepEqual(items[0], {
    title: 'Hacking with Andrew and Brad',
    vid: '1rZ-JorHJEY',
    channel: 'The Go Programming Language',
    durationSeconds: 3769,
    thumbnailUrl: 'https://i.ytimg.com/vi/1rZ-JorHJEY/mqdefault.jpg',
    watchUrl: 'https://www.youtube.com/watch?v=1rZ-JorHJEY',
  })
  assert.equal(items[1].vid, null)
  assert.equal(items[1].watchUrl, null)
  assert.equal(items[1].channel, null)
  assert.equal(items[1].durationSeconds, null)
  assert.equal(items[1].thumbnailUrl, null)
  assert.equal('summary' in items[0], false)
})

test('parseFeed rejects a non-list payload', () => {
  assert.throws(() => parseFeed({ items: [] }), /不是列表/)
})

test('feedUrl is the first homepage page and does not send local likes', () => {
  const url = new URL(feedUrl('42'))
  assert.equal(url.origin + url.pathname, 'https://hackertube.org/api/feed')
  assert.equal(url.searchParams.get('offset'), '0')
  assert.equal(url.searchParams.get('n'), '36')
  assert.equal(url.searchParams.get('seed'), '42')
  assert.equal(url.searchParams.get('like'), null)
  assert.equal(url.searchParams.get('seen'), null)
})

test('formatDuration follows the source seconds', () => {
  assert.equal(formatDuration(3769), '1:02:49')
  assert.equal(formatDuration(65), '1:05')
  assert.equal(formatDuration(0), null)
})

test('list state keeps the last success when a refresh fails', () => {
  let state = { status: 'idle' }
  state = reduceList(state, { type: 'start' })
  assert.equal(viewModel(state).mode, 'loading')
  state = reduceList(state, { type: 'success', items: parseFeed([row]) })
  assert.equal(viewModel(state).mode, 'ready')
  state = reduceList(state, { type: 'start' })
  assert.equal(viewModel(state).mode, 'refreshing')
  assert.equal(viewModel(state).items[0].title, 'Hacking with Andrew and Brad')
  state = reduceList(state, { type: 'failure', message: '连不上 HackTube' })
  const stale = viewModel(state)
  assert.equal(stale.mode, 'stale')
  assert.equal(stale.banner, '连不上 HackTube')
  assert.equal(stale.items.length, 1)
  assert.equal(stale.items[0].durationLabel, '1:02:49')
})

test('an empty homepage is not a failed refresh', () => {
  let state = reduceList({ status: 'ready', items: parseFeed([row]) }, { type: 'start' })
  state = reduceList(state, { type: 'success', items: [] })
  assert.equal(viewModel(state).mode, 'empty')
  assert.deepEqual(viewModel(state).items, [])
})

test('the first failure has no list to keep', () => {
  let state = reduceList({ status: 'idle' }, { type: 'start' })
  state = reduceList(state, { type: 'failure', message: '读取首页超时' })
  assert.deepEqual(viewModel(state), { mode: 'failed', banner: '读取首页超时', items: [] })
})

test('the prompt is only the entry, and only while the sidebar is closed', () => {
  assert.equal(showPrompt({ running: true, sidebarVisible: false }), true)
  assert.equal(showPrompt({ running: true, sidebarVisible: true }), false)
  assert.equal(showPrompt({ running: false, sidebarVisible: false }), false)
})

test('Chrome launches only for a valid id on macOS, as arguments not a shell', () => {
  const plan = launchPlan('darwin', '1rZ-JorHJEY')
  assert.deepEqual(plan, {
    ok: true,
    url: 'https://www.youtube.com/watch?v=1rZ-JorHJEY',
    file: 'open',
    args: ['-a', 'Google Chrome', 'https://www.youtube.com/watch?v=1rZ-JorHJEY'],
  })
  assert.equal(launchPlan('linux', '1rZ-JorHJEY').ok, false)
  assert.equal(launchPlan('linux', '1rZ-JorHJEY').code, 'not-mac')
  assert.equal(launchPlan('darwin', 'javascript:alert(1)').code, 'bad-target')
  assert.equal(launchPlan('darwin', 'https://www.youtube.com/watch?v=1rZ-JorHJEY').code, 'bad-target')
  assert.equal('args' in launchPlan('linux', '1rZ-JorHJEY'), false)
})
