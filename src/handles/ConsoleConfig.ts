import { Expose } from "class-transformer"

export class ConsoleConfig {
  @Expose()
  public enabled = true

  /** Whether long log lines should be truncated instead of wrapped. */
  @Expose()
  public truncate = false

  constructor(options: Partial<ConsoleConfig> = {}) {
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined) Object.assign(this, { [key]: value })
    }
  }
}
