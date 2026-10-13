import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { AppPaths } from "./AppPaths"
import { resolveToolchain } from "./Toolchain"

function readVersion(paths: AppPaths): string {
  for (const candidate of [
    join(paths.resourcesDir, "BUILD-INFO.json"),
    join(paths.resourcesDir, "package.json"),
    join(paths.resourcesDir, "..", "package.json"),
  ]) {
    try {
      const value = JSON.parse(readFileSync(candidate, "utf8")) as { version?: unknown }
      if (typeof value.version === "string" && value.version) return value.version
    } catch {
      // Try the next embedded or development metadata file.
    }
  }
  return "unknown"
}

export async function handleCliCommand(args: readonly string[], paths: AppPaths): Promise<number | null> {
  if (args.includes("--version")) {
    console.log(`yt-dlp-downloader ${readVersion(paths)}`)
    return 0
  }

  if (args.includes("--print-paths")) {
    console.log(JSON.stringify(paths, null, 2))
    return 0
  }

  if (!args.includes("--doctor")) return null

  const toolchain = await resolveToolchain(paths)
  console.log(`mode: ${paths.mode}`)
  console.log(`target: ${paths.target}`)
  console.log(`resources: ${paths.resourcesDir}`)
  console.log(`bin: ${paths.binDir}`)
  console.log(`config: ${paths.configFile}`)
  console.log(`history: ${paths.historyFile}`)
  console.log(`ffmpeg: ${toolchain.ffmpegPath ?? "missing"}`)
  console.log(`ffprobe: ${toolchain.ffprobePath ?? "missing"}`)
  console.log(`yt-dlp: ${toolchain.ytDlpPath ?? "missing"}`)
  for (const diagnostic of toolchain.diagnostics) console.error(diagnostic)
  return toolchain.ready ? 0 : 1
}
