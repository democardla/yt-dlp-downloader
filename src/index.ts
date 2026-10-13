import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  RGBA,
  type Renderable,
} from "@opentui/core"
import {
  createAudioConversionFeature,
  createDownloadHistoryFeature,
  createDownloaderFeature,
  createSettingsFeature,
  createVideoConversionFeature,
  type DownloadHistoryFeature,
} from "./ui"
import { ActionButtonRenderable, ConsolePanelRenderable, TabBarRenderable, writeAppConsole } from "./components"
import { resolveToolchain } from "./runtime/Toolchain"
import { detectChrome } from "./runtime/Browser"
import { getAppPaths, initializeAppPaths } from "./runtime/AppPaths"
import { handleCliCommand } from "./runtime/CliCommands"
import { ensureMinimumTerminalSize } from "./runtime/Terminal"

import { Configs } from "./handles"



import "reflect-metadata"


const appPaths = getAppPaths()
const cliExitCode = await handleCliCommand(Bun.argv.slice(2), appPaths)
if (cliExitCode !== null) process.exit(cliExitCode)
const terminalPreparation = await ensureMinimumTerminalSize()
const migrationActions = initializeAppPaths(appPaths)

// ---------------------------------------------------------------------------
// 渲染器
// ---------------------------------------------------------------------------

const initialRendererSize = terminalPreparation.resized
  ? {
      width: terminalPreparation.targetColumns,
      height: terminalPreparation.targetRows,
    }
  : {}

const renderer = await createCliRenderer({
  ...initialRendererSize,
  exitOnCtrlC: true,
  useMouse: true,      // 启用鼠标输入
  autoFocus: true,     // 点击时自动聚焦
})

// OpenTUI asks the terminal for its real viewport after initialization. On
// Windows that reply can arrive just after mode.com has resized the console.
// Keep the screen empty briefly instead of mounting an incorrectly compressed
// 80x25 layout and then visibly reflowing it.
if (terminalPreparation.resized) {
  const viewportDeadline = Date.now() + 1_000
  while (
    (renderer.width < terminalPreparation.targetColumns
      || renderer.height < terminalPreparation.targetRows)
    && Date.now() < viewportDeadline
  ) {
    await Bun.sleep(25)
  }
}

// ---------------------------------------------------------------------------
// 功能模块
// ---------------------------------------------------------------------------

interface Feature {
  root: Renderable
  getFocusables(): Renderable[]
  focusFirst(): void
}

// 设置页（真实功能）
const settings: Feature = createSettingsFeature(renderer)
let appConfigs: Configs
try {
  appConfigs = Configs.loadFromFileSync(appPaths.configFile)
} catch {
  appConfigs = new Configs()
}
const consolePanel = new ConsolePanelRenderable(renderer, {
  enabled: appConfigs.console.enabled,
  truncate: appConfigs.console.truncate,
})

writeAppConsole("log", `启动路径：模式=${appPaths.mode}，目标=${appPaths.target}`)
writeAppConsole("log", `启动路径：bin=${appPaths.binDir}`)
writeAppConsole("log", `启动路径：配置=${appPaths.configFile}`)
writeAppConsole("log", `启动路径：历史=${appPaths.historyFile}`)
if (terminalPreparation.attempted) {
  writeAppConsole(
    terminalPreparation.resized ? "log" : "warn",
    terminalPreparation.resized
      ? "终端布局：已将 Windows 控制台调整到至少 120 × 35"
      : "终端布局：自动调整失败，请将窗口扩大到至少 120 × 35",
  )
}
if (renderer.width < 100 || renderer.height < 28) {
  writeAppConsole("warn", `终端空间不足：当前 ${renderer.width} × ${renderer.height}，建议至少 120 × 35`)
}
for (const action of migrationActions) {
  writeAppConsole("log", `数据迁移：${action}`)
}

const chrome = detectChrome()
writeAppConsole(chrome.available ? "log" : "warn", `启动检测：Chrome = ${chrome.chromePath ?? "未找到"}`)

// Resolve the host and all external binaries after the console exists, so the
// startup lookup is visible in the app log just like a manual refresh.
writeAppConsole("log", "启动检测：只检查应用 bin 目录")
const toolchain = await resolveToolchain(appPaths)
logToolchainResult("启动检测", toolchain)

// 下载器（真实功能）
const downloadHistory: DownloadHistoryFeature = createDownloadHistoryFeature(renderer)
const downloader: Feature = createDownloaderFeature(renderer, toolchain, downloadHistory.refresh, chrome.available)
const videoConversion: Feature = createVideoConversionFeature(renderer, toolchain, downloadHistory.refresh)
const audioConversion: Feature = createAudioConversionFeature(renderer, toolchain, downloadHistory.refresh)

// 关于（占位）
function createPlaceholderFeature(id: string, title: string, body: string): Feature {
  const panel = new BoxRenderable(renderer, {
    id,
    flexGrow: 1,
    height: "100%",
    border: true,
    title,
    titleAlignment: "center",
    flexDirection: "column",
    padding: 2,
    gap: 1,
  })
  panel.add(
    new TextRenderable(renderer, {
      content: body,
      fg: RGBA.fromHex("#6b7280"),
    })
  )
  return { root: panel, getFocusables: () => [], focusFirst: () => {} }
}

