import {
  Renderable,
  type RenderContext,
  type RenderableOptions,
  type KeyEvent,
  TextRenderable,
  RGBA,
} from "@opentui/core"

export interface MultiSelectItem {
  name: string
  description?: string
}

/** Keyboard- and mouse-friendly multi-select list. */
export class MultiSelectRenderable extends Renderable {
  private readonly itemRows: TextRenderable[] = []
  private items: MultiSelectItem[]
  private selected: Set<number>
  private cursor: number
  private readonly onSubmit?: (indices: number[], items: MultiSelectItem[]) => void
  private readonly onSelectionChange?: (indices: number[], items: MultiSelectItem[]) => void
  private readonly onCursorChange?: (index: number) => void

  constructor(
    ctx: RenderContext,
    opts: RenderableOptions & {
      items?: Array<string | MultiSelectItem>
      selected?: number[]
      cursor?: number
      onSubmit?: (indices: number[], items: MultiSelectItem[]) => void
      onSelectionChange?: (indices: number[], items: MultiSelectItem[]) => void
      onCursorChange?: (index: number) => void
    } = {},
  ) {
    const {
      items = [],
      selected = [],
      cursor = 0,
      onSubmit,
      onSelectionChange,
      onCursorChange,
      ...rest
    } = opts
    super(ctx, {
      ...rest,
      flexDirection: "column",
      height: rest.height ?? Math.max(1, items.length),
    })

    this.items = this.normalizeItems(items)
    this.selected = new Set(selected.filter((index) => index >= 0 && index < this.items.length))
    this.cursor = this.clampIndex(cursor)
    this.onSubmit = onSubmit
    this.onSelectionChange = onSelectionChange
    this.onCursorChange = onCursorChange
    this.focusable = true
    this.syncRows()
  }

  private normalizeItems(items: Array<string | MultiSelectItem>): MultiSelectItem[] {
    return items.map((item) => typeof item === "string"
      ? { name: item }
      : { name: item.name, description: item.description })
  }

  private clampIndex(index: number): number {
    return this.items.length === 0 ? 0 : Math.max(0, Math.min(this.items.length - 1, index))
  }

  private syncRows(): void {
    while (this.itemRows.length > this.items.length) {
      const row = this.itemRows.pop()
      if (row) this.remove(row.id)
    }

    while (this.itemRows.length < this.items.length) {
      const index = this.itemRows.length
      const row = new TextRenderable(this.ctx, {
        id: `multi-select-item-${index}`,
        height: 1,
        width: "100%",
        selectable: false,
        wrapMode: "none",
        truncate: true,
      })
      row.onMouseDown = () => {
        this.setCursor(index)
        this.toggleCurrent()
      }
      this.itemRows.push(row)
      this.add(row)
    }

    this.height = Math.max(1, this.items.length)
    this.updateRows()
  }

  private updateRows(): void {
    this.itemRows.forEach((row, index) => {
      const item = this.items[index]
      if (!item) return
      const isSelected = this.selected.has(index)
      const isCursor = index === this.cursor
      const cursorMark = isCursor ? "▸ " : "  "
      const checkbox = isSelected ? "■" : "□"
      const description = item.description ? `  ${item.description}` : ""
      row.content = `${cursorMark}${checkbox} ${item.name}${description}`
      row.fg = isCursor ? RGBA.fromHex("#FFFFFF") : RGBA.fromHex("#D1D5DB")
      row.bg = isCursor
        ? RGBA.fromInts(55, 150, 220, 150)
        : isSelected
          ? RGBA.fromInts(55, 150, 220, 80)
          : RGBA.fromInts(0, 0, 0, 0)
    })
    this.requestRender()
  }

  private emitSelectionChange(): void {
    this.onSelectionChange?.(this.getSelectedIndices(), this.getSelectedItems())
  }

  override handleKeyPress(key: KeyEvent): boolean {
    switch (key.name) {
      case "up":
      case "k":
        this.prev()
        return true
      case "down":
      case "j":
        this.next()
        return true
      case "space":
        this.toggleCurrent()
        return true
      case "return":
        this.submit()
        return true
      case "home":
        this.setCursor(0)
        return true
      case "end":
        this.setCursor(this.items.length - 1)
        return true
      default:
        return false
    }
  }

  setItems(items: Array<string | MultiSelectItem>): void {
    this.items = this.normalizeItems(items)
    this.selected = new Set([...this.selected].filter((index) => index < this.items.length))
    this.cursor = this.clampIndex(this.cursor)
    this.syncRows()
  }

  setCursor(index: number): void {
    this.cursor = this.clampIndex(index)
    this.updateRows()
    this.onCursorChange?.(this.cursor)
  }

  getCursor(): number {
    return this.cursor
  }

  next(): void {
    if (this.items.length === 0) return
    this.setCursor((this.cursor + 1) % this.items.length)
  }

  prev(): void {
    if (this.items.length === 0) return
    this.setCursor((this.cursor - 1 + this.items.length) % this.items.length)
  }

  toggleCurrent(): void {
    if (this.items.length === 0) return
    if (this.selected.has(this.cursor)) this.selected.delete(this.cursor)
    else this.selected.add(this.cursor)
    this.updateRows()
    this.emitSelectionChange()
  }

  select(index: number): void {
    if (index >= 0 && index < this.items.length) {
      this.selected.add(index)
      this.updateRows()
      this.emitSelectionChange()
    }
  }

  deselect(index: number): void {
    this.selected.delete(index)
    this.updateRows()
    this.emitSelectionChange()
  }

  selectAll(): void {
    this.selected = new Set(this.items.map((_, index) => index))
    this.updateRows()
    this.emitSelectionChange()
  }

  clearSelection(): void {
    this.selected.clear()
    this.updateRows()
    this.emitSelectionChange()
  }

  getSelectedIndices(): number[] {
    return Array.from(this.selected).sort((a, b) => a - b)
  }

  getSelectedItems(): MultiSelectItem[] {
    return this.getSelectedIndices().map((index) => this.items[index]!).filter(Boolean)
  }

  submit(): { indices: number[]; items: MultiSelectItem[] } {
    const indices = this.getSelectedIndices()
    const items = this.getSelectedItems()
    this.onSubmit?.(indices, items)
    return { indices, items }
  }
}
