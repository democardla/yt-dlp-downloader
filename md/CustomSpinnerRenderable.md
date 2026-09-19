**CustomSpinnerRenderable**

描述：继承自 `TextRenderable` 的可复用 Spinner 渲染器，内部通过定时器切换帧来实现动画。

API
- **构造函数**: `new CustomSpinnerRenderable(ctx, opts)`
- **opts**: 支持 `TextOptions` 中的常用字段，以及：
  - `frames?: string[]` - 帧数组，默认 `['◐','◓','◑','◒']`。
  - `interval?: number` - 帧切换间隔（ms），默认 `100`。
  - `label?: string` - 文本标签，显示在帧之后。

方法
- `start(interval: number)`：以指定间隔（ms）启动/重启动画。
- `stop()`：停止动画并清理定时器。
- `set label(v: string)`：更新标签并触发重渲染。

使用示例
```ts
import { createCliRenderer } from "@opentui/core"
import { CustomSpinnerRenderable } from "./components/CustomSpinnerRenderable"
import { RGBA } from "@opentui/core"

async function main() {
  const renderer = await createCliRenderer({ fps: 30 })

  const spinner = new CustomSpinnerRenderable(renderer, {
    label: "处理中...",
    fg: RGBA.fromHex("#BB9AF7"),
    frames: ["◜","◠","◝","◞","◡","◟"],
    interval: 120,
    id: "main-spinner",
  })

  renderer.root.add(spinner)
  renderer.start()

  // 若需停止动画或释放资源：
  // spinner.stop()
}

main()
```

注意
- 创建后若将组件从树上移除，建议调用 `stop()` 清理定时器以避免内存泄漏。
