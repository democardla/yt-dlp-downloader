import { BoxRenderable, InputRenderable, InputRenderableEvents, ScrollBoxRenderable, TextRenderable, RGBA, type CliRenderer, type Renderable } from "@opentui/core"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { setAppConsoleEnabled, SidebarNavRenderable, StatusSelectRenderable } from "./components"
import { Configs, formatSortToString, type DownloadNetworkConfig, type FormatSort, type OutputConfig, type SubtitleConfig, type VideoFormatConfig } from "./handles"

// Use cwd so both Bun source mode and compiled single-file mode can write it.
const CONFIG_PATH = resolve("yt-dlp-downloader/config.json")
type ConfigSection = "downloadNetwork" | "output" | "subtitle" | "videoFormat" | "console"
type ConfigValue = string | number | boolean | null
type ConfigObject = DownloadNetworkConfig | OutputConfig | SubtitleConfig | VideoFormatConfig | { enabled: boolean }
type SettingType = "toggle" | "select" | "input"

interface SettingItemDef {
  section: ConfigSection
  property: string
  label: string
  type: SettingType
  options?: { name: string; value: ConfigValue; available?: boolean }[]
  placeholder?: string
  formatSortField?: keyof FormatSort
}
interface SettingsCategoryDef { name: string; description: string; items: SettingItemDef[] }

const SCHEMA: SettingsCategoryDef[] = [
  { name: " 下载网络 ", description: "下载速度与重试相关配置", items: [
    { section: "downloadNetwork", property: "concurrent_fragments", type: "input", label: "Fragment 并发数", placeholder: "例如 4" },
    { section: "downloadNetwork", property: "limit_rate", type: "input", label: "下载速度限制", placeholder: "例如 5M" },
    { section: "downloadNetwork", property: "retries", type: "input", label: "重试次数", placeholder: "例如 10 或 infinite" },
  ] },
  { name: " 输出 ", description: "文件输出路径与文件名", items: [
    { section: "output", property: "path", type: "input", label: "下载目录", placeholder: "例如 ~/Downloads" },
    { section: "output", property: "output", type: "input", label: "输出模板", placeholder: "例如 %(title)s.%(ext)s" },
    { section: "output", property: "restrict_filenames", type: "toggle", label: "限制文件名为 ASCII" },
    { section: "output", property: "windows_filenames", type: "toggle", label: "使用 Windows 文件名" },
  ] },
  { name: " 字幕 ", description: "字幕下载与嵌入", items: [
    { section: "subtitle", property: "subtitleMode", type: "select", label: "下载字幕", options: [{ name: "不下载", value: "none", available: false }, { name: "原始字幕", value: "original", available: true }, { name: "生成式字幕", value: "generated", available: true }] },
    { section: "subtitle", property: "embed_subs", type: "toggle", label: "嵌入字幕" },
    { section: "subtitle", property: "sub_langs", type: "select", label: "字幕语言", options: [{ name: "简体中文", value: "zh-Hans", available: true }, { name: "繁体中文", value: "zh-Hant", available: true }, { name: "英语", value: "en", available: true }] },
    { section: "subtitle", property: "sub_format", type: "select", label: "字幕格式", options: [{ name: "vtt", value: "vtt", available: true }, { name: "srt", value: "srt", available: true }, { name: "ttml", value: "ttml", available: true }] },
  ] },
  { name: " 视频格式 ", description: "视频格式与格式排序", items: [
    { section: "videoFormat", property: "format", type: "select", label: "格式", options: [{ name: "未指定", value: null, available: false }, { name: "mp4", value: "mp4", available: true }, { name: "mp3", value: "mp3", available: true }, { name: "webm", value: "webm", available: true }] },
    { section: "videoFormat", property: "format_sort", formatSortField: "vcodec", type: "select", label: "视频编码", options: [{ name: "未指定", value: null, available: false }, { name: "H.264", value: "h264", available: true }, { name: "H.265", value: "h265", available: true }, { name: "VP9", value: "vp9", available: true }] },
    { section: "videoFormat", property: "format_sort", formatSortField: "lang", type: "select", label: "语言优先级", options: [{ name: "未指定", value: null, available: false }, { name: "简体中文", value: "zh-Hans", available: true }, { name: "繁体中文", value: "zh-Hant", available: true }, { name: "英语", value: "en", available: true }] },
    { section: "videoFormat", property: "format_sort", formatSortField: "quality", type: "select", label: "画质优先级", options: [{ name: "未指定", value: null, available: false }, { name: "最佳", value: "best", available: true }, { name: "最差", value: "worst", available: true }] },
    { section: "videoFormat", property: "format_sort", formatSortField: "res", type: "select", label: "分辨率", options: [{ name: "未指定", value: null, available: false }, { name: "360p", value: "360", available: true }, { name: "480p", value: "480", available: true }, { name: "720p", value: "720", available: true }, { name: "1080p", value: "1080", available: true }, { name: "2160p", value: "2160", available: true }] },
    { section: "videoFormat", property: "format_sort", formatSortField: "fps", type: "select", label: "帧率", options: [{ name: "未指定", value: null, available: false }, { name: "30 FPS", value: "30", available: true }, { name: "60 FPS", value: "60", available: true }, { name: "120 FPS", value: "120", available: true }] },
    { section: "videoFormat", property: "format_sort", formatSortField: "hdr", type: "select", label: "HDR 类型", options: [{ name: "未指定", value: null, available: false }, { name: "HDR12", value: "HDR12", available: true }, { name: "HDR10", value: "HDR10", available: true }, { name: "HLG", value: "HLG", available: true }, { name: "SDR", value: "SDR", available: true }] },
    { section: "videoFormat", property: "format_sort", formatSortField: "acodec", type: "select", label: "音频编码", options: [{ name: "未指定", value: null, available: false }, { name: "AAC", value: "aac", available: true }, { name: "Opus", value: "opus", available: true }, { name: "MP3", value: "mp3", available: true }] },
    { section: "videoFormat", property: "check_formats", type: "toggle", label: "检查格式可用性" },
    { section: "videoFormat", property: "prefer_free_formats", type: "toggle", label: "优先自由格式" },
  ] },
  { name: " 控制台 ", description: "底部运行日志显示", items: [
    { section: "console", property: "enabled", type: "toggle", label: "启用底部控制台" },
  ] },
]

