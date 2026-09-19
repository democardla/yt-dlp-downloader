**MultiSelectRenderable**

描述：基于 `Renderable` 的多选列表组件，内部使用 `TextRenderable` 渲染内容，支持光标移动、多项选择、整体选择与清空。渲染为多行文本，当前行以 `>` 标记，选中项以实心方块 `■`、未选中为空心方块 `□`。

API
- **构造函数**: `new MultiSelectRenderable(ctx, opts)`
- **opts**: 支持 `RenderableOptions` 中的常用字段，以及：
  - `items?: Array<string | { name: string; description?: string }>` - 列表项数组；每项可为字符串（当作 `name`）或对象 `{ name, description? }`。
  - `selected?: number[]` - 初始选中索引数组。
  - `cursor?: number` - 初始光标位置。
  - `onSubmit?: (indices: number[], items: { name: string; description?: string }[]) => void` - 提交时的回调函数。

方法
- `setItems(items)`：替换列表项并修剪选中索引。
- `setCursor(idx: number)`：设置光标位置。
- `next()` / `prev()`：光标向下/向上移动（循环）。
- `toggleCurrent()`：切换当前行的选中状态。
- `select(index: number)` / `deselect(index: number)`：单项选中/取消。
- `selectAll()` / `clearSelection()`：全部选中 / 清空选择。
- `getSelectedIndices(): number[]`：返回当前选中索引数组（升序）。
- `getSelectedItems(): { name: string; description?: string }[]`：返回当前选中项对象数组。
- `submit()`：手动触发提交，返回 `{ indices, items }` 并调用 `onSubmit`（若提供）。

- `onSubmit` (opts): 构造时可以传入 `onSubmit(indices, items)` 回调；按 `return` 键会触发提交并调用该回调。

按键行为
- `up` / `down`：光标向上/向下移动（循环）。
- `space`：切换当前项选中状态。
- `return`：提交当前选择，触发 `onSubmit`（若提供）。
- `home` / `end`：移动光标到第一项/最后一项。

显示格式
- 每行示例: `> ■ ItemName - description` （`>` 为光标，`■` 为已选，`□` 为未选，`- description` 可选）。

使用示例
```ts
import { createCliRenderer, TextRenderable, RGBA } from "@opentui/core"
import { MultiSelectRenderable } from "./components/MultiSelectRenderable"

async function main() {
  const renderer = await createCliRenderer({ fps: 20 })

  const ms = new MultiSelectRenderable(renderer, {
    id: "multiselect",
    width: 60,
    height: 10,
    items: [
      { name: "Option A", description: "This is option A" },
      { name: "Option B", description: "This is option B" },
      { name: "Option C", description: "This is option C" },
    ],
    selected: [],
    cursor: 0,
    onSubmit: (indices, items) => {
      const selectedOptions = items.map(i => i.name).join(", ")
      const message = `Submitted: ${selectedOptions}`
      const log = new TextRenderable(renderer, {
        content: message,
        fg: RGBA.fromHex("#7FC7FF"),
      })
      console.log(`Submitted: ${selectedOptions}`)
      renderer.root.add(log)
    }
  })

  renderer.root.add(ms)
  ms.focus() // 必须聚焦组件才能接收键盘事件
}

main()
```

注意
- 组件需要通过调用 `focus()` 方法聚焦才能接收键盘事件。
- 组件自动处理键盘事件，通过 `handleKeyPress` 方法响应，无需手动绑定 `renderer.on('key', ...)`。
- 回车（Return）键用于提交，而不是 Enter 键。
