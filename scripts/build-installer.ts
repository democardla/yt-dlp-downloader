import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs"
import { join, resolve } from "node:path"

const repositoryRoot = resolve(import.meta.dir, "..")
const packageJsonPath = join(repositoryRoot, "package.json")
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string }
const packageVersion = packageJson.version ?? "0.0.0"
const installerVersion = packageVersion.match(/^\d+(?:\.\d+){0,3}/)?.[0] ?? "0.0.0"

const appPayload = join(repositoryRoot, "dist", "apps", "win32-x64", "YT-DLP-Downloader")
const outputDirectory = join(repositoryRoot, "dist", "installers")
const portableMarker = join(appPayload, "portable.flag")
const installerScript = join(repositoryRoot, "packaging", "windows", "installer.iss")

function findInnoSetupCompiler(): string | null {
  const configured = process.env.INNO_SETUP_COMPILER?.trim()
  const candidates = [
    configured,
    join(process.env["ProgramFiles(x86)"] ?? "", "Inno Setup 6", "ISCC.exe"),
    join(process.env.ProgramFiles ?? "", "Inno Setup 6", "ISCC.exe"),
    join(process.env.LOCALAPPDATA ?? "", "Programs", "Inno Setup 6", "ISCC.exe"),
  ].filter((path): path is string => Boolean(path))

  return candidates.find((path) => existsSync(path)) ?? null
}

function run(command: string, args: string[]): void {
  const result = Bun.spawnSync([command, ...args], {
    cwd: repositoryRoot,
    stdout: "inherit",
    stderr: "inherit",
  })
  if (result.exitCode !== 0) throw new Error(`命令执行失败：${command}（退出码 ${result.exitCode}）`)
}

function main(): void {
  if (process.platform !== "win32") {
    throw new Error("Windows 安装包只能在 Windows 构建环境中生成")
  }

  const compiler = findInnoSetupCompiler()
  if (!compiler) {
    throw new Error(
      "未找到 Inno Setup 编译器。请安装 Inno Setup 6，或设置 INNO_SETUP_COMPILER 指向 ISCC.exe。",
    )
  }

  run(process.execPath, ["run", "scripts/build-app.ts", "--target", "win32-x64"])
  // The directory build is portable by default. An installed copy must use
  // %APPDATA% for config/history, so do not ship the portable marker.
  rmSync(portableMarker, { force: true })
  mkdirSync(outputDirectory, { recursive: true })

  run(compiler, [
    `/DAppVersion=${installerVersion}`,
    `/DAppLabel=${packageVersion}`,
    `/DAppPayload=${appPayload}`,
    `/DAppOutputDir=${outputDirectory}`,
    installerScript,
  ])

  console.log(`Windows 安装包已生成：${outputDirectory}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