const ACCENT = RGBA.fromHex("#7FC7FF")

export interface SettingsFeature { root: BoxRenderable; getFocusables(): Renderable[]; focusFirst(): void }

function parseFormatSort(value: string | null): Partial<FormatSort> {
  const fields: Partial<FormatSort> = {}
  for (const part of value?.split(",") ?? []) {
    const separator = part.indexOf(":")
    if (separator <= 0) continue
    const field = part.slice(0, separator) as keyof FormatSort
    if (["vcodec", "lang", "quality", "res", "fps", "hdr", "acodec"].includes(field)) {
      fields[field] = part.slice(separator + 1) as never
    }
  }
  return fields
}

function loadConfigs(): Configs {
  if (!existsSync(CONFIG_PATH)) {
    const configs = new Configs(); configs.saveToFileSync(CONFIG_PATH); return configs
  }
  try { return Configs.loadFromFileSync(CONFIG_PATH) } catch (error) {
    console.error(`配置文件读取失败，将使用默认配置: ${String(error)}`)
    const configs = new Configs(); configs.saveToFileSync(CONFIG_PATH); return configs
  }
}

function getConfigValue(configs: Configs, item: SettingItemDef, formatSortFields: Partial<FormatSort>): ConfigValue {
  if (item.formatSortField) return formatSortFields[item.formatSortField] ?? null
  if (item.section === "subtitle" && item.property === "subtitleMode") {
    if (!configs.subtitle.write_subs) return "none"
    return configs.subtitle.write_auto_subs ? "generated" : "original"
  }
  const section = configs[item.section] as unknown as ConfigObject
  return section[item.property as keyof ConfigObject] as unknown as ConfigValue
}

function setConfigValue(configs: Configs, item: SettingItemDef, value: ConfigValue, formatSortFields: Partial<FormatSort>): void {
  if (item.formatSortField) {
    if (value === null || value === "") delete formatSortFields[item.formatSortField]
    else formatSortFields[item.formatSortField] = value as never
    configs.videoFormat.format_sort = formatSortToString(formatSortFields)
    configs.saveToFileSync(CONFIG_PATH)
    return
  }
  if (item.section === "subtitle" && item.property === "subtitleMode") {
    configs.subtitle.write_subs = value !== "none"
    configs.subtitle.write_auto_subs = value === "generated"
    configs.saveToFileSync(CONFIG_PATH)
    return
  }
  const section = configs[item.section] as unknown as Record<string, ConfigValue>
  section[item.property] = value
  configs.saveToFileSync(CONFIG_PATH)
  if (item.section === "console" && item.property === "enabled") setAppConsoleEnabled(value === true)
}

