# HackerTube 摸鱼

DeepSeek Harness 插件。对话还在进行的时候，侧栏展示 [HackTube.org](https://hackertube.org/) 首页列表；点一条，用 Chrome 打开对应的 YouTube 视频。插件里不嵌播放器。

做法靠近 [摸鱼短剧](https://github.com/frostming/dsh-hongguo)（frostming/dsh-hongguo）：正事留在对话里，列表放在右侧边栏。

插件代码还没写。这个仓库目前只有落地页。

## 本地预览

在 `site/public` 里起一个静态服务：

```sh
cd site/public
python3 -m http.server
```

浏览器打开 <http://127.0.0.1:8000/>。

字标是 Fraunces 的软体子集，使命句是马善政楷的子集，许可都是 OFL，文件在 `site/public/fonts/`。需要重做子集时，安装 `fonttools==4.68.0` 与 `brotli==1.2.1`，再运行 `python3 site/slogan-font.py`。
