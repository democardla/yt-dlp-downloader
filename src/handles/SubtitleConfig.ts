import { Expose } from 'class-transformer';


export class SubtitleConfig {
    @Expose()
    public only_subs = false
    
    // 是否下载可用字幕
    @Expose()
    public write_subs = false
    @Expose()
    public write_auto_subs = false
    
    @Expose()
    public list_subs = false
    @Expose()
    public sub_format: "vtt" | "srt" | "ttml" = "vtt"
    @Expose()
    public sub_langs: "zh-Hans" | "zh-Hant" | "en" = "en"
    @Expose()
    public embed_subs = false

    constructor(options: Partial<SubtitleConfig> = {}) {
        Object.assign(this, options)
    }

    public toArgs(): string[] {
        const args: string[] = []
        if (this.only_subs) {
            args.push("--skip-download")
        }

        if (this.write_subs) {
            if (this.write_auto_subs) {
                args.push("--write-auto-subs")
            } else {
                args.push("--write-subs")
            }
            args.push("--sub-format", this.sub_format)
            args.push("--sub-langs", this.sub_langs)
        }
        

        if (this.list_subs) {
            args.push("--list-subs")
        }

        if (this.embed_subs) {
            args.push("--embed-subs")
        }

        return args
    }
}
