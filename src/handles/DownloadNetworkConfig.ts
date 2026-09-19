import { Expose } from "class-transformer"


export class DownloadNetworkConfig {

    // Fragment 并发数
    @Expose()
    public concurrent_fragments: number | null = null

    // 下载速度限制
    @Expose()
    public limit_rate: string | null = null

    // 判断限速的阈值
    @Expose()
    public throttled_rate: string | null = null

    // HTTP 下载重试次数
    @Expose()
    public retries: number | "infinite" | null = null

    // Fragment 重试次数
    @Expose()
    public fragment_retries: number | "infinite" | null = null

    // 文件访问重试次数
    @Expose()
    public file_access_retries: number | "infinite" | null = null

    // 下载缓冲区
    @Expose()
    public buffer_size: string | null = null

    // HTTP chunk 大小
    @Expose()
    public http_chunk_size: string | null = null

    constructor(options: Partial<DownloadNetworkConfig> = {}) {
        // Keep field initializers as defaults. An explicitly supplied null
        // still disables the option, while undefined is treated as omitted.
        for (const [key, value] of Object.entries(options)) {
            if (value !== undefined) Object.assign(this, { [key]: value })
        }
    }

    public toArgs(): string[] {

        const args: string[] = []

        if (this.concurrent_fragments !== null) {
            args.push(
                "--concurrent-fragments",
                this.concurrent_fragments.toString()
            )
        }

        if (this.limit_rate) {
            args.push("--limit-rate", this.limit_rate)
        }

        if (this.throttled_rate) {
            args.push("--throttled-rate", this.throttled_rate)
        }

        if (this.retries !== null) {
            args.push(
                "--retries",
                this.retries.toString()
            )
        }

        if (this.fragment_retries !== null) {
            args.push(
                "--fragment-retries",
                this.fragment_retries.toString()
            )
        }

        if (this.file_access_retries !== null) {
            args.push(
                "--file-access-retries",
                this.file_access_retries.toString()
            )
        }

        if (this.buffer_size) {
            args.push("--buffer-size", this.buffer_size)
        }

        if (this.http_chunk_size) {
            args.push(
                "--http-chunk-size",
                this.http_chunk_size
            )
        }

        return args
    }
}
