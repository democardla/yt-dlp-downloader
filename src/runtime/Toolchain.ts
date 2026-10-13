import { accessSync, constants, statSync } from "node:fs"
import { delimiter, dirname, join, resolve } from "node:path"
import { getAppPaths, getDefaultDownloadDirectory, type AppPaths } from "./AppPaths"

export { getDefaultDownloadDirectory } from "./AppPaths"

export type HostOperatingSystem = "windows" | "macos" | "linux" | "freebsd" | "other"

export interface Toolchain {
  platform: NodeJS.Platform
  operatingSystem: HostOperatingSystem
  ffmpegPath: string | null
  ffprobePath: string | null
  ytDlpPath: string | null
  ready: boolean
  diagnostics: string[]
  searchedDirectories: string[]
}

const TOOL_DEFINITIONS = {
  ffmpeg: { names: ["ffmpeg"] },
  ffprobe: { names: ["ffprobe"] },
  ytDlp: { names: ["yt-dlp"] },
} as const

function getOperatingSystem(platform: NodeJS.Platform): HostOperatingSystem {
  if (platform === "win32") return "windows"
  if (platform === "darwin") return "macos"
  if (platform === "linux") return "linux"
  if (platform === "freebsd") return "freebsd"
  return "other"
}

function isExecutableFile(filePath: string): boolean {
  try {
    if (!statSync(filePath).isFile()) return false
    // Windows does not use Unix execute bits. The bundled-bin candidate
    // builder checks the extension, while existence is sufficient here.
    if (process.platform === "win32") return true
    accessSync(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function isRegularFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

function candidateNames(names: readonly string[]): string[] {
  if (process.platform !== "win32") return [...names]
  const extensions = [".exe", ".cmd", ".bat", ""]
  return names.flatMap((name) => extensions.map((extension) => `${name}${extension}`))
}

function resolveFromDirectories(names: readonly string[], directories: readonly string[]): string | null {

  for (const directory of directories) {
    for (const name of candidateNames(names)) {
      const candidate = resolve(directory, name)
      if (isExecutableFile(candidate)) return candidate
    }
  }
  return null
}

/** Normalize a path emitted by yt-dlp before it is shown or opened. */
export function normalizeFilePath(filePath: string): string {
  let value = filePath.trim().replaceAll("\u0000", "")
  if (!value) return ""

  // Some wrappers quote paths containing spaces. yt-dlp normally does not,
  // but accepting both forms keeps the file-jump action platform-independent.
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      value = value.slice(1, -1).trim()
    }
  }
  if (!value) return ""

  // Be tolerant if a future output format returns a file URI instead of a
  // native path. The current yt-dlp format emits native paths.
  if (/^file:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      value = decodeURIComponent(url.pathname)
      if (process.platform === "win32" && /^\/[A-Za-z]:/.test(value)) {
        value = value.slice(1)
      }
    } catch {
      // Keep the original value if it is not a valid file URI.
    }
  }

  // Explorer does not reliably accept the Win32 extended-length prefix for
  // selection. yt-dlp normally emits a regular path, but remove the prefix if
  // it is supplied by a wrapper or a custom output template.
  if (process.platform === "win32" && value.startsWith("\\\\?\\")) {
    value = value.slice(4)
  }

  return resolve(value)
}

/** Resolve all external binaries before the UI and download processes start. */
export async function resolveToolchain(appPaths: AppPaths = getAppPaths()): Promise<Toolchain> {
  const platform = process.platform
  const operatingSystem = getOperatingSystem(platform)
  const bundledDirectories = [appPaths.binDir]
  const ffmpegPath = resolveFromDirectories(TOOL_DEFINITIONS.ffmpeg.names, bundledDirectories)
  const ffprobePath = resolveFromDirectories(TOOL_DEFINITIONS.ffprobe.names, bundledDirectories)
  const ytDlpPath = resolveFromDirectories(TOOL_DEFINITIONS.ytDlp.names, bundledDirectories)
  const diagnostics: string[] = []

  const lookupHint = `请确认应用 bin 目录完整：${appPaths.binDir}`
  if (!ffmpegPath) diagnostics.push(`未找到 ffmpeg，${lookupHint}`)
  if (!ffprobePath) diagnostics.push(`未找到 ffprobe，${lookupHint}`)
  if (!ytDlpPath) diagnostics.push(`未找到 yt-dlp，${lookupHint}`)

  return {
    platform,
    operatingSystem,
    ffmpegPath,
    ffprobePath,
    ytDlpPath,
    ready: diagnostics.length === 0,
    diagnostics,
    searchedDirectories: bundledDirectories,
  }
}

/** Build a child-process environment where both media tools are discoverable. */
export function toolchainEnvironment(toolchain: Toolchain): Record<string, string> {
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH"
  const currentPath = process.env[pathKey] ?? ""
  const directories = [toolchain.ffmpegPath, toolchain.ffprobePath, toolchain.ytDlpPath]
    .filter((path): path is string => Boolean(path))
    .map((path) => path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))))
    .filter(Boolean)
  const uniqueDirectories = [...new Set(directories)]
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) environment[key] = value
  }
  environment[pathKey] = [...uniqueDirectories, currentPath].filter(Boolean).join(delimiter)
  // Keep yt-dlp's Python output deterministic when it is launched through a
  // Windows pipe. decodeToolText still accepts GB18030 for older builds that
  // ignore these variables.
  environment.PYTHONUTF8 = "1"
  environment.PYTHONIOENCODING = "utf-8"
  return environment
}

/** Reveal a completed file in the host operating system's file manager. */
export function revealInFileManager(filePath: string): boolean {
  const absolutePath = normalizeFilePath(filePath)

  // macOS media files are regular files, not executable files. Keep this
  // branch separate because Finder has its own native reveal command and the
  // Unix execute-bit check used by tool binaries is not appropriate here.
  if (process.platform === "darwin") {
    if (!isRegularFile(absolutePath)) return false

    try {
      Bun.spawn(["/usr/bin/open", "-R", absolutePath], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      })
      return true
    } catch {
      // Finder/open should not be allowed to crash the TUI.
      return false
    }
  }

  if (!isExecutableFile(absolutePath)) return false

  try {
    if (process.platform === "win32") {
      // Pass the selector directly to Explorer. Verbatim arguments prevent
      // Bun from adding another layer of Windows slash/quote escaping, so the
      // command line remains /select,"C:\\directory\\file".
      const windowsDirectory = process.env.WINDIR ?? process.env.SystemRoot ?? "C:\\Windows"
      const explorerPath = join(windowsDirectory, "explorer.exe")
      const selector = `/select,"${absolutePath}"`
      Bun.spawn([explorerPath, selector], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
        windowsVerbatimArguments: true,
      })
    } else {
      Bun.spawn(["xdg-open", dirname(absolutePath)], { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
    }
    return true
  } catch {
    // A missing file manager should not crash the TUI.
    return false
  }
}
