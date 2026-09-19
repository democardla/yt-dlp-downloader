import {
  ASCIIFontRenderable,
  BoxRenderable,
  RGBA,
  ScrollBoxRenderable,
  TextRenderable,
  type CliRenderer,
  type Renderable,
} from "@opentui/core"
import { basename } from "node:path"
import { writeAppConsole } from "./components"
import { loadDownloadHistory } from "./runtime/DownloadHistory"
import { revealInFileManager } from "./runtime/Toolchain"

export interface DownloadHistoryFeature {
  root: BoxRenderable
  getFocusables(): Renderable[]
  focusFirst(): void
  refresh(): void
}

/** Top-level view for the ten most recent successful download locations. */
export function createDownloadHistoryFeature(renderer: CliRenderer): DownloadHistoryFeature {
  const listScroll = new ScrollBoxRenderable(renderer, {
    flexGrow: 1,
    scrollY: true,
    scrollX: false,
    scrollbarOptions: { showArrows: false },
  })

  const root = new BoxRenderable(renderer, {
    id: "download-history-panel",
    flexGrow: 1,
    height: "100%",
    border: true,
    title: " 下载历史（最近 10 条） ",
    titleAlignment: "center",
    flexDirection: "column",
    padding: 1,
  })
  root.add(listScroll)

  const revealHistoryFile = (filePath: string) => {
    const revealed = revealInFileManager(filePath)
    if (revealed) {
      writeAppConsole("log", `[文件跳转] 已发送文件定位命令：${filePath}`)
    } else {
      writeAppConsole("error", `[文件跳转] 找不到文件或无法打开：${filePath}`)
    }
  }

  const refresh = () => {
    const historyPaths = loadDownloadHistory()
    for (const child of listScroll.getChildren()) listScroll.remove(child.id)

    if (historyPaths.length === 0) {
      const emptyState = new BoxRenderable(renderer, {
        id: "history-empty-state",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      })
      emptyState.add(new ASCIIFontRenderable(renderer, {
        text: "HIST",
        font: "tiny",
        color: RGBA.fromHex("#FFFFFF"),
        selectable: false,
      }))
      listScroll.add(emptyState)
      return
    }

    historyPaths.forEach((filePath, index) => {
      const row = new BoxRenderable(renderer, {
        id: `history-row-${index}`,
        width: "100%",
        height: 2,
        flexDirection: "column",
      })
      const title = new TextRenderable(renderer, {
        content: `✓ ${basename(filePath) || filePath}`,
        wrapMode: "none",
        truncate: true,
        selectable: false,
      })
      const location = new TextRenderable(renderer, {
        content: `  ${filePath}`,
        fg: RGBA.fromHex("#9CA3AF"),
        wrapMode: "none",
        truncate: true,
        selectable: false,
      })
      const reveal = () => revealHistoryFile(filePath)
      title.onMouseDown = reveal
      location.onMouseDown = reveal
      row.onMouseDown = reveal
      row.add(title)
      row.add(location)
      listScroll.add(row)
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
