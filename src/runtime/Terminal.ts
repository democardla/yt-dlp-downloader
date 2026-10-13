import { join } from "node:path"

export interface TerminalPreparation {
  attempted: boolean
  resized: boolean
  columns: number
  rows: number
  targetColumns: number
  targetRows: number
}

/** Give the side-by-side OpenTUI layout enough room in a double-clicked Windows console. */
export async function ensureMinimumTerminalSize(
  minimumColumns = 120,
  minimumRows = 35,
): Promise<TerminalPreparation> {
  const columns = process.stdout.columns ?? 0
  const rows = process.stdout.rows ?? 0
  const targetColumns = Math.max(columns, minimumColumns)
  const targetRows = Math.max(rows, minimumRows)
  const result: TerminalPreparation = {
    attempted: false,
    resized: false,
    columns,
    rows,
    targetColumns,
    targetRows,
  }
  if (process.platform !== "win32" || !process.stdout.isTTY) return result
  if (columns >= minimumColumns && rows >= minimumRows) return result

  result.attempted = true

  try {
    const windowsDirectory = process.env.WINDIR ?? process.env.SystemRoot ?? "C:\\Windows"
    const modePath = join(windowsDirectory, "System32", "mode.com")
    const resize = Bun.spawnSync([
      modePath,
      "con:",
      `cols=${targetColumns}`,
      `lines=${targetRows}`,
    ], { stdin: "ignore", stdout: "ignore", stderr: "ignore" })
    result.resized = resize.exitCode === 0
  } catch {
    result.resized = false
  }

  // Modern terminals may ignore `mode.com` but accept the xterm resize CSI.
  if (!result.resized) {
    try {
      process.stdout.write(`\u001b[8;${targetRows};${targetColumns}t`)
    } catch {
      // A layout warning is written after OpenTUI starts if both methods fail.
    }
  }
  // Let Node's stdout dimensions receive the console resize event before
  // OpenTUI reads its initial viewport. This avoids a visible 80x25 frame.
  await Bun.sleep(150)
  result.columns = process.stdout.columns ?? result.columns
  result.rows = process.stdout.rows ?? result.rows
  return result
}
