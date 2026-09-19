import {
  BoxRenderable,
  ASCIIFontRenderable,
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
import { getDefaultDownloadDirectory, revealInFileManager, type Toolchain } from "./runtime/Toolchain"
import { Configs } from "./handles/Configs"

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
  outputPath?: string
  kill?: () => void
}

const ACCENT = RGBA.fromHex("#7FC7FF")

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
    value: (() => {
      try {
        const configured = Configs.loadFromFileSync(resolve("yt-dlp-downloader/config.json")).output.path
        return configured && configured !== "~/Downloads" ? configured : getDefaultDownloadDirectory(toolchain.platform)
      } catch {
        return getDefaultDownloadDirectory(toolchain.platform)
      }
    })(),
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
  leftPanel.add(configScroll)

  // -------------------------------------------------------------------------
  // 右侧：下载列表（标签页）
  // -------------------------------------------------------------------------

  const innerTabs = new TabBarRenderable<number>(renderer, {
    id: "tabs",
    options: [
      { name: " 下载中 ", value: 0, badge: { value: 0, shown: true } },
      { name: " 已完成 ", value: 1, badge: { value: 0, shown: true } },
      { name: " 未成功 ", value: 2, badge: { value: 0, shown: true } },
    ],
    onChange: (_option, index) => {
      activeTab = index as 0 | 1 | 2
      renderList()
    },
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
      { name: " 下载中 ", value: 0, badge: { value: downloadingCount, shown: true } },
      { name: " 已完成 ", value: 1, badge: { value: doneCount, shown: true } },
      { name: " 未成功 ", value: 2, badge: { value: errorCount, shown: true } },
    ])

    for (const child of listScroll.getChildren()) listScroll.remove(child.id)

    if (items.length === 0) {
      const emptyState = new BoxRenderable(renderer, {
        id: "download-empty-state",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      })
      const emptyLabel = activeTab === 0 ? "DLD" : activeTab === 1 ? "FIN" : "FAIL"
      emptyState.add(new ASCIIFontRenderable(renderer, {
        text: emptyLabel,
        font: "tiny",
        color: RGBA.fromHex("#FFFFFF"),
        selectable: false,
      }))
      listScroll.add(emptyState)
      return
    }

    for (const item of items) {
      const statusIcon =
        item.status === "downloading" ? "⟳" : item.status === "done" ? "✓" : "✗"

      const row = new BoxRenderable(renderer, {
        id: `download-row-${item.id}`,
        width: "100%",
        height: 1,
        flexDirection: "column",
        alignItems: "center",
      })
      const titleText = new TextRenderable(renderer, {
        content: `${statusIcon} ${item.title || item.url}`,
        flexGrow: 1,
        wrapMode: "none",
        truncate: true,
        selectable: false,
      })
      if (item.status === "done" && item.outputPath) {
        titleText.onMouseDown = () => revealInFileManager(item.outputPath!)
        row.onMouseDown = () => revealInFileManager(item.outputPath!)
      }
      row.add(titleText)
      if (item.status === "downloading") {
        row.flexDirection = "row"
        row.justifyContent = "space-between"
        row.add(new ProgressBarRenderable(renderer, {
          width: 20,
          percent: item.percent,
          label: `${item.speed || ""} ETA ${item.eta || "--"}`,
          truncate: true,
          selectable: false,
        }))
      } else {
        const status = item.status === "done"
          ? item.outputPath ? "[单击查看]" : "[完成]"
          : `[失败] ${item.error || ""}`
        const statusText = new TextRenderable(renderer, {
          content: status,
          wrapMode: "none",
          truncate: true,
          selectable: false,
        })
        if (item.status === "done" && item.outputPath) {
          statusText.onMouseDown = () => revealInFileManager(item.outputPath!)
        }
        row.flexDirection = "row"
        row.justifyContent = "space-between"
        row.add(statusText)
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
    const formatOpt = selectedFormat === "mp3" ? "mp3" : selectedFormat === "字幕" ? "subtitle" : "mp4"
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
      onOutputPath: (path) => {
        item.outputPath = path
        renderList()
      },
      onDone: ({ outputPath }) => {
        item.status = "done"
        item.percent = 100
        if (outputPath) item.outputPath = outputPath
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

  // The list starts empty. Render the initial tab immediately so its ASCII
  // empty-state marker is visible before the user switches tabs.
  renderList()

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
