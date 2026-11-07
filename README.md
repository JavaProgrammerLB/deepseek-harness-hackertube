# dsh-hackertube

DeepSeek Harness 插件。Agent 在干活时，侧栏可以看一份 HackerTube 导出的文字列表。点一条，用这台 Mac 上的 Chrome 打开对应的 YouTube。插件只负责跳转，不负责播放。

列表不是线上首页接口。默认不请求 `/api/feed`，也不加载缩略图或时长。来源和许可写在侧栏底部，细节在 [数据说明](docs/DATA-NOTICE.md)。

## 能做什么

侧栏底部一直有「视频」。Agent 空闲时也能从这里打开列表。

Agent 开始工作、并且侧栏没开着时，输入框上方多出一句「看视频列表」。这句话里没有片单。侧栏已经开着，这句话就不再出现。工作结束，只把这句话藏起来。侧栏不关，Chrome 里的页面也不动。

列表来自官方文件 `videos.jsonl` 里分数较高的前 36 条。导出里有频道就显示频道，没有就空着，不编造。点「刷新」会重新下载这个文件。下载失败时留下上次成功的列表，并写明这次失败了。没有旧列表时，直接说明没读到导出。

点一条，在 macOS 上执行 `open -a "Google Chrome"`，地址是 `https://www.youtube.com/watch?v=` 加上这条的 id。不改去系统默认浏览器。YouTube 打开之后播不播，由 YouTube 决定。

## 怎么安装

用在桌面版 DeepSeek Harness，配置档是 `desktop`。安装方式在 0.2.2-rc.1 上对过。这次改成导出列表之后，还没有在那台 Mac 上再装一遍。先完全退出应用，装完再打开。

`dsh` 在应用包里：

```sh
dsh="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
```

用本机检出的仓库路径安装。

```sh
"$dsh" plugin --profile desktop add /path/to/deepseek-harness-hackertube
```

命令会把 `dsh-hackertube` 写进 `~/.dsh/profiles/desktop`。然后完全退出并重新打开 DeepSeek Harness。

## 怎么用

1. 点侧栏底部的「视频」，或在 Agent 工作时点「看视频列表」。侧栏打开，并读取已保存的导出。还没有保存时，下载 `https://hackertube.org/download/videos.jsonl`。
2. 看标题。有频道就一起看。想更新，点「刷新」。
3. 点一条。本机 Chrome 打开对应的 YouTube。

打不开 Chrome，或这台电脑不是 macOS，侧栏里留下地址，可以复制，不会悄悄换别的浏览器。没有有效 YouTube id 的条目不能点开。

## 它不做什么

不做内嵌播放器，也不控制暂停、倍速或连播。不搜索，不收藏，不记观看历史。不把远程电脑上的点击转到这台 Mac 的浏览器。不请求线上 `/api/feed`。不加载缩略图，不显示时长。不把整站爬下来，只下载这一份导出文件，并且限制大小。

## 来源

数据来自 [HackerTube](https://hackertube.org/)，许可是 [ODC-By 1.0](https://opendatacommons.org/licenses/by/1-0/)。也请注明 [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news)。本插件是独立第三方，未获这些项目背书。

## 检查

在仓库根目录：

```sh
node --test
node scripts/verify.mjs
```

`node --test` 不访问网络。`scripts/verify.mjs` 会下载一次官方 `videos.jsonl` 并核对能解析出标题。它不请求 `/api/feed`。Mac 上这次数据改动还没有装进 DeepSeek Harness 再看过。
