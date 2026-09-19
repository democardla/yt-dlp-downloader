# yt-dlp Downloader for macOS

一个基于 OpenTUI 和 yt-dlp 的终端下载工具，提供可视化配置界面、下载进度显示和工具链检测。

## 发布信息

- 平台：macOS
- 架构：Intel x86_64
- 文件：`yt-dlp-downloader`
- 类型：Mach-O 64-bit 可执行文件
- 运行方式：Terminal / 终端应用

Apple Silicon Mac 需要通过 Rosetta 2 运行。

## 主要功能

- 支持下载 MP4 视频、MP3 音频和字幕。
- 实时显示下载进度、速度和预计剩余时间。
- 支持下载中、已完成、未成功三个任务分类。
- 已完成任务支持在访达中定位文件。
- 支持下载网络、输出、字幕、视频格式和控制台配置。
- 支持加载 `yt-dlp-downloader` 目录下的 `.pre` 预设文件。
- 连续下载相同链接时自动生成唯一文件名。
- 启动时自动检测当前操作系统、`ffmpeg`、`ffprobe` 和 `yt-dlp`。

## 运行环境

运行前请确保系统中已安装：

```text
ffmpeg
ffprobe
yt-dlp
```

程序会自动从系统 `PATH` 中查找这些工具，也支持通过环境变量指定路径：

```bash
export FFMPEG_PATH="/path/to/ffmpeg"
export FFPROBE_PATH="/path/to/ffprobe"
export YTDLP_PATH="/path/to/yt-dlp"
```

## 使用方式

将可执行文件和配置目录放在同一工作目录中：

```text
yt-dlp-downloader
yt-dlp-downloader/
└── config.json
```

如果需要使用预设文件：

```text
yt-dlp-downloader/
├── config.json
├── bilibili.pre
└── youtube.pre
```

执行：

```bash
chmod +x ./yt-dlp-downloader
./yt-dlp-downloader
```

## 默认下载目录

默认输出目录为当前 macOS 用户的下载目录：

```text
~/Downloads
```

也可以在“设置 → 输出”中修改默认输出目录。下载器界面的输出目录只影响当前下载任务，不会修改设置中的默认配置。

## 配置文件

配置文件位于：

```text
yt-dlp-downloader/config.json
```

配置文件包含配置名称、配置描述、网络设置、输出设置、字幕设置、视频格式设置和控制台设置。

## 注意事项

- 该版本为 macOS Intel x86_64 架构。
- Apple Silicon Mac 需要安装 Rosetta 2。
- 程序是终端界面应用，需要在 Terminal 中运行。
- 如果 macOS 阻止首次运行，请在“系统设置 → 隐私与安全性”中允许执行。
- 如果应用未签名或未经过公证，首次运行时可能出现安全提示。
- `yt-dlp`、`ffmpeg` 和 `ffprobe` 需要单独安装，未内置在该二进制文件中。
