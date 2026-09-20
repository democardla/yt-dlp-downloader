import { afterEach, expect, test } from "bun:test"
import { BoxRenderable, type Renderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { ActionButtonRenderable } from "./ActionButtonRenderable"
import { SubtitleSelectionModalRenderable } from "./SubtitleSelectionModalRenderable"

let renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"] | null = null

afterEach(() => {
  renderer?.destroy()
  renderer = null
})

test("fits above an expanded console and exposes a working cancel button", async () => {
  const testSetup = await createTestRenderer({ width: 80, height: 24 })
  renderer = testSetup.renderer

  const app = new BoxRenderable(renderer, {
    width: "100%",
    height: "100%",
    flexDirection: "column",
  })
  const topBar = new BoxRenderable(renderer, { width: "100%", height: 1 })
  const content = new BoxRenderable(renderer, { width: "100%", flexGrow: 1 })
  const consolePanel = new BoxRenderable(renderer, { width: "100%", height: 7 })
  let cancelled = false
  const modal = new SubtitleSelectionModalRenderable(renderer, {
    tracks: [
      { language: "ai-zh", source: "original" },
      { language: "en", source: "generated" },
    ],
    onSubmit: () => {},
    onCancel: () => {
      cancelled = true
    },
  })

  content.add(modal)
  app.add(topBar)
  app.add(content)
  app.add(consolePanel)
  renderer.root.add(app)
  await testSetup.renderOnce()

  const panel = modal.findDescendantById("subtitle-selection-panel") as Renderable
  const cancel = modal.findDescendantById("subtitle-selection-cancel") as ActionButtonRenderable
  expect(panel.height).toBeLessThanOrEqual(content.height)
  expect(panel.screenY + panel.height).toBeLessThanOrEqual(content.screenY + content.height)
  const frame = testSetup.captureCharFrame()
  expect(frame).toContain("选择可下载字幕")
  expect(frame).toContain("ai-zh")
  expect(frame).toContain("取消")
  expect(frame).toContain("提交")

  cancel.handleKeyPress({ name: "space" } as never)
  expect(cancelled).toBe(true)
})
