import { afterEach, expect, test } from "bun:test"
import { ASCIIFontRenderable } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { MatrixSelectRenderable, TabBarRenderable } from "../components"
import { createAudioConversionFeature, createVideoConversionFeature } from "./ConversionUI"
import type { Toolchain } from "../runtime/Toolchain"

let renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"] | null = null

afterEach(() => {
  renderer?.destroy()
  renderer = null
})

const toolchain: Toolchain = {
  platform: "darwin",
  operatingSystem: "macos",
  ffmpegPath: "/usr/local/bin/ffmpeg",
  ffprobePath: "/usr/local/bin/ffprobe",
  ytDlpPath: null,
  ready: false,
  diagnostics: [],
  searchedDirectories: [],
}

test("renders separate video and audio conversion workspaces", async () => {
  const setup = await createTestRenderer({ width: 110, height: 28 })
  renderer = setup.renderer
  const video = createVideoConversionFeature(renderer, toolchain)
  renderer.root.add(video.root)
  await setup.renderOnce()
  let frame = setup.captureCharFrame()
  expect(frame).toContain("视频转视频")
  expect(frame).toContain("视频转音频")
  expect(frame).toContain("mp4")
  expect(frame).toContain("输出位置")
  expect(frame).not.toContain("结果保存位置")

  const mode = video.root.findDescendantById("video-conversion-mode") as TabBarRenderable<string>
  const optionsScroll = video.root.findDescendantById("video-conversion-options-scroll")
  const format = video.root.findDescendantById("video-conversion-format") as MatrixSelectRenderable<string>
  const inputMark = video.root.findDescendantById("video-conversion-input-mark") as ASCIIFontRenderable
  expect(mode.getSelectedOption()?.value).toBe("video-to-video")
  expect(mode.parent?.id).toBe("video-conversion-options")
  expect(optionsScroll).toBeDefined()
  expect(format.getSelectedOption()?.value).toBe("mp4")
  expect(inputMark.text).toBe("IN")

  renderer.root.remove(video.root.id)
  const audio = createAudioConversionFeature(renderer, toolchain)
  renderer.root.add(audio.root)
  await setup.renderOnce()
  frame = setup.captureCharFrame()
  expect(frame).toContain("mp3")
  expect(frame).toContain("flac")
  expect(frame).not.toContain("输出 MP3 文件")
})
