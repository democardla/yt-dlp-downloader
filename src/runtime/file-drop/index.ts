import { parseMacDroppedFilePaths } from "./macos"
import { parseWindowsDroppedFilePaths } from "./windows"

export { parseMacDroppedFilePath, parseMacDroppedFilePaths } from "./macos"
export { parseWindowsDroppedFilePath, parseWindowsDroppedFilePaths } from "./windows"

export function parseDroppedFilePaths(
  value: string,
  platform: NodeJS.Platform = process.platform,
): string[] {
  if (platform === "win32") return parseWindowsDroppedFilePaths(value)
  return parseMacDroppedFilePaths(value)
}

export function parseDroppedFilePath(
  value: string,
  platform: NodeJS.Platform = process.platform,
): string | null {
  return parseDroppedFilePaths(value, platform)[0] ?? null
}
