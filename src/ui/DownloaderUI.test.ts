import { afterEach, expect, test } from "bun:test"
import { BoxRenderable, InputRenderable, type Renderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { ActionButtonRenderable } from "../components/ActionButtonRenderable"
import { createDownloaderFeature } from "./DownloaderUI"
import type { Toolchain } from "../runtime/Toolchain"

let renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"] | null = null

afterEach(() => {
  renderer?.destroy()
  renderer = null
})

test("keeps a long URL inside the config panel and renders a download button", async () => {
  const testSetup = await createTestRenderer({ width: 100, height: 30 })
  renderer = testSetup.renderer
  const toolchain: Toolchain = {
    platform: "darwin",
    operatingSystem: "macos",
    ffmpegPath: null,
    ffprobePath: null,
    ytDlpPath: null,
    ready: false,
    diagnostics: ["test toolchain unavailable"],
    searchedDirectories: [],
  }
  const app = new BoxRenderable(renderer, {
    width: "100%",
    height: "100%",
    flexDirection: "column",
  })
  const content = new BoxRenderable(renderer, { width: "100%", flexGrow: 1 })
  const consolePanel = new BoxRenderable(renderer, { width: "100%", height: 7 })
  const feature = createDownloaderFeature(renderer, toolchain)
  content.add(feature.root)
  app.add(content)
  app.add(consolePanel)
  renderer.root.add(app)

  const input = feature.root.findDescendantById("url-input") as InputRenderable
  const leftPanel = feature.root.findDescendantById("left-panel") as Renderable
  const downloadButton = feature.root.findDescendantById("start-download") as ActionButtonRenderable
  input.value = `https://example.com/watch?${"very-long-query=".repeat(20)}`
  await testSetup.renderOnce()

  expect(input.width).toBeLessThan(leftPanel.width)
  expect(input.screenX + input.width).toBeLessThanOrEqual(leftPanel.screenX + leftPanel.width)
  expect(downloadButton.screenY).toBe(input.screenY)
  expect(downloadButton.screenX).toBeGreaterThanOrEqual(input.screenX + input.width)
  expect(testSetup.captureCharFrame()).toContain("开始下载")
  expect(feature.getFocusables()).toContain(downloadButton)
})
