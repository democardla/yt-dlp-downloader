# BorderlessTableRenderable

无边框三栏或多栏表格组件。表头默认使用蓝色字体，每一列可以放置任意 OpenTUI `Renderable`，因此状态栏既可以显示文字，也可以显示进度条或按钮。

```ts
const table = new BorderlessTableRenderable(renderer, {
  columns: [
    { id: "name", title: "文件名称", flexGrow: 1 },
    { id: "status", title: "状态", width: 20 },
    { id: "clear", title: "清除", width: 6 },
  ],
})
```

通过 `addRow`、`removeRow`、`replaceCell` 和 `replaceHeaderCell` 管理行、单元格与表头。组件本身不绘制边框，适合放入已有面板或滚动区域。
