/** A configuration object that can be translated to yt-dlp arguments. */
export interface YtConfig {
  toArgs(): string[]
}
