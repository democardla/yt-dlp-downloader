import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { normalizeFilePath } from "./Toolchain"

const HISTORY_PATH = resolve("yt-dlp-downloader/download-history.json")
const MAX_HISTORY_ITEMS = 10
const LEGACY_SOURCE = "下载器"

export interface DownloadHistoryEntry {
  filePath: string
  source: string
  processedAt: string
}

function normalizeEntry(value: unknown): DownloadHistoryEntry | null {
  if (typeof value === "string") {
    const filePath = normalizeFilePath(value)
    return filePath ? { filePath, source: LEGACY_SOURCE, processedAt: "" } : null
  }

  if (!value || typeof value !== "object") return null
  const item = value as Record<string, unknown>
  const rawPath = typeof item.filePath === "string"
    ? item.filePath
    : typeof item.path === "string"
      ? item.path
      : null
  if (!rawPath) return null
  const filePath = normalizeFilePath(rawPath)
  if (!filePath) return null

  return {
    filePath,
    source: typeof item.source === "string" && item.source.trim() ? item.source : LEGACY_SOURCE,
    processedAt: typeof item.processedAt === "string" ? item.processedAt : "",
  }
}

/** Normalize both the current object format and the old string-path format. */
export function normalizeDownloadHistoryEntries(values: unknown): DownloadHistoryEntry[] {
  if (!Array.isArray(values)) return []

  const result: DownloadHistoryEntry[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const entry = normalizeEntry(value)
    if (!entry || seen.has(entry.filePath)) continue
    seen.add(entry.filePath)
    result.push(entry)
    if (result.length >= MAX_HISTORY_ITEMS) break
  }
  return result
}

/** Load the most recent successful task results. */
export function loadDownloadHistory(): DownloadHistoryEntry[] {
  try {
    return normalizeDownloadHistoryEntries(JSON.parse(readFileSync(HISTORY_PATH, "utf8")))
  } catch {
    return []
  }
}

/** Put a successful result at the front and persist the latest ten entries. */
export function rememberDownloadedFile(
  filePath: string,
  source = LEGACY_SOURCE,
  processedAt = new Date().toISOString(),
): DownloadHistoryEntry[] {
  const normalizedPath = normalizeFilePath(filePath)
  if (!normalizedPath) return loadDownloadHistory()

  const entry: DownloadHistoryEntry = {
    filePath: normalizedPath,
    source: source.trim() || LEGACY_SOURCE,
    processedAt,
  }
  const entries = normalizeDownloadHistoryEntries([entry, ...loadDownloadHistory()])

  try {
    mkdirSync(dirname(HISTORY_PATH), { recursive: true })
    writeFileSync(HISTORY_PATH, JSON.stringify(entries, null, 2) + "\n", "utf8")
  } catch {
    // A history write failure must not make an otherwise successful task fail.
  }

  return entries
}
