import { BoxRenderable, ScrollBoxRenderable, TextRenderable, RGBA, type CliRenderer } from "@opentui/core"

let activePanel: ConsolePanelRenderable | null = null

export class ConsolePanelRenderable extends BoxRenderable {
  private readonly scroll: ScrollBoxRenderable
  private readonly lines: BoxRenderable[] = []

  constructor(renderer: CliRenderer, options: { height?: number; enabled?: boolean } = {}) {
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
      height: 1,
      selectable: false,
      wrapMode: "none",
      truncate: true,
      fg: RGBA.fromHex("#9CA3AF"),
    })
    const line = new BoxRenderable(this.ctx, {
      width: "100%",
      height: 1,
      flexDirection: "row",
    })
    line.add(label)
    line.add(body)
    this.lines.push(line)
    this.scroll.add(line)
    if (this.lines.length > 500) {
      const oldest = this.lines.shift()
      if (oldest) this.scroll.remove(oldest.id)
    }
    this.scroll.scrollTo({ x: 0, y: this.scroll.scrollHeight })
    this.requestRender()
  }

  public setEnabled(enabled: boolean): void { this.visible = enabled }
}

export function setAppConsoleEnabled(enabled: boolean): void { activePanel?.setEnabled(enabled) }
export function writeAppConsole(level: "log" | "warn" | "error", message: string): void { activePanel?.append(level, message) }
