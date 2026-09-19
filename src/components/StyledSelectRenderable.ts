import {
  Renderable,
  type RenderContext,
  type RenderableOptions,
  type KeyEvent,
  TextRenderable,
  RGBA,
} from "@opentui/core"

/**
 * 美观样式的 Select 组件，参考 MultiSelectRenderable 的实现方式
 * 提供预设的美观配色方案
 */
export class StyledSelectRenderable extends Renderable {
  private textRenderable: TextRenderable
  private options: { name: string; description?: string }[]
  private selectedIndex: number
  private cursor: number
  private onSelect?: (index: number, option: { name: string; description?: string }) => void

  constructor(
    ctx: RenderContext,
    opts: RenderableOptions & {
      options?: Array<{ name: string; description?: string }>
      selectedIndex?: number
      cursor?: number
      onSelect?: (index: number, option: { name: string; description?: string }) => void
    } = {}
  ) {
    const {
      options = [],
      selectedIndex = 0,
      cursor = 0,
      onSelect,
      ...rest
    } = opts
    super(ctx, rest)
    
    this.options = options
    this.selectedIndex = Math.max(0, Math.min(options.length - 1, selectedIndex))
    this.cursor = Math.max(0, Math.min(options.length - 1, cursor))
    this.onSelect = onSelect
    
    // 创建内部的 TextRenderable
    this.textRenderable = new TextRenderable(ctx, {})
    this.add(this.textRenderable)
    this.textRenderable.onMouseDown = (event) => {
      // MouseEvent coordinates are screen coordinates; each option occupies
      // one terminal row in the rendered text block.
      const index = Math.floor(event.y - this.textRenderable.screenY)
      if (index >= 0 && index < this.options.length) {
        this.setCursor(index)
      }
    }
    
    // 设置为可聚焦的
    this.focusable = true
    this.updateContent()
  }

  private updateContent() {
    const lines: string[] = []

    this.options.forEach((option, idx) => {
      const isSelected = idx === this.selectedIndex
      const isCursor = idx === this.cursor
      const checkbox = isSelected ? "●" : "○"
      const cursorMark = isCursor ? "> " : "  "

      let line = `${cursorMark}${checkbox} ${option.name}`
      if (option.description) {
        line += ` - ${option.description}`
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
      case "return":
        this.selectCurrent()
        return true
      case "home":
        this.setCursor(0)
        return true
      case "end":
        this.setCursor(this.options.length - 1)
        return true
      default:
        return false
    }
  }

  setOptions(options: Array<{ name: string; description?: string }>) {
    this.options = options
    
    if (this.selectedIndex >= options.length) {
      this.selectedIndex = Math.max(0, options.length - 1)
    }
    
    if (this.cursor >= options.length) {
      this.cursor = Math.max(0, options.length - 1)
    }

    this.updateContent()
  }

  setCursor(idx: number) {
    this.cursor = Math.max(0, Math.min(this.options.length - 1, idx))
    this.selectedIndex = this.cursor
    if (this.onSelect && this.options[this.cursor]) {
      this.onSelect(this.cursor, this.options[this.cursor]!)
    }
    this.updateContent()
  }

  setSelectedIndex(idx: number) {
    this.selectedIndex = Math.max(0, Math.min(this.options.length - 1, idx))
    this.cursor = this.selectedIndex
    if (this.onSelect && this.options[this.selectedIndex]) {
      this.onSelect(this.selectedIndex, this.options[this.selectedIndex]!)
    }
    this.updateContent()
  }

  next() {
    if (this.options.length === 0) return
    this.cursor = (this.cursor + 1) % this.options.length
    this.selectedIndex = this.cursor
    if (this.onSelect && this.options[this.cursor]) {
      this.onSelect(this.cursor, this.options[this.cursor]!)
    }
    this.updateContent()
  }

  prev() {
    if (this.options.length === 0) return
    this.cursor = this.cursor - 1
    if (this.cursor < 0) {
      this.cursor = this.options.length - 1
    }
    this.selectedIndex = this.cursor
    if (this.onSelect && this.options[this.cursor]) {
      this.onSelect(this.cursor, this.options[this.cursor]!)
    }
    this.updateContent()
  }

  selectCurrent() {
    // 现在光标移动时已经自动选中，这个方法主要用于回车键确认
    if (this.onSelect && this.options[this.cursor]) {
      this.onSelect(this.cursor, this.options[this.cursor]!)
    }
  }

  getSelectedIndex(): number {
    return this.selectedIndex
  }

  getSelectedOption(): { name: string; description?: string } | null {
    return this.options[this.selectedIndex] || null
  }
}
