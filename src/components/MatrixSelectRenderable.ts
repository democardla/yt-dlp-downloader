import {
  RGBA,
  Renderable,
  TextRenderable,
  type KeyEvent,
  type RenderContext,
  type RenderableOptions,
} from "@opentui/core"

export interface MatrixSelectOption<T = string> {
  name: string
  value?: T
}

export interface MatrixSelectOptions<T = string> extends RenderableOptions {
  options?: MatrixSelectOption<T>[]
  selectedIndex?: number
  onChange?: (option: MatrixSelectOption<T>, index: number) => void
}

/** Compact single-select control that lays its name-only options out in a matrix. */
export class MatrixSelectRenderable<T = string> extends Renderable {
  private options: MatrixSelectOption<T>[]
  private selectedIndex: number
  private cursor: number
  private cellWidth = 1
  private readonly cells: TextRenderable[] = []
  private readonly onChange?: (option: MatrixSelectOption<T>, index: number) => void

  constructor(ctx: RenderContext, opts: MatrixSelectOptions<T> = {}) {
    const {
      options = [],
      selectedIndex = 0,
      onChange,
      ...rest
    } = opts
    super(ctx, {
      ...rest,
      width: rest.width ?? "100%",
      height: rest.height ?? "auto",
      flexDirection: "row",
      flexWrap: "wrap",
    })
    this.options = options
    this.selectedIndex = this.clamp(selectedIndex)
    this.cursor = this.selectedIndex
    this.onChange = onChange
    this.focusable = true
    this.rebuild()
  }

  private clamp(index: number): number {
    if (this.options.length === 0) return 0
    return Math.max(0, Math.min(this.options.length - 1, index))
  }

  private rebuild(): void {
    for (const child of this.getChildren()) this.remove(child.id)
    this.cells.length = 0
    // One marker, one separating space and one trailing cell keep the options
    // readable without stretching them to equal fractions of the whole panel.
    this.cellWidth = Math.max(3, ...this.options.map((option) => option.name.length + 3))

    this.options.forEach((option, index) => {
      const cell = new TextRenderable(this.ctx, {
        id: `${this.id}-option-${index}`,
        width: this.cellWidth,
        height: 1,
        wrapMode: "none",
        truncate: true,
        selectable: false,
      })
      cell.onMouseDown = () => this.select(index, true)
      this.cells.push(cell)
      this.add(cell)
    })
    this.update()
  }

  private get columns(): number {
    const availableWidth = typeof this.width === "number" ? this.width : this.cellWidth
    return Math.max(1, Math.min(this.options.length || 1, Math.floor(availableWidth / this.cellWidth)))
  }

  private update(): void {
    this.cells.forEach((cell, index) => {
      const selected = index === this.selectedIndex
      const cursor = index === this.cursor
      cell.content = `${selected ? "●" : "○"} ${this.options[index]!.name}`
      cell.fg = selected ? RGBA.fromHex("#FFFFFF") : RGBA.fromHex("#9CA3AF")
      cell.bg = cursor && this.focused
        ? RGBA.fromInts(55, 150, 220, 90)
        : RGBA.fromInts(0, 0, 0, 0)
    })
    this.requestRender()
  }

  private select(index: number, notify: boolean): void {
    if (this.options.length === 0) return
    this.cursor = this.clamp(index)
    this.selectedIndex = this.cursor
    this.update()
    if (notify) {
      const option = this.options[this.selectedIndex]
      if (option) this.onChange?.(option, this.selectedIndex)
    }
  }

  private move(delta: number): void {
    if (this.options.length === 0) return
    const next = (this.cursor + delta + this.options.length) % this.options.length
    this.select(next, true)
  }

  override handleKeyPress(key: KeyEvent): boolean {
    if (key.name === "left") { this.move(-1); return true }
    if (key.name === "right") { this.move(1); return true }
    if (key.name === "up") { this.move(-this.columns); return true }
    if (key.name === "down") { this.move(this.columns); return true }
    if (key.name === "home") { this.select(0, true); return true }
    if (key.name === "end") { this.select(this.options.length - 1, true); return true }
    if (key.name === "return" || key.name === "space") {
      const option = this.options[this.selectedIndex]
      if (option) this.onChange?.(option, this.selectedIndex)
      return true
    }
    return false
  }

  override focus(): void {
    super.focus()
    this.update()
  }

  override blur(): void {
    super.blur()
    if (!this.isDestroyed) this.update()
  }

  setOptions(options: MatrixSelectOption<T>[]): void {
    this.options = options
    this.selectedIndex = this.clamp(this.selectedIndex)
    this.cursor = this.selectedIndex
    this.rebuild()
  }

  setSelectedIndex(index: number, notify = false): void {
    this.select(index, notify)
  }

  getSelectedIndex(): number {
    return this.selectedIndex
  }

  getSelectedOption(): MatrixSelectOption<T> | null {
    return this.options[this.selectedIndex] ?? null
  }
}
