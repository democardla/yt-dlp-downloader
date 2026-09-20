import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { parseOutputPathLine } from "./downloader"

test("parses final media and subtitle-only output paths", () => {
  expect(parseOutputPathLine("FILEPATH /tmp/video.mp4")).toBe(resolve("/tmp/video.mp4"))
  expect(parseOutputPathLine("[info] Writing video subtitles to: /tmp/video.ai-zh.srt"))
    .toBe(resolve("/tmp/video.ai-zh.srt"))
  expect(parseOutputPathLine("[download] 100% of 10.00MiB")).toBeNull()
})
