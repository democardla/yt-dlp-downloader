import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  ScrollBoxRenderable,
  TextRenderable,
  RGBA,
  type CliRenderer,
  type Renderable,
} from "@opentui/core"
import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { ProgressBarRenderable, StatusSelectRenderable, StyledSelectRenderable, TabBarRenderable } from "./components"
import {
  startDownload,
  type DownloadOptions,
  type DownloadStatus,
} from "./downloader"
import type { Toolchain } from "./runtime/Toolchain"

// ---------------------------------------------------------------------------
// 数据模型
// ---------------------------------------------------------------------------

interface DownloadItem {
  id: string
  url: string
  title: string
  status: DownloadStatus
  percent: number
  speed: string
  eta: string
  error?: string
  kill?: () => void
}

const ACCENT = RGBA.fromHex("#7FC7FF")
const MUTED = RGBA.fromHex("#6b7280")

export interface DownloaderFeature {
  /** 下载器根布局（左：配置区，右：下载列表） */
  root: BoxRenderable
  /** 可聚焦组件，供外部做 Tab 焦点循环 */
  getFocusables(): Renderable[]
  /** 聚焦第一个输入框（URL） */
  focusFirst(): void
}

/** 创建下载器业务逻辑：构建界面、绑定事件、管理下载列表与状态 */
export function createDownloaderFeature(renderer: CliRenderer, toolchain: Toolchain): DownloaderFeature {
  const downloads: DownloadItem[] = []
  let activeTab: 0 | 1 | 2 = 0 // 0 = 下载中, 1 = 已完成, 2 = 未成功

  // -------------------------------------------------------------------------
  // 左侧：下载配置区
  // -------------------------------------------------------------------------

  const urlInput = new InputRenderable(renderer, {
    id: "url-input",
    placeholder: "粘贴视频链接，回车开始下载",
    value: "",
  })

  // 输出格式选择：使用 StyledSelectRenderable
  const formatSelect = new StyledSelectRenderable(renderer, {
    options: [
      { name: "mp4", description: "视频 MP4" },
      { name: "mp3", description: "仅音频 MP3" },
      { name: "字幕", description: "仅下载字幕" },
    ],
    selectedIndex: 0,
  })

  const outDirInput = new InputRenderable(renderer, {
    id: "out-dir",
    value: "~/Downloads",
    placeholder: "下载文件保存目录",
  })

  const extraArgsInput = new InputRenderable(renderer, {
    id: "extra-args",
    placeholder: "额外 yt-dlp 参数（空格分隔）",
    value: "",
  })

  const formatContainer = new BoxRenderable(renderer, {
    id: "format-select-container",
    height: 3,
  })
  formatContainer.add(formatSelect)

  const presetDirectory = resolve("yt-dlp-downloader")
  function readPresetOptions() {
    try {
      const presetFiles = readdirSync(presetDirectory, { withFileTypes: true })
        .filter((file) => file.isFile() && file.name.endsWith(".pre"))
        .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))

      return [
        { name: "不使用预设", value: null, available: false },
        ...presetFiles.map((file) => ({
          name: file.name,
          value: resolve(presetDirectory, file.name),
          available: true,
        })),
      ]
    } catch {
      return [{ name: "不使用预设", value: null, available: false }]
    }
  }

  const presetSelect = new StatusSelectRenderable<string | null>(renderer, {
    options: readPresetOptions(),
    selectedIndex: 0,
    onBeforeOpen: () => presetSelect.setOptions(readPresetOptions()),
  })

  const leftPanel = new BoxRenderable(renderer, {
    id: "left-panel",
    width: "40%",
    height: "100%",
    border: true,
    title: " 下载配置 ",
    titleAlignment: "center",
    flexDirection: "column",
    padding: 1,
    gap: 1,
  })
  const configScroll = new ScrollBoxRenderable(renderer, {
    flexGrow: 1,
    scrollY: true,
    scrollX: false,
    scrollbarOptions: { showArrows: false },
  })
  configScroll.add(new TextRenderable(renderer, { content: "视频 URL", fg: ACCENT }))
  configScroll.add(urlInput)
  configScroll.add(new TextRenderable(renderer, { content: "输出格式", fg: ACCENT }))
  configScroll.add(formatContainer)
  configScroll.add(new TextRenderable(renderer, { content: "输出目录", fg: ACCENT }))
  configScroll.add(outDirInput)
  configScroll.add(new TextRenderable(renderer, { content: "预设文件", fg: ACCENT }))
  configScroll.add(presetSelect)
  configScroll.add(new TextRenderable(renderer, { content: "附加参数", fg: ACCENT }))
  configScroll.add(extraArgsInput)
  configScroll.add(
    new TextRenderable(renderer, {
      content: "回车：开始下载   Tab：切换焦点   Ctrl+C：退出",
      fg: MUTED,
    })
  )
  leftPanel.add(configScroll)

  // -------------------------------------------------------------------------
  // 右侧：下载列表（标签页）
  // -------------------------------------------------------------------------

  const innerTabs = new TabBarRenderable<number>(renderer, {
    id: "tabs",
    options: [
      { name: " 下载中 ", description: "0", value: 0 },
      { name: " 已完成 ", description: "0", value: 1 },
      { name: " 未成功 ", description: "0", value: 2 },
    ],
    onChange: (_option, index) => {
      activeTab = index as 0 | 1 | 2
      renderList()
    },
  })

  const listContent = new TextRenderable(renderer, {
    id: "list-content",
    content: "暂无下载任务",
  })

  const listContainer = new BoxRenderable(renderer, {
    id: "list-container",
    flexGrow: 1,
    flexDirection: "column",
    padding: 1,
  })
  const listScroll = new ScrollBoxRenderable(renderer, {
    flexGrow: 1,
    scrollY: true,
    scrollX: false,
    scrollbarOptions: { showArrows: false },
  })
  listScroll.add(listContent)
  listContainer.add(listScroll)

  const rightPanel = new BoxRenderable(renderer, {
    id: "right-panel",
    flexGrow: 1,
    height: "100%",
    border: true,
    title: " 下载列表 ",
    titleAlignment: "center",
    flexDirection: "column",
  })
  rightPanel.add(innerTabs)
  rightPanel.add(listContainer)

  const root = new BoxRenderable(renderer, {
    id: "downloader-root",
    flexDirection: "row",
    width: "100%",
    height: "100%",
  })
  root.add(leftPanel)
  root.add(rightPanel)

  // -------------------------------------------------------------------------
  // 列表渲染
  // -------------------------------------------------------------------------

  function renderList() {
    const items = downloads.filter((d) => activeTab === 0
      ? d.status === "downloading"
      : activeTab === 1 ? d.status === "done" : d.status === "error")

    const downloadingCount = downloads.filter((d) => d.status === "downloading").length
    const doneCount = downloads.filter((d) => d.status === "done").length
    const errorCount = downloads.filter((d) => d.status === "error").length
    innerTabs.setOptions([
      { name: " 下载中 ", description: String(downloadingCount), value: 0 },
      { name: " 已完成 ", description: String(doneCount), value: 1 },
      { name: " 未成功 ", description: String(errorCount), value: 2 },
    ])

    for (const child of listScroll.getChildren()) listScroll.remove(child.id)

    if (items.length === 0) {
      listScroll.add(listContent)
      listContent.content = activeTab === 0 ? "暂无下载中的任务" : activeTab === 1 ? "暂无已完成的任务" : "暂无失败的任务"
      return
    }

    for (const item of items) {
      const statusIcon =
        item.status === "downloading" ? "⟳" : item.status === "done" ? "✓" : "✗"

      const row = new BoxRenderable(renderer, {
        id: `download-row-${item.id}`,
        flexDirection: "column",
      })
      row.add(new TextRenderable(renderer, {
        content: `${statusIcon} ${item.title || item.url}`,
      }))

      if (item.status === "downloading") {
        row.add(new ProgressBarRenderable(renderer, {
          width: 20,
          percent: item.percent,
          label: `${item.speed || ""} ETA ${item.eta || "--"}`,
        }))
      } else {
        const status = item.status === "done"
          ? "[完成]"
          : `[失败] ${item.error || ""}`
        row.add(new TextRenderable(renderer, { content: status }))
      }
      listScroll.add(row)
    }
  }

  // -------------------------------------------------------------------------
  // 启动下载
  // -------------------------------------------------------------------------

  function beginDownload() {
    const url = urlInput.value.trim()
    if (!url) return

    const selectedFormat = formatSelect.getSelectedOption()?.name
    const formatOpt = selectedFormat === "mp3" ? "mp3" : selectedFormat === "简字幕" ? "subtitle" : "mp4"
    const outDir = outDirInput.value.trim() || "~/Downloads"
    const extraRaw = extraArgsInput.value.trim()
    const extraArgs = extraRaw ? extraRaw.split(/\s+/).filter(Boolean) : []
    const presetPath = presetSelect.getSelectedOption()?.value ?? null

    const item: DownloadItem = {
      id: `dl-${Date.now()}`,
      url,
      title: url,
      status: "downloading",
      percent: 0,
      speed: "",
      eta: "",
    }
    downloads.push(item)

    activeTab = 0
    innerTabs.setSelectedIndex(0)
    renderList()

    const opts: DownloadOptions = {
      url,
      format: formatOpt as DownloadOptions["format"],
      outDir,
      extraArgs,
      presetPath,
    }

    item.kill = startDownload(opts, {
      onTitle: (title) => {
        item.title = title
        renderList()
      },
      onProgress: (p) => {
        item.percent = p.percent
        item.speed = p.speed
        item.eta = p.eta
        renderList()
      },
      onDone: () => {
        item.status = "done"
        item.percent = 100
        renderList()
      },
      onError: (msg) => {
        item.status = "error"
        item.error = msg
        renderList()
      },
    }, toolchain)

    urlInput.value = ""
    urlInput.focus()
  }

  // -------------------------------------------------------------------------
  // 事件绑定
  // -------------------------------------------------------------------------

  urlInput.on(InputRenderableEvents.ENTER, () => {
    beginDownload()
  })

  extraArgsInput.on(InputRenderableEvents.ENTER, () => {
    beginDownload()
  })

  const focusables: Renderable[] = [
    urlInput,
    formatSelect,
    outDirInput,
    extraArgsInput,
    innerTabs,
  ]

  return {
    root,
    getFocusables: () => focusables,
    focusFirst: () => urlInput.focus(),
  }
}
