# FileDropInputRenderable

用于接收手动输入或从文件管理器拖入终端的一个或多个文件路径。组件包含输入栏、可滚动文件列表、逐项“清除”按钮和“全部清除”按钮。过长文件名保持单行并省略显示。

```ts
const input = new FileDropInputRenderable(renderer, {
  platform: toolchain.platform,
  placeholder: "拖拽文件到这里",
  outputPath: "/Users/demo/Downloads",
  onPathParsed: (path) => console.log(path),
})

input.getPaths()       // 返回全部文件路径
input.getOutputPath(path) // 返回该文件的输出目录
input.setOutputPath(path, "/tmp/output")
input.removePath(0)    // 清除单个条目
input.clearAll()       // 清除全部条目
```

macOS 与 Windows 使用独立解析器：macOS 支持 Finder 的反斜杠转义、引号和 `file://`；Windows 支持多个带引号盘符路径、UNC 路径和 Windows `file://`。组件会去重保存路径。挂载期间还会捕获指向真实文件的全局 paste，因此即使其他输出控件拥有焦点，拖入文件仍会进入文件列表。

设置 `outputPath` 后，文件列表会增加“输出位置”列，每个条目都可以单独修改临时输出目录。
