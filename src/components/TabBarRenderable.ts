import { Renderable, type RenderContext, type RenderableOptions, type KeyEvent, TextRenderable, RGBA } from "@opentui/core"

export interface TabBarOption<T = number> {
  name: string
  description?: string
  value?: T
}

/** Compact, mouse-friendly tab bar for the application's top-level views. */
export class TabBarRenderable<T = number> extends Renderable {
  private readonly tabs: TextRenderable[] = []
  private options: TabBarOption<T>[]
  private selectedIndex: number
  private readonly onChange?: (option: TabBarOption<T>, index: number) => void

  constructor(ctx: RenderContext, opts: RenderableOptions & { options?: TabBarOption<T>[]; selectedIndex?: number; onChange?: (option: TabBarOption<T>, index: number) => void } = {}) {
    const { options = [], selectedIndex = 0, onChange, ...rest } = opts
    super(ctx, { ...rest, flexDirection: "row" })
    this.options = options
    this.selectedIndex = this.clamp(selectedIndex)
    this.onChange = onChange
    this.buildTabs(ctx)
    this.focusable = true
    this.update()
  }

  private clamp(index: number): number { return this.options.length === 0 ? 0 : Math.max(0, Math.min(this.options.length - 1, index)) }

  private buildTabs(ctx: RenderContext) {
    this.tabs.length = 0
    for (const child of this.getChildren()) this.remove(child.id)
    this.options.forEach((option, index) => {
      const tab = new TextRenderable(ctx, { content: ` ${option.name} `, height: 1 })
      tab.onMouseDown = () => this.setSelectedIndex(index, true)
      this.tabs.push(tab)
      this.add(tab)
    })
  }

  private update() {
    this.tabs.forEach((tab, index) => {
      tab.bg = index === this.selectedIndex ? RGBA.fromInts(55, 150, 220, 100) : RGBA.fromInts(0, 0, 0, 0)
      tab.fg = index === this.selectedIndex ? RGBA.fromHex("#FFFFFF") : RGBA.fromHex("#9CA3AF")
    })
    this.requestRender()
  }

  private move(delta: number) {
    if (this.options.length === 0) return
    this.setSelectedIndex((this.selectedIndex + delta + this.options.length) % this.options.length, true)
  }

  override handleKeyPress(key: KeyEvent): boolean {
    if (key.name === "left" || key.name === "up") { this.move(-1); return true }
    if (key.name === "right" || key.name === "down") { this.move(1); return true }
    if (key.name === "return" || key.name === "space") { this.emitChange(); return true }
    return false
  }

  private emitChange() {
    const option = this.options[this.selectedIndex]
    if (option) this.onChange?.(option, this.selectedIndex)
  }

  public setOptions(options: TabBarOption<T>[]) {
    this.options = options
    this.selectedIndex = this.clamp(this.selectedIndex)
    this.buildTabs(this.ctx)
    this.update()
  }

  public setSelectedIndex(index: number, notify = false) {
    this.selectedIndex = this.clamp(index)
    this.update()
    if (notify) this.emitChange()
  }

  public getSelectedIndex(): number { return this.selectedIndex }
  public getSelectedOption(): TabBarOption<T> | null { return this.options[this.selectedIndex] ?? null }
}
