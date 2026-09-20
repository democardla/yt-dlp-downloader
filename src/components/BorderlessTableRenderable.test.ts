import { afterEach, expect, test } from "bun:test"
import { TextRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { BorderlessTableRenderable } from "./BorderlessTableRenderable"

let renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"] | null = null

afterEach(() => {
  renderer?.destroy()
  renderer = null
})

test("renders arbitrary cells in borderless columns and can replace a cell", async () => {
  const setup = await createTestRenderer({ width: 60, height: 8 })
  renderer = setup.renderer
  const table = new BorderlessTableRenderable(renderer, {
    id: "table",
    height: 5,
    columns: [
      { id: "name", title: "文件名称", flexGrow: 1 },
      { id: "status", title: "状态", width: 15 },
      { id: "clear", title: "", width: 10 },
    ],
  })
  table.addRow({
    id: "row-1",
    cells: [
      new TextRenderable(renderer, { content: "clip.mp4", selectable: false }),
      new TextRenderable(renderer, { content: "就绪", selectable: false }),
      new TextRenderable(renderer, { content: "清除", selectable: false }),
    ],
  })
  renderer.root.add(table)
  await setup.renderOnce()

  expect(setup.captureCharFrame()).toContain("文件名称")
  expect(setup.captureCharFrame()).toContain("clip.mp4")
  expect(setup.captureCharFrame()).not.toContain("┌")
  table.replaceCell("row-1", 1, new TextRenderable(renderer, { content: "等待", selectable: false }))
  await setup.renderOnce()
  expect(setup.captureCharFrame()).toContain("等待")
})
