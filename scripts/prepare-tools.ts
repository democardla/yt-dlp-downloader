import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join, resolve } from "node:path"
import { targetArgument, verifyTargetBinaries, type ReleaseTarget } from "./release-targets"

interface ReleaseToolDefinition {
  asset?: string
  sha256?: string
}

interface ToolManifest {
  release?: {
    repository?: string
    tag?: string
  }
  tools?: Record<string, ReleaseToolDefinition>
}

interface GitHubReleaseAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  assets?: GitHubReleaseAsset[]
}

const DEFAULT_REPOSITORY = "democardla/yt-dlp-downloader"

function manifestPath(target: ReleaseTarget): string {
  return resolve("bin", target.id, "manifest.json")
}

function readManifest(target: ReleaseTarget): ToolManifest {
  try {
    return JSON.parse(readFileSync(manifestPath(target), "utf8")) as ToolManifest
  } catch {
    throw new Error(`缺少工具清单：${manifestPath(target)}`)
  }
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function toolFileNames(target: ReleaseTarget): Record<string, string> {
  return {
    ffmpeg: target.toolNames.ffmpeg,
    ffprobe: target.toolNames.ffprobe,
    "yt-dlp": target.toolNames.ytDlp,
  }
}

function localToolsAreReady(target: ReleaseTarget): boolean {
  try {
    verifyTargetBinaries(target)
    return true
  } catch {
    return false
  }
}

async function getRelease(repository: string, tag: string): Promise<GitHubRelease> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "yt-dlp-downloader-tool-preparer",
  }
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(
    `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    { headers },
  )
  if (!response.ok) {
    throw new Error(`无法读取 GitHub Release ${repository}@${tag}：HTTP ${response.status}`)
  }
  return await response.json() as GitHubRelease
}

async function downloadAsset(url: string, destination: string, expectedSha256: string): Promise<void> {
  const response = await fetch(url, {
    headers: { Accept: "application/octet-stream", "User-Agent": "yt-dlp-downloader-tool-preparer" },
  })
  if (!response.ok) throw new Error(`下载工具失败：HTTP ${response.status} ${url}`)

  const temporaryPath = `${destination}.download-${process.pid}`
  rmSync(temporaryPath, { force: true })
  try {
    const bytes = new Uint8Array(await response.arrayBuffer())
    writeFileSync(temporaryPath, bytes)
    const actualSha256 = sha256File(temporaryPath)
    if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new Error(`工具校验失败：${destination}，期望 ${expectedSha256}，实际 ${actualSha256}`)
    }
    copyFileSync(temporaryPath, destination)
  } finally {
    rmSync(temporaryPath, { force: true })
  }
}

/** Ensure a target's ignored binaries are available, downloading them from its Release when needed. */
export async function ensureTargetBinaries(target: ReleaseTarget): Promise<void> {
  if (localToolsAreReady(target)) return

  const manifest = readManifest(target)
  const repository = manifest.release?.repository ?? DEFAULT_REPOSITORY
  const tag = manifest.release?.tag
  if (!tag) {
    throw new Error(`工具缺失，且 ${manifestPath(target)} 没有配置 Release 标签`)
  }

  const release = await getRelease(repository, tag)
  const assets = new Map((release.assets ?? []).map((asset) => [asset.name, asset.browser_download_url]))
  const fileNames = toolFileNames(target)
  const targetDirectory = resolve("bin", target.id)
  mkdirSync(targetDirectory, { recursive: true })

  for (const [name, fileName] of Object.entries(fileNames)) {
    const definition = manifest.tools?.[name]
    const assetName = definition?.asset
    const expectedSha256 = definition?.sha256
    if (!assetName || !expectedSha256) {
      throw new Error(`工具清单缺少 ${name} 的 Release 资产名或 SHA-256：${manifestPath(target)}`)
    }
    const assetUrl = assets.get(assetName)
    if (!assetUrl) throw new Error(`Release ${repository}@${tag} 缺少资产：${assetName}`)

    const destination = join(targetDirectory, fileName)
    console.log(`下载工具：${target.id}/${fileName} ← ${repository}@${tag}`)
    await downloadAsset(assetUrl, destination, expectedSha256)
    if (!existsSync(destination) || statSync(destination).size === 0) {
      throw new Error(`工具下载后文件无效：${destination}`)
    }
  }

  verifyTargetBinaries(target)
  console.log(`工具已准备：${target.id}`)
}

if (import.meta.main) {
  try {
    await ensureTargetBinaries(targetArgument())
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
