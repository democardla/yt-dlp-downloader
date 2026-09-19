import { readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolve } from "node:path"
import { Configs } from "./handles/Configs"
import { OutputConfig } from "./handles/OutputConfig"
import { YtTask } from "./handles/YtTask"
import { writeAppConsole } from "./components"
import { toolchainEnvironment, type Toolchain } from "./runtime/Toolchain"

/** 下载任务的实时进度回调 */
export interface DownloadProgress {
  percent: number
  speed: string
  eta: string
}

export type DownloadStatus = "downloading" | "done" | "error"

export interface DownloadCallbacks {
  onTitle: (title: string) => void
  onProgress: (p: DownloadProgress) => void
  onDone: (info: { outputPath?: string }) => void
  onError: (message: string) => void
}

export interface DownloadOptions {
  url: string
  format: "mp4" | "mp3" | "subtitle"
  outDir: string
  extraArgs: string[]
  /** 用户选择的 yt-dlp .pre 配置文件；null 表示不使用预设。 */
  presetPath?: string | null
}






const CONFIG_PATH = resolve("yt-dlp-downloader/config.json")
/** 把 ~ 展开为用户主目录 */
function expandHome(p: string): string {
  if (p === "~") return process.env.HOME ?? p
  if (p.startsWith("~/")) return `${process.env.HOME ?? ""}${p.slice(1)}`
  return p
}

/** 类 shell 的行分词，支持单/双引号 */
function tokenize(line: string): string[] {
  const tokens: string[] = []
  let current = ""
  let inQuote = false
  let quote = ""
  for (const ch of line) {
    if (inQuote) {
      if (ch === quote) inQuote = false
      else current += ch
    } else if (ch === '"' || ch === "'") {
      inQuote = true
      quote = ch
    } else if (ch === " " || ch === "\t") {
      if (current) {
        tokens.push(current)
        current = ""
      }
    } else {
      current += ch
    }
  }
  if (current) tokens.push(current)
  return tokens
}

/** 读取并解析项目根目录下的 config 文件，得到默认 yt-dlp 参数列表 */
export function loadConfigArgs(): string[] {
  try {
    const configs = Configs.loadFromFileSync(CONFIG_PATH)
    return [
      configs.downloadNetwork,
      configs.output,
      configs.subtitle,
      configs.videoFormat,
    ].flatMap((config) => config.toArgs())
  } catch {
    // The settings UI creates the JSON file on startup. Keep download startup
    // resilient if the file is missing or malformed.
    return []
  }
}

/** 根据用户选择的格式返回对应的 yt-dlp 参数 */
function formatArgs(format: DownloadOptions["format"]): string[] {
  switch (format) {
    case "mp3":
      return ["-t", "mp3"]
    case "mp4":
      return ["-t", "mp4"]
    case "subtitle":
      return ["--skip-download", "--write-subs", "--sub-langs", "zh-Hans"]
    default:
      return []
  }
}

/** 从参数数组中移除某个带值的开关（如 -t mp4、--preset-alias mp4） */
function stripFlagWithValue(args: string[], flags: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (flags.includes(args[i]!)) {
      i++ // 跳过该开关的值
      continue
    }
    out.push(args[i]!)
  }
  return out
}

/** 构建传给 yt-dlp 的完整参数列表 */
export function buildArgs(opts: DownloadOptions, titleFile: string, toolchain?: Toolchain): string[] {
  let configArgs = loadConfigArgs()
  const outDir = expandHome(opts.outDir || "~/Downloads")
  const outTemplate = `${outDir}/%(title)s.%(ext)s`

  if (opts.format === "mp3") {
    // 移除 config 里的视频预设（-t mp4 → --merge-output-format mp4 --remux-video mp4），
    // 否则 -x 提取出的 mp3 会被 remux 回 mp4。
    configArgs = stripFlagWithValue(configArgs, ["-t", "--preset-alias"])
  }

  const task = new YtTask(opts.url)
    .config(new OutputConfig({
      // The task-specific output takes precedence over the persisted config.
      path: null,
      output: outTemplate,
    }))
    .args(
      // 进度输出格式：每行 PROGRESS 百分比|速度|ETA（输出到 stdout）
      "--newline",
      "--progress-template",
      "PROGRESS %(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
      // --print-to-file 拿到标题，不影响实际下载与进度输出。
      "--print-to-file",
      "before_dl:%(title)s",
      titleFile,
      ...formatArgs(opts.format),
      ...(toolchain?.ffmpegPath ? ["--ffmpeg-location", toolchain.ffmpegPath] : []),
      ...(opts.presetPath ? ["--config-locations", opts.presetPath] : []),
      ...opts.extraArgs,
    )

  return [...configArgs, ...task.toArgs()]
}

