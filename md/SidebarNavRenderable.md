**SidebarNavRenderable**

描述：垂直侧边栏导航组件。每个选项占用一行，当前选项使用 `▸` 标记和半透明蓝色背景显示，支持鼠标点击和键盘切换。

API

- **构造函数**：`new SidebarNavRenderable(ctx, opts)`
- **opts**：支持 `RenderableOptions` 中的常用字段，以及：
  - `options?: string[]` - 导航项名称数组。
  - `selectedIndex?: number` - 初始选中索引，默认 `0`。
  - `onChange?: (index: number) => void` - 选中项发生变化时调用。
- `getSelectedIndex(): number`：获取当前选中索引。
- `setSelectedIndex(index, notify?)`：设置选中索引；`notify` 为 `true` 时调用 `onChange`。

按键和鼠标行为

- `up` / `down`：向上或向下移动，超出边界时循环。
- `return` / `space`：重新确认当前选项并触发 `onChange`。
- 鼠标点击某一行：直接选中并触发 `onChange`。
- 组件需要 `focus()` 后才能接收键盘事件。

使用示例

```ts
import { createCliRenderer, BoxRenderable } from "@opentui/core"
import { SidebarNavRenderable } from "./components/SidebarNavRenderable"

const renderer = await createCliRenderer()
const panel = new BoxRenderable(renderer, {
  width: 24,
  height: 12,
  flexDirection: "column",
})

const nav = new SidebarNavRenderable(renderer, {
  options: ["下载网络", "输出", "字幕", "视频格式"],
  selectedIndex: 0,
  onChange: (index) => {
    console.log("切换到设置分类", index)
  },
})

panel.add(nav)
renderer.root.add(panel)
nav.focus()
```
