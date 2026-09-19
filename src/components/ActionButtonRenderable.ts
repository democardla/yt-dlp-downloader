import { TextRenderable, type KeyEvent, type RenderContext, type RenderableOptions, RGBA } from "@opentui/core"

export interface ActionButtonOptions extends RenderableOptions {
  label: string
  onActivate: () => void
}

/** Small keyboard- and mouse-friendly action button for configuration panels. */
export class ActionButtonRenderable extends TextRenderable {
  private readonly onActivate: () => void

  constructor(ctx: RenderContext, options: ActionButtonOptions) {
    const { label, onActivate, ...rest } = options
    super(ctx, {
      ...rest,
      height: rest.height ?? 1,
      content: label,
      fg: RGBA.fromHex("#8BE9FD"),
      selectable: false,
      wrapMode: "none",
      truncate: true,
    })
    this.focusable = true
    this.onActivate = onActivate
    this.onMouseDown = () => this.activate()
  }

  setLabel(label: string): void {
    this.content = label
    this.requestRender()
  }

  private activate(): void {
    this.onActivate()
  }

  override handleKeyPress(key: KeyEvent): boolean {
    if (key.name === "return" || key.name === "space") {
      this.activate()
      return true
    }
    return false
  }
}
