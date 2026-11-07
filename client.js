window.__ModuleLoader__.load({
  id: 'dsh-hackertube',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const TAB_ID = 'dsh-hackertube'
    const KIND = 'hackertube'
    let pluginCtx

    function openList() {
      const sidebar = pluginCtx?.get('sidebarRight')
      try {
        sidebar?.openTab(KIND, {})
      } catch (error) {
        console.error('[hackertube] 打不开侧栏', error?.message ?? String(error))
      }
    }

    function listIsShowing() {
      const root = document.querySelector('.ht-root')
      if (!root) return false
      // Collapsed panels stay mounted with their last width, clipped by the
      // window. The host marks the open panel with data-sidebar-right-open.
      const panel = root.closest('[data-sidebar-right-panel]')
      if (!panel || panel.getAttribute('data-sidebar-right-open') === null) return false
      const box = root.getBoundingClientRect()
      const visibleW = Math.min(box.right, window.innerWidth) - Math.max(box.left, 0)
      const visibleH = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0)
      return visibleW >= 8 && visibleH >= 8
    }

    function Prompt({ session, useSession, shouldHide }) {
      const liveRunning = useSession((snapshot) => snapshot.running === true)
      const [sidebarVisible, setSidebarVisible] = React.useState(false)

      React.useEffect(() => {
        const read = () => setSidebarVisible(listIsShowing())
        read()
        const timer = setInterval(read, 800)
        return () => clearInterval(timer)
      }, [])

      if (typeof shouldHide === 'function' && shouldHide()) return null
      const running = liveRunning === true || session?.running === true
      if (!(running === true && sidebarVisible !== true)) return null
      return h(React.Fragment, null,
        h('style', null, '.ht-prompt { display: inline-flex; align-self: flex-start; width: fit-content; margin: 8px 12px; border: 1px solid #ccc; background: #fff; color: #1c1c1c; border-radius: 999px; padding: 6px 12px; font: 14px/1.4 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; cursor: pointer; }'),
        h('button', { type: 'button', className: 'ht-prompt', onClick: openList }, '看视频列表'))
    }

    function FooterButton(props) {
      const wide = props?.wide !== false
      return h(
        'button',
        {
          type: 'button',
          className: 'ht-foot',
          title: '打开视频列表',
          'aria-label': '打开视频列表',
          onClick: openList,
        },
        wide ? '视频' : '视',
      )
    }

    function Panel() {
      const [view, setView] = React.useState(null)
      const [problem, setProblem] = React.useState(null)
      const [copyNote, setCopyNote] = React.useState('')

      React.useEffect(() => {
        let gone = false
        async function firstLoad() {
          try {
            const current = await getJson('/api/hackertube/list')
            if (gone) return
            if (current.mode === 'loading' && current.items.length === 0) {
              setView(await postJson('/api/hackertube/load', {}))
            } else {
              setView(current)
            }
          } catch {
            if (!gone) setView(keepOrFail(null, '连不上插件'))
          }
        }
        firstLoad()
        return () => {
          gone = true
        }
      }, [])

      async function refresh() {
        const previous = view
        setView(previous && previous.items.length
          ? { ...previous, mode: 'refreshing' }
          : { mode: 'loading', banner: null, items: [] })
        try {
          setView(await postJson('/api/hackertube/load', {}))
        } catch {
          setView(keepOrFail(previous, '连不上插件'))
        }
      }

      async function openItem(item) {
        setCopyNote('')
        try {
          const result = await postJson('/api/hackertube/open', { vid: item.vid })
          if (result.ok) {
            setProblem(null)
            return
          }
          setProblem({
            message: result.code === 'not-mac'
              ? '这台电脑不是 macOS，没有改用别的浏览器。'
              : 'Chrome 没有打开。',
            url: result.url || item.watchUrl,
          })
        } catch {
          setProblem({ message: '没有连上插件，Chrome 没有打开。', url: item.watchUrl })
        }
      }

      async function copyUrl(url) {
        try {
          await navigator.clipboard.writeText(url)
          setCopyNote('已复制')
        } catch {
          setCopyNote('请选中下面的链接复制')
        }
      }

      return h('div', { className: 'ht-root' },
        h('style', null, CSS),
        h('div', { className: 'ht-bar' },
          h('strong', null, '导出列表'),
          h('button', { type: 'button', onClick: refresh }, '刷新')),
        problem ? h('div', { className: 'ht-problem' },
          h('p', null, problem.message),
          problem.url ? h('input', { readOnly: true, value: problem.url, onFocus: (event) => event.target.select() }) : null,
          problem.url ? h('button', { type: 'button', onClick: () => copyUrl(problem.url) }, '复制链接') : null,
          copyNote ? h('p', null, copyNote) : null) : null,
        renderBody(view, openItem),
        h('p', { className: 'ht-credit' },
          '列表来自 ',
          h('a', { href: 'https://hackertube.org/', target: '_blank', rel: 'noopener noreferrer' }, 'HackerTube'),
          ' 的导出数据，许可是 ',
          h('a', { href: 'https://opendatacommons.org/licenses/by/1-0/', target: '_blank', rel: 'noopener noreferrer' }, 'ODC-By 1.0'),
          '。请同时注明 ',
          h('a', { href: 'https://huggingface.co/datasets/open-index/hacker-news', target: '_blank', rel: 'noopener noreferrer' }, 'open-index/hacker-news'),
          '。本插件是独立第三方，未获这些项目背书。'))
    }

    function renderBody(view, openItem) {
      if (!view || view.mode === 'loading') return h('p', { className: 'ht-note' }, '正在读取导出列表')
      if (view.mode === 'failed') {
        return h('div', null,
          h('p', { className: 'ht-note' }, view.banner || '读取导出失败'),
          h('p', { className: 'ht-note' }, '点刷新再试一次。'))
      }
      if (view.mode === 'empty') return h('p', { className: 'ht-note' }, '导出里没有可显示的标题。点刷新再看。')
      return h('div', null,
        view.mode === 'refreshing' ? h('p', { className: 'ht-note' }, '正在刷新') : null,
        view.mode === 'stale' ? h('p', { className: 'ht-note' }, `刷新失败，仍显示上次的列表。${view.banner || ''}`) : null,
        h('ul', { className: 'ht-list' }, view.items.map((item) =>
          h('li', { key: item.vid || item.title }, renderRow(item, openItem)))))
    }

    function renderRow(item, openItem) {
      const text = h('div', { className: 'ht-copy' },
        h('span', { className: 'ht-title' }, item.title),
        renderMeta(item),
        item.vid ? h('span', { className: 'ht-open' }, '用 Chrome 打开') : h('span', { className: 'ht-miss' }, '这条没有可打开的 YouTube 地址'))
      if (!item.vid) return h('div', { className: 'ht-row' }, text)
      return h('button', {
        type: 'button',
        className: 'ht-row',
        onClick: () => openItem(item),
      }, text)
    }

    function renderMeta(item) {
      if (!item.channel) return null
      return h('span', { className: 'ht-meta' }, item.channel)
    }

    return {
      inject: ['slots', 'sidebarRight', 'sidebarRightTabs'],
      apply(ctx) {
        pluginCtx = ctx
        const sidebarRightTabs = ctx.get('sidebarRightTabs')
        if (sidebarRightTabs?.register) {
          ctx.effect(() => sidebarRightTabs.register({
            id: TAB_ID,
            kind: KIND,
            multiple: false,
            title: () => '首页视频',
            guide: [{
              id: 'hackertube',
              order: 40,
              title: () => '首页视频',
              description: () => '打开 HackerTube 导出的文字列表',
            }],
          }), 'hackertube: tab')
        }
        ctx.slots.inject('sidebar.right.pane.tab', () =>
          ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, Panel))
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register({
            name: 'sidebar.footer.action',
            id: 'hackertube',
            order: 20,
            label: () => '视频',
          }, FooterButton))
        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register({
            name: 'conversation.input.dock',
            id: 'hackertube-prompt',
            order: 40,
          }, Prompt))
      },
    }
  },
})

