import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { normalizeFilePath } from "./Toolchain"

const HISTORY_PATH = resolve("yt-dlp-downloader/download-history.json")
const MAX_HISTORY_ITEMS = 10

function cleanPaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) return []

  const result: string[] = []
  for (const value of paths) {
    if (typeof value !== "string") continue
    const path = normalizeFilePath(value)
    if (path && !result.includes(path)) result.push(path)
    if (result.length >= MAX_HISTORY_ITEMS) break
  }
  return result
}

/** Load the most recent successful download locations. */
export function loadDownloadHistory(): string[] {
  try {
    return cleanPaths(JSON.parse(readFileSync(HISTORY_PATH, "utf8")))
  } catch {
    return []
  }
}

/** Put a successful download at the front and persist the latest ten paths. */
export function rememberDownloadedFile(filePath: string): string[] {
  const normalizedPath = normalizeFilePath(filePath)
  if (!normalizedPath) return loadDownloadHistory()

  const paths = cleanPaths([
    normalizedPath,
    ...loadDownloadHistory(),
  ])

  try {
    mkdirSync(dirname(HISTORY_PATH), { recursive: true })
    writeFileSync(HISTORY_PATH, JSON.stringify(paths, null, 2) + "\n", "utf8")
  } catch {
    // A history write failure must not make an otherwise successful download fail.
  }

  return paths
}
