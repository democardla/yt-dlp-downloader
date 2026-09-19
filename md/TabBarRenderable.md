**TabBarRenderable**

描述：横向标签页组件，支持鼠标点击、键盘切换和任务数量徽标。当前标签使用半透明蓝色背景显示，标签文本默认设置为不可选择，避免鼠标拖动时进入文本选择状态。

API

```ts
interface TabBarOption<T = number> {
  name: string
  description?: string
  value?: T
  badge?: {
    value: number | string
    shown?: boolean
  }
}
```

- **构造函数**：`new TabBarRenderable<T>(ctx, opts)`
- **opts**：支持 `RenderableOptions` 中的常用字段，以及：
  - `options?: TabBarOption<T>[]` - 标签页数组。
  - `selectedIndex?: number` - 初始选中索引，默认 `0`。
  - `onChange?: (option, index) => void` - 标签切换时调用。
- `setOptions(options)`：替换所有标签，并修正当前选中索引。
- `setSelectedIndex(index, notify?)`：设置当前标签；`notify` 为 `true` 时调用 `onChange`。
- `getSelectedIndex(): number`：获取当前选中索引。
- `getSelectedOption(): TabBarOption<T> | null`：获取当前标签对象。

徽标

当 `badge.shown` 不是 `false` 时，徽标会紧跟在标签名称后显示：

```ts
{
  name: "下载中",
  value: 0,
  badge: { value: 3, shown: true },
}
```

显示为：

```text
下载中(3)
```

隐藏徽标：

```ts
badge: { value: 3, shown: false }
```

按键和鼠标行为

- 鼠标点击标签：立即切换并触发 `onChange`。
- `left` / `up`：切换到上一个标签。
- `right` / `down`：切换到下一个标签。
- `return` / `space`：确认当前标签并触发 `onChange`。
- 组件需要 `focus()` 后才能接收键盘事件。

使用示例

```ts
import { TabBarRenderable } from "./components/TabBarRenderable"

const tabs = new TabBarRenderable<number>(renderer, {
  width: "100%",
  options: [
    { name: "下载中", value: 0, badge: { value: 2, shown: true } },
    { name: "已完成", value: 1, badge: { value: 8, shown: true } },
    { name: "未成功", value: 2, badge: { value: 0, shown: true } },
  ],
  selectedIndex: 0,
  onChange: (option, index) => {
    console.log("切换到", option.name, index)
  },
})

renderer.root.add(tabs)
tabs.focus()
```