const about: Feature = createPlaceholderFeature(
  "about-panel",
  " 关于 ",
  "yt-dlp 下载器\n基于 OpenTUI + yt-dlp\n\n输入视频链接即可下载为 mp4 / mp3"
)

const features: Feature[] = [downloader, videoConversion, audioConversion, downloadHistory, settings, about]

// ---------------------------------------------------------------------------
// 顶部标签页（切换功能）
// ---------------------------------------------------------------------------

const featureTabs = new TabBarRenderable(renderer, {
  id: "feature-tabs",
  flexGrow: 1,
  options: [
    { name: " 下载器 ", description: "下载视频 / 音频" },
    { name: " 视频转换 ", description: "视频转视频 / 音频" },
    { name: " 音频转换 ", description: "音频格式转换" },
    { name: " 历史 ", description: "最近成功处理的文件" },
    { name: " 设置 ", description: "配置参数" },
    { name: " 关于 ", description: "关于本工具" },
  ],
  onChange: (_option, index) => selectFeature(index),
})

const topBar = new BoxRenderable(renderer, {
  id: "top-bar",
  width: "100%",
  height: 1,
  flexDirection: "row",
  alignItems: "center",
})
topBar.add(featureTabs)

let refreshButton: ActionButtonRenderable | null = null
let refreshingToolchain = false

if (!toolchain.ready) {
  refreshButton = new ActionButtonRenderable(renderer, {
    id: "refresh-toolchain",
    width: 14,
    height: 1,
    label: "刷新工具",
    onActivate: refreshToolchain,
  })
  topBar.add(refreshButton)
}

// ---------------------------------------------------------------------------
// 布局：顶部标签 + 内容区
// ---------------------------------------------------------------------------

const content = new BoxRenderable(renderer, {
  id: "content",
  flexGrow: 1,
  flexDirection: "column",
})

const root = new BoxRenderable(renderer, {
  id: "root",
  flexDirection: "column",
  width: "100%",
  height: "100%",
})
root.add(topBar)
root.add(content)
root.add(consolePanel)

renderer.root.add(root)

// ---------------------------------------------------------------------------
// 功能切换
// ---------------------------------------------------------------------------

let activeFeature: Feature = features[0]!
let focusIdx = 0

function currentFocusables(): Renderable[] {
  const list = [...activeFeature.getFocusables(), featureTabs]
  if (refreshButton) list.push(refreshButton)
  if (focusIdx >= list.length) focusIdx = 0
  return list
}

async function refreshToolchain() {
  if (refreshingToolchain) return

  refreshingToolchain = true
  writeAppConsole("log", "刷新工具：按钮已触发，开始重新扫描工具路径")
  try {
    Object.assign(toolchain, await resolveToolchain(appPaths))
    logToolchainResult("刷新工具", toolchain)

    if (toolchain.ready && refreshButton) {
      topBar.remove(refreshButton.id)
      refreshButton = null
    }
  } finally {
    refreshingToolchain = false
  }
}

function logToolchainResult(source: string, current: typeof toolchain) {
  writeAppConsole("log", `${source}：本次检查的目录如下（每行一个）`)
  if (current.searchedDirectories.length === 0) {
    writeAppConsole("warn", `${source}：没有可检查的目录`)
  } else {
    for (const directory of current.searchedDirectories) {
      writeAppConsole("log", `${source}：检查目录 ${directory}`)
    }
  }

  for (const [name, path] of [
    ["ffmpeg", current.ffmpegPath],
    ["ffprobe", current.ffprobePath],
    ["yt-dlp", current.ytDlpPath],
  ] as const) {
    writeAppConsole(path ? "log" : "error", `${source}：${name} = ${path ?? "未找到"}`)
  }

  writeAppConsole(current.ready ? "log" : "warn", `${source}：工具链${current.ready ? "已就绪" : "未就绪"}`)
  if (current.diagnostics.length > 0) {
    writeAppConsole("warn", `${source}：${current.diagnostics.join("；")}`)
  }
}

function selectFeature(index: number) {
  content.remove(activeFeature.root.id)

  const next = features[index]!
  content.add(next.root)
  activeFeature = next
  focusIdx = 0
  next.focusFirst()
}

// ---------------------------------------------------------------------------
// 全局 Tab 焦点循环
// ---------------------------------------------------------------------------

renderer.keyInput.on("keypress", (key: { name: string; defaultPrevented?: boolean }) => {
  if (key.name === "tab") {
    key.defaultPrevented = true
    const list = currentFocusables()
    if (list.length === 0) return
    focusIdx = (focusIdx + 1) % list.length
    list[focusIdx]?.focus()
  }
})

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

writeAppConsole("log", "yt-dlp 下载器已就绪，输入视频链接后回车即可开始下载")

// 初始选中“下载器”并聚焦 URL 输入
selectFeature(0)
