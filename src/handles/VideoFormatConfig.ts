export interface FormatSort {
    vcodec: "h263" | "h264" | "h265" | "vp9.2" | "vp9" | "vp8" | "theora"
    lang: string
    quality: string
    res: "360" | "480" | "720" | "1080" | "2160"
    fps: "30" | "60" | "120"
    hdr: "HDR12" | "HDR10" | "HDR10+" | "HLG" | "SDR"
    acodec: string
}

/** Convert format-sort fields to yt-dlp's comma-separated value. */
export function formatSortToString(sort: Partial<FormatSort>): string {
    const fields: (keyof FormatSort)[] = [
        "vcodec",
        "lang",
        "quality",
        "res",
        "fps",
        "hdr",
        "acodec",
    ]

    return fields
        .filter((field) => sort[field] !== undefined && sort[field] !== null && sort[field] !== "")
        .map((field) => `${field}:${sort[field]}`)
        .join(",")
}

export class VideoFormatConfig {

    // 视频格式选择
    public format: "mp4" | "mp3" | "webm" | null = null

    // 格式排序
    public format_sort: string | null = null

    // 合并后的容器格式
    public merge_output_format: string | null = null

    // 允许多个视频流
    public video_multistreams = false

    // 允许多个音频流
    public audio_multistreams = false

    // 优先选择自由格式
    public prefer_free_formats = false

    // 检查所选择的格式是否真的可以下载
    public check_formats = false

    constructor(options: Partial<VideoFormatConfig> = {}) {
        Object.assign(this, options)
    }

    /** Set format_sort from structured fields, e.g. vcodec:h264,res:1080. */
    public setFormatSort(sort: Partial<FormatSort>): this {
        this.format_sort = formatSortToString(sort)
        return this
    }

    public toArgs(): string[] {
        const args: string[] = []

        this.format ? args.push("--format", this.format) : null
        return [
            this.format ? "--format" : "",
            this.format ?? "",

            this.format_sort ? "--format-sort" : "",
            this.format_sort ?? "",

            this.merge_output_format
                ? "--merge-output-format"
                : "",
            this.merge_output_format ?? "",

            this.video_multistreams
                ? "--video-multistreams"
                : "",

            this.audio_multistreams
                ? "--audio-multistreams"
                : "",

            this.prefer_free_formats
                ? "--prefer-free-formats"
                : "",

            this.check_formats
                ? "--check-formats"
                : ""
        ].filter(Boolean)
    }
}
