import { expect, test } from "bun:test"
import { dirname, join, resolve } from "node:path"
import { getRuntimeTarget, resolveAppPaths } from "./AppPaths"

test("keeps source mode data inside the legacy development directory", () => {
  const workingDirectory = resolve("test-workspace")
  const sourceRoot = resolve("test-source")
  const paths = resolveAppPaths({
    workingDirectory,
    sourceRoot,
    executablePath: join(resolve("runtime"), process.platform === "win32" ? "bun.exe" : "bun"),
    packaged: false,
  })

  expect(paths.mode).toBe("development")
  expect(paths.configFile).toBe(join(workingDirectory, "yt-dlp-downloader", "config.json"))
  expect(paths.historyFile).toBe(join(workingDirectory, "yt-dlp-downloader", "download-history.json"))
  expect(paths.binDir).toBe(join(sourceRoot, "bin", getRuntimeTarget()))
})

test("uses app-local resources and user-data in portable packaged mode", () => {
  const executablePath = join(resolve("portable-app"), process.platform === "win32" ? "YT-DLP-Downloader.exe" : "yt-dlp-downloader")
  const paths = resolveAppPaths({
    executablePath,
    workingDirectory: resolve("unrelated-working-directory"),
    environment: { ...process.env, YTDLP_DOWNLOADER_PORTABLE: "1" },
    packaged: true,
  })

  expect(paths.mode).toBe("packaged")
  expect(paths.resourcesDir).toBe(dirname(executablePath))
  expect(paths.configDir).toBe(join(dirname(executablePath), "user-data"))
  expect(paths.dataDir).toBe(join(dirname(executablePath), "user-data"))
  expect(paths.binDir).toBe(join(dirname(executablePath), "bin"))
})

test("accepts explicit resource, bin, config and data directories from a launcher", () => {
  const resourcesDir = resolve("bundle-resources")
  const binDir = resolve("bundle-tools")
  const configDir = resolve("bundle-config")
  const dataDir = resolve("bundle-data")
  const paths = resolveAppPaths({
    executablePath: join(resolve("bundle"), "yt-dlp-downloader"),
    environment: {
      ...process.env,
      YTDLP_DOWNLOADER_RESOURCES: resourcesDir,
      YTDLP_DOWNLOADER_BIN: binDir,
      YTDLP_DOWNLOADER_CONFIG_DIR: configDir,
      YTDLP_DOWNLOADER_DATA_DIR: dataDir,
    },
    packaged: true,
  })

  expect(paths.resourcesDir).toBe(resourcesDir)
  expect(paths.binDir).toBe(binDir)
  expect(paths.configFile).toBe(join(configDir, "config.json"))
  expect(paths.historyFile).toBe(join(dataDir, "download-history.json"))
})
