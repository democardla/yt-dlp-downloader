// components/CustomSpinnerRenderable.ts
import {
  TextRenderable,
  type RenderContext,
  type TextOptions,
  RGBA,
} from "@opentui/core"

export class CustomSpinnerRenderable extends TextRenderable {
  private frames: string[]
  private idx = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private _label = ""

  constructor(
    ctx: RenderContext,
    opts: TextOptions & { frames?: string[]; interval?: number; label?: string } = {}
  ) {
    const {
      frames = ["◐","◓","◑","◒"],
      interval = 100,
      label = "",
      ...rest
    } = opts
    super(ctx, { content: frames[0] + " " + label, ...rest })
    this.frames = frames
    this._label = label
    this.start(interval)
  }

  start(interval: number) {
    this.timer = setInterval(() => {
      this.idx = (this.idx + 1) % this.frames.length
      this.content = `${this.frames[this.idx]} ${this._label}`
    }, interval)
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  set label(v: string) { this._label = v; this.requestRender() }
}