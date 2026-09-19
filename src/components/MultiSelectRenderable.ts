import {
  Renderable,
  type RenderContext,
  type RenderableOptions,
  type KeyEvent,
  TextRenderable,
  RGBA,
} from "@opentui/core"

export class MultiSelectRenderable extends Renderable {
  private textRenderable: TextRenderable
  private items: { name: string; description?: string }[]
  private selected: Set<number>
  private cursor: number
  private onSubmit?: (indices: number[], items: { name: string; description?: string }[]) => void

  constructor(
    ctx: RenderContext,
    opts: RenderableOptions & {
      items?: Array<string | { name: string; description?: string }>
      selected?: number[]
      cursor?: number
      onSubmit?: (indices: number[], items: { name: string; description?: string }[]) => void
    } = {}
  ) {
    const { items = [], selected = [], cursor = 0, onSubmit, ...rest } = opts
    super(ctx, rest)
    
    this.items = items.map((it: any) =>
      typeof it === "string" ? { name: it, description: "" } : { name: it.name, description: it.description }
    )

    this.selected = new Set(selected)
    this.cursor = Math.max(0, Math.min(this.items.length - 1, cursor))
    this.onSubmit = onSubmit
    
    // 创建内部的 TextRenderable
    this.textRenderable = new TextRenderable(ctx, {})
    this.add(this.textRenderable)
    this.textRenderable.onMouseDown = () => this.toggleCurrent()
    
    // 设置为可聚焦的
    this.focusable = true
    this.updateContent()
  }

  private updateContent() {
    const lines: string[] = []

    this.items.forEach((it, idx) => {
      const isSelected = this.selected.has(idx)
      const isCursor = idx === this.cursor
      const checkbox = isSelected ? "■" : "□"
      const cursorMark = isCursor ? "> " : "  "

      let line = `${cursorMark}${checkbox} ${it.name}`
      if (it.description) {
        line += ` - ${it.description}`
      }
      lines.push(line)
    })

    this.textRenderable.content = lines.join("\n")
    this.requestRender()
  }

  override handleKeyPress(key: KeyEvent): boolean {
    switch (key.name) {
      case "up":
        this.prev()
        return true
      case "down":
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

  setItems(items: Array<string | { name: string; description?: string }>) {
    this.items = items.map((it: any) =>
      typeof it === "string" ? { name: it, description: "" } : { name: it.name, description: it.description }
    )

    const validIndices = new Set<number>()
    this.selected.forEach((idx) => {
      if (idx < this.items.length) {
        validIndices.add(idx)
      }
    })
    this.selected = validIndices

    if (this.cursor >= this.items.length) {
      this.cursor = Math.max(0, this.items.length - 1)
    }

    this.updateContent()
  }

  setCursor(idx: number) {
    this.cursor = Math.max(0, Math.min(this.items.length - 1, idx))
    this.updateContent()
  }

  next() {
    this.cursor = (this.cursor + 1) % this.items.length
    this.updateContent()
  }

  prev() {
    this.cursor = this.cursor - 1
    if (this.cursor < 0) {
      this.cursor = this.items.length - 1
    }
    this.updateContent()
  }

  toggleCurrent() {
    if (this.selected.has(this.cursor)) {
      this.selected.delete(this.cursor)
    } else {
      this.selected.add(this.cursor)
    }
    this.updateContent()
  }

  select(index: number) {
    if (index >= 0 && index < this.items.length) {
      this.selected.add(index)
      this.updateContent()
    }
  }

  deselect(index: number) {
    this.selected.delete(index)
    this.updateContent()
  }

  selectAll() {
    this.selected = new Set(this.items.map((_, idx) => idx))
    this.updateContent()
  }

  clearSelection() {
    this.selected = new Set()
    this.updateContent()
  }

  getSelectedIndices(): number[] {
    return Array.from(this.selected).sort((a, b) => a - b)
  }

  getSelectedItems(): { name: string; description?: string }[] {
    return this.getSelectedIndices().map((idx) => this.items[idx]!)
  }

  submit() {
    const indices = this.getSelectedIndices()
    const items = this.getSelectedItems()
    if (this.onSubmit) {
      this.onSubmit(indices, items)
    }
    return { indices, items }
  }
}

// 用法：创建实例后把它添加到 renderer.root 中，使用 next()/prev()/toggleCurrent() 控制选择。
