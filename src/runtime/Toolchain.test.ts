import { afterAll, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolveAppPaths } from "./AppPaths"
import { resolveToolchain } from "./Toolchain"

const fixtureRoot = mkdtempSync(join(tmpdir(), "yt-dlp-toolchain-"))
afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }))

function toolFileName(name: "ffmpeg" | "ffprobe" | "yt-dlp"): string {
  return process.platform === "win32" ? `${name}.exe` : name
}

function createTool(directory: string, name: "ffmpeg" | "ffprobe" | "yt-dlp"): string {
  mkdirSync(directory, { recursive: true })
  const path = join(directory, toolFileName(name))
  writeFileSync(path, "fixture", "utf8")
  if (process.platform !== "win32") chmodSync(path, 0o755)
  return path
}

test("resolves every required tool exclusively from the application bin directory", async () => {
  const binDir = join(fixtureRoot, "complete-bin")
  const ffmpegPath = createTool(binDir, "ffmpeg")
  const ffprobePath = createTool(binDir, "ffprobe")
  const ytDlpPath = createTool(binDir, "yt-dlp")
  const paths = resolveAppPaths({ packaged: true, executablePath: join(fixtureRoot, "app", "app.exe") })
  paths.binDir = binDir

  const toolchain = await resolveToolchain(paths)
  expect(toolchain.ffmpegPath).toBe(ffmpegPath)
  expect(toolchain.ffprobePath).toBe(ffprobePath)
  expect(toolchain.ytDlpPath).toBe(ytDlpPath)
  expect(toolchain.searchedDirectories).toEqual([binDir])
  expect(toolchain.ready).toBe(true)
})

test("does not fall back to environment variables or PATH", async () => {
  const emptyBin = join(fixtureRoot, "empty-bin")
  const externalBin = join(fixtureRoot, "external-bin")
  mkdirSync(emptyBin, { recursive: true })
  createTool(externalBin, "ffmpeg")
  createTool(externalBin, "ffprobe")
  createTool(externalBin, "yt-dlp")

  const paths = resolveAppPaths({
    packaged: true,
    executablePath: join(fixtureRoot, "app", "app.exe"),
    environment: {
      ...process.env,
      PATH: externalBin,
      FFMPEG_PATH: externalBin,
      FFPROBE_PATH: externalBin,
      YTDLP_PATH: externalBin,
    },
  })
  paths.binDir = emptyBin
  const toolchain = await resolveToolchain(paths)
  expect(toolchain.ready).toBe(false)
  expect(toolchain.ffmpegPath).toBeNull()
  expect(toolchain.ffprobePath).toBeNull()
  expect(toolchain.ytDlpPath).toBeNull()
  expect(toolchain.searchedDirectories).toEqual([emptyBin])
})
