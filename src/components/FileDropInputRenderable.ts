import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  Renderable,
  TextRenderable,
  decodePasteBytes,
  stripAnsiSequences,
  type PasteEvent,
  type RenderContext,
  type RenderableOptions,
} from "@opentui/core"
import { basename } from "node:path"
import { statSync } from "node:fs"
import { parseDroppedFilePaths } from "../runtime/file-drop"
import { ActionButtonRenderable } from "./ActionButtonRenderable"
import { BorderlessTableRenderable } from "./BorderlessTableRenderable"
import { ProgressBarRenderable } from "./ProgressBarRenderable"

export interface FileDropInputOptions extends RenderableOptions {
  platform?: NodeJS.Platform
  captureGlobalDrop?: boolean
  placeholder?: string
  value?: string | string[]
  /** Default output directory shown in the optional output column. */
  outputPath?: string
  outputPathPlaceholder?: string
  onPathParsed?: (path: string) => void
  onPathsChanged?: (paths: string[]) => void
}

export type FileDropInputStatus =
  | "ready"
  | "waiting"
  | "complete"
  | "failed"
  | "cancelled"
  | { type: "progress"; percent: number; label?: string }

/** Multi-file input that converts Finder/Explorer terminal drops into native paths. */
export class FileDropInputRenderable extends Renderable {
  private readonly platform: NodeJS.Platform
  private readonly captureGlobalDrop: boolean
  private readonly onPathParsed?: (path: string) => void
  private readonly onPathsChanged?: (paths: string[]) => void
  private readonly defaultOutputPath: string
  private readonly outputPathPlaceholder: string
  private readonly outputPaths = new Map<string, string>()
  private readonly outputResults = new Map<string, { path: string; onReveal?: () => void }>()
  private readonly editor: InputRenderable
  private readonly table: BorderlessTableRenderable
  private readonly clearAllButton: ActionButtonRenderable
  private paths: string[] = []
  private readonly statuses = new Map<string, FileDropInputStatus>()
  private dropNormalizationTimer: ReturnType<typeof setTimeout> | null = null
  private normalizing = false

  constructor(ctx: RenderContext, options: FileDropInputOptions = {}) {
    const {
      platform = process.platform,
      captureGlobalDrop = true,
      placeholder = "拖拽一个或多个文件到此处，或手动输入路径后回车",
      value = [],
      outputPath = "",
      outputPathPlaceholder = "输出目录",
      onPathParsed,
      onPathsChanged,
      ...rest
    } = options
    super(ctx, {
      ...rest,
      width: rest.width ?? "100%",
      minHeight: rest.minHeight ?? 3,
      flexGrow: rest.flexGrow ?? 1,
      flexDirection: "column",
    })
    this.platform = platform
    this.captureGlobalDrop = captureGlobalDrop
    this.onPathParsed = onPathParsed
    this.onPathsChanged = onPathsChanged
    this.defaultOutputPath = outputPath
    this.outputPathPlaceholder = outputPathPlaceholder

    const toolbar = new BoxRenderable(ctx, {
      id: `${this.id}-toolbar`,
      width: "100%",
      height: 1,
      flexDirection: "row",
      gap: 1,
    })
    this.editor = new InputRenderable(ctx, {
      id: `${this.id}-editor`,
      flexGrow: 1,
      placeholder,
    })
    this.editor.on(InputRenderableEvents.INPUT, this.handleInputCandidate)
    this.editor.onSubmit = () => this.commitEditorValue()
    this.editor.onPaste = (event) => this.handlePaste(event)
    toolbar.add(this.editor)

    const addButton = new ActionButtonRenderable(ctx, {
      id: `${this.id}-add`,
      width: 6,
      label: "添加",
      onActivate: () => this.commitEditorValue(),
    })
    toolbar.add(addButton)

    this.clearAllButton = new ActionButtonRenderable(ctx, {
      id: `${this.id}-clear-all`,
      width: 10,
      label: "全部清除",
      danger: true,
      disabled: true,
      onActivate: () => this.clearAll(),
    })
    this.add(toolbar)

    this.table = new BorderlessTableRenderable(ctx, {
      id: `${this.id}-table`,
      width: "100%",
      flexGrow: 1,
      columns: [
        { id: "name", title: "文件名称", flexGrow: 1 },
        { id: "output", title: "输出位置", width: 24 },
        { id: "status", title: "状态", width: 22 },
        { id: "clear", title: "", width: 8 },
      ],
    })
    this.table.replaceHeaderCell(3, this.clearAllButton)
    this.add(this.table)

    this.ctx.keyInput.on("paste", this.handleGlobalPaste)
    this.setPaths(Array.isArray(value) ? value : value ? [value] : [], false)
  }

