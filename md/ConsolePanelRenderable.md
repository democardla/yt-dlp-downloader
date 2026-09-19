**ConsolePanelRenderable**

描述：应用底部的日志控制台组件。组件内部使用 `ScrollBoxRenderable` 保存最多 500 条日志，并支持按日志级别显示 `LOG`、`WARN`、`ERROR` 前缀。

API

- **构造函数**：`new ConsolePanelRenderable(renderer, options?)`
- **options**：
  - `height?: number` - 控制台高度，默认 `7`。
  - `enabled?: boolean` - 是否显示，默认 `true`。
- `append(level, message)`：追加一条日志。`level` 可取 `"log"`、`"warn"`、`"error"`。
- `setEnabled(enabled)`：显示或隐藏控制台。

全局辅助函数

- `writeAppConsole(level, message)`：向当前控制台追加日志；尚未创建控制台时调用会被忽略。
- `setAppConsoleEnabled(enabled)`：切换当前控制台的显示状态。

使用示例

```ts
import { createCliRenderer, BoxRenderable } from "@opentui/core"
import {
  ConsolePanelRenderable,
  writeAppConsole,
} from "./components/ConsolePanelRenderable"

const renderer = await createCliRenderer()
const root = new BoxRenderable(renderer, {
  flexDirection: "column",
  width: "100%",
  height: "100%",
})

const consolePanel = new ConsolePanelRenderable(renderer, {
  height: 8,
  enabled: true,
})
root.add(consolePanel)
renderer.root.add(root)

writeAppConsole("log", "应用已启动")
writeAppConsole("warn", "这是一个警告")
writeAppConsole("error", "发生错误")
```

注意

- 组件使用模块级的当前面板引用，同一进程中建议只创建一个实例。
- 日志超过 500 条时会从最早的日志开始删除。
- 控制台隐藏时仍会继续接收日志；重新启用后可以看到已保留的内容。
