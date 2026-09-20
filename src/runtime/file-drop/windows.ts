function normalizeWindowsFileUrl(value: string): string | null {
  try {
    const url = new URL(value)
    let path = decodeURIComponent(url.pathname).replaceAll("/", "\\")
    if (/^\\[A-Za-z]:/.test(path)) path = path.slice(1)
    return url.hostname ? `\\\\${url.hostname}${path}` : path
  } catch {
    return null
  }
}

/** Parse all paths emitted when Explorer drops files into a terminal. */
export function parseWindowsDroppedFilePaths(value: string): string[] {
  const input = value.replaceAll("\u0000", "").trim()
  if (!input) return []

  if (/^file:\/\//i.test(input)) {
    return input.split(/\s+/).map(normalizeWindowsFileUrl).filter((path): path is string => Boolean(path))
  }

  const paths: string[] = []
  for (const line of input.split(/\r?\n/)) {
    const matches = line.matchAll(/"([^"]+)"|(\S+)/g)
    for (const match of matches) {
      const path = (match[1] ?? match[2] ?? "").trim()
      if (path) paths.push(path)
    }
  }
  return paths
}

/** Parse the first path emitted when Explorer drops files into a terminal. */
export function parseWindowsDroppedFilePath(value: string): string | null {
  return parseWindowsDroppedFilePaths(value)[0] ?? null
}
