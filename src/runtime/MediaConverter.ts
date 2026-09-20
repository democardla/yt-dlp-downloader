import { mkdirSync, statSync } from "node:fs"
import { rename, rm } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { basename, extname, join, resolve } from "node:path"
import { writeAppConsole } from "../components"
import { normalizeFilePath, toolchainEnvironment, type Toolchain } from "./Toolchain"

export type ConversionKind = "video-to-audio" | "video-to-video" | "audio-to-audio"
export type VideoOutputFormat = "mp4" | "mkv" | "webm" | "mov"
export type AudioOutputFormat = "mp3" | "m4a" | "flac" | "wav" | "opus" | "ogg"
export type ConversionOutputFormat = VideoOutputFormat | AudioOutputFormat

export interface MediaConversionOptions {
  kind: ConversionKind
  inputPath: string
  outputDirectory: string
  outputFormat: ConversionOutputFormat
}

export interface MediaConversionCallbacks {
  onProgress: (percent: number) => void
  onDone: (outputPath: string) => void
  onError: (message: string) => void
}

interface MediaProbe {
  duration: number
  hasVideo: boolean
  hasAudio: boolean
}

function expandHome(path: string): string {
  if (path === "~") return process.env.HOME ?? process.env.USERPROFILE ?? path
  if (path.startsWith("~/")) return join(process.env.HOME ?? process.env.USERPROFILE ?? "", path.slice(2))
  return path
}

function isFile(path: string): boolean {
  try { return statSync(path).isFile() } catch { return false }
}

export function conversionCodecArgs(kind: ConversionKind, format: ConversionOutputFormat): string[] {
  if (kind === "video-to-video") {
    if (format === "webm") return ["-map", "0:v:0", "-map", "0:a?", "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-c:a", "libopus", "-b:a", "128k"]
    const common = ["-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-c:a", "aac", "-b:a", "192k"]
    return format === "mp4" ? [...common, "-movflags", "+faststart"] : common
  }

  const audio: Record<AudioOutputFormat, string[]> = {
    mp3: ["-vn", "-map", "0:a:0", "-c:a", "libmp3lame", "-q:a", "2"],
    m4a: ["-vn", "-map", "0:a:0", "-c:a", "aac", "-b:a", "192k"],
    flac: ["-vn", "-map", "0:a:0", "-c:a", "flac"],
    wav: ["-vn", "-map", "0:a:0", "-c:a", "pcm_s16le"],
    opus: ["-vn", "-map", "0:a:0", "-c:a", "libopus", "-b:a", "128k"],
    ogg: ["-vn", "-map", "0:a:0", "-c:a", "libvorbis", "-q:a", "5"],
  }
  return audio[format as AudioOutputFormat] ?? audio.mp3
}

async function probeMedia(inputPath: string, toolchain: Toolchain): Promise<MediaProbe> {
  if (!toolchain.ffprobePath) throw new Error("未找到 ffprobe")
  const proc = Bun.spawn([
    toolchain.ffprobePath,
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,duration",
    "-of", "json",
    inputPath,
  ], { stdin: "ignore", stdout: "pipe", stderr: "pipe", env: toolchainEnvironment(toolchain) })
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  if (code !== 0) throw new Error(stderr.trim() || `ffprobe 退出码 ${code}`)
  const data = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string; duration?: string }> }
  const streams = data.streams ?? []
  const duration = Number(data.format?.duration) || Math.max(0, ...streams.map((stream) => Number(stream.duration) || 0))
  if (!(duration > 0)) throw new Error("无法读取媒体时长")
  return {
    duration,
    hasVideo: streams.some((stream) => stream.codec_type === "video"),
    hasAudio: streams.some((stream) => stream.codec_type === "audio"),
  }
}

async function readLines(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""
    for (const line of lines) onLine(line)
  }
  buffer += decoder.decode()
  if (buffer) onLine(buffer)
}

function formatCommand(args: string[]): string {
  return args.map((arg) => /^[A-Za-z0-9_@%+=:,./\\-]+$/.test(arg) ? arg : JSON.stringify(arg)).join(" ")
}

/** Start one FFmpeg conversion and return a cancellation function immediately. */
export function startMediaConversion(
  options: MediaConversionOptions,
  callbacks: MediaConversionCallbacks,
  toolchain: Toolchain,
): () => void {
  let process: { kill(): void } | null = null
  let cancelled = false
  let partialPath: string | null = null

  const cleanup = async () => {
    if (partialPath) await rm(partialPath, { force: true }).catch(() => {})
  }

  void (async () => {
    if (!toolchain.ffmpegPath || !toolchain.ffprobePath) throw new Error("FFmpeg/FFprobe 工具链未准备完成")
    const inputPath = normalizeFilePath(options.inputPath)
    if (!isFile(inputPath)) throw new Error(`输入文件不存在：${inputPath}`)
    const probe = await probeMedia(inputPath, toolchain)
    if (options.kind !== "audio-to-audio" && !probe.hasVideo) throw new Error("输入文件不包含视频流")
    if (options.kind !== "video-to-video" && !probe.hasAudio) throw new Error("输入文件不包含音频流")
    if (cancelled) return

    const outputDirectory = resolve(expandHome(options.outputDirectory))
    mkdirSync(outputDirectory, { recursive: true })
    const stem = basename(inputPath, extname(inputPath))
    const suffix = randomUUID().replaceAll("-", "").slice(0, 8)
    const finalPath = join(outputDirectory, `${stem} [${suffix}].${options.outputFormat}`)
    partialPath = join(outputDirectory, `${stem} [${suffix}].partial.${options.outputFormat}`)
    const args = [
      "-hide_banner", "-nostdin", "-y", "-i", inputPath,
      ...conversionCodecArgs(options.kind, options.outputFormat),
      "-progress", "pipe:1", "-nostats", partialPath,
    ]
    writeAppConsole("log", `[格式转换] 执行命令：${formatCommand([toolchain.ffmpegPath, ...args])}`)
    const spawned = Bun.spawn([toolchain.ffmpegPath, ...args], {
      stdin: "ignore", stdout: "pipe", stderr: "pipe", env: toolchainEnvironment(toolchain),
    })
    process = spawned

    let stderrTail = ""
    const stdoutDone = readLines(spawned.stdout, (line) => {
      const match = line.match(/^out_time_us=(\d+)$/)
      if (match) callbacks.onProgress(Math.min(100, Number(match[1]) / (probe.duration * 10_000)))
    })
    const stderrDone = readLines(spawned.stderr, (line) => {
      if (!line.trim()) return
      stderrTail = `${stderrTail}\n${line}`.slice(-4000)
    })
    const code = await spawned.exited
    await Promise.all([stdoutDone, stderrDone])
    if (cancelled) { await cleanup(); return }
    if (code !== 0) throw new Error(stderrTail.trim() || `ffmpeg 退出码 ${code}`)
    if (!partialPath || !isFile(partialPath)) throw new Error("转换结束但没有生成结果文件")
    await rename(partialPath, finalPath)
    partialPath = null
    callbacks.onProgress(100)
    callbacks.onDone(finalPath)
  })().catch(async (error) => {
    await cleanup()
    if (!cancelled) callbacks.onError(error instanceof Error ? error.message : String(error))
  })

  return () => {
    if (cancelled) return
    cancelled = true
    try { process?.kill() } catch { /* ignore */ }
    void cleanup()
  }
}
