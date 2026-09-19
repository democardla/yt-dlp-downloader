import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  RGBA,
  type Renderable,
} from "@opentui/core"
import { createDownloaderFeature } from "./DownloaderUi"
import { createSettingsFeature } from "./SettingsUi"
import { ConsolePanelRenderable, TabBarRenderable, writeAppConsole } from "./components"
import { access, mkdir } from "node:fs/promises";
import { resolveToolchain } from "./runtime/Toolchain"

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
    console.log("目录已经存在");
} catch {
    await mkdir(dir, { recursive: true });
    console.log("目录不存在，已创建");
}

// Resolve the host and all external binaries before constructing download UI.
const toolchain = resolveToolchain()

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

// 下载器（真实功能）
const downloader: Feature = createDownloaderFeature(renderer, toolchain)

// 设置页（真实功能）
const settings: Feature = createSettingsFeature(renderer)
let appConfigs: Configs
try {
  appConfigs = Configs.loadFromFileSync("yt-dlp-downloader/config.json")
} catch {
  appConfigs = new Configs()
}
const consolePanel = new ConsolePanelRenderable(renderer, { enabled: appConfigs.console.enabled })

const toolchainHeader = `系统：${toolchain.operatingSystem} (${toolchain.platform})`
console.log(toolchainHeader)
writeAppConsole("log", toolchainHeader)
for (const [name, path] of [
  ["ffmpeg", toolchain.ffmpegPath],
  ["ffprobe", toolchain.ffprobePath],
  ["yt-dlp", toolchain.ytDlpPath],
] as const) {
  const message = `${name}: ${path ?? "未找到"}`
  console.log(message)
  writeAppConsole(path ? "log" : "error", message)
}
if (!toolchain.ready) {
  const message = `工具链未准备完成，下载功能暂不可用：${toolchain.diagnostics.join("；")}`
  console.error(message)
  writeAppConsole("error", message)
}

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

const features: Feature[] = [downloader, settings, about]

// ---------------------------------------------------------------------------
// 顶部标签页（切换功能）
// ---------------------------------------------------------------------------

const featureTabs = new TabBarRenderable(renderer, {
  id: "feature-tabs",
  width: "100%",
  options: [
    { name: " 下载器 ", description: "下载视频 / 音频" },
    { name: " 设置 ", description: "配置参数" },
    { name: " 关于 ", description: "关于本工具" },
  ],
  onChange: (_option, index) => selectFeature(index),
})

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
root.add(featureTabs)
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
  if (focusIdx >= list.length) focusIdx = 0
  return list
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

console.log("yt-dlp 下载器已就绪，输入视频链接后回车即可开始下载")
writeAppConsole("log", "yt-dlp 下载器已就绪，输入视频链接后回车即可开始下载")

// 初始选中“下载器”并聚焦 URL 输入
selectFeature(0)
