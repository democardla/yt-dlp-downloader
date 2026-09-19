**ProgressBarRenderable**

描述：继承自 `TextRenderable` 的进度条渲染器，使用 `content` 显示带百分比的字符进度条，支持在运行时通过属性修改更新显示。

API
- **构造函数**: `new ProgressBarRenderable(ctx, opts)`
- **opts**: 支持 `TextOptions` 中的常用字段，以及：
  - `width?: number` - 进度条宽度（字符数），默认 `30`。
  - `percent?: number` - 初始完成度（0~100），默认 `0`。
  - `label?: string` - 前置标签文本，默认空串。

属性
- `percent: number` - 设置/读取当前百分比；赋值会触发重渲染并限制在 0~100。
- `width: number` - 设置/读取进度条字符宽度；赋值会触发重渲染。
- `label: string` - 设置/读取标签文本；赋值会触发重渲染。

使用示例
```ts
import { createCliRenderer } from "@opentui/core"
import { ProgressBarRenderable } from "./components/ProgressBarRenderable"

async function main() {
  const renderer = await createCliRenderer({ fps: 20 })

  const bar = new ProgressBarRenderable(renderer, {
    width: 40,
    percent: 0,
    label: "下载：",
    id: "main-progress",
  })

  renderer.root.add(bar)
  renderer.start()

  // 模拟进度
  let p = 0
  const t = setInterval(() => {
    p += 7
    if (p > 100) { clearInterval(t); return }
    bar.percent = p
  }, 300)
}

main()
```

说明
- 通过直接赋值 `bar.percent = 50`、`bar.width = 50` 或 `bar.label = '...'` 可以即时更新显示，无需重新创建实例。
