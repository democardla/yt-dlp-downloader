import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  RGBA,
  type Renderable,
} from "@opentui/core"
import { createDownloaderFeature } from "./DownloaderUI"
import { createDownloadHistoryFeature, type DownloadHistoryFeature } from "./DownloadHistoryUI"
import { createSettingsFeature } from "./SettingsUI"
import { ActionButtonRenderable, ConsolePanelRenderable, TabBarRenderable, writeAppConsole } from "./components"
import { access, mkdir } from "node:fs/promises";
import { resolveToolchain } from "./runtime/Toolchain"
import { detectChrome } from "./runtime/Browser"

import { 
  Configs,
  DownloadNetworkConfig,
  OutputConfig,
  SubtitleConfig,
  VideoFormatConfig
} from "./handles"



import "reflect-metadata"


const configs = new Configs();


const dir = "yt-dlp-downloader";

try {
    await access(dir);
} catch {
    await mkdir(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// 渲染器
// ---------------------------------------------------------------------------

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  useMouse: true,      // 启用鼠标输入
  autoFocus: true,     // 点击时自动聚焦
})

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
  appConfigs = Configs.loadFromFileSync("yt-dlp-downloader/config.json")
} catch {
  appConfigs = new Configs()
}
const consolePanel = new ConsolePanelRenderable(renderer, {
  enabled: appConfigs.console.enabled,
  truncate: appConfigs.console.truncate,
})

const chrome = detectChrome()
writeAppConsole(chrome.available ? "log" : "warn", `启动检测：Chrome = ${chrome.chromePath ?? "未找到"}`)

// Resolve the host and all external binaries after the console exists, so the
// startup lookup is visible in the app log just like a manual refresh.
writeAppConsole("log", "启动检测：开始扫描工具路径（环境变量路径 + PATH）")
const toolchain = await resolveToolchain()
logToolchainResult("启动检测", toolchain)

// 下载器（真实功能）
const downloadHistory: DownloadHistoryFeature = createDownloadHistoryFeature(renderer)
const downloader: Feature = createDownloaderFeature(renderer, toolchain, downloadHistory.refresh, chrome.available)

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

const features: Feature[] = [downloader, downloadHistory, settings, about]

// ---------------------------------------------------------------------------
// 顶部标签页（切换功能）
// ---------------------------------------------------------------------------

const featureTabs = new TabBarRenderable(renderer, {
  id: "feature-tabs",
  flexGrow: 1,
  options: [
    { name: " 下载器 ", description: "下载视频 / 音频" },
    { name: " 下载历史 ", description: "最近成功下载的文件" },
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
    Object.assign(toolchain, await resolveToolchain())
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
