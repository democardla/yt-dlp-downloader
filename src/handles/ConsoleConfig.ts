import { Expose } from "class-transformer"

export class ConsoleConfig {
  @Expose()
  public enabled = true

  constructor(options: Partial<ConsoleConfig> = {}) {
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined) Object.assign(this, { [key]: value })
    }
  }
}
