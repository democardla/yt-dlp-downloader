import { afterEach, expect, test } from "bun:test"
import { InputRenderable, PasteEvent } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { resolve } from "node:path"
import { ActionButtonRenderable } from "./ActionButtonRenderable"
import { FileDropInputRenderable } from "./FileDropInputRenderable"

let renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"] | null = null

afterEach(() => {
  renderer?.destroy()
  renderer = null
})

test("normalizes a Windows Explorer path received as terminal paste", async () => {
  const setup = await createTestRenderer({ width: 60, height: 5 })
  renderer = setup.renderer
  const input = new FileDropInputRenderable(renderer, { platform: "win32" })
  renderer.root.add(input)
  input.handlePaste(new PasteEvent(new TextEncoder().encode('"C:\\Media Files\\clip.mp4"')))
  expect(input.value).toBe("C:\\Media Files\\clip.mp4")
})

test("normalizes a Finder drop received as a regular terminal input stream", async () => {
  const setup = await createTestRenderer({ width: 60, height: 5 })
  renderer = setup.renderer
  const input = new FileDropInputRenderable(renderer, { platform: "darwin" })
  renderer.root.add(input)
  input.insertText("/Users/demo/Media\\ Files/clip.mp4")
  await Bun.sleep(40)
  expect(input.value).toBe("/Users/demo/Media Files/clip.mp4")
})

test("captures a real Finder file drop even when another control owns focus", async () => {
  const setup = await createTestRenderer({ width: 80, height: 5 })
  renderer = setup.renderer
  const input = new FileDropInputRenderable(renderer, { platform: "darwin" })
  const otherControl = new InputRenderable(renderer, { value: "keep me" })
  renderer.root.add(input)
  renderer.root.add(otherControl)
  otherControl.focus()

  const filePath = resolve(import.meta.dir, "FileDropInputRenderable.test.ts")
  renderer.keyInput.processPaste(new TextEncoder().encode(filePath))

  expect(input.value).toBe(filePath)
  expect(input.focused).toBe(true)
  expect(otherControl.value).toBe("keep me")
})

test("adds multiple files and supports per-item and clear-all actions", async () => {
  const setup = await createTestRenderer({ width: 50, height: 8 })
  renderer = setup.renderer
  const input = new FileDropInputRenderable(renderer, {
    id: "files",
    platform: "darwin",
  })
  renderer.root.add(input)

  input.handlePaste(new PasteEvent(new TextEncoder().encode(
    "/Users/demo/One\\ Video.mp4 '/Users/demo/Two Video.mov'",
  )))
  expect(input.getPaths()).toEqual([
    "/Users/demo/One Video.mp4",
    "/Users/demo/Two Video.mov",
  ])

  const removeFirst = input.findDescendantById("files-remove-0") as ActionButtonRenderable
  removeFirst.handleKeyPress({ name: "space" } as never)
  expect(input.getPaths()).toEqual(["/Users/demo/Two Video.mov"])

  const clearAll = input.findDescendantById("files-clear-all") as ActionButtonRenderable
  clearAll.handleKeyPress({ name: "space" } as never)
  expect(input.getPaths()).toEqual([])
})

test("truncates long file names inside the available row width", async () => {
  const setup = await createTestRenderer({ width: 28, height: 6 })
  renderer = setup.renderer
  const input = new FileDropInputRenderable(renderer, {
    id: "files",
    platform: "darwin",
  })
  renderer.root.add(input)
  input.addPaths(["/tmp/a-very-long-video-file-name-that-cannot-fit.mp4"])
  await setup.renderOnce()

  expect(setup.captureCharFrame()).not.toContain("a-very-long-video-file-name-that-cannot-fit.mp4")
})

test("shows and keeps a per-file output directory", async () => {
  const setup = await createTestRenderer({ width: 100, height: 8 })
  renderer = setup.renderer
  const input = new FileDropInputRenderable(renderer, {
    id: "files",
    platform: "darwin",
    outputPath: "/tmp/output",
  })
  renderer.root.add(input)
  input.addPaths(["/Users/demo/clip.mp4"])

  expect(input.getOutputPath("/Users/demo/clip.mp4")).toBe("/tmp/output")
  input.setOutputPath("/Users/demo/clip.mp4", "/tmp/custom-output")
  expect(input.getOutputPath("/Users/demo/clip.mp4")).toBe("/tmp/custom-output")
  input.setOutputResult("/Users/demo/clip.mp4", "/tmp/custom-output/clip.mp4")
  await setup.renderOnce()
  expect(setup.captureCharFrame()).toContain("[单击查看]")
})
