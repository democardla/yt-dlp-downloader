import { expect, test } from "bun:test"
import { normalizeDownloadHistoryEntries } from "./DownloadHistory"

test("normalizes legacy path history and current task metadata", () => {
  const entries = normalizeDownloadHistoryEntries([
    "/tmp/video.mp4",
    { filePath: "/tmp/subtitle.srt", source: "字幕下载", processedAt: "2026-09-20T10:00:00.000Z" },
    { path: "/tmp/video.mp4", source: "重复记录", processedAt: "2026-09-20T11:00:00.000Z" },
  ])

  expect(entries).toEqual([
    { filePath: "/tmp/video.mp4", source: "下载器", processedAt: "" },
    { filePath: "/tmp/subtitle.srt", source: "字幕下载", processedAt: "2026-09-20T10:00:00.000Z" },
  ])
})
