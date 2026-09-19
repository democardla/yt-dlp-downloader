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
  searchedDirectories: string[]
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

function splitPathValues(values: readonly string[]): string[] {
  return [...new Set(values
    .flatMap((value) => value.split(delimiter))
    .map((directory) => directory.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean))]
}

async function getPathDirectories(): Promise<string[]> {
  const processPath = getEnvironmentValue(["PATH"])

  if (process.platform === "darwin") {
    const shellPath = getEnvironmentValue(["SHELL"]) ?? "/bin/zsh"
    const shellPathValue = await readPathFromShell(shellPath)
    return splitPathValues([
      ...(processPath ? [processPath] : []),
      ...(shellPathValue ? [shellPathValue] : []),
    ])
  }

  if (process.platform !== "win32") {
    return splitPathValues(processPath ? [processPath] : [])
  }

  // Windows processes keep a startup snapshot of PATH. Read the current user
  // and machine values so refresh can see PATH edits made while the app runs.
  try {
    const powershell = Bun.spawn([
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$paths = @([Environment]::GetEnvironmentVariable('Path', 'Machine'), [Environment]::GetEnvironmentVariable('Path', 'User')); $paths | ForEach-Object { if ($_){ [Environment]::ExpandEnvironmentVariables($_) } } | ConvertTo-Json -Compress",
    ], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
    })
    const [exitCode, stdout] = await Promise.all([
      powershell.exited,
      new Response(powershell.stdout).text(),
    ])

    if (exitCode === 0 && stdout.trim()) {
      const values = JSON.parse(stdout.trim()) as string | string[]
      return splitPathValues([
        ...(processPath ? [processPath] : []),
        ...(Array.isArray(values) ? values : [values]),
      ])
    }
  } catch {
    // Fall back to the startup snapshot if the live environment is unavailable.
  }

  return splitPathValues(processPath ? [processPath] : [])
}

async function readPathFromShell(shellPath: string): Promise<string | null> {
  const startMarker = "__YT_DLP_PATH_START__"
  const endMarker = "__YT_DLP_PATH_END__"

  try {
    const shell = Bun.spawn([shellPath, "-lc", `printf '%s%s%s' '${startMarker}' "$PATH" '${endMarker}'`], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
    })
    const [exitCode, stdout] = await Promise.all([
      shell.exited,
      new Response(shell.stdout).text(),
    ])
    if (exitCode !== 0) return null

    const start = stdout.indexOf(startMarker)
    const end = stdout.indexOf(endMarker, start + startMarker.length)
    if (start < 0 || end < 0) return null
    return stdout.slice(start + startMarker.length, end)
  } catch {
    return null
  }
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

function getConfiguredDirectories(): string[] {
  const values = [
    getEnvironmentValue(TOOL_DEFINITIONS.ffmpeg.envKeys),
    getEnvironmentValue(TOOL_DEFINITIONS.ffprobe.envKeys),
    getEnvironmentValue(TOOL_DEFINITIONS.ytDlp.envKeys),
  ].filter((value): value is string => Boolean(value))

  return values.map((value) => {
    const expanded = value.startsWith("~/")
      ? join(process.env.HOME ?? process.env.USERPROFILE ?? "", value.slice(2))
      : value
    const absolute = resolve(expanded)
    return isExecutableFile(absolute) ? dirname(absolute) : absolute
  })
}

async function resolveTool(
  names: readonly string[],
  envKeys: readonly string[],
  pathDirectories: readonly string[],
): Promise<string | null> {
  // Scan the current PATH first on every platform. This prevents a stale
  // explicit path from hiding a newly configured binary in PATH. Windows gets
  // .exe/.cmd/.bat candidates through candidateNames().
  return resolveFromDirectories(names, pathDirectories)
    ?? resolveCandidate(getEnvironmentValue(envKeys), names)
}

/** Resolve all external binaries before the UI and download processes start. */
export async function resolveToolchain(): Promise<Toolchain> {
  const platform = process.platform
  const operatingSystem = getOperatingSystem(platform)
  const pathDirectories = await getPathDirectories()
  const [ffmpegPath, ffprobePath, ytDlpPath] = await Promise.all([
    resolveTool(TOOL_DEFINITIONS.ffmpeg.names, TOOL_DEFINITIONS.ffmpeg.envKeys, pathDirectories),
    resolveTool(TOOL_DEFINITIONS.ffprobe.names, TOOL_DEFINITIONS.ffprobe.envKeys, pathDirectories),
    resolveTool(TOOL_DEFINITIONS.ytDlp.names, TOOL_DEFINITIONS.ytDlp.envKeys, pathDirectories),
  ])
  const diagnostics: string[] = []

  const lookupHint = "请确认它已安装、位于 PATH 中，或通过对应环境变量指定路径"
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
    searchedDirectories: [...new Set([...getConfiguredDirectories(), ...pathDirectories])],
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
  if (!isExecutableFile(absolutePath)) return false

  try {
    if (process.platform === "darwin") {
      Bun.spawn(["open", "-R", absolutePath], { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
    } else if (process.platform === "win32") {
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
