import { accessSync, constants, statSync } from "node:fs"
import { delimiter, dirname, join, resolve } from "node:path"

export type HostOperatingSystem = "windows" | "macos" | "linux" | "freebsd" | "other"

export interface Toolchain {
  platform: NodeJS.Platform
  operatingSystem: HostOperatingSystem
  ffmpegPath: string | null
  ffprobePath: string | null
  ytDlpPath: string | null
  ready: boolean
  diagnostics: string[]
}

export function getDefaultDownloadDirectory(platform: NodeJS.Platform = process.platform): string {
  const home = platform === "win32"
    ? process.env.USERPROFILE ?? [process.env.HOMEDRIVE, process.env.HOMEPATH].filter(Boolean).join("\\")
    : process.env.HOME
  return home ? join(home, "Downloads") : "Downloads"
}

const TOOL_DEFINITIONS = {
  ffmpeg: {
    names: ["ffmpeg"],
    envKeys: ["FFMPEG_PATH", "FFMPEG_BINARY", "FFMPEG_BIN", "FFMPEG"],
  },
  ffprobe: {
    names: ["ffprobe"],
    envKeys: ["FFPROBE_PATH", "FFPROBE_BINARY", "FFPROBE_BIN", "FFPROBE"],
  },
  ytDlp: {
    names: ["yt-dlp", "ytdlp"],
    envKeys: ["YTDLP_PATH", "YTDLP_BINARY", "YTDLP_BIN", "YTDLP", "YT_DLP"],
  },
} as const

function getOperatingSystem(platform: NodeJS.Platform): HostOperatingSystem {
  if (platform === "win32") return "windows"
  if (platform === "darwin") return "macos"
  if (platform === "linux") return "linux"
  if (platform === "freebsd") return "freebsd"
  return "other"
}

function getEnvironmentValue(keys: readonly string[]): string | null {
  const environment = process.env
  for (const key of keys) {
    const actualKey = Object.keys(environment).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    )
    const value = actualKey ? environment[actualKey] : undefined
    if (value?.trim()) return value.trim().replace(/^['"]|['"]$/g, "")
  }
  return null
}

function isExecutableFile(filePath: string): boolean {
  try {
    if (!statSync(filePath).isFile()) return false
    // Windows does not use Unix execute bits. The extension is checked by the
    // PATH candidate builder below, while existence is sufficient here.
    if (process.platform === "win32") return true
    accessSync(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function candidateNames(names: readonly string[]): string[] {
  if (process.platform !== "win32") return [...names]
  const extensions = [".exe", ".cmd", ".bat", ""]
  return names.flatMap((name) => extensions.map((extension) => `${name}${extension}`))
}

function resolveCandidate(value: string | null, names: readonly string[]): string | null {
  if (!value) return null
  const expanded = value.startsWith("~/")
    ? join(process.env.HOME ?? process.env.USERPROFILE ?? "", value.slice(2))
    : value
  const absolute = resolve(expanded)
  if (isExecutableFile(absolute)) return absolute

  // An environment variable may point to the containing directory instead of
  // the binary itself.
  for (const name of candidateNames(names)) {
    const path = join(absolute, name)
    if (isExecutableFile(path)) return path
  }
  return null
}

function resolveFromPath(names: readonly string[]): string | null {
  const pathValue = getEnvironmentValue(["PATH"])
  if (!pathValue) return null

  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue
    for (const name of candidateNames(names)) {
      const candidate = resolve(directory.trim().replace(/^['"]|['"]$/g, ""), name)
      if (isExecutableFile(candidate)) return candidate
    }
  }
  return null
}

function resolveTool(names: readonly string[], envKeys: readonly string[]): string | null {
  return resolveCandidate(getEnvironmentValue(envKeys), names) ?? resolveFromPath(names)
}

/** Resolve all external binaries before the UI and download processes start. */
export function resolveToolchain(): Toolchain {
  const platform = process.platform
  const operatingSystem = getOperatingSystem(platform)
  const ffmpegPath = resolveTool(TOOL_DEFINITIONS.ffmpeg.names, TOOL_DEFINITIONS.ffmpeg.envKeys)
  const ffprobePath = resolveTool(TOOL_DEFINITIONS.ffprobe.names, TOOL_DEFINITIONS.ffprobe.envKeys)
  const ytDlpPath = resolveTool(TOOL_DEFINITIONS.ytDlp.names, TOOL_DEFINITIONS.ytDlp.envKeys)
  const diagnostics: string[] = []

  if (!ffmpegPath) diagnostics.push("未找到 ffmpeg，请设置 FFMPEG_PATH 或将其加入 PATH")
  if (!ffprobePath) diagnostics.push("未找到 ffprobe，请设置 FFPROBE_PATH 或将其加入 PATH")
  if (!ytDlpPath) diagnostics.push("未找到 yt-dlp，请设置 YTDLP_PATH 或将其加入 PATH")

  return {
    platform,
    operatingSystem,
    ffmpegPath,
    ffprobePath,
    ytDlpPath,
    ready: diagnostics.length === 0,
    diagnostics,
  }
}

/** Build a child-process environment where both media tools are discoverable. */
export function toolchainEnvironment(toolchain: Toolchain): Record<string, string> {
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH"
  const currentPath = process.env[pathKey] ?? ""
  const directories = [toolchain.ffmpegPath, toolchain.ffprobePath]
    .filter((path): path is string => Boolean(path))
    .map((path) => path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))))
    .filter(Boolean)
  const uniqueDirectories = [...new Set(directories)]
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) environment[key] = value
  }
  environment[pathKey] = [...uniqueDirectories, currentPath].filter(Boolean).join(delimiter)
  return environment
}

/** Reveal a completed file in the host operating system's file manager. */
export function revealInFileManager(filePath: string): void {
  const absolutePath = resolve(filePath)
  try {
    if (process.platform === "darwin") {
      Bun.spawn(["open", "-R", absolutePath], { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
    } else if (process.platform === "win32") {
      Bun.spawn(["explorer.exe", `/select,${absolutePath}`], { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
    } else {
      Bun.spawn(["xdg-open", dirname(absolutePath)], { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
    }
  } catch {
    // A missing file manager should not crash the TUI.
  }
}
