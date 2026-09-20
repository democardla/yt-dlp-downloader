import { expect, test } from "bun:test"
import { parseMacDroppedFilePath, parseMacDroppedFilePaths } from "./macos"
import { parseWindowsDroppedFilePath, parseWindowsDroppedFilePaths } from "./windows"

test("parses Finder terminal drop paths", () => {
  expect(parseMacDroppedFilePath("/Users/demo/My\\ Video.mp4 ")).toBe("/Users/demo/My Video.mp4")
  expect(parseMacDroppedFilePath("'/Users/demo/My Video.mp4' ")).toBe("/Users/demo/My Video.mp4")
  expect(parseMacDroppedFilePath("file:///Users/demo/My%20Video.mp4")).toBe("/Users/demo/My Video.mp4")
  expect(parseMacDroppedFilePaths("/Users/demo/One\\ Video.mp4 '/Users/demo/Two Video.mov'")).toEqual([
    "/Users/demo/One Video.mp4",
    "/Users/demo/Two Video.mov",
  ])
})

test("parses Explorer terminal drop paths", () => {
  expect(parseWindowsDroppedFilePath('"C:\\Users\\demo\\My Video.mp4"')).toBe("C:\\Users\\demo\\My Video.mp4")
  expect(parseWindowsDroppedFilePath("\\\\server\\share\\video.mp4")).toBe("\\\\server\\share\\video.mp4")
  expect(parseWindowsDroppedFilePath("file:///C:/Users/demo/My%20Video.mp4")).toBe("C:\\Users\\demo\\My Video.mp4")
  expect(parseWindowsDroppedFilePaths('"C:\\Media Files\\one.mp4" "D:\\Other Files\\two.mov"')).toEqual([
    "C:\\Media Files\\one.mp4",
    "D:\\Other Files\\two.mov",
  ])
})
