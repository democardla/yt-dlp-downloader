import { Expose } from 'class-transformer';

export class OutputConfig {
    // 下载路径
    @Expose()
    public path: string | null = "~/Downloads";

    // 临时文件路径
    @Expose()
    public temp_path: string | null = null;

    // 输出文件模板
    @Expose()
    public output: string | null = null;

    // 不可用字段的占位符
    @Expose()
    public output_na_placeholder: string | null = null;

    // 限制文件名为 ASCII
    @Expose()
    public restrict_filenames: boolean = false;

    // 强制 Windows 文件名
    @Expose()
    public windows_filenames: boolean = false;

    // 文件名最大长度
    @Expose()
    public trim_filenames: number | null = null;

    constructor(options: Partial<OutputConfig> = {}) {
        Object.assign(this, options)
    }

    // 原有的命令行参数转换方法保持不变
    public toArgs(): string[] {
        const args: string[] = [];

        if (this.path) {
            args.push("--paths", this.path);
        }

        if (this.temp_path) {
            args.push("--paths", `temp:${this.temp_path}`);
        }

        if (this.output) {
            args.push("--output", this.output);
        }

        if (this.output_na_placeholder) {
            args.push("--output-na-placeholder", this.output_na_placeholder);
        }

        if (this.restrict_filenames) {
            args.push("--restrict-filenames");
        }

        if (this.windows_filenames) {
            args.push("--windows-filenames");
        }

        if (this.trim_filenames !== null) {
            args.push("--trim-filenames", this.trim_filenames.toString());
        }

        return args;
    }
}
