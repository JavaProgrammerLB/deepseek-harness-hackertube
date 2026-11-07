# HackerTube 首页

在 DeepSeek Harness 里，Agent 工作时点一下入口，打开 HackTube 首页列表。再点一条，用这台 Mac 上的 Chrome 打开对应的 YouTube。插件不播放视频。

展示网站还没做。要等插件在 Bill 的 Mac 上真实跑通，并留下真实画面之后。

## 安装

下面的安装方式还没有在 Bill 的 Mac 上验收。Harness 和 Chrome 需要在同一台电脑。

参考插件用的是这条命令：

```sh
dsh plugin add github:frostming/dsh-hongguo
```

本插件预计同样写成：

```sh
dsh plugin add github:JavaProgrammerLB/deepseek-harness-hackertube
```

如果当前 Harness 不认这个地址，把仓库克隆到本机，再按那一版 Harness 的本地插件方式启用 `dsh-hackertube`。改完后重启 `dsh web`。

## 使用

侧栏底部有「视频」。Agent 空闲时也能打开列表。

Agent 开始工作后，输入框上方出现「看首页视频」。这句话里没有片单。侧栏已经开着时，这句话不再出现。工作结束只把这句话藏起来，不关闭侧栏，也不去动 Chrome 里的页面。

列表是 HackTube 首页第一页，最多 36 条，顺序跟这次请求一致。点「刷新」再要一次。刷新失败时留下上次成功的列表，并写明失败。封面加载失败时只留一块灰底，标题还在。

点一条会在 macOS 上执行 `open -a "Google Chrome"`，地址是 `https://www.youtube.com/watch?v=` 加上该条的 id。打不开时，侧栏里留下这个地址，可以复制。不会改去系统默认浏览器。

YouTube 打开之后播不播，由 YouTube 决定。

## 检查

在仓库根目录：

```sh
node --test
node scripts/verify.mjs
```

`node --test` 不访问网络。`scripts/verify.mjs` 会再请求一次真实首页，并写明本机有没有 `dsh`。这两项都不等于 Mac 上的安装验收。
