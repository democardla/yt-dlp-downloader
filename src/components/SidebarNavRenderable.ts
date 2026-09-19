import { Renderable, type RenderContext, type RenderableOptions, type KeyEvent, TextRenderable, RGBA } from "@opentui/core"

export class SidebarNavRenderable extends Renderable {
  private readonly rows: TextRenderable[] = []
  private readonly names: string[] = []
  private selectedIndex: number
  private readonly onChange?: (index: number) => void

  constructor(ctx: RenderContext, opts: RenderableOptions & { options?: string[]; selectedIndex?: number; onChange?: (index: number) => void } = {}) {
    const { options = [], selectedIndex = 0, onChange, ...rest } = opts
    super(ctx, { ...rest, flexDirection: "column" })
    this.selectedIndex = Math.max(0, Math.min(options.length - 1, selectedIndex))
    this.onChange = onChange
    options.forEach((name, index) => {
      const row = new TextRenderable(ctx, { content: `  ${name}`, height: 1 })
      this.rows.push(row)
      this.names.push(name)
      this.add(row)
      row.onMouseDown = () => this.setSelectedIndex(index, true)
    })
    this.focusable = true
    this.updateRows()
  }

  private updateRows() {
    this.rows.forEach((row, index) => {
      row.content = `${index === this.selectedIndex ? "▸" : " "} ${this.names[index]}`
      row.bg = index === this.selectedIndex ? RGBA.fromInts(55, 150, 220, 80) : RGBA.fromInts(0, 0, 0, 0)
    })
    this.requestRender()
  }

  private move(delta: number) {
    if (this.rows.length === 0) return
    this.setSelectedIndex((this.selectedIndex + delta + this.rows.length) % this.rows.length, true)
  }

  override handleKeyPress(key: KeyEvent): boolean {
    if (key.name === "up") { this.move(-1); return true }
    if (key.name === "down") { this.move(1); return true }
    if (key.name === "return" || key.name === "space") { this.onChange?.(this.selectedIndex); return true }
    return false
  }

  public getSelectedIndex(): number { return this.selectedIndex }

  public setSelectedIndex(index: number, notify = false) {
    this.selectedIndex = Math.max(0, Math.min(this.rows.length - 1, index))
    this.updateRows()
    if (notify) this.onChange?.(this.selectedIndex)
  }
}
