import { TextRenderable, type KeyEvent, type RenderContext, type RenderableOptions, RGBA } from "@opentui/core"

export interface ActionButtonOptions extends RenderableOptions {
  label: string
  onActivate: () => void
  /** Normal button background. Kept snake_case for configuration-style callers. */
  background_color?: string | RGBA
  disabled?: boolean
}

/** Small keyboard- and mouse-friendly action button for configuration panels. */
export class ActionButtonRenderable extends TextRenderable {
  private readonly onActivate: () => void
  private normalBackground: string | RGBA
  private hovered = false
  private pressed = false
  private pointerDown = false
  private _disabled: boolean

  constructor(ctx: RenderContext, options: ActionButtonOptions) {
    const { label, onActivate, background_color, disabled = false, ...rest } = options
    super(ctx, {
      ...rest,
      height: rest.height ?? 1,
      content: label,
      fg: RGBA.fromHex("#8BE9FD"),
      bg: background_color ?? RGBA.fromInts(55, 150, 220, 55),
      selectable: false,
      wrapMode: "none",
      truncate: true,
    })
    this.focusable = true
    this.onActivate = onActivate
    this.normalBackground = background_color ?? RGBA.fromInts(55, 150, 220, 55)
    this._disabled = disabled
    this.updateAppearance()

    this.onMouseOver = () => {
      if (this._disabled) return
      this.hovered = true
      this.updateAppearance()
    }
    this.onMouseOut = () => {
      this.hovered = false
      this.updateAppearance()
    }
    this.onMouseDown = () => {
      if (this._disabled) return
      this.pointerDown = true
      this.pressed = true
      this.updateAppearance()
    }
    this.onMouseUp = () => {
      if (this._disabled) return
      const shouldActivate = this.pointerDown
      this.pointerDown = false
      this.pressed = false
      this.updateAppearance()
      if (shouldActivate) this.activate()
    }
  }

  setLabel(label: string): void {
    this.content = label
    this.requestRender()
  }

  set disabled(value: boolean) {
    this._disabled = value
    this.pointerDown = false
    this.pressed = false
    this.updateAppearance()
  }

  get disabled(): boolean {
    return this._disabled
  }

  set background_color(value: string | RGBA) {
    this.normalBackground = value
    this.updateAppearance()
  }

  get background_color(): string | RGBA {
    return this.normalBackground
  }

  private activate(): void {
    if (this._disabled) return
    this.onActivate()
  }

  private updateAppearance(): void {
    if (this._disabled) {
      this.fg = RGBA.fromHex("#6B7280")
      this.bg = RGBA.fromInts(75, 85, 99, 100)
    } else if (this.pressed) {
      this.fg = RGBA.fromHex("#FFFFFF")
      this.bg = RGBA.fromInts(35, 110, 175, 210)
    } else if (this.hovered) {
      this.fg = RGBA.fromHex("#FFFFFF")
      this.bg = RGBA.fromInts(55, 150, 220, 150)
    } else {
      this.fg = RGBA.fromHex("#8BE9FD")
      this.bg = this.normalBackground
    }
    this.requestRender()
  }

  override handleKeyPress(key: KeyEvent): boolean {
    if (this._disabled) return false
    if (key.name === "return" || key.name === "space") {
      this.activate()
      return true
    }
    return false
  }
}
