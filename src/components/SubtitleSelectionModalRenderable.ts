import {
  BoxRenderable,
  ScrollBoxRenderable,
  TextRenderable,
  RGBA,
  type KeyEvent,
  type RenderContext,
  type Renderable,
  type RenderableOptions,
} from "@opentui/core"
import { ActionButtonRenderable } from "./ActionButtonRenderable"
import { MultiSelectRenderable } from "./MultiSelectRenderable"
import type { SubtitleTrack } from "../downloader"

export interface SubtitleSelectionModalOptions extends RenderableOptions {
  tracks: SubtitleTrack[]
  onSubmit: (tracks: SubtitleTrack[]) => void
  onCancel: () => void
}

/** Modal subtitle picker with a scrollable, mouse-friendly multi-select list. */
export class SubtitleSelectionModalRenderable extends BoxRenderable {
  private readonly selection: MultiSelectRenderable
  private readonly cancelButton: ActionButtonRenderable
  private readonly submitButton: ActionButtonRenderable
  private readonly keyHandler: (key: KeyEvent) => void
  private readonly tracks: SubtitleTrack[]
  private readonly onSubmit: (tracks: SubtitleTrack[]) => void
  private readonly onCancel: () => void

  constructor(ctx: RenderContext, options: SubtitleSelectionModalOptions) {
    const { tracks, onSubmit, onCancel, ...rest } = options

    super(ctx, {
      ...rest,
      id: rest.id ?? "subtitle-selection-modal",
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      zIndex: 100,
      alignItems: "center",
      justifyContent: "center",
      paddingX: 2,
      paddingY: 1,
      backgroundColor: RGBA.fromInts(0, 0, 0, 125),
    })

    this.tracks = tracks
    this.onSubmit = onSubmit
    this.onCancel = onCancel

    const panel = new BoxRenderable(ctx, {
      id: "subtitle-selection-panel",
      // Size against the modal's actual parent rather than ctx.height. The
      // latter includes the bottom console, while this modal lives inside the
      // smaller content area and would therefore be clipped when it was open.
      width: "100%",
      maxWidth: 90,
      height: "auto",
      maxHeight: "100%",
      border: true,
      borderStyle: "rounded",
      borderColor: RGBA.fromHex("#7FC7FF"),
      backgroundColor: RGBA.fromHex("#111827"),
      flexDirection: "column",
      padding: 1,
      gap: 0,
      focusable: true,
    })
    panel.add(new TextRenderable(ctx, {
      content: "选择可下载字幕",
      fg: RGBA.fromHex("#7FC7FF"),
      selectable: false,
    }))
    const list = new ScrollBoxRenderable(ctx, {
      id: "subtitle-selection-scroll",
      height: Math.min(12, Math.max(1, tracks.length)),
      minHeight: 1,
      flexShrink: 1,
      scrollY: true,
      scrollX: false,
      scrollbarOptions: { showArrows: false },
      border: true,
      borderColor: RGBA.fromInts(127, 199, 255, 80),
    })

    this.selection = new MultiSelectRenderable(ctx, {
      id: "subtitle-selection-list",
      items: tracks.map((track) => ({
        name: track.language,
        description: track.source === "original" ? "原始字幕" : "生成式字幕",
      })),
      width: "100%",
      onCursorChange: (index) => list.scrollChildIntoView(`multi-select-item-${index}`),
      onSelectionChange: (indices) => {
        this.submitButton.disabled = indices.length === 0
      },
    })
    list.add(this.selection)
    panel.add(list)

    const footer = new BoxRenderable(ctx, {
      width: "100%",
      height: 1,
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 1,
    })
    this.cancelButton = new ActionButtonRenderable(ctx, {
      id: "subtitle-selection-cancel",
      width: 12,
      label: "取消",
      background_color: RGBA.fromInts(220, 70, 80, 110),
      onActivate: this.onCancel,
    })
    this.submitButton = new ActionButtonRenderable(ctx, {
      id: "subtitle-selection-submit",
      width: 12,
      label: "提交",
      disabled: true,
      background_color: RGBA.fromInts(55, 150, 220, 110),
      onActivate: () => this.submit(),
    })
    footer.add(this.cancelButton)
    footer.add(this.submitButton)
    panel.add(footer)
    this.add(panel)

    this.selection.focus()
    this.keyHandler = (key) => {
      if (key.name === "escape") this.onCancel()
    }
    ctx.keyInput.on("keypress", this.keyHandler)
  }

  getFocusables(): Renderable[] {
    return [this.selection, this.cancelButton, this.submitButton]
  }

  private submit(): void {
    const indices = this.selection.getSelectedIndices()
    if (indices.length === 0) return
    this.onSubmit(indices.map((index) => this.tracks[index]!).filter(Boolean))
  }

  override destroy(): void {
    this.ctx.keyInput.off("keypress", this.keyHandler)
    super.destroy()
  }
}
