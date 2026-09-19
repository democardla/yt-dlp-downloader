# yt-dlp Downloader

一个基于 [OpenTUI](https://github.com/anomalyco/opentui) 和 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 的终端下载工具。

项目提供可视化配置界面、下载任务列表、实时进度、字幕下载、预设文件和跨平台工具链检测，适合在 Terminal 中直接使用。

## 功能

- 下载视频为 MP4。
- 下载音频为 MP3。
- 仅下载字幕，不下载视频。
- 支持简体中文、繁体中文和英语字幕设置。
- 支持视频编码、分辨率、帧率、HDR、音频编码等格式排序设置。
- 下载列表分为“下载中”“已完成”和“未成功”三个标签页。
- 下载中显示进度、速度和预计剩余时间。
- 已完成任务支持在系统文件管理器中定位输出文件。
- 连续下载同一个链接时自动生成唯一文件名，避免重名冲突。
- 启动时自动识别操作系统以及 `ffmpeg`、`ffprobe`、`yt-dlp` 的实际路径。
- 支持通过 `.pre` 文件加载 yt-dlp 预设参数。
- 支持底部控制台日志和可滚动设置界面。
- 使用自定义 OpenTUI 组件实现下拉框、标签页、侧边栏、进度条和控制台。

## 环境要求

- [Bun](https://bun.sh/)
- `yt-dlp`
- `ffmpeg`
- `ffprobe`

程序启动时会从系统 `PATH` 中查找三个外部工具，也支持通过环境变量指定位置：

```bash
export FFMPEG_PATH="/path/to/ffmpeg"
export FFPROBE_PATH="/path/to/ffprobe"
export YTDLP_PATH="/path/to/yt-dlp"
```

Windows 支持从环境变量和 `PATH` 查找 `.exe`、`.cmd`、`.bat` 文件。

## 安装依赖

```bash
bun install
```

## 开发运行

```bash
bun dev
```

也可以直接运行入口文件：

```bash
bun run src/index.ts
```

## 构建可执行文件

```bash
bun run build
```

输出位置：

```text
dist/yt-dlp-downloader
```

Apple Silicon：

```bash
bun build --compile \
  --target=bun-darwin-arm64 \
  ./src/index.ts \
  --outfile dist/yt-dlp-downloader
```

Intel Mac：

```bash
bun build --compile \
  --target=bun-darwin-x64 \
  ./src/index.ts \
  --outfile dist/yt-dlp-downloader
```

Windows x64：

```bash
bun build --compile \
  --target=bun-windows-x64 \
  ./src/index.ts \
  --outfile dist/yt-dlp-downloader.exe
```

OpenTUI 是终端界面应用，编译后的文件需要在 Terminal、PowerShell 或其他终端环境中运行。macOS `.app` 的 Terminal 启动器方案请参考 [RELEASE_NOTES.md](./RELEASE_NOTES.md)。

## 配置文件

首次启动时会创建：

```text
yt-dlp-downloader/config.json
```

配置文件包含：

- `name`：配置名称。
- `description`：配置说明。
- `downloadNetwork`：并发、限速和重试设置。
- `output`：输出目录和文件名设置。
- `subtitle`：字幕下载、字幕语言和字幕格式设置。
- `videoFormat`：视频格式及格式排序设置。
- `console`：底部控制台开关。

输出目录默认根据当前操作系统确定：

- macOS / Linux：用户的 `Downloads` 目录。
- Windows：用户目录下的 `Downloads` 目录。

设置页面修改的是持久化配置。下载器页面中的“输出目录”输入框只影响当前下载任务，不会改写设置配置。

## 预设文件

将后缀为 `.pre` 的文件放在配置目录下：

```text
yt-dlp-downloader/
├── config.json
├── bilibili.pre
└── youtube.pre
```

下载配置中的预设下拉菜单会在每次展开时重新扫描目录，因此新增或删除预设文件无需重启程序。

选中预设后，程序会通过以下参数传递给 yt-dlp：

```text
--config-locations /absolute/path/to/example.pre
```

## 测试示例

以下链接保留自项目早期测试命令，可用于验证视频、格式和字幕下载功能：

```bash
yt-dlp "https://www.bilibili.com/video/BV1yq4k6wEU7/?vd_source=03e8776c2b36f6f8873e0a65ad1e4633" \
  --merge-output-format mp4 \
  --remux-video mp4 \
  -S "vcodec:h264,lang,quality,res,fps,height:720,hdr:12,acodec:aac"

yt-dlp "https://www.bilibili.com/video/BV1yq4k6wEU7/?vd_source=03e8776c2b36f6f8873e0a65ad1e4633" \
  -t mp4

yt-dlp "https://www.bilibili.com/video/BV175hzzNESY/?spm_id_from=333.337.search-card.all.click&vd_source=03e8776c2b36f6f8873e0a65ad1e4633" \
  -t mp4 \
  --embed-chapters

yt-dlp --cookies-from-browser chrome \
  "https://www.bilibili.com/video/BV175hzzNESY/?spm_id_from=333.337.search-card.all.click&vd_source=03e8776c2b36f6f8873e0a65ad1e4633" \
  -t mp4 \
  --write-auto-subs \
  --sub-langs en \
  -S res:360 \
  --embed-subs
```

## 项目结构

```text
src/
├── index.ts                 # 应用入口和顶层布局
├── DownloaderUI.ts          # 下载器界面和任务列表
├── SettingsUI.ts            # 设置界面
├── downloader.ts            # yt-dlp 进程及参数构建
├── runtime/
│   └── Toolchain.ts         # 操作系统和外部工具路径检测
├── components/              # 自定义 OpenTUI 组件
└── handles/                 # 配置映射类和 yt-dlp 参数配置类

md/                          # 自定义组件文档
yt-dlp-downloader/           # 运行时配置和预设文件目录
```

## 自定义组件文档

- [ConsolePanelRenderable](./md/ConsolePanelRenderable.md)
- [CustomSpinnerRenderable](./md/CustomSpinnerRenderable.md)
- [MultiSelectRenderable](./md/MultiSelectRenderable.md)
- [ProgressBarRenderable](./md/ProgressBarRenderable.md)
- [SidebarNavRenderable](./md/SidebarNavRenderable.md)
- [StatusSelectRenderable](./md/StatusSelectRenderable.md)
- [StyledSelectRenderable](./md/StyledSelectRenderable.md)
- [TabBarRenderable](./md/TabBarRenderable.md)

## 注意事项

- `yt-dlp`、`ffmpeg` 和 `ffprobe` 不会被打包进应用，需要单独安装。
- macOS Intel 架构程序在 Apple Silicon Mac 上需要 Rosetta 2。
- 如果 macOS 阻止首次运行，请在“系统设置 → 隐私与安全性”中允许执行。
- 未签名或未公证的 macOS 构建版本首次启动时可能出现安全提示。
- 配置文件和预设文件使用当前工作目录下的 `yt-dlp-downloader` 文件夹。
