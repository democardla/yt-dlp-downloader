import {
  BoxRenderable,
  RGBA,
  TextRenderable,
  type CliRenderer,
  type Renderable,
} from "@opentui/core"
import { basename } from "node:path"
import { existsSync } from "node:fs"
import { BorderlessTableRenderable, writeAppConsole } from "../components"
import { loadDownloadHistory, type DownloadHistoryEntry } from "../runtime/DownloadHistory"
import { revealInFileManager } from "../runtime/Toolchain"

export interface DownloadHistoryFeature {
  root: BoxRenderable
  getFocusables(): Renderable[]
  focusFirst(): void
  refresh(): void
}

function formatProcessedAt(value: string): string {
  if (!value) return "未知"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "未知"
  return date.toLocaleString("zh-CN", { hour12: false })
}

function historyCell(
  renderer: CliRenderer,
  content: string,
  reveal: () => void,
  options: { fg?: RGBA; id: string },
): TextRenderable {
  const cell = new TextRenderable(renderer, {
    id: options.id,
    content,
    fg: options.fg,
    wrapMode: "none",
    truncate: true,
    selectable: false,
  })
  cell.onMouseDown = reveal
  return cell
}

/** Top-level view for the ten most recent successful task results. */
export function createDownloadHistoryFeature(
  renderer: CliRenderer,
  entriesLoader: () => DownloadHistoryEntry[] = loadDownloadHistory,
): DownloadHistoryFeature {
  const table = new BorderlessTableRenderable(renderer, {
    id: "download-history-table",
    flexGrow: 1,
    columns: [
      { id: "file-name", title: "文件名", flexGrow: 1, minWidth: 12 },
      { id: "source", title: "来源", width: 14 },
      { id: "status", title: "状态", width: 12 },
      { id: "processed-at", title: "处理时间", width: 22 },
    ],
  })

  const root = new BoxRenderable(renderer, {
    id: "download-history-panel",
    flexGrow: 1,
    height: "100%",
    border: true,
    title: " 历史 ",
    titleAlignment: "center",
    flexDirection: "column",
    padding: 1,
  })
  root.add(table)

  const revealHistoryFile = (filePath: string) => {
    const revealed = revealInFileManager(filePath)
    if (revealed) {
      writeAppConsole("log", `[文件跳转] 已发送文件定位命令：${filePath}`)
    } else {
      writeAppConsole("error", `[文件跳转] 找不到文件或无法打开：${filePath}`)
    }
  }

  const refresh = () => {
    const entries = entriesLoader()
    table.setRows(entries.map((entry: DownloadHistoryEntry, index) => {
      const reveal = () => revealHistoryFile(entry.filePath)
      const available = existsSync(entry.filePath)
      return {
        id: `history-row-${index}`,
        cells: [
          historyCell(renderer, basename(entry.filePath) || entry.filePath, reveal, { id: `history-file-${index}` }),
          historyCell(renderer, entry.source, reveal, { id: `history-source-${index}`, fg: RGBA.fromHex("#A7F3D0") }),
          historyCell(renderer, available ? "可找到" : "找不到", reveal, {
            id: `history-status-${index}`,
            fg: available ? RGBA.fromHex("#86EFAC") : RGBA.fromHex("#EF4444"),
          }),
          historyCell(renderer, formatProcessedAt(entry.processedAt), reveal, { id: `history-time-${index}`, fg: RGBA.fromHex("#9CA3AF") }),
        ],
      }
    }))

    entries.forEach((entry, index) => {
      table.getRow(`history-row-${index}`)!.onMouseDown = () => revealHistoryFile(entry.filePath)
    })
  }

  refresh()

  return {
    root,
    getFocusables: () => [],
    focusFirst: () => {},
    refresh,
  }
}
