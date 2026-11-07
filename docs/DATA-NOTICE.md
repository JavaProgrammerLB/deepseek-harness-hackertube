# 数据与许可

这份说明只记录 2026-11-07 读到的公开页面，以及本插件因此做的限制。它不是法律意见，也不表示已经得到站方授权，或这个插件已经完全合规。

## 插件代码和第三方数据是两件事

本仓库没有单独的许可证文件。这里不给插件代码另设许可。

HackerTube 导出的数据库是第三方数据。插件只在用户自己的机器上下载并读取 `videos.jsonl`，不把这份数据提交进仓库，也不发布改写后的数据库。

## 已读到的许可说法

[About](https://hackertube.org/about) 写着站点背后的数据可以再用，例子包括另一种界面或终端浏览器。同一页写着数据以 ODC-By 1.0 发布，使用时注明 HackerTube。YouTube 自己的说明、播放量和时长不在其中，因为 YouTube 条款不允许再分发这些内容。页面后部还要求同时注明 [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news)。

[DATA.md](https://hackertube.org/download/DATA.md) 的许可一节写着，数据按 [ODC-By 1.0](https://opendatacommons.org/licenses/by/1-0/) 发布，请注明 HackerTube（https://hackertube.org）和 open-index/hacker-news。评论仍是作者的作品。视频标题和频道名属于创作者。该数据集不隶属于 YouTube、Google、Hacker News 或 Y Combinator。导出日期写的是 2026-10-31。

ODC-By 1.0 的前言写着，这份许可管的是数据库，不管数据库里每一项内容各自的权利，也不处理软件、商标或隐私等其他权利。因此，数据采用 ODC-By，并不自动要求这个插件开源，也不自动禁止商业使用。标题和频道名仍然可能另有权利。

官方下载地址是 `https://hackertube.org/download/videos.jsonl`。核对时响应大约 8.6 MB，类型是 `application/x-ndjson`，第一行能解析出标题、频道和 11 位 `vid`。

## 本插件实际做了什么

默认只下载这一个文件。大小必须落在 1 MB 到 12 MB 之间，行数必须落在 1000 到 30000 之间，损坏行不能超过 1%。通过之后才写入插件数据目录里的 `videos.jsonl`。侧栏只显示其中前 36 条的标题，以及该行若有的频道。打开地址只由 `vid` 拼出来。

不请求 `https://hackertube.org/api/feed`。不请求缩略图。不显示时长或其他没有随这份导出提供、需要另向 YouTube 取得的元数据。没有「我同意」开关把这些内容默默打开。

## 还不能当成已经允许的事

下面这些没有在已读页面里找到清楚授权。没找到，也不等于页面已经明确禁止。

- 插件持续调用线上 `/api/feed`。About 和 DATA.md 讲的是导出文件，不是这个接口。
- 默认加载 `i.ytimg.com` 缩略图。DATA.md 提到可以不经 API 使用这类地址，但没有写明本插件可以默认热链。
- 展示时长、播放量等 YouTube 元数据。导出说明把它们排除在外。
- 站方或 YouTube 认可、背书本插件。

如果以后要恢复线上 feed、缩略图或时长，需要先有覆盖这种用法的明确许可，再改默认行为。不能靠界面上的勾选代替。

## 署名

使用这份列表时请注明：

- HackerTube，https://hackertube.org
- open-index/hacker-news，https://huggingface.co/datasets/open-index/hacker-news
- ODC-By 1.0，https://opendatacommons.org/licenses/by/1-0/
