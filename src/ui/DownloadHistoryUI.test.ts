import { afterEach, expect, test } from "bun:test"
import { BoxRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { createDownloadHistoryFeature } from "./DownloadHistoryUI"

let renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"] | null = null

afterEach(() => {
  renderer?.destroy()
  renderer = null
})

test("renders history metadata in a clickable four-column table", async () => {
  const setup = await createTestRenderer({ width: 90, height: 12 })
  renderer = setup.renderer
  const feature = createDownloadHistoryFeature(renderer, () => [{
    filePath: "/tmp/a-very-long-video-name.mp4",
    source: "视频转视频",
    processedAt: "2026-09-20T10:00:00.000Z",
  }])
  const app = new BoxRenderable(renderer, { width: "100%", height: "100%" })
  app.add(feature.root)
  renderer.root.add(app)
  await setup.renderOnce()

  const table = feature.root.findDescendantById("download-history-table") as unknown as { getRowCount(): number; getRow(id: string): { getChildren(): unknown[] } | null }
  expect(setup.captureCharFrame()).toContain("文件名")
  expect(setup.captureCharFrame()).toContain("视频转视频")
  expect(setup.captureCharFrame()).toContain("状态")
  expect(setup.captureCharFrame()).toContain("找不到")
  expect(table.getRowCount()).toBe(1)
  expect(table.getRow("history-row-0")?.getChildren()).toHaveLength(4)
})