  private isMounted(): boolean {
    const rendererRoot = (this.ctx as RenderContext & { root?: Renderable }).root
    if (!rendererRoot) return this.parent !== null
    let current: Renderable = this
    while (current.parent) current = current.parent as Renderable
    return current === rendererRoot
  }

  private parsePayload(text: string): string[] {
    const sanitized = stripAnsiSequences(text).trim()
    if (!sanitized) return []
    try {
      if (statSync(sanitized).isFile()) return [sanitized]
    } catch {
      // Terminal drag formats may contain quotes or escaped spaces.
    }
    return parseDroppedFilePaths(sanitized, this.platform)
  }

  private readonly handleGlobalPaste = (event: PasteEvent): void => {
    if (!this.captureGlobalDrop || event.defaultPrevented || !this.isMounted()) return
    const candidates = this.parsePayload(decodePasteBytes(event.bytes))
    const existingFiles = candidates.filter((path) => {
      try {
        return statSync(path).isFile()
      } catch {
        return false
      }
    })
    if (existingFiles.length === 0) return

    event.preventDefault()
    event.stopPropagation()
    this.focus()
    this.addPaths(existingFiles)
  }

  private readonly handleInputCandidate = (value: string): void => {
    if (this.normalizing || !this.looksLikeTerminalDrop(value)) return
    if (this.dropNormalizationTimer) clearTimeout(this.dropNormalizationTimer)
    this.dropNormalizationTimer = setTimeout(() => {
      this.dropNormalizationTimer = null
      if (this.acceptDroppedText(this.editor.value)) this.editor.value = ""
    }, 25)
  }

  private looksLikeTerminalDrop(value: string): boolean {
    if (/^file:\/\//i.test(value)) return true
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) return true
    return this.platform !== "win32" && /\\\s/.test(value)
  }

  private commitEditorValue(): void {
    const raw = this.editor.value
    if (!raw.trim()) return
    this.addPaths(this.parsePayload(raw))
    this.editor.value = ""
  }

  private acceptDroppedText(text: string): boolean {
    const paths = this.parsePayload(text)
    if (paths.length === 0) return false
    this.addPaths(paths)
    return true
  }

  private createStatusCell(status: FileDropInputStatus): Renderable {
    if (typeof status === "object" && status.type === "progress") {
      return new ProgressBarRenderable(this.ctx, {
        width: 20,
        percent: status.percent,
        label: status.label ?? "转换",
        selectable: false,
      })
    }
    const labels: Record<Exclude<FileDropInputStatus, { type: "progress" }>, string> = {
      ready: "就绪",
      waiting: "等待",
      complete: "完成",
      failed: "失败",
      cancelled: "已取消",
    }
    const textStatus = typeof status === "string" ? status : "ready"
    return new TextRenderable(this.ctx, {
      content: labels[textStatus],
      fg: textStatus === "failed" ? "#EF4444" : textStatus === "complete" ? "#86EFAC" : "#D1D5DB",
      selectable: false,
      wrapMode: "none",
      truncate: true,
    })
  }

  private createOutputCell(path: string, index: number): Renderable {
    const result = this.outputResults.get(path)
    if (result) {
      const cell = new TextRenderable(this.ctx, {
        id: `${this.id}-output-${index}`,
        content: `[单击查看] ${result.path}`,
        width: "100%",
        wrapMode: "none",
        truncate: true,
        selectable: false,
      })
      cell.onMouseDown = result.onReveal
      return cell
    }

    const editor = new InputRenderable(this.ctx, {
      id: `${this.id}-output-${index}`,
      value: this.outputPaths.get(path) ?? this.defaultOutputPath,
      width: "100%",
      placeholder: this.outputPathPlaceholder,
      wrapMode: "none",
    })
    editor.on(InputRenderableEvents.INPUT, (value) => {
      this.outputPaths.set(path, value)
    })
    return editor
  }