export function createSettingsFeature(renderer: CliRenderer): SettingsFeature {
  const configs = loadConfigs()
  const formatSortFields = parseFormatSort(configs.videoFormat.format_sort)
  const categoryPanels: BoxRenderable[] = []
  const categoryControls: Renderable[][] = []

  function buildItem(item: SettingItemDef, catIndex: number, itemIndex: number) {
    const row = new BoxRenderable(renderer, { id: `setting-item-${catIndex}-${itemIndex}`, flexDirection: "row", alignItems: "center", gap: 1 })
    row.add(new TextRenderable(renderer, { content: item.label, fg: ACCENT }))
    const current = getConfigValue(configs, item, formatSortFields)
    let control: Renderable
    if (item.type === "toggle" || item.type === "select") {
      const options = item.options ?? []
      const selectOptions = item.type === "toggle"
        ? [{ name: "关闭", value: false, available: false }, { name: "开启", value: true, available: true }]
        : options
      const selectedIndex = Math.max(0, selectOptions.findIndex((option) => option.value === current))
      const select = new StatusSelectRenderable<ConfigValue>(renderer, { flexGrow: 1, options: selectOptions, selectedIndex, onChange: (option) => setConfigValue(configs, item, option.value, formatSortFields) })
      control = select
    } else {
      const input = new InputRenderable(renderer, { flexGrow: 1, value: current === null || current === undefined ? "" : String(current), placeholder: item.placeholder })
      input.on(InputRenderableEvents.ENTER, () => {
        const value = input.value.trim()
        if (value === "") setConfigValue(configs, item, null, formatSortFields)
        else if (item.section === "downloadNetwork" && ["concurrent_fragments", "retries", "fragment_retries", "file_access_retries"].includes(item.property)) setConfigValue(configs, item, value === "infinite" ? value : Number(value), formatSortFields)
        else setConfigValue(configs, item, value, formatSortFields)
      })
      control = input
    }
    row.add(control)
    return { row, control }
  }

  SCHEMA.forEach((category, catIndex) => {
    const panel = new BoxRenderable(renderer, { id: `settings-cat-${catIndex}`, flexGrow: 1, flexDirection: "column", gap: 1, padding: 1 })
    const controls: Renderable[] = []
    category.items.forEach((item, itemIndex) => { const built = buildItem(item, catIndex, itemIndex); panel.add(built.row); controls.push(built.control) })
    categoryPanels.push(panel); categoryControls.push(controls)
  })

  const nav = new SidebarNavRenderable(renderer, { options: SCHEMA.map((category) => category.name), selectedIndex: 0, onChange: (index) => setCategory(index) })
  const navScroll = new ScrollBoxRenderable(renderer, { flexGrow: 1, scrollY: true, scrollX: false, scrollbarOptions: { showArrows: false } })
  navScroll.add(nav)
  const leftNav = new BoxRenderable(renderer, { id: "settings-nav", width: "30%", height: "100%", border: true, title: " 设置分类 ", titleAlignment: "center", flexDirection: "column", padding: 1 }); leftNav.add(navScroll)
  const rightPanel = new BoxRenderable(renderer, { id: "settings-content", flexGrow: 1, height: "100%", border: true, title: SCHEMA[0]!.name, titleAlignment: "center", flexDirection: "column" })
  const settingsScroll = new ScrollBoxRenderable(renderer, { flexGrow: 1, scrollY: true, scrollX: false, scrollbarOptions: { showArrows: false } })
  rightPanel.add(settingsScroll)
  const root = new BoxRenderable(renderer, { id: "settings-root", flexDirection: "row", width: "100%", height: "100%" }); root.add(leftNav); root.add(rightPanel)
  let currentCat = 0
  function setCategory(index: number) { for (const child of settingsScroll.getChildren()) settingsScroll.remove(child.id); settingsScroll.add(categoryPanels[index]!); rightPanel.title = SCHEMA[index]!.name; currentCat = index }
  setCategory(0)
  return { root, getFocusables: () => [nav, ...categoryControls[currentCat]!], focusFirst: () => nav.focus() }
}
