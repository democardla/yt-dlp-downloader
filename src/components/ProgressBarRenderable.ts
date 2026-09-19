import {
  TextRenderable,
  type RenderContext,
  type TextOptions,
} from "@opentui/core"

export class ProgressBarRenderable extends TextRenderable {
  private barWidth: number
  private _percent: number
  private _label: string

  constructor(
    ctx: RenderContext,
    opts: TextOptions & { width?: number; percent?: number; label?: string } = {}
  ) {
    const { width = 30, percent = 0, label = "", ...rest } = opts
    const content = ProgressBarRenderable.buildContent(width, percent, label)
    super(ctx, { content, ...rest })
    this.barWidth = Math.max(0, Math.floor(width))
    this._percent = Math.max(0, Math.min(100, Math.round(percent)))
    this._label = label
  }

  private static buildContent(width: number, percent: number, label: string) {
    const w = Math.max(0, Math.floor(width))
    const p = Math.max(0, Math.min(100, Math.round(percent)))
    const filled = Math.round((w * p) / 100)
    const bar = "█".repeat(filled) + "░".repeat(Math.max(0, w - filled))
    return `${label ? label + " " : ""}${bar} ${p}%`
  }

  private updateContent() {
    this.content = ProgressBarRenderable.buildContent(this.barWidth, this._percent, this._label)
    this.requestRender()
  }

  set percent(v: number) {
    const p = Math.max(0, Math.min(100, Math.round(v)))
    if (p === this._percent) return
    this._percent = p
    this.updateContent()
  }
  get percent() {
    return this._percent
  }

  override set width(v: number) {
    const w = Math.max(0, Math.floor(v))
    if (w === this.barWidth) return
    this.barWidth = w
    this.updateContent()
  }
  override get width() {
    return this.barWidth
  }

  set label(v: string) {
    if (v === this._label) return
    this._label = v
    this.updateContent()
  }
  get label() {
    return this._label
  }
}

// Use setters to update `percent`, `width` or `label` at runtime.
