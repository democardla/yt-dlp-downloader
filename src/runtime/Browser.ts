import { accessSync, constants, statSync } from "node:fs"
import { delimiter, join, resolve } from "node:path"

export interface BrowserDetection {
  chromePath: string | null
  available: boolean
}

function isExecutableFile(filePath: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(filePath).isFile()) return false
    if (platform === "win32") return true
    accessSync(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function firstExisting(paths: string[], platform: NodeJS.Platform): string | null {
  for (const filePath of paths) {
    if (isExecutableFile(filePath, platform)) return filePath
  }
  return null
}

/** Check the standard Google Chrome application locations on macOS. */
export function detectChromeOnMacOS(environment: NodeJS.ProcessEnv = process.env): string | null {
  const home = environment.HOME ?? ""
  return firstExisting([
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    join(home, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
  ], "darwin")
}

/** Check Chrome using Windows environment variables and standard install roots. */
export function detectChromeOnWindows(environment: NodeJS.ProcessEnv = process.env): string | null {
  const localAppData = environment.LOCALAPPDATA ?? ""
  const programFiles = environment.PROGRAMFILES ?? ""
  const programFilesX86 = environment["PROGRAMFILES(X86)"] ?? ""
  return firstExisting([
    join(localAppData, "Google/Chrome/Application/chrome.exe"),
    join(programFiles, "Google/Chrome/Application/chrome.exe"),
    join(programFilesX86, "Google/Chrome/Application/chrome.exe"),
  ], "win32")
}

/** Check Chrome/Chrome Stable from PATH on Linux and other Unix systems. */
export function detectChromeOnLinux(environment: NodeJS.ProcessEnv = process.env): string | null {
  const pathValue = environment.PATH ?? ""
  const names = ["google-chrome", "google-chrome-stable", "chrome"]
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    const found = firstExisting(names.map((name) => resolve(directory, name)), "linux")
    if (found) return found
  }
  return null
}

export function detectChrome(
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env,
): BrowserDetection {
  const chromePath = platform === "darwin"
    ? detectChromeOnMacOS(environment)
    : platform === "win32"
      ? detectChromeOnWindows(environment)
      : detectChromeOnLinux(environment)

  return { chromePath, available: chromePath !== null }
}
