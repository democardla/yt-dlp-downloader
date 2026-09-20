# MatrixSelectRenderable

紧凑的矩阵单选组件。它只显示选项名称，不显示描述，适合格式、质量等短选项。组件按照最长名称计算紧凑的单元格宽度，并根据当前栏宽自动决定每行显示多少项。

## 基本用法

```ts
const format = new MatrixSelectRenderable(renderer, {
  options: [
    { name: "mp3", value: "mp3" },
    { name: "flac", value: "flac" },
    { name: "wav", value: "wav" },
  ],
  onChange: (option) => console.log(option.value),
})
```

组件支持鼠标点击，以及方向键、Home、End、Enter 和 Space。上下方向键按矩阵列数移动。

## 配置项

- `options`：由 `name` 和可选 `value` 组成的选项。
- `selectedIndex`：初始选中项。
- `onChange`：选项变化后的回调。
