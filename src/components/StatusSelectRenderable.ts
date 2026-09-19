import {
  Renderable,
  type RenderContext,
  type RenderableOptions,
  type KeyEvent,
  TextRenderable,
  RGBA,
} from "@opentui/core"

export interface StatusSelectOption<T = string> {
  name: string
  value: T
  /** Green when true, red when false. */
  available?: boolean
}

/** A compact select whose expanded options are independent mouse targets. */
export class StatusSelectRenderable<T = string> extends Renderable {
  private readonly header: TextRenderable
  private readonly optionRows: TextRenderable[] = []
  private options: StatusSelectOption<T>[]
  private selectedIndex: number
  private open = false
  private readonly onChange?: (option: StatusSelectOption<T>, index: number) => void
  private readonly onBeforeOpen?: () => void

  constructor(
    ctx: RenderContext,
    opts: RenderableOptions & {
      options?: StatusSelectOption<T>[]
      selectedIndex?: number
      onChange?: (option: StatusSelectOption<T>, index: number) => void
      onBeforeOpen?: () => void
    } = {},
  ) {
    const { options = [], selectedIndex = 0, onChange, onBeforeOpen, ...rest } = opts
    super(ctx, { ...rest, flexDirection: "column" })
    this.options = options
    this.selectedIndex = this.clampIndex(selectedIndex)
    this.onChange = onChange
    this.onBeforeOpen = onBeforeOpen

    this.header = new TextRenderable(ctx, { height: 1 })
    this.header.onMouseDown = () => {
      if (!this.open) this.onBeforeOpen?.()
      this.open = !this.open
      this.update()
    }
    this.add(this.header)
    this.focusable = true
    this.update()
  }

  private clampIndex(index: number): number {
    return this.options.length === 0 ? 0 : Math.max(0, Math.min(this.options.length - 1, index))
  }

  private selected(): StatusSelectOption<T> | undefined {
    return this.options[this.selectedIndex]
  }

  private stateColor(available: boolean): RGBA {
    return available
      ? RGBA.fromInts(55, 190, 100, 70)
      : RGBA.fromInts(220, 70, 70, 70)
  }

  private selectedColor(available: boolean): RGBA {
    return available
      ? RGBA.fromInts(55, 190, 100, 150)
      : RGBA.fromInts(220, 70, 70, 150)
  }

  private update(): void {
    const current = this.selected()
    this.header.bg = this.stateColor(current?.available ?? true)
    this.header.content = `▾  ${current?.name ?? "未选择"}`

    for (const row of this.optionRows) this.remove(row.id)
    this.optionRows.length = 0

    if (this.open) {
      this.options.forEach((option, index) => {
        const row = new TextRenderable(this.ctx, {
          content: `${index === this.selectedIndex ? "▸" : "  "} ${option.name}`,
          height: 1,
          bg: index === this.selectedIndex
            ? this.selectedColor(option.available ?? true)
            : this.stateColor(option.available ?? true),
          fg: index === this.selectedIndex ? RGBA.fromHex("#FFFFFF") : RGBA.fromHex("#D1D5DB"),
        })
        row.onMouseDown = () => {
          this.open = false
          this.setSelectedIndex(index, true)
        }
        this.optionRows.push(row)
        this.add(row)
      })
    }
    this.requestRender()
  }

  private move(delta: number): void {
    if (this.options.length === 0) return
    this.setSelectedIndex((this.selectedIndex + delta + this.options.length) % this.options.length, true)
  }

  override handleKeyPress(key: KeyEvent): boolean {
    switch (key.name) {
      case "up": this.move(-1); return true
      case "down": this.move(1); return true
      case "return":
      case "space": this.open = !this.open; this.update(); return true
      case "escape": this.open = false; this.update(); return true
      default: return false
    }
  }

  private emitChange(): void {
    const option = this.selected()
    if (option) this.onChange?.(option, this.selectedIndex)
  }

  public getSelectedIndex(): number { return this.selectedIndex }
  public getSelectedOption(): StatusSelectOption<T> | null { return this.selected() ?? null }

  public setSelectedIndex(index: number, notify = false): void {
    this.selectedIndex = this.clampIndex(index)
    this.update()
    if (notify) this.emitChange()
  }

  /** Replace the options while retaining the current value when possible. */
  public setOptions(options: StatusSelectOption<T>[]): void {
    const currentValue = this.selected()?.value
    this.options = options
    const preservedIndex = options.findIndex((option) => Object.is(option.value, currentValue))
    this.selectedIndex = this.clampIndex(preservedIndex >= 0 ? preservedIndex : 0)
    this.update()
  }
}
