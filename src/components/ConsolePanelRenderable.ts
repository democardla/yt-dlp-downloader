import { BoxRenderable, ScrollBoxRenderable, TextRenderable, RGBA, type CliRenderer } from "@opentui/core"

let activePanel: ConsolePanelRenderable | null = null

export class ConsolePanelRenderable extends BoxRenderable {
  private readonly scroll: ScrollBoxRenderable
  private readonly lines: Array<{ container: BoxRenderable; body: TextRenderable }> = []
  private truncate = false

  constructor(renderer: CliRenderer, options: { height?: number; enabled?: boolean; truncate?: boolean } = {}) {
    super(renderer, {
      id: "app-console",
      height: options.height ?? 7,
      border: true,
      title: " 控制台 ",
      titleAlignment: "center",
      flexDirection: "column",
      paddingX: 1,
      visible: options.enabled ?? true,
    })
    this.truncate = options.truncate ?? false
    this.scroll = new ScrollBoxRenderable(renderer, {
      flexGrow: 1,
      scrollY: true,
      scrollX: false,
      stickyScroll: true,
      scrollbarOptions: { showArrows: false },
    })
    this.add(this.scroll)
    this.append("log", "控制台已就绪")
    activePanel = this
  }

  public append(level: "log" | "warn" | "error", message: string): void {
    const label = new TextRenderable(this.ctx, {
      content: `[${level.toUpperCase()}]`,
      width: 7,
      height: 1,
      selectable: false,
      wrapMode: "none",
      fg: level === "warn"
        ? RGBA.fromHex("#FACC15")
        : level === "error"
          ? RGBA.fromHex("#EF4444")
          : RGBA.fromHex("#9CA3AF"),
    })
    const body = new TextRenderable(this.ctx, {
      content: ` ${message}`,
      flexGrow: 1,
      selectable: false,
      wrapMode: this.truncate ? "none" : "char",
      truncate: this.truncate,
      fg: RGBA.fromHex("#9CA3AF"),
    })
    const line = new BoxRenderable(this.ctx, {
      width: "100%",
      flexDirection: "row",
      alignItems: "flex-start",
    })
    line.add(label)
    line.add(body)
    this.lines.push({ container: line, body })
    this.scroll.add(line)
    if (this.lines.length > 500) {
      const oldest = this.lines.shift()
      if (oldest) this.scroll.remove(oldest.container.id)
    }
    this.scroll.scrollTo({ x: 0, y: this.scroll.scrollHeight })
    this.requestRender()
  }

  public setTruncate(truncate: boolean): void {
    this.truncate = truncate
    for (const line of this.lines) {
      line.body.wrapMode = truncate ? "none" : "char"
      line.body.truncate = truncate
    }
    this.requestRender()
  }

  public setEnabled(enabled: boolean): void { this.visible = enabled }
}

export function setAppConsoleEnabled(enabled: boolean): void { activePanel?.setEnabled(enabled) }
export function setAppConsoleTruncate(truncate: boolean): void { activePanel?.setTruncate(truncate) }
export function writeAppConsole(level: "log" | "warn" | "error", message: string): void { activePanel?.append(level, message) }
