import {
  ASCIIFontRenderable,
  BoxRenderable,
  RGBA,
  ScrollBoxRenderable,
  TextRenderable,
  type CliRenderer,
  type Renderable,
} from "@opentui/core"
import { basename, resolve } from "node:path"
import {
  ActionButtonRenderable,
  FileDropInputRenderable,
  type FileDropInputStatus,
  MatrixSelectRenderable,
  TabBarRenderable,
  writeAppConsole,
} from "../components"
import { Configs } from "../handles"
import { rememberDownloadedFile } from "../runtime/DownloadHistory"
import {
  type AudioOutputFormat,
  type ConversionKind,
  type ConversionOutputFormat,
  type VideoOutputFormat,
} from "../runtime/MediaConverter"
import { ConversionScheduler, type ConversionTaskHandle, type ConversionTaskStatus } from "../runtime/ConversionScheduler"
import { getDefaultDownloadDirectory, revealInFileManager, type Toolchain } from "../runtime/Toolchain"

const ACCENT = RGBA.fromHex("#7FC7FF")
const AUDIO_FORMATS: AudioOutputFormat[] = ["mp3", "m4a", "flac", "wav", "opus", "ogg"]
const VIDEO_FORMATS: VideoOutputFormat[] = ["mp4", "mkv", "webm", "mov"]

export interface ConversionFeature {
  root: BoxRenderable
  getFocusables(): Renderable[]
  focusFirst(): void
}

function defaultOutputDirectory(toolchain: Toolchain): string {
  try {
    const configured = Configs.loadFromFileSync(resolve("yt-dlp-downloader/config.json")).output.path
    return configured && configured !== "~/Downloads"
      ? configured
      : getDefaultDownloadDirectory(toolchain.platform)
  } catch {
    return getDefaultDownloadDirectory(toolchain.platform)
  }
}

function formatOptions<T extends string>(formats: readonly T[]) {
  return formats.map((format) => ({ name: format, value: format }))
}

function configuredMaxConcurrentTasks(): number {
  try {
    const value = Configs.loadFromFileSync(resolve("yt-dlp-downloader/config.json")).general.max_concurrent_tasks
    return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 2
  } catch {
    return 2
  }
}

