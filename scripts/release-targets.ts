import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { getRuntimeTarget } from "../src/runtime/AppPaths"

export type ReleaseTargetId = "win32-x64" | "darwin-x64" | "darwin-arm64" | "linux-x64" | "linux-arm64"

export interface ReleaseTarget {
  id: ReleaseTargetId
  bunTarget: string
  executableName: string
  toolNames: {
    ffmpeg: string
    ffprobe: string
    ytDlp: string
  }
}

export interface VerifiedBinary {
  name: "ffmpeg" | "ffprobe" | "yt-dlp"
  fileName: string
  path: string
  size: number
  sha256: string
}

interface ToolManifest {
  tools?: Record<string, { sha256?: string }>
}

const UNIX_TOOLS = { ffmpeg: "ffmpeg", ffprobe: "ffprobe", ytDlp: "yt-dlp" } as const
const WINDOWS_TOOLS = { ffmpeg: "ffmpeg.exe", ffprobe: "ffprobe.exe", ytDlp: "yt-dlp.exe" } as const

export const RELEASE_TARGETS: Record<ReleaseTargetId, ReleaseTarget> = {
  "win32-x64": {
    id: "win32-x64",
    bunTarget: "bun-windows-x64",
    executableName: "YT-DLP-Downloader.exe",
    toolNames: WINDOWS_TOOLS,
  },
  "darwin-x64": {
    id: "darwin-x64",
    bunTarget: "bun-darwin-x64",
    executableName: "yt-dlp-downloader",
    toolNames: UNIX_TOOLS,
  },
  "darwin-arm64": {
    id: "darwin-arm64",
    bunTarget: "bun-darwin-arm64",
    executableName: "yt-dlp-downloader",
    toolNames: UNIX_TOOLS,
  },
  "linux-x64": {
    id: "linux-x64",
    bunTarget: "bun-linux-x64",
    executableName: "yt-dlp-downloader",
    toolNames: UNIX_TOOLS,
  },
  "linux-arm64": {
    id: "linux-arm64",
    bunTarget: "bun-linux-arm64",
    executableName: "yt-dlp-downloader",
    toolNames: UNIX_TOOLS,
  },
}

export function targetArgument(args: string[] = Bun.argv.slice(2)): ReleaseTarget {
  const targetIndex = args.indexOf("--target")
  const requested = targetIndex >= 0 ? args[targetIndex + 1] : getRuntimeTarget()
  const target = requested ? RELEASE_TARGETS[requested as ReleaseTargetId] : undefined
  if (!target) {
    throw new Error(`不支持的发布目标：${requested ?? "未指定"}。可用目标：${Object.keys(RELEASE_TARGETS).join(", ")}`)
  }
  return target
}

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

export function verifyTargetBinaries(target: ReleaseTarget): VerifiedBinary[] {
  const sourceDirectory = resolve("bin", target.id)
  let manifest: ToolManifest = {}
  try {
    manifest = JSON.parse(readFileSync(join(sourceDirectory, "manifest.json"), "utf8")) as ToolManifest
  } catch {
    // A manifest is recommended for releases but file validation still works
    // while a new platform package is being prepared.
  }
  const entries = [
    ["ffmpeg", target.toolNames.ffmpeg],
    ["ffprobe", target.toolNames.ffprobe],
    ["yt-dlp", target.toolNames.ytDlp],
  ] as const

  return entries.map(([name, fileName]) => {
    const path = join(sourceDirectory, fileName)
    let stats
    try {
      stats = statSync(path)
    } catch {
      throw new Error(`缺少 ${target.id} 工具：${path}`)
    }
    if (!stats.isFile() || stats.size === 0) throw new Error(`工具文件无效：${path}`)
    const sha256 = hashFile(path)
    const expectedHash = manifest.tools?.[name]?.sha256?.toLowerCase()
    if (expectedHash && expectedHash !== sha256) {
      throw new Error(`${name} 校验失败：期望 ${expectedHash}，实际 ${sha256}`)
    }
    return { name, fileName, path, size: stats.size, sha256 }
  })
}
