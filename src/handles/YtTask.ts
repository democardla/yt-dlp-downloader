import type { YtConfig } from "./YtConfig"

/** Composable yt-dlp task whose argv is safe to pass to Bun.spawn. */
export class YtTask {
  private readonly configs: YtConfig[] = []
  private readonly extraArgs: string[] = []

  constructor(public readonly url: string) {
    if (!url.trim()) throw new Error("yt-dlp URL cannot be empty")
  }

  public config(config: YtConfig): this {
    this.configs.push(config)
    return this
  }

  /** Add already-tokenized arguments that do not have a dedicated config yet. */
  public args(...args: string[]): this {
    this.extraArgs.push(...args)
    return this
  }

  public toArgs(): string[] {
    return [...this.configs.flatMap((config) => config.toArgs()), ...this.extraArgs, this.url]
  }

  public toCommand(binary = "yt-dlp"): string[] {
    return [binary, ...this.toArgs()]
  }
}

export default YtTask
