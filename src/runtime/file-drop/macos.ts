/** Parse all paths emitted when Finder drops files into a terminal. */
export function parseMacDroppedFilePaths(value: string): string[] {
  const input = value.trim()
  if (!input) return []

  const tokens: string[] = []
  let token = ""
  let quote: "'" | '"' | null = null
  for (let index = 0; index < input.length; index++) {
    const char = input[index]!
    if (quote) {
      if (char === quote) {
        quote = null
        continue
      }
      if (char === "\\" && quote === '"' && index + 1 < input.length) {
        token += input[++index]!
      } else {
        token += char
      }
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
    } else if (char === "\\" && index + 1 < input.length) {
      token += input[++index]!
    } else if (/\s/.test(char)) {
      if (token) tokens.push(token)
      token = ""
    } else {
      token += char
    }
  }
  if (token) tokens.push(token)

  return tokens.flatMap((item) => {
    if (!/^file:\/\//i.test(item)) return [item]
    try {
      return [decodeURIComponent(new URL(item).pathname)]
    } catch {
      return []
    }
  })
}

/** Parse the first path emitted when Finder drops files into a terminal. */
export function parseMacDroppedFilePath(value: string): string | null {
  return parseMacDroppedFilePaths(value)[0] ?? null
}
