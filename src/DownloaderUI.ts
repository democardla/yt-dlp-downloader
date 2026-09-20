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
import {
  ProgressBarRenderable,
  ActionButtonRenderable,
  StatusSelectRenderable,
  StyledSelectRenderable,
  TabBarRenderable,
  SubtitleSelectionModalRenderable,
  writeAppConsole,
} from "./components"
import {
  fetchAvailableSubtitles,
  startDownload,
  type DownloadOptions,
  type DownloadStatus,
  type SubtitleTrack,
} from "./downloader"
import { getDefaultDownloadDirectory, revealInFileManager, type Toolchain } from "./runtime/Toolchain"
import {
  rememberDownloadedFile,
} from "./runtime/DownloadHistory"
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
  outputPaths?: string[]
  kill?: () => void
  row?: BoxRenderable
  progressBar?: ProgressBarRenderable
  cancelButton?: ActionButtonRenderable
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
export function createDownloaderFeature(
  renderer: CliRenderer,
  toolchain: Toolchain,
  onHistoryChanged?: () => void,
  chromeAvailable = false,
): DownloaderFeature {
  // The completed tab is session-only. Persistent records are shown in the
  // top-level Download History tab instead.
  const downloads: DownloadItem[] = []
  let activeTab: 0 | 1 | 2 | 3 = 0 // 0 = 下载中, 1 = 已完成, 2 = 未成功, 3 = 已取消
  let subtitleModal: SubtitleSelectionModalRenderable | null = null
  let subtitleQuerying = false

  // -------------------------------------------------------------------------
  // 左侧：下载配置区
  // -------------------------------------------------------------------------

  const urlInput = new InputRenderable(renderer, {
    id: "url-input",
    width: "auto",
    minWidth: 1,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    placeholder: "粘贴视频链接，回车开始下载",
    value: "",
  })

  // 输出格式选择：使用 StyledSelectRenderable
  const formatSelect = new StyledSelectRenderable(renderer, {
    options: [
      { name: "mp4", description: "视频 MP4" },
      { name: "mp3", description: "仅音频 MP3" },
      ...(chromeAvailable ? [{ name: "字幕", description: "仅下载字幕" }] : []),
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

  const downloadButton = new ActionButtonRenderable(renderer, {
    id: "start-download",
    width: 14,
    label: "开始下载",
    background_color: RGBA.fromInts(34, 197, 94, 110),
    onActivate: () => {
      void beginDownload()
    },
  })
  const urlActions = new BoxRenderable(renderer, {
    id: "url-actions",
    width: "100%",
    height: 1,
    flexDirection: "row",
    gap: 1,
  })
  urlActions.add(urlInput)
  urlActions.add(downloadButton)

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
  configScroll.add(urlActions)
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
      { name: " 已取消 ", value: 3, badge: { value: 0, shown: true } },
    ],
    onChange: (_option, index) => {
      activeTab = index as 0 | 1 | 2 | 3
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

  const revealDownload = (filePath: string) => {
    const revealed = revealInFileManager(filePath)
    if (revealed) {
      writeAppConsole("log", `[文件跳转] 已发送文件定位命令：${filePath}`)
    } else {
      writeAppConsole("error", `[文件跳转] 找不到文件或无法打开：${filePath}`)
    }
  }

  const root = new BoxRenderable(renderer, {
    id: "downloader-root",
    flexDirection: "row",
    width: "100%",
    height: "100%",
  })
  root.add(leftPanel)
  root.add(rightPanel)

  function closeSubtitleModal(): void {
    if (!subtitleModal) return
    root.remove(subtitleModal.id)
    subtitleModal.destroy()
    subtitleModal = null
    urlInput.focus()
  }

  function showSubtitleModal(url: string, tracks: SubtitleTrack[]): void {
    if (subtitleModal) closeSubtitleModal()
    subtitleModal = new SubtitleSelectionModalRenderable(renderer, {
      id: "subtitle-selection-modal",
      tracks,
      onCancel: closeSubtitleModal,
      onSubmit: (selectedTracks) => {
        closeSubtitleModal()
        void beginDownload(selectedTracks)
      },
    })
    root.add(subtitleModal)
    subtitleModal.getFocusables()[0]?.focus()
    writeAppConsole("log", `[字幕] 已获取 ${tracks.length} 个可用字幕选项：${url}`)
  }

  function cancelDownload(item: DownloadItem): void {
    if (item.status !== "downloading") return
    item.status = "cancelled"
    item.error = "用户取消下载"
    item.kill?.()
    item.kill = undefined
    writeAppConsole("warn", `[下载] 已取消任务：${item.title || item.url}`)
    renderList()
  }

  // -------------------------------------------------------------------------
  // 列表渲染
  // -------------------------------------------------------------------------

  function renderList() {
    const items = downloads.filter((d) => activeTab === 0
      ? d.status === "downloading"
      : activeTab === 1
        ? d.status === "done"
        : activeTab === 2
          ? d.status === "error"
          : d.status === "cancelled")

    const downloadingCount = downloads.filter((d) => d.status === "downloading").length
    const doneCount = downloads.filter((d) => d.status === "done").length
    const errorCount = downloads.filter((d) => d.status === "error").length
    const cancelledCount = downloads.filter((d) => d.status === "cancelled").length
    innerTabs.setOptions([
      { name: " 下载中 ", value: 0, badge: { value: downloadingCount, shown: true } },
      { name: " 已完成 ", value: 1, badge: { value: doneCount, shown: true } },
      { name: " 未成功 ", value: 2, badge: { value: errorCount, shown: true } },
      { name: " 已取消 ", value: 3, badge: { value: cancelledCount, shown: true } },
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
      const emptyLabel = activeTab === 0
        ? "DLD"
        : activeTab === 1
          ? "FIN"
          : activeTab === 2
            ? "FAIL"
            : "CANC"
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
        item.status === "downloading" ? "⟳" : item.status === "done" ? "✓" : item.status === "cancelled" ? "■" : "✗"

      const row = new BoxRenderable(renderer, {
        id: `download-row-${item.id}`,
        width: "100%",
        height: 1,
        flexDirection: "column",
        alignItems: "center",
      })
      item.row = row
      const titleText = new TextRenderable(renderer, {
        content: `${statusIcon} ${item.title || item.url}`,
        flexGrow: 1,
        wrapMode: "none",
        truncate: true,
        selectable: false,
      })
      if (item.status === "done" && item.outputPath) {
        titleText.onMouseDown = () => revealDownload(item.outputPath!)
        row.onMouseDown = () => revealDownload(item.outputPath!)
      }
      row.add(titleText)
      if (item.status === "downloading") {
        row.flexDirection = "row"
        row.justifyContent = "space-between"
        const progressBar = new ProgressBarRenderable(renderer, {
          width: 20,
          percent: item.percent,
          label: `${item.speed || ""} ETA ${item.eta || "--"}`,
          truncate: true,
          selectable: false,
        })
        item.progressBar = progressBar
        row.add(progressBar)
        const cancelButton = new ActionButtonRenderable(renderer, {
          id: `cancel-download-${item.id}`,
          width: 8,
          label: "取消",
          background_color: RGBA.fromInts(220, 70, 70, 95),
          onActivate: () => cancelDownload(item),
        })
        item.cancelButton = cancelButton
        row.add(cancelButton)
      } else {
        item.progressBar = undefined
        item.cancelButton = undefined
        const status = item.status === "done"
          ? item.outputPath ? "[单击查看]" : "[完成]"
          : item.status === "cancelled"
            ? `[已取消] ${item.error || ""}`
            : `[失败] ${item.error || ""}`
        const statusText = new TextRenderable(renderer, {
          content: status,
          wrapMode: "none",
          truncate: true,
          selectable: false,
        })
        if (item.status === "done" && item.outputPath) {
          statusText.onMouseDown = () => revealDownload(item.outputPath!)
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

  async function beginDownload(selectedSubtitleTracks?: SubtitleTrack[]) {
    const url = urlInput.value.trim()
    if (!url) return

    const selectedFormat = formatSelect.getSelectedOption()?.name
    const formatOpt = selectedFormat === "mp3" ? "mp3" : selectedFormat === "字幕" ? "subtitle" : "mp4"

    if (formatOpt === "subtitle" && !chromeAvailable) {
      writeAppConsole("error", "[字幕] 未检测到 Chrome，字幕下载选项不可用")
      return
    }

    if (formatOpt === "subtitle" && !selectedSubtitleTracks) {
      if (subtitleQuerying) return
      subtitleQuerying = true
      writeAppConsole("log", `[字幕] 正在获取可用字幕：${url}`)
      try {
        const tracks = await fetchAvailableSubtitles(url, toolchain)
        if (tracks.length === 0) {
          writeAppConsole(
            "warn",
            `[字幕] 未检测到可用字幕：${url}。可能是视频确实没有字幕，也可能是 Chrome 当前配置文件没有该网站的 Cookie。`,
          )
          return
        }
        showSubtitleModal(url, tracks)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        writeAppConsole("error", `[字幕] 获取可用字幕失败：${message}`)
      } finally {
        subtitleQuerying = false
      }
      return
    }

    const outDir = outDirInput.value.trim() || "~/Downloads"
    const extraRaw = extraArgsInput.value.trim()
    const extraArgs = extraRaw ? extraRaw.split(/\s+/).filter(Boolean) : []
    const presetPath = presetSelect.getSelectedOption()?.value ?? null
    let subtitleFormat: DownloadOptions["subtitleFormat"]
    if (formatOpt === "subtitle") {
      try {
        subtitleFormat = Configs.loadFromFileSync(resolve("yt-dlp-downloader/config.json")).subtitle.sub_format
      } catch {
        subtitleFormat = "vtt"
      }
    }

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
      subtitleLanguages: selectedSubtitleTracks?.map((track) => track.language),
      subtitleSources: selectedSubtitleTracks
        ? [...new Set(selectedSubtitleTracks.map((track) => track.source))]
        : undefined,
      subtitleFormat,
      useChromeCookies: formatOpt === "subtitle",
      presetPath,
    }

    let savedHistoryPaths: string[] = []
    const saveCompletedPaths = (paths: string[]) => {
      // rememberDownloadedFile prepends entries, so save in reverse to retain
      // yt-dlp's result order in the history view.
      for (const path of [...paths].reverse()) {
        savedHistoryPaths = rememberDownloadedFile(path)
      }
      onHistoryChanged?.()
    }

    item.kill = startDownload(opts, {
      onTitle: (title) => {
        if (item.status !== "downloading") return
        item.title = title
        renderList()
      },
      onProgress: (p) => {
        if (item.status !== "downloading") return
        item.percent = p.percent
        item.speed = p.speed
        item.eta = p.eta
        if (item.progressBar) {
          item.progressBar.percent = p.percent
          item.progressBar.label = `${p.speed || ""} ETA ${p.eta || "--"}`
        } else {
          renderList()
        }
      },
      onOutputPath: (path) => {
        if (item.status !== "downloading") return
        item.outputPaths = [...new Set([...(item.outputPaths ?? []), path])]
        item.outputPath ??= path
        // Show the detected filename immediately, but only persist it after
        // the process succeeds and startDownload verifies that it exists.
        const fileName = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1)
        if (fileName && item.outputPaths.length === 1) item.title = fileName
        renderList()
      },
      onDone: ({ outputPath, outputPaths }) => {
        if (item.status !== "downloading") return
        const completedPaths = [...new Set(outputPaths)]
        if (completedPaths.length === 0) {
          item.status = "error"
          item.error = "任务结束但没有可访问的结果文件"
          renderList()
          return
        }

        item.status = "done"
        item.percent = 100
        item.outputPath = outputPath
        item.outputPaths = completedPaths
        saveCompletedPaths(completedPaths)

        const primaryFileName = outputPath.slice(Math.max(outputPath.lastIndexOf("/"), outputPath.lastIndexOf("\\")) + 1)
        if (primaryFileName) {
          item.title = completedPaths.length === 1
            ? primaryFileName
            : `${primaryFileName} 等 ${completedPaths.length} 个文件`
        }
        const historySet = new Set(savedHistoryPaths)
        const completedPathSet = new Set(completedPaths)

        // Keep active/error tasks, but trim completed items to the persisted
        // ten most recent successful files and remove duplicate results.
        for (let index = downloads.length - 1; index >= 0; index--) {
          const existing = downloads[index]
          if (!existing || existing === item || existing.status !== "done") continue
          const existingPaths = existing.outputPaths ?? (existing.outputPath ? [existing.outputPath] : [])
          if (existingPaths.some((path) => completedPathSet.has(path))
            || !existingPaths.some((path) => historySet.has(path))) {
            downloads.splice(index, 1)
          }
        }

        const itemIndex = downloads.indexOf(item)
        if (itemIndex >= 0) downloads.splice(itemIndex, 1)
        downloads.unshift(item)
        renderList()
      },
      onError: (msg) => {
        if (item.status !== "downloading") return
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
    downloadButton,
    innerTabs,
  ]

  return {
    root,
    getFocusables: () => subtitleModal?.getFocusables() ?? [
      ...focusables,
      ...downloads
        .filter((item) => item.status === "downloading" && item.cancelButton)
        .map((item) => item.cancelButton!),
    ],
    focusFirst: () => (subtitleModal?.getFocusables()[0] ?? urlInput).focus(),
  }
}