  private refreshList(): void {
    this.clearAllButton.disabled = this.paths.length === 0
    this.table.setRows(this.paths.map((path, index) => ({
      id: `${this.id}-row-${index}`,
      cells: [
        new TextRenderable(this.ctx, {
          id: `${this.id}-name-${index}`,
          content: basename(path) || path,
          flexGrow: 1,
          height: 1,
          wrapMode: "none",
          truncate: true,
          selectable: false,
        }),
        this.createOutputCell(path, index),
        this.createStatusCell(this.statuses.get(path) ?? "ready"),
        new ActionButtonRenderable(this.ctx, {
          id: `${this.id}-remove-${index}`,
          width: 6,
          label: "清除",
          danger: true,
          onActivate: () => this.removePath(index),
        }),
      ],
    })))
  }

  private notifyChanged(added: string[] = []): void {
    for (const path of added) this.onPathParsed?.(path)
    this.onPathsChanged?.(this.getPaths())
  }

  addPaths(paths: readonly string[]): void {
    const added: string[] = []
    for (const path of paths.map((item) => item.trim()).filter(Boolean)) {
      if (this.paths.includes(path)) continue
      this.paths.push(path)
      this.statuses.set(path, "ready")
      added.push(path)
    }
    if (added.length === 0) return
    this.refreshList()
    this.notifyChanged(added)
  }

  setPaths(paths: readonly string[], notify = true): void {
    const previousStatuses = new Map(this.statuses)
    const previousOutputPaths = new Map(this.outputPaths)
    this.paths = [...new Set(paths.map((path) => path.trim()).filter(Boolean))]
    this.statuses.clear()
    this.outputPaths.clear()
    this.outputResults.clear()
    this.paths.forEach((path) => this.statuses.set(path, previousStatuses.get(path) ?? "ready"))
    this.paths.forEach((path) => this.outputPaths.set(path, previousOutputPaths.get(path) ?? this.defaultOutputPath))
    this.refreshList()
    if (notify) this.notifyChanged(this.paths)
  }

  removePath(index: number): void {
    if (index < 0 || index >= this.paths.length) return
    const [removed] = this.paths.splice(index, 1)
    if (removed) this.statuses.delete(removed)
    if (removed) this.outputPaths.delete(removed)
    if (removed) this.outputResults.delete(removed)
    this.refreshList()
    this.notifyChanged()
  }

  clearAll(): void {
    if (this.paths.length === 0) return
    this.paths = []
    this.statuses.clear()
    this.outputPaths.clear()
    this.outputResults.clear()
    this.editor.value = ""
    this.refreshList()
    this.notifyChanged()
  }

  getPaths(): string[] {
    return [...this.paths]
  }

  getOutputPath(path: string): string {
    return this.outputPaths.get(path) ?? this.defaultOutputPath
  }

  setOutputPath(path: string, outputPath: string): void {
    if (!this.paths.includes(path)) return
    this.outputPaths.set(path, outputPath)
    this.outputResults.delete(path)
    this.refreshList()
  }

  setOutputResult(path: string, outputPath: string, onReveal?: () => void): void {
    const index = this.paths.indexOf(path)
    if (index < 0) return
    this.outputResults.set(path, { path: outputPath, onReveal })
    this.table.replaceCell(`${this.id}-row-${index}`, 1, this.createOutputCell(path, index))
  }

  clearOutputResult(path: string): void {
    if (!this.outputResults.delete(path)) return
    const index = this.paths.indexOf(path)
    if (index >= 0) this.table.replaceCell(`${this.id}-row-${index}`, 1, this.createOutputCell(path, index))
  }

  commitPendingInput(): void {
    this.commitEditorValue()
  }

  setPathStatus(path: string, status: FileDropInputStatus): void {
    const index = this.paths.indexOf(path)
    if (index < 0) return
    this.statuses.set(path, status)
    this.table.replaceCell(`${this.id}-row-${index}`, 2, this.createStatusCell(status))
  }

  get value(): string {
    return this.paths[0] ?? this.editor.value
  }

  set value(path: string) {
    this.setPaths(path.trim() ? [path] : [])
  }

  insertText(text: string): void {
    this.editor.insertText(text)
  }

  override handlePaste(event: PasteEvent): void {
    const text = decodePasteBytes(event.bytes)
    if (!this.acceptDroppedText(text)) return
    event.preventDefault()
    this.editor.value = ""
  }

  override focus(): void {
    this.editor.focus()
  }

  override blur(): void {
    this.editor.blur()
  }

  override get focused(): boolean {
    return this.editor.focused
  }

  override destroy(): void {
    if (this.dropNormalizationTimer) clearTimeout(this.dropNormalizationTimer)
    this.ctx.keyInput.off("paste", this.handleGlobalPaste)
    this.editor.off(InputRenderableEvents.INPUT, this.handleInputCandidate)
    super.destroy()
  }
}
