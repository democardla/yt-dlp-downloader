import { mkdirSync, readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolve } from "node:path"
import { Configs } from "./handles/Configs"
import { OutputConfig } from "./handles/OutputConfig"
import { YtTask } from "./handles/YtTask"
import { writeAppConsole } from "./components"
import {
  getDefaultDownloadDirectory,
  normalizeFilePath,
  toolchainEnvironment,
  type Toolchain,
} from "./runtime/Toolchain"

/** 下载任务的实时进度回调 */
export interface DownloadProgress {
  percent: number
  speed: string
  eta: string
}

export type DownloadStatus = "downloading" | "done" | "error" | "cancelled"

export type SubtitleSource = "original" | "generated"

export interface SubtitleTrack {
  language: string
  source: SubtitleSource
}

export interface DownloadCallbacks {
  onTitle: (title: string) => void
  onProgress: (p: DownloadProgress) => void
  onOutputPath: (path: string) => void
  onDone: (info: { outputPath?: string }) => void
  onError: (message: string) => void
}

export interface DownloadOptions {
  url: string
  format: "mp4" | "mp3" | "subtitle"
  outDir: string
  extraArgs: string[]
  subtitleLanguages?: string[]
  subtitleSources?: SubtitleSource[]
  subtitleFormat?: "vtt" | "srt" | "ttml"
  useChromeCookies?: boolean
  /** Per-task temporary directory, managed by startDownload. */
  tempDir?: string
  /** 用户选择的 yt-dlp .pre 配置文件；null 表示不使用预设。 */
  presetPath?: string | null
}






const CONFIG_PATH = resolve("yt-dlp-downloader/config.json")

const BROWSER_COOKIE_ERROR = /(cookie|keyring|decrypt|browser profile|profile path|cookies database)/i

export function isBrowserCookieError(message: string): boolean {
  return BROWSER_COOKIE_ERROR.test(message)
}

export function describeBrowserCookieError(message: string): string {
  return [
    "Chrome Cookie 不可用，可能原因：当前 Chrome 配置文件没有登录该网站、Cookie 不在默认配置文件中，或系统拒绝了 yt-dlp 读取/解密 Cookie。",
    `yt-dlp 原始错误：${message}`,
  ].join(" ")
}

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
function formatArgs(opts: DownloadOptions): string[] {
  switch (opts.format) {
    case "mp3":
      return ["-t", "mp3"]
    case "mp4":
      return ["-t", "mp4"]
    case "subtitle": {
      const sources = new Set(opts.subtitleSources ?? ["original"])
      const languages = [...new Set((opts.subtitleLanguages ?? []).map((language) => language.trim()).filter(Boolean))]
      const args = ["--skip-download"]
      if (sources.has("original")) args.push("--write-subs")
      if (sources.has("generated")) args.push("--write-auto-subs")
      args.push("--sub-format", opts.subtitleFormat ?? "vtt")
      args.push("--sub-langs", languages.join(",") || "all")
      if (opts.useChromeCookies) args.push("--cookies-from-browser", "chrome")
      return args
    }
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

function stripFlags(args: string[], flags: string[]): string[] {
  return args.filter((arg) => !flags.includes(arg))
}

/** Format argv for the console without exposing any browser cookie values. */
export function formatCommand(args: string[]): string {
  return args.map((arg) => /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : JSON.stringify(arg)).join(" ")
}

function parseSubtitleTracks(metadata: unknown): SubtitleTrack[] {
  if (!metadata || typeof metadata !== "object") return []
  const record = metadata as Record<string, unknown>
  const tracks: SubtitleTrack[] = []
  const seen = new Set<string>()

  const append = (value: unknown, source: SubtitleSource) => {
    if (!value || typeof value !== "object") return
    for (const language of Object.keys(value)) {
      const normalized = language.trim()
      if (!normalized) continue
      const key = `${source}:${normalized}`
      if (seen.has(key)) continue
      seen.add(key)
      tracks.push({ language: normalized, source })
    }
  }

  append(record.subtitles, "original")
  append(record.automatic_captions, "generated")
  return tracks.sort((a, b) => a.language.localeCompare(b.language) || a.source.localeCompare(b.source))
}

/** Query the current video's original and generated subtitle language codes. */
export async function fetchAvailableSubtitles(url: string, toolchain: Toolchain): Promise<SubtitleTrack[]> {
  if (!toolchain.ready || !toolchain.ytDlpPath) {
    throw new Error(toolchain.diagnostics.join("；") || "外部工具链未准备完成")
  }

  const args = [
    "--skip-download",
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--cookies-from-browser",
    "chrome",
    url,
  ]
  writeAppConsole("log", `[字幕查询] 执行命令：${formatCommand([toolchain.ytDlpPath, ...args])}`)

  const proc = Bun.spawn([toolchain.ytDlpPath, ...args], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: toolchainEnvironment(toolchain),
  })

  const [exitCode, stdoutBytes, stderrBytes] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).arrayBuffer(),
    new Response(proc.stderr).arrayBuffer(),
  ])
  const stdout = decodeToolText(new Uint8Array(stdoutBytes)).trim()
  const stderr = decodeToolText(new Uint8Array(stderrBytes)).trim()

  if (exitCode !== 0) {
    const message = stderr || `获取字幕列表失败，进程退出码 ${exitCode}`
    throw new Error(isBrowserCookieError(message) ? describeBrowserCookieError(message) : message)
  }

  try {
    return parseSubtitleTracks(JSON.parse(stdout))
  } catch {
    throw new Error("yt-dlp 返回的字幕列表不是有效 JSON")
  }
}

