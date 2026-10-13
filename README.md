# yt-dlp Downloader

一个基于 [OpenTUI](https://github.com/anomalyco/opentui)、[yt-dlp](https://github.com/yt-dlp/yt-dlp) 和 FFmpeg 的终端下载与媒体转换工具。

项目提供视频/音频下载、字幕选择、本地媒体格式转换、任务队列、处理历史、可视化设置和跨平台工具链检测，适合在 Terminal 中直接使用。

## 功能

### 在线下载

- 将在线视频下载为 MP4，或提取为 MP3。
- 下载列表分为“下载中”“已完成”“未成功”和“已取消”四个标签页。
- 实时显示下载进度、速度和预计剩余时间，并支持单任务取消。
- 支持自定义输出目录、附加 yt-dlp 参数和 `.pre` 预设文件。
- 连续下载同一个链接时自动生成唯一文件名，避免覆盖已有文件。
- 成功任务可直接在 Finder、Windows 文件资源管理器或 Linux 文件管理器中定位结果。

### 字幕下载

- 自动查询视频可用的原始字幕和生成式字幕。
- 在下载前通过弹窗选择一个或多个字幕语言及字幕来源。
- 支持 VTT、SRT 和 TTML 输出格式。
- 字幕查询和下载使用 Chrome Cookie；未检测到 Chrome 时，界面会隐藏字幕下载选项。
- Cookie 读取、解密或浏览器配置异常会在控制台显示明确提示。

### 本地媒体转换

- 顶部提供独立的“视频转换”和“音频转换”页面。
- 支持从 Finder/Explorer 向终端拖入一个或多个文件，也可手动输入文件路径。
- 视频转视频支持 `mp4`、`mkv`、`webm`、`mov`。
- 视频转音频和音频转音频支持 `mp3`、`m4a`、`flac`、`wav`、`opus`、`ogg`。
- 每个输入文件都可以单独设置输出目录。
- 转换前通过 ffprobe 检查媒体流和时长，转换中显示实时进度。
- 支持批量排队、限制最大并发任务数、停止全部任务和移除单个任务。
- 转换使用临时文件，成功后再移动为最终文件；失败或取消时自动清理未完成结果。

### 历史记录与应用界面

- 顶部“历史”页面记录最近 10 个成功处理的文件，包括下载、字幕下载和格式转换。
- 历史表格展示文件名、来源、文件状态和处理时间，单击记录即可定位文件。
- “下载器 → 已完成”只显示当前运行期间完成的任务；跨会话记录统一在“历史”页面查看。
- 启动时检测 Chrome，以及 `ffmpeg`、`ffprobe`、`yt-dlp` 三个外部工具。
- 任意工具缺失时，顶部显示“刷新工具”按钮，可在修改 PATH 后重新扫描。
- 支持底部控制台日志、长日志截断和可滚动设置界面。
- 使用自定义 OpenTUI 组件实现文件表格、拖拽输入、矩阵选择器、标签页、侧边栏、进度条和控制台。

## 环境要求

- [Bun](https://bun.sh/)
- `yt-dlp`
- `ffmpeg`
- `ffprobe`
- Chrome（可选，仅字幕查询和字幕下载需要）

程序启动时会依次检查应用自带的 `bin` 目录、对应环境变量和系统 `PATH`。Windows 会自动尝试 `.exe`、`.cmd` 和 `.bat` 后缀。

可用的工具路径环境变量包括 `FFMPEG_PATH`、`FFPROBE_PATH` 和 `YTDLP_PATH`；同时兼容项目中定义的 `*_BINARY`、`*_BIN` 等别名。

也可以将三个二进制文件所在目录加入 `PATH`，例如：

```powershell
$env:Path = "C:\path\to\tools;$env:Path"
```

启动时如果任意一个工具缺失，顶部标签栏最右侧会显示“刷新工具”按钮；修改 PATH 或对应环境变量后点击该按钮即可重新检查。

## 界面使用

应用顶部包含以下页面：

- `下载器`：输入视频 URL，选择 MP4、MP3 或字幕后开始下载。
- `视频转换`：在“视频转视频”和“视频转音频”之间切换，添加本地视频并选择输出格式。
- `音频转换`：添加本地音频并转换为目标音频格式。
- `历史`：查看最近 10 个成功下载或转换的文件，并定位文件位置。
- `设置`：配置并发任务、下载网络、输出、字幕、格式排序和控制台行为。
- `关于`：查看应用基本信息。

在转换页面中，可直接把一个或多个文件拖入终端窗口。文件列表允许为每个文件填写独立的输出目录，并显示“就绪”“等待”“转换中”“完成”“失败”或“已取消”等状态。

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

## 运行测试

```bash
bun test
```

测试覆盖下载参数、下载历史、转换调度、媒体转换、文件拖拽输入和主要界面组件。

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

## 构建跨平台 App（Beta）

发布构建会把 OpenTUI 主程序和对应平台的工具一起组装。先将三个独立可执行文件放入目标目录：

```text
bin/win32-x64/     # ffmpeg.exe、ffprobe.exe、yt-dlp.exe
bin/darwin-x64/    # ffmpeg、ffprobe、yt-dlp
bin/darwin-arm64/  # ffmpeg、ffprobe、yt-dlp
bin/linux-x64/     # ffmpeg、ffprobe、yt-dlp
```

验证 Windows x64 工具：

```bash
bun run verify:bin --target win32-x64
```

构建对应平台应用包：

```bash
bun run build:app:windows
bun run build:app:macos:x64
bun run build:app:macos:arm64
bun run build:app:linux
```

生成结果位于 `dist/apps/<平台-架构>/`。Windows 生成可双击运行的控制台应用目录；macOS 生成 `.app`；Linux 生成可继续交给 `appimagetool` 的 `AppDir`。实际发布时应在目标操作系统的原生构建环境中执行相应命令。

发布包可以使用以下非交互命令进行检查：

```bash
yt-dlp-downloader --version
yt-dlp-downloader --print-paths
yt-dlp-downloader --doctor
```

`--doctor` 会打印应用模式、目标平台、资源和用户数据目录，以及三个内置工具的实际解析结果；工具缺失时返回非零退出码。

OpenTUI 是终端界面应用，编译后的文件需要在 Terminal、PowerShell 或其他终端环境中运行。macOS `.app` 的 Terminal 启动器方案请参考 [RELEASE_NOTES.md](./RELEASE_NOTES.md)。

## 配置文件

源码开发模式首次启动时会创建：

```text
yt-dlp-downloader/config.json
```

打包后的应用使用系统用户数据目录：

- Windows：`%APPDATA%\YT-DLP Downloader\`
- macOS：`~/Library/Application Support/YT-DLP Downloader/`
- Linux：`$XDG_CONFIG_HOME/yt-dlp-downloader/` 和 `$XDG_DATA_HOME/yt-dlp-downloader/`

首次运行打包应用时，如果启动目录下存在旧版 `yt-dlp-downloader` 数据目录，程序会迁移尚未存在的配置、历史和 `.pre` 文件。设置 `YTDLP_DOWNLOADER_PORTABLE=1` 可让打包应用改用程序旁边的 `user-data` 目录。

配置文件包含：

- `name`：配置名称。
- `description`：配置说明。
- `general`：视频和音频转换的最大并发任务数量，默认值为 `2`。
- `downloadNetwork`：并发、限速和重试设置。
- `output`：下载及转换的默认输出目录、临时目录和文件名设置。
- `subtitle`：字幕下载、字幕语言和字幕格式设置。
- `videoFormat`：视频格式及格式排序设置。
- `console`：底部控制台开关和长日志截断设置。

输出目录默认根据当前操作系统确定：

- macOS / Linux：用户的 `Downloads` 目录。
- Windows：用户目录下的 `Downloads` 目录。

设置页面修改的是持久化配置。下载器页面中的“输出目录”输入框只影响当前下载任务，不会改写设置配置。

## 历史记录文件

成功下载或转换后，程序会立即更新：

```text
yt-dlp-downloader/download-history.json
```

文件最多保留 10 条记录。每条记录包含结果文件的完整路径、来源和完成时间；同一路径再次成功处理时会移动到列表最前面。历史记录写入失败不会把已经完成的下载或转换标记为失败。

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
yt-dlp https://www.bilibili.com/video/BV1yq4k6wEU7/?vd_source=03e8776c2b36f6f8873e0a65ad1e4633 \
  --merge-output-format mp4 \
  --remux-video mp4 \
  -S "vcodec:h264,lang,quality,res,fps,height:720,hdr:12,acodec:aac"

yt-dlp https://www.bilibili.com/video/BV1yq4k6wEU7/?vd_source=03e8776c2b36f6f8873e0a65ad1e4633 \
  -t mp4

yt-dlp https://www.bilibili.com/video/BV175hzzNESY/?spm_id_from=333.337.search-card.all.click\&vd_source=03e8776c2b36f6f8873e0a65ad1e4633 \
  -t mp4 \
  --embed-chapters

yt-dlp --cookies-from-browser chrome \
  https://www.bilibili.com/video/BV175hzzNESY/?spm_id_from=333.337.search-card.all.click\&vd_source=03e8776c2b36f6f8873e0a65ad1e4633 \
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
├── ui/                      # 顶层功能界面
│   ├── DownloaderUI.ts      # 下载器界面和任务列表
│   ├── ConversionUI.ts      # 视频、音频转换界面
│   ├── DownloadHistoryUI.ts # 下载历史界面
│   └── SettingsUI.ts        # 设置界面
├── downloader.ts            # yt-dlp 进程及参数构建
├── runtime/
│   ├── Browser.ts           # Chrome 检测与浏览器 Cookie 支持
│   ├── ConversionScheduler.ts # 转换队列、并发和取消调度
│   ├── DownloadHistory.ts   # 最近成功结果的持久化记录
│   ├── MediaConverter.ts    # ffprobe 检查与 ffmpeg 转换
│   ├── Toolchain.ts         # 操作系统、工具路径和文件定位
│   └── file-drop/           # macOS / Windows 拖拽路径解析
├── components/              # 自定义 OpenTUI 组件
└── handles/                 # 配置映射类和 yt-dlp 参数配置类

md/                          # 自定义组件文档
yt-dlp-downloader/           # 配置、历史记录和预设文件目录
```

## 自定义组件文档

- [ConsolePanelRenderable](./md/ConsolePanelRenderable.md)
- [CustomSpinnerRenderable](./md/CustomSpinnerRenderable.md)
- [BorderlessTableRenderable](./md/BorderlessTableRenderable.md)
- [FileDropInputRenderable](./md/FileDropInputRenderable.md)
- [MatrixSelectRenderable](./md/MatrixSelectRenderable.md)
- [MultiSelectRenderable](./md/MultiSelectRenderable.md)
- [ProgressBarRenderable](./md/ProgressBarRenderable.md)
- [SidebarNavRenderable](./md/SidebarNavRenderable.md)
- [StatusSelectRenderable](./md/StatusSelectRenderable.md)
- [StyledSelectRenderable](./md/StyledSelectRenderable.md)
- [TabBarRenderable](./md/TabBarRenderable.md)

## 注意事项

- 源码开发和旧版单文件构建仍可使用系统中的 `yt-dlp`、`ffmpeg` 和 `ffprobe`；跨平台 App 构建会从对应的 `bin/<平台-架构>` 目录复制它们。
- 字幕轨道查询和下载依赖本机 Chrome 的默认用户配置及可读取的 Cookie。
- 下载器的“已完成”列表只保留当前会话；跨会话结果请在顶部“历史”页面查看。
- 转换任务先写入 `.partial` 临时文件，成功后才生成最终文件。
- macOS Intel 架构程序在 Apple Silicon Mac 上需要 Rosetta 2。
- 如果 macOS 阻止首次运行，请在“系统设置 → 隐私与安全性”中允许执行。
- 未签名或未公证的 macOS 构建版本首次启动时可能出现安全提示。
- 配置文件和预设文件使用当前工作目录下的 `yt-dlp-downloader` 文件夹。
