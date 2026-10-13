import { targetArgument, verifyTargetBinaries } from "./release-targets"

try {
  const target = targetArgument()
  const binaries = verifyTargetBinaries(target)
  console.log(`工具目录已就绪：${target.id}`)
  for (const binary of binaries) {
    console.log(`${binary.name}: ${binary.fileName} (${binary.size} bytes, sha256=${binary.sha256})`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