/** 构建传给 yt-dlp 的完整参数列表 */
export function buildArgs(opts: DownloadOptions, titleFile: string, toolchain?: Toolchain): string[] {
  let configArgs = loadConfigArgs()
  const outDir = expandHome(opts.outDir || "~/Downloads")
  // yt-dlp will otherwise target the same title/ext on repeated downloads.
  // Generate the suffix in the app so even two downloads started in one
  // second cannot collide.
  const taskSuffix = randomUUID().replaceAll("-", "").slice(0, 12)
  const outTemplate = `${outDir}/%(title)s [${taskSuffix}].%(ext)s`

  if (opts.format === "mp3") {
    // 移除 config 里的视频预设（-t mp4 → --merge-output-format mp4 --remux-video mp4），
    // 否则 -x 提取出的 mp3 会被 remux 回 mp4。
    configArgs = stripFlagWithValue(configArgs, ["-t", "--preset-alias"])
  }

  if (opts.format === "subtitle") {
    configArgs = stripFlags(configArgs, [
      "--skip-download",
      "--write-subs",
      "--write-auto-subs",
      "--list-subs",
      "--embed-subs",
    ])
    configArgs = stripFlagWithValue(configArgs, ["--sub-langs", "--sub-format"])
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
      ...formatArgs(opts),
      ...(toolchain?.ffmpegPath ? ["--ffmpeg-location", toolchain.ffmpegPath] : []),
      ...(opts.tempDir ? ["--paths", `temp:${opts.tempDir}`] : []),
      ...(opts.presetPath ? ["--config-locations", opts.presetPath] : []),
      "--print",
      "after_move:FILEPATH %(filepath)s",
      // --print implies quiet/simulate in yt-dlp. Explicitly restore the
      // normal download and progress behaviour after the diagnostic print.
      "--no-quiet",
      "--no-simulate",
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

function parseOutputPathLine(line: string): string | null {
  if (!line.startsWith("FILEPATH ")) return null
  const path = normalizeFilePath(line.slice("FILEPATH ".length))
  return path || null
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: true })
// Bun supports this WHATWG decoder label, although the bundled TypeScript
// definitions expose only the narrower standard encoding union.
const gb18030Decoder = new TextDecoder("gb18030" as never)

/** Decode tool output from UTF-8, with a Windows GB18030 fallback. */
function decodeToolText(bytes: Uint8Array): string {
  try {
    return utf8Decoder.decode(bytes)
  } catch {
    return gb18030Decoder.decode(bytes)
  }
}

/** 逐行读取可读流 */
async function readLines(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void
): Promise<void> {
  const reader = stream.getReader()
  let buffer = new Uint8Array(0)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const next = new Uint8Array(buffer.length + value.length)
    next.set(buffer)
    next.set(value, buffer.length)
    buffer = next

    let idx: number
    while ((idx = buffer.indexOf(0x0a)) >= 0) {
      onLine(decodeToolText(buffer.slice(0, idx)).replace(/\r$/, ""))
      buffer = buffer.slice(idx + 1)
    }
  }
  if (buffer.length > 0) onLine(decodeToolText(buffer).replace(/\r$/, ""))
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
    if (isBrowserCookieError(trimmed)) {
      writeAppConsole("error", `[Chrome Cookie] ${describeBrowserCookieError(trimmed)}`)
    }
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

  const taskTempDir = join(tmpdir(), "yt-dlp-downloader", randomUUID())
  mkdirSync(taskTempDir, { recursive: true })
  const titleFile = join(taskTempDir, "title.txt")
  const args = buildArgs({ ...opts, tempDir: taskTempDir }, titleFile, toolchain)
  writeAppConsole("log", `[下载] 执行命令：${formatCommand([toolchain.ytDlpPath, ...args])}`)

  console.log(`▶ 开始下载: ${opts.url}`)

  const proc = Bun.spawn([toolchain.ytDlpPath, ...args], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: toolchainEnvironment(toolchain),
  })

  let titleSet = false
  let outputPath: string | undefined
  let cancelled = false
  let temporaryFilesCleaned = false

  const cleanupTemporaryFiles = async () => {
    if (temporaryFilesCleaned) return
    temporaryFilesCleaned = true
    try {
      await rm(taskTempDir, { recursive: true, force: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      writeAppConsole("warn", `[下载] 清理临时文件失败：${message}`)
    }
  }

  // 标题由 --print-to-file before_dl 写入临时文件，这里惰性读取
  const readTitle = () => {
    if (titleSet) return
    try {
      const t = decodeToolText(readFileSync(titleFile)).trim()
      if (t) {
        titleSet = true
        cb.onTitle(t)
      }
    } catch {
      // 尚未写入
    }
  }

  const handleOutputLine = (line: string) => {
    readTitle()
    const parsedOutputPath = parseOutputPathLine(line)
    if (parsedOutputPath) {
      outputPath = parsedOutputPath
      cb.onOutputPath(parsedOutputPath)
      return
    }

    const progress = parseProgressLine(line)
    if (progress) {
      cb.onProgress(progress)
    } else {
      logToConsole(line)
    }
  }

  // Keep both stream promises. The process can exit before the final stdout
  // chunk has been delivered; waiting for both prevents a completed item from
  // being rendered before its output path is available.
  const stdoutDone = readLines(proc.stdout, handleOutputLine)

  // stderr：WARNING / ERROR 等。也解析 FILEPATH，以兼容不同 yt-dlp 输出配置。
  const stderrDone = readLines(proc.stderr, handleOutputLine)

  // 等待进程结束
  void proc.exited.then(async (code) => {
    await Promise.all([stdoutDone, stderrDone])
    if (cancelled) {
      await cleanupTemporaryFiles()
      return
    }
    readTitle()
    await cleanupTemporaryFiles()
    if (code === 0) {
      console.log("✔ 下载完成")
      cb.onDone({ outputPath })
    } else {
      console.error(`✘ 下载失败，进程退出码 ${code}`)
      cb.onError(`进程退出码 ${code}`)
    }
  }).catch((err) => {
    if (cancelled) return
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`✘ 下载异常: ${msg}`)
    cb.onError(msg)
  })

  return () => {
    if (cancelled) return
    cancelled = true
    try {
      proc.kill()
    } catch {
      /* ignore */
    }
    void proc.exited.then(cleanupTemporaryFiles).catch(cleanupTemporaryFiles)
  }
}
