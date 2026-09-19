**StyledSelectRenderable**

描述：基于 `Renderable` 的单选列表组件，参考 MultiSelectRenderable 的实现方式，内部使用 `TextRenderable` 渲染内容。光标移动时自动选中对应项，无需额外按空格确认。渲染为多行文本，当前行以 `>` 标记，选中项以实心圆点 `●`、未选中为空心圆点 `○`。

快捷导入

1. 引用包
```ts
import { StyledSelectRenderable } from "@components"
```

2. 创建实例
```ts
const select = new StyledSelectRenderable(renderer, {
  options: [
    { name: "Option 1", description: "Description 1" },
    { name: "Option 2", description: "Description 2" },
  ],
  selectedIndex: 0,
  onSelect: (index, option) => {
    console.log(`Selected: ${option.name}`)
  }
})
```

API
- **构造函数**: `new StyledSelectRenderable(ctx, opts)`
- **opts**: 支持 `RenderableOptions` 中的常用字段，以及：
  - `options?: Array<{ name: string; description?: string }>` - 列表项数组。
  - `selectedIndex?: number` - 初始选中索引。
  - `cursor?: number` - 初始光标位置。
  - `onSelect?: (index: number, option: { name: string; description?: string }) => void` - 选中时的回调函数。

方法
- `setOptions(options)`：替换列表项。
- `setCursor(idx: number)`：设置光标位置并自动选中。
- `setSelectedIndex(idx: number)`：设置选中索引并移动光标到该位置。
- `next()` / `prev()`：光标向下/向上移动（循环）并自动选中。
- `selectCurrent()`：手动触发当前项选中（主要用于回车键确认）。
- `getSelectedIndex(): number`：返回当前选中索引。
- `getSelectedOption(): { name: string; description?: string } | null`：返回当前选中项对象。

按键行为
- `up` / `down`：光标向上/向下移动（循环）并自动选中，触发 `onSelect`。
- `return`：确认选中，触发 `onSelect`。
- `home` / `end`：移动光标到第一项/最后一项并自动选中。

显示格式
- 每行示例: `> ● ItemName - description` （`>` 为光标，`●` 为已选，`○` 为未选，`- description` 可选）。

使用示例
```ts
import { createCliRenderer, TextRenderable, RGBA } from "@opentui/core"
import { StyledSelectRenderable } from "./components/StyledSelectRenderable"

async function main() {
  const renderer = await createCliRenderer({ fps: 20 })

  const select = new StyledSelectRenderable(renderer, {
    id: "styled-select",
    width: 50,
    height: 8,
    options: [
      { name: "Home", description: "返回首页" },
      { name: "Settings", description: "应用设置" },
      { name: "Profile", description: "个人资料" },
      { name: "About", description: "关于我们" },
    ],
    selectedIndex: 0,
    onSelect: (index, option) => {
      const message = `Selected: ${option.name}`
      const log = new TextRenderable(renderer, {
        content: message,
        fg: RGBA.fromHex("#7c3aed"),
      })
      console.log(message)
      renderer.root.add(log)
    }
  })

  renderer.root.add(select)
  select.focus() // 必须聚焦组件才能接收键盘事件
}

main()
```

注意
- 组件需要通过调用 `focus()` 方法聚焦才能接收键盘事件。
- 组件自动处理键盘事件，通过 `handleKeyPress` 方法响应，无需手动绑定 `renderer.on('key', ...)`。
- 光标移动时会自动选中对应项并触发 `onSelect` 回调，无需按空格键。
- 回车（Return）键也会触发 `onSelect` 回调，用于确认选择。
