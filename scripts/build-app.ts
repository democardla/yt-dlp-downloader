import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { targetArgument, verifyTargetBinaries, type ReleaseTarget } from "./release-targets"
import { ensureTargetBinaries } from "./prepare-tools"

interface PackageLayout {
  packageRoot: string
  executablePath: string
  binDirectory: string
  resourcesDirectory: string
}

function packageLayout(target: ReleaseTarget): PackageLayout {
  const targetRoot = resolve("dist", "apps", target.id)
  if (target.id.startsWith("darwin-")) {
    const packageRoot = join(targetRoot, "YT-DLP Downloader.app")
    const resourcesDirectory = join(packageRoot, "Contents", "Resources")
    return {
      packageRoot,
      executablePath: join(resourcesDirectory, "app", target.executableName),
      binDirectory: join(resourcesDirectory, "bin"),
      resourcesDirectory,
    }
  }
  if (target.id.startsWith("linux-")) {
    const packageRoot = join(targetRoot, "YT-DLP-Downloader.AppDir")
    const resourcesDirectory = join(packageRoot, "usr", "lib", "yt-dlp-downloader")
    return {
      packageRoot,
      executablePath: join(packageRoot, "usr", "bin", target.executableName),
      binDirectory: join(resourcesDirectory, "bin"),
      resourcesDirectory,
    }
  }

  const packageRoot = join(targetRoot, "YT-DLP-Downloader")
  return {
    packageRoot,
    executablePath: join(packageRoot, target.executableName),
    binDirectory: join(packageRoot, "bin"),
    resourcesDirectory: packageRoot,
  }
}

function compileApplication(target: ReleaseTarget, outputPath: string): void {
  mkdirSync(dirname(outputPath), { recursive: true })
  const result = Bun.spawnSync([
    process.execPath,
    "build",
    "--compile",
    `--target=${target.bunTarget}`,
    "./src/index.ts",
    `--outfile=${outputPath}`,
  ], { stdout: "inherit", stderr: "inherit" })
  if (result.exitCode !== 0) throw new Error(`Bun 编译失败，退出码 ${result.exitCode}`)
}

function copyTools(target: ReleaseTarget, binDirectory: string): ReturnType<typeof verifyTargetBinaries> {
  const binaries = verifyTargetBinaries(target)
  mkdirSync(binDirectory, { recursive: true })
  for (const binary of binaries) {
    const destination = join(binDirectory, binary.fileName)
    copyFileSync(binary.path, destination)
    if (!target.id.startsWith("win32-")) chmodSync(destination, 0o755)
  }
  return binaries
}

function copyIfPresent(source: string, destination: string): void {
  if (!existsSync(source)) return
  cpSync(source, destination, { recursive: true })
}

function packagePlatformFiles(target: ReleaseTarget, layout: PackageLayout, version: string): void {
  if (target.id.startsWith("darwin-")) {
    const contents = join(layout.packageRoot, "Contents")
    const launcher = join(contents, "MacOS", "launcher")
    mkdirSync(dirname(launcher), { recursive: true })
    copyFileSync(resolve("packaging", "macos", "launcher"), launcher)
    chmodSync(launcher, 0o755)
    const shortVersion = version.match(/^\d+(?:\.\d+){0,2}/)?.[0] ?? "0.1.0"
    const buildVersion = version.match(/(?:beta\.|\+)(\d+)/i)?.[1] ?? "1"
    const info = readFileSync(resolve("packaging", "macos", "Info.plist"), "utf8")
      .replaceAll("__SHORT_VERSION__", shortVersion)
      .replaceAll("__BUILD_VERSION__", buildVersion)
    writeFileSync(join(contents, "Info.plist"), info, "utf8")
    return
  }

  if (target.id.startsWith("linux-")) {
    const appRun = join(layout.packageRoot, "AppRun")
    copyFileSync(resolve("packaging", "linux", "AppRun"), appRun)
    chmodSync(appRun, 0o755)
    const desktopDirectory = join(layout.packageRoot, "usr", "share", "applications")
    mkdirSync(desktopDirectory, { recursive: true })
    copyFileSync(
      resolve("packaging", "linux", "yt-dlp-downloader.desktop"),
      join(desktopDirectory, "yt-dlp-downloader.desktop"),
    )
    return
  }

  // The directory build is the portable Windows distribution. A future
  // installer can omit this marker to use the standard per-user data path.
  writeFileSync(join(layout.packageRoot, "portable.flag"), "portable\n", "utf8")
}

async function main(): Promise<void> {
  const target = targetArgument()
  // The executable files are intentionally not tracked by Git. Prepare them
  // from the target's GitHub Release before packaging when the local cache is
  // missing or fails the manifest checksum.
  await ensureTargetBinaries(target)
  const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { version?: string }
  const version = packageJson.version ?? "0.0.0"
  const layout = packageLayout(target)

  rmSync(dirname(layout.packageRoot), { recursive: true, force: true })
  mkdirSync(layout.packageRoot, { recursive: true })
  const binaries = copyTools(target, layout.binDirectory)
  compileApplication(target, layout.executablePath)
  if (!target.id.startsWith("win32-")) chmodSync(layout.executablePath, 0o755)
  packagePlatformFiles(target, layout, version)
  copyIfPresent(resolve("licenses"), join(layout.resourcesDirectory, "licenses"))
  copyIfPresent(
    resolve("bin", target.id, "manifest.json"),
    join(layout.resourcesDirectory, "TOOL-MANIFEST.json"),
  )

  writeFileSync(join(layout.resourcesDirectory, "BUILD-INFO.json"), JSON.stringify({
    name: "yt-dlp-downloader",
    version,
    target: target.id,
    builtAt: new Date().toISOString(),
    tools: binaries.map(({ name, fileName, size, sha256 }) => ({ name, fileName, size, sha256 })),
  }, null, 2) + "\n", "utf8")

  console.log(`应用包已生成：${layout.packageRoot}`)
  console.log(`主程序：${basename(layout.executablePath)}`)
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