/** 从一行进度文本中解析百分比、速度、ETA */
function parseProgressLine(line: string): DownloadProgress | null {
  // 形如 "PROGRESS  12.3%| 1.23MiB/s|00:03"
  if (!line.startsWith("PROGRESS ")) return null
  const body = line.slice("PROGRESS ".length).trim()
  const [percentStr, speed, eta] = body.split("|")
  const m = percentStr?.match(/([\d.]+)/)
  const percent = m ? parseFloat(m[1]!) : 0
  return {
    percent: isNaN(percent) ? 0 : Math.max(0, Math.min(100, percent)),
    speed: (speed ?? "").trim(),
    eta: (eta ?? "").trim(),
  }
}

/** 逐行读取可读流 */
async function readLines(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf("\n")) >= 0) {
      onLine(buffer.slice(0, idx))
      buffer = buffer.slice(idx + 1)
    }
  }
  if (buffer) onLine(buffer)
}

/** 把 yt-dlp 的一行输出写入底部控制台（进度行已在列表展示，跳过避免刷屏） */
function logToConsole(line: string) {
  const trimmed = line.trim()
  if (!trimmed) return
  if (trimmed.startsWith("PROGRESS ")) return
  if (trimmed.startsWith("WARNING")) {
    console.warn(`[yt-dlp] ${trimmed}`)
    writeAppConsole("warn", `[yt-dlp] ${trimmed}`)
  } else if (trimmed.startsWith("ERROR")) {
    console.error(`[yt-dlp] ${trimmed}`)
    writeAppConsole("error", `[yt-dlp] ${trimmed}`)
  } else {
    console.log(`[yt-dlp] ${trimmed}`)
    writeAppConsole("log", `[yt-dlp] ${trimmed}`)
  }
}

/** 启动一个下载任务，返回可用于终止的 kill 函数 */
export function startDownload(opts: DownloadOptions, cb: DownloadCallbacks, toolchain: Toolchain): () => void {
  if (!toolchain.ready || !toolchain.ytDlpPath) {
    const message = toolchain.diagnostics.join("；") || "外部工具链未准备完成"
    cb.onError(message)
    writeAppConsole("error", `[启动失败] ${message}`)
    return () => {}
  }

  const titleFile = join(
    tmpdir(),
    `ytdlp-title-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
  )
  const args = buildArgs(opts, titleFile, toolchain)

  console.log(`▶ 开始下载: ${opts.url}`)

  const proc = Bun.spawn([toolchain.ytDlpPath, ...args], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: toolchainEnvironment(toolchain),
  })

  let titleSet = false

  // 标题由 --print-to-file before_dl 写入临时文件，这里惰性读取
  const readTitle = () => {
    if (titleSet) return
    try {
      const t = readFileSync(titleFile, "utf8").trim()
      if (t) {
        titleSet = true
        cb.onTitle(t)
      }
    } catch {
      // 尚未写入
    }
  }

  // stdout：状态日志 + PROGRESS 进度行（yt-dlp 的进度与状态都走 stdout）
  void readLines(proc.stdout, (line) => {
    readTitle()
    const progress = parseProgressLine(line)
    if (progress) {
      cb.onProgress(progress)
    } else {
      logToConsole(line)
    }
  })

  // stderr：WARNING / ERROR 等
  void readLines(proc.stderr, (line) => {
    logToConsole(line)
  })

  // 等待进程结束
  void proc.exited.then((code) => {
    readTitle()
    if (code === 0) {
      console.log("✔ 下载完成")
      cb.onDone({})
    } else {
      console.error(`✘ 下载失败，进程退出码 ${code}`)
      cb.onError(`进程退出码 ${code}`)
    }
  }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`✘ 下载异常: ${msg}`)
    cb.onError(msg)
  })

  return () => {
    try {
      proc.kill()
    } catch {
      /* ignore */
    }
  }
}
