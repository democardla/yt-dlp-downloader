import { Expose } from "class-transformer"

/** Settings shared by the conversion features. */
export class GeneralConfig {
  @Expose()
  public max_concurrent_tasks = 2

  constructor(options: Partial<GeneralConfig> = {}) {
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined) Object.assign(this, { [key]: value })
    }
  }
}
