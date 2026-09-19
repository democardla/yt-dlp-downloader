import { BoxRenderable, ScrollBoxRenderable, TextRenderable, RGBA, type CliRenderer } from "@opentui/core"

let activePanel: ConsolePanelRenderable | null = null

export class ConsolePanelRenderable extends BoxRenderable {
  private readonly output: TextRenderable
  private readonly scroll: ScrollBoxRenderable
  private readonly lines: string[] = []

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
    this.output = new TextRenderable(renderer, { content: "控制台已就绪", fg: RGBA.fromHex("#9CA3AF") })
    this.scroll.add(this.output)
    this.add(this.scroll)
    activePanel = this
  }

  public append(level: "log" | "warn" | "error", message: string): void {
    this.lines.push(`[${level.toUpperCase()}] ${message}`)
    if (this.lines.length > 500) this.lines.shift()
    this.output.content = this.lines.join("\n")
    this.scroll.scrollTo({ x: 0, y: this.scroll.scrollHeight })
    this.requestRender()
  }

  public setEnabled(enabled: boolean): void { this.visible = enabled }
}

export function setAppConsoleEnabled(enabled: boolean): void { activePanel?.setEnabled(enabled) }
export function writeAppConsole(level: "log" | "warn" | "error", message: string): void { activePanel?.append(level, message) }
