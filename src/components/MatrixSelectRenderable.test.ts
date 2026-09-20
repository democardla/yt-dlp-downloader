import { afterEach, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { MatrixSelectRenderable } from "./MatrixSelectRenderable"

let renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"] | null = null

afterEach(() => {
  renderer?.destroy()
  renderer = null
})

test("wraps name-only options according to the available width", async () => {
  const setup = await createTestRenderer({ width: 60, height: 6 })
  renderer = setup.renderer
  const select = new MatrixSelectRenderable(renderer, {
    id: "formats",
    width: 14,
    options: [
      { name: "mp3", value: "mp3" },
      { name: "flac", value: "flac" },
      { name: "wav", value: "wav" },
      { name: "opus", value: "opus" },
    ],
  })
  renderer.root.add(select)
  await setup.renderOnce()

  const lines = setup.captureCharFrame().split("\n")
  expect(lines.some((line) => line.includes("mp3") && line.includes("flac") && !line.includes("wav"))).toBe(true)
  expect(select.height).toBe(2)
  const first = select.findDescendantById("formats-option-0")!
  const second = select.findDescendantById("formats-option-1")!
  expect(second.screenX - first.screenX).toBeLessThanOrEqual(8)

  select.width = 35
  await setup.renderOnce()
  expect(select.height).toBe(1)
})

test("changes the selected item with matrix-aware keyboard navigation", async () => {
  const setup = await createTestRenderer({ width: 60, height: 6 })
  renderer = setup.renderer
  const select = new MatrixSelectRenderable(renderer, {
    width: 14,
    options: ["mp3", "flac", "wav", "opus"].map((name) => ({ name, value: name })),
  })
  renderer.root.add(select)

  select.handleKeyPress({ name: "down" } as never)
  expect(select.getSelectedOption()?.value).toBe("wav")
  select.handleKeyPress({ name: "left" } as never)
  expect(select.getSelectedOption()?.value).toBe("flac")
})
