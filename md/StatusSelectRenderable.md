**StatusSelectRenderable**

描述：带状态颜色的紧凑型单选下拉组件。关闭时只显示当前选项，展开后每个选项成为独立的鼠标点击目标。`available` 为 `true` 时使用半透明绿色，为 `false` 时使用半透明红色。

API

```ts
interface StatusSelectOption<T = string> {
  name: string
  value: T
  available?: boolean
}
```

- **构造函数**：`new StatusSelectRenderable<T>(ctx, opts)`
- **opts**：支持 `RenderableOptions` 中的常用字段，以及：
  - `options?: StatusSelectOption<T>[]` - 选项数组。
  - `selectedIndex?: number` - 初始选中索引，默认 `0`。
  - `onChange?: (option, index) => void` - 选择改变时调用。
  - `onBeforeOpen?: () => void` - 鼠标点击准备展开菜单时调用，适合刷新动态选项。
- `getSelectedIndex(): number`：获取当前选中索引。
- `getSelectedOption(): StatusSelectOption<T> | null`：获取当前选项。
- `setSelectedIndex(index, notify?)`：设置选项；`notify` 为 `true` 时调用 `onChange`。
- `setOptions(options)`：替换选项，并尽量按照原选项的 `value` 保留当前选择。

按键和鼠标行为

- 点击当前标题：展开或收起菜单。
- 展开后点击选项：立即选中并收起菜单。
- `up` / `down`：循环切换选项。
- `return` / `space`：展开或收起菜单。
- `escape`：收起菜单。
- 组件需要 `focus()` 后才能接收键盘事件。

使用示例

```ts
import { StatusSelectRenderable } from "./components/StatusSelectRenderable"

const select = new StatusSelectRenderable<string>(renderer, {
  options: [
    { name: "可用格式", value: "available", available: true },
    { name: "暂不可用", value: "unavailable", available: false },
  ],
  selectedIndex: 0,
  onChange: (option) => {
    console.log("当前选择：", option.value)
  },
})

renderer.root.add(select)
select.focus()
```

动态刷新示例

```ts
const select = new StatusSelectRenderable<string | null>(renderer, {
  options: readOptions(),
  onBeforeOpen: () => select.setOptions(readOptions()),
})
```