function keepOrFail(previous, message) {
  if (previous?.items?.length) return { mode: 'stale', banner: message, items: previous.items }
  return { mode: 'failed', banner: message, items: [] }
}

async function getJson(path) {
  const response = await fetch(path, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok && !payload.code) throw new Error(String(response.status))
  return payload
}

const CSS = `
.ht-root { box-sizing: border-box; height: 100%; overflow: auto; padding: 12px 14px 20px; color: #1c1c1c; background: #fff; font: 14px/1.45 -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", sans-serif; }
.ht-root * { box-sizing: border-box; }
.ht-root button { color: #1c1c1c; }
.ht-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.ht-bar button, .ht-problem button, .ht-prompt, .ht-foot { font: inherit; cursor: pointer; }
.ht-bar button, .ht-problem button { border: 1px solid #ccc; background: #fff; border-radius: 6px; padding: 4px 10px; }
.ht-note { margin: 8px 0; color: #555; }
.ht-problem { margin-bottom: 10px; padding: 8px; background: #f7f1ee; border: 1px solid #e4d2cb; }
.ht-problem p { margin: 0 0 6px; }
.ht-problem input { width: 100%; margin-bottom: 6px; font: 12px/1.4 ui-monospace, monospace; }
.ht-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ht-row { width: 100%; display: block; text-align: left; border: 0; background: transparent; padding: 6px 2px; font: inherit; color: inherit; }
button.ht-row { cursor: pointer; }
.ht-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ht-title { font-weight: 600; }
.ht-meta, .ht-miss, .ht-open { color: #666; font-size: 12px; }
.ht-credit { margin: 16px 0 0; color: #555; font-size: 12px; line-height: 1.5; }
.ht-credit a { color: inherit; }
.ht-prompt { display: inline-flex; align-self: flex-start; width: fit-content; margin: 8px 12px; border: 1px solid #ccc; background: #fff; color: #1c1c1c; border-radius: 999px; padding: 6px 12px; }
`