function createConversionFeature(
  renderer: CliRenderer,
  toolchain: Toolchain,
  feature: "video" | "audio",
  onHistoryChanged?: () => void,
): ConversionFeature {
  let kind: ConversionKind = feature === "video" ? "video-to-video" : "audio-to-audio"
  const scheduler = new ConversionScheduler(toolchain, configuredMaxConcurrentTasks())
  const taskHandles = new Map<string, ConversionTaskHandle>()

  const finishIfIdle = () => {
    if (scheduler.isBusy()) return
    startButton.disabled = false
    cancelButton.disabled = true
    cancelButton.setLabel("停止")
    cancelButton.background_color = RGBA.fromInts(75, 85, 99, 100)
  }

  const setFileStatus = (path: string, value: FileDropInputStatus) => {
    inputPath.setPathStatus(path, value)
  }

  const inputPath = new FileDropInputRenderable(renderer, {
    id: `${feature}-conversion-input`,
    platform: toolchain.platform,
    width: "100%",
    outputPath: defaultOutputDirectory(toolchain),
    onPathsChanged: (paths) => {
      for (const [path, handle] of taskHandles) {
        if (!paths.includes(path)) {
          handle.cancel()
          taskHandles.delete(path)
        }
      }
    },
  })
  const initialFormats: ConversionOutputFormat[] = feature === "video" ? [...VIDEO_FORMATS] : [...AUDIO_FORMATS]
  const formatSelect = new MatrixSelectRenderable<ConversionOutputFormat>(renderer, {
    id: `${feature}-conversion-format`,
    options: formatOptions(initialFormats),
    selectedIndex: 0,
  })

  const start = () => {
    if (scheduler.isBusy()) return
    scheduler.setMaxConcurrentTasks(configuredMaxConcurrentTasks())
    inputPath.commitPendingInput()
    const sources = inputPath.getPaths()
    if (sources.length === 0) {
      writeAppConsole("warn", "[格式转换] 请先拖入或输入文件路径")
      return
    }
    const selectedFormat = formatSelect.getSelectedOption()?.value
    if (!selectedFormat) return
    scheduler.clearFinished()
    taskHandles.clear()
    startButton.disabled = true
    cancelButton.disabled = false
    cancelButton.setLabel("停止")
    cancelButton.background_color = RGBA.fromInts(220, 70, 80, 180)
    for (const source of sources) {
      const directory = inputPath.getOutputPath(source).trim() || defaultOutputDirectory(toolchain)
      inputPath.clearOutputResult(source)
      setFileStatus(source, "waiting")
      const handle = scheduler.enqueue({
        kind,
        inputPath: source,
        outputDirectory: directory,
        outputFormat: selectedFormat,
      }, {
        onState: (taskStatus: ConversionTaskStatus) => {
          if (taskStatus === "waiting") setFileStatus(source, "waiting")
          if (taskStatus === "running") setFileStatus(source, { type: "progress", percent: 0 })
          if (taskStatus === "complete") setFileStatus(source, "complete")
          if (taskStatus === "failed") setFileStatus(source, "failed")
          if (taskStatus === "cancelled") setFileStatus(source, "cancelled")
          if (taskStatus === "complete" || taskStatus === "failed" || taskStatus === "cancelled") finishIfIdle()
        },
        onProgress: (percent) => setFileStatus(source, { type: "progress", percent }),
        onDone: (outputPath) => {
          const source = kind === "video-to-video"
            ? "视频转视频"
            : kind === "video-to-audio"
              ? "视频转音频"
              : "音频转音频"
          rememberDownloadedFile(outputPath, source)
          onHistoryChanged?.()
          inputPath.setOutputResult(source, outputPath, () => {
            const revealed = revealInFileManager(outputPath)
            writeAppConsole(revealed ? "log" : "error", revealed
              ? `[文件跳转] 已发送文件定位命令：${outputPath}`
              : `[文件跳转] 找不到文件或无法打开：${outputPath}`)
          })
        },
        onError: (message) => {
          writeAppConsole("error", `[格式转换] ${basename(source)}：${message}`)
        },
      })
      taskHandles.set(source, handle)
    }
  }

  const startButton = new ActionButtonRenderable(renderer, {
    id: `${feature}-conversion-start`,
    width: 14,
    label: "开始转换",
    background_color: RGBA.fromInts(34, 197, 94, 110),
    onActivate: start,
  })
  const cancelButton = new ActionButtonRenderable(renderer, {
    id: `${feature}-conversion-cancel`,
    width: 12,
    label: "停止",
    disabled: true,
    danger: true,
    background_color: RGBA.fromInts(75, 85, 99, 100),
    onActivate: () => {
      scheduler.cancelAll()
      finishIfIdle()
    },
  })

  const actions = new BoxRenderable(renderer, { width: "100%", height: 1, flexDirection: "row", gap: 1 })
  actions.add(startButton)
  actions.add(cancelButton)

  const left = new BoxRenderable(renderer, {
    id: `${feature}-conversion-options`,
    width: "50%",
    height: "100%",
    border: true,
    title: " 输出参数 ",
    titleAlignment: "center",
    flexDirection: "column",
    padding: 1,
    gap: 1,
  })
  const optionsScroll = new ScrollBoxRenderable(renderer, {
    id: `${feature}-conversion-options-scroll`,
    flexGrow: 1,
    scrollY: true,
    scrollX: false,
    scrollbarOptions: { showArrows: false },
  })

  let modeTabs: TabBarRenderable<"video-to-audio" | "video-to-video"> | null = null
  if (feature === "video") {
    modeTabs = new TabBarRenderable(renderer, {
      id: "video-conversion-mode",
      options: [
        { name: " 视频转视频 ", value: "video-to-video" },
        { name: " 视频转音频 ", value: "video-to-audio" },
      ],
      onChange: (option) => {
        kind = option.value ?? "video-to-video"
        const formats = kind === "video-to-video" ? VIDEO_FORMATS : AUDIO_FORMATS
        formatSelect.setOptions(formatOptions(formats))
        formatSelect.setSelectedIndex(0)
      },
    })
    left.add(modeTabs)
  }
  optionsScroll.add(new TextRenderable(renderer, { content: "输出文件类型", fg: ACCENT, selectable: false }))
  optionsScroll.add(formatSelect)
  optionsScroll.add(actions)
  left.add(optionsScroll)

  const right = new BoxRenderable(renderer, {
    id: `${feature}-conversion-input-panel`,
    flexGrow: 1,
    height: "100%",
    border: true,
    title: " 输入文件 ",
    titleAlignment: "center",
    flexDirection: "column",
    padding: 2,
    gap: 1,
  })
  const inputMark = new BoxRenderable(renderer, {
    width: "100%",
    height: 3,
    justifyContent: "center",
    alignItems: "center",
  })
  inputMark.add(new ASCIIFontRenderable(renderer, {
    id: `${feature}-conversion-input-mark`,
    text: "IN",
    font: "tiny",
    color: RGBA.fromHex("#FFFFFF"),
    selectable: false,
  }))
  right.add(inputMark)
  right.add(inputPath)
  right.onMouseDown = () => inputPath.focus()
  right.onMouseOver = () => inputPath.focus()

  const root = new BoxRenderable(renderer, {
    id: `${feature}-conversion-root`,
    width: "100%",
    height: "100%",
    flexDirection: "row",
  })
  root.add(left)
  root.add(right)

  const focusables: Renderable[] = [
    ...(modeTabs ? [modeTabs] : []),
    formatSelect,
    inputPath,
    startButton,
    cancelButton,
  ]
  return { root, getFocusables: () => focusables, focusFirst: () => inputPath.focus() }
}

export function createVideoConversionFeature(renderer: CliRenderer, toolchain: Toolchain, onHistoryChanged?: () => void) {
  return createConversionFeature(renderer, toolchain, "video", onHistoryChanged)
}

export function createAudioConversionFeature(renderer: CliRenderer, toolchain: Toolchain, onHistoryChanged?: () => void) {
  return createConversionFeature(renderer, toolchain, "audio", onHistoryChanged)
}
