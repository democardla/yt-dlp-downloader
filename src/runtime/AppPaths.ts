import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"

export const APP_ID = "yt-dlp-downloader"
export const APP_DISPLAY_NAME = "YT-DLP Downloader"

export type RuntimeTarget =
  | "win32-x64"
  | "win32-arm64"
  | "darwin-x64"
  | "darwin-arm64"
  | "linux-x64"
  | "linux-arm64"
  | `${NodeJS.Platform}-${string}`

export interface AppPaths {
  mode: "development" | "packaged"
  target: RuntimeTarget
  executableDir: string
  resourcesDir: string
  binDir: string
  configDir: string
  dataDir: string
  presetDir: string
  configFile: string
  historyFile: string
  legacyDir: string
  defaultDownloadDir: string
}

export interface ResolveAppPathsOptions {
  platform?: NodeJS.Platform
  arch?: string
  environment?: NodeJS.ProcessEnv
  workingDirectory?: string
  executablePath?: string
  sourceRoot?: string
  packaged?: boolean
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function cleanEnvironmentPath(value: string | undefined): string | null {
  const cleaned = value?.trim().replace(/^['"]|['"]$/g, "")
  return cleaned ? resolve(cleaned) : null
}

function userHome(platform: NodeJS.Platform, environment: NodeJS.ProcessEnv): string {
  if (platform === "win32") {
    const driveHome = [environment.HOMEDRIVE, environment.HOMEPATH].filter(Boolean).join("\\")
    return environment.USERPROFILE ?? (driveHome || homedir())
  }
  return environment.HOME ?? homedir()
}

export function getDefaultDownloadDirectory(
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const home = userHome(platform, environment)
  return home ? join(home, "Downloads") : "Downloads"
}

export function getRuntimeTarget(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): RuntimeTarget {
  return `${platform}-${arch}` as RuntimeTarget
}

function isPackagedExecutable(executablePath: string, environment: NodeJS.ProcessEnv): boolean {
  if (environment.YTDLP_DOWNLOADER_PACKAGED === "1") return true
  if (environment.YTDLP_DOWNLOADER_PACKAGED === "0") return false
  return !/^bun(?:\.exe)?$/i.test(basename(executablePath))
}

function standardDirectories(
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv,
): { configDir: string; dataDir: string } {
  const home = userHome(platform, environment)
  if (platform === "win32") {
    const base = environment.APPDATA ?? join(home, "AppData", "Roaming")
    const directory = join(base, APP_DISPLAY_NAME)
    return { configDir: directory, dataDir: directory }
  }
  if (platform === "darwin") {
    const directory = join(home, "Library", "Application Support", APP_DISPLAY_NAME)
    return { configDir: directory, dataDir: directory }
  }

  return {
    configDir: join(environment.XDG_CONFIG_HOME ?? join(home, ".config"), APP_ID),
    dataDir: join(environment.XDG_DATA_HOME ?? join(home, ".local", "share"), APP_ID),
  }
}

function defaultResourcesDirectory(
  platform: NodeJS.Platform,
  executableDir: string,
  sourceRoot: string,
  packaged: boolean,
): string {
  if (!packaged) return sourceRoot
  if (platform === "darwin" && basename(executableDir) === "MacOS") {
    return resolve(executableDir, "..", "Resources")
  }
  return executableDir
}

function selectBinDirectory(resourcesDir: string, target: RuntimeTarget, packaged: boolean): string {
  const flat = join(resourcesDir, "bin")
  const targetSpecific = join(flat, target)
  const candidates = packaged ? [flat, targetSpecific] : [targetSpecific, flat]
  return candidates.find(isDirectory) ?? candidates[0]!
}

/** Resolve writable user data and read-only application resource paths. */
export function resolveAppPaths(options: ResolveAppPathsOptions = {}): AppPaths {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const environment = options.environment ?? process.env
  const workingDirectory = resolve(options.workingDirectory ?? process.cwd())
  const executablePath = resolve(options.executablePath ?? process.execPath)
  const executableDir = dirname(executablePath)
  const sourceRoot = resolve(options.sourceRoot ?? resolve(import.meta.dir, "..", ".."))
  const packaged = options.packaged ?? isPackagedExecutable(executablePath, environment)
  const mode = packaged ? "packaged" : "development"
  const target = getRuntimeTarget(platform, arch)
  const resourcesDir = cleanEnvironmentPath(environment.YTDLP_DOWNLOADER_RESOURCES)
    ?? defaultResourcesDirectory(platform, executableDir, sourceRoot, packaged)

  const portable = environment.YTDLP_DOWNLOADER_PORTABLE === "1"
  const standard = standardDirectories(platform, environment)
  const developmentDirectory = join(workingDirectory, APP_ID)
  const portableDirectory = join(executableDir, "user-data")
  const configDir = cleanEnvironmentPath(environment.YTDLP_DOWNLOADER_CONFIG_DIR)
    ?? (packaged ? (portable ? portableDirectory : standard.configDir) : developmentDirectory)
  const dataDir = cleanEnvironmentPath(environment.YTDLP_DOWNLOADER_DATA_DIR)
    ?? (packaged ? (portable ? portableDirectory : standard.dataDir) : developmentDirectory)
  const binDir = cleanEnvironmentPath(environment.YTDLP_DOWNLOADER_BIN)
    ?? selectBinDirectory(resourcesDir, target, packaged)

  return {
    mode,
    target,
    executableDir,
    resourcesDir,
    binDir,
    configDir,
    dataDir,
    presetDir: configDir,
    configFile: join(configDir, "config.json"),
    historyFile: join(dataDir, "download-history.json"),
    legacyDir: developmentDirectory,
    defaultDownloadDir: getDefaultDownloadDirectory(platform, environment),
  }
}

let cachedPaths: AppPaths | null = null

export function getAppPaths(): AppPaths {
  cachedPaths ??= resolveAppPaths()
  return cachedPaths
}

/** Used by focused tests and future embedded launchers before bootstrap starts. */
export function setAppPaths(paths: AppPaths | null): void {
  cachedPaths = paths
}

function copyIfMissing(source: string, destination: string, actions: string[]): void {
  if (!existsSync(source) || existsSync(destination)) return
  copyFileSync(source, destination)
  actions.push(`${source} -> ${destination}`)
}

/** Create writable directories and migrate data from the former cwd layout. */
export function initializeAppPaths(paths: AppPaths = getAppPaths()): string[] {
  mkdirSync(paths.configDir, { recursive: true })
  mkdirSync(paths.dataDir, { recursive: true })
  mkdirSync(paths.presetDir, { recursive: true })

  const actions: string[] = []
  if (resolve(paths.legacyDir) === resolve(paths.configDir)
    && resolve(paths.legacyDir) === resolve(paths.dataDir)) {
    return actions
  }

  copyIfMissing(join(paths.legacyDir, "config.json"), paths.configFile, actions)
  copyIfMissing(join(paths.legacyDir, "download-history.json"), paths.historyFile, actions)

  try {
    for (const entry of readdirSync(paths.legacyDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".pre")) continue
      copyIfMissing(join(paths.legacyDir, entry.name), join(paths.presetDir, entry.name), actions)
    }
  } catch {
    // The legacy directory is optional on fresh installations.
  }
  return actions
}
