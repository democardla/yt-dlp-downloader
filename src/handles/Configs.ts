import fs from "fs/promises"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import "reflect-metadata"

import { Expose, Type, plainToClass } from 'class-transformer';

import {
  DownloadNetworkConfig,
} from "./DownloadNetworkConfig"
import { OutputConfig } from "./OutputConfig"
import { SubtitleConfig } from "./SubtitleConfig"
import { VideoFormatConfig } from "./VideoFormatConfig"
import { ConsoleConfig } from "./ConsoleConfig"
import { GeneralConfig } from "./GeneralConfig"

export interface DownloadNetworkShape {
  concurrent_fragments?: number | null
  limit_rate?: string | null
  throttled_rate?: string | null
  retries?: number | "infinite" | null
  fragment_retries?: number | "infinite" | null
  file_access_retries?: number | "infinite" | null
  buffer_size?: string | null
  http_chunk_size?: string | null
}

export interface OutputShape {
  path?: string | null
  temp_path?: string | null
  output?: string | null
  output_na_placeholder?: string | null
  restrict_filenames?: boolean
  windows_filenames?: boolean
  trim_filenames?: number | null
}

export interface SublineShape {
  convert_subs?: boolean
  embed_subs?: boolean
  sub_lang?: string
}

export interface SubtitleShape {
  only_subs?: boolean
  write_subs?: boolean
  write_auto_subs?: boolean
  list_subs?: boolean
  sub_format?: string
  sub_langs?: string
  embed_subs?: boolean
}

export interface VideoFormatShape {
  format?: string | null
  format_sort?: string | null
  merge_output_format?: string | null
  video_multistreams?: boolean
  audio_multistreams?: boolean
  prefer_free_formats?: boolean
  check_formats?: boolean
}

export interface ConsoleShape {
  enabled?: boolean
  truncate?: boolean
}

export interface GeneralShape {
  max_concurrent_tasks?: number
}

export interface ConfigsJSON {
  name?: string
  description?: string
  downloadNetwork?: DownloadNetworkShape
  output?: OutputShape
  subline?: SublineShape
  subtitle?: SubtitleShape
  videoFormat?: VideoFormatShape
  console?: ConsoleShape
  general?: GeneralShape
}

export class Configs {

  @Expose()
  public name = "默认配置"

  @Expose()
  public description = "yt-dlp 下载器默认配置"

  @Type(() => DownloadNetworkConfig)
  public downloadNetwork: DownloadNetworkConfig = new DownloadNetworkConfig()

  @Type(() => OutputConfig)
  public output: OutputConfig = new OutputConfig()
  @Type(() => SubtitleConfig)
  public subtitle: SubtitleConfig = new SubtitleConfig()
  @Type(() => VideoFormatConfig)
  public videoFormat: VideoFormatConfig = new VideoFormatConfig()
  @Type(() => ConsoleConfig)
  public console: ConsoleConfig = new ConsoleConfig()
  @Type(() => GeneralConfig)
  public general: GeneralConfig = new GeneralConfig()

    public static async loadFromFile(filePath: string): Promise<Configs> {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const jsonData: ConfigsJSON = JSON.parse(fileContent);
        return plainToClass(Configs, jsonData);

    }

    public static loadFromFileSync(filePath: string): Configs {
        const fileContent = readFileSync(filePath, "utf8")
        const jsonData: ConfigsJSON = JSON.parse(fileContent)
        return plainToClass(Configs, jsonData)
    }

    public async saveToFile(filePath: string): Promise<void> {
        const jsonData: ConfigsJSON = {
            name: this.name,
            description: this.description,
            downloadNetwork: this.downloadNetwork,
            output: this.output,
            subtitle: this.subtitle,
            videoFormat: this.videoFormat,
            console: this.console,
            general: this.general,
        };
        const fileContent = JSON.stringify(jsonData, null, 2);
        await fs.writeFile(filePath, fileContent, 'utf-8');
    }

    public saveToFileSync(filePath: string): void {
        const jsonData: ConfigsJSON = {
            name: this.name,
            description: this.description,
            downloadNetwork: this.downloadNetwork,
            output: this.output,
            subtitle: this.subtitle,
            videoFormat: this.videoFormat,
            console: this.console,
            general: this.general,
        }
        mkdirSync(dirname(filePath), { recursive: true })
        writeFileSync(filePath, JSON.stringify(jsonData, null, 2) + "\n", "utf8")
    }

    constructor() {}


}

export default Configs
