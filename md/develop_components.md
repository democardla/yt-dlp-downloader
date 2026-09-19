OpenTUI 自己手写组件主要有两种方式：**声明式 Construct 函数（推荐）**和**继承 Renderable 类（底层定制）**。
---

## 方式一：声明式 Construct —— 自定义 Spinner 组件（推荐）

利用 `TextRenderable` + `setInterval` 定时切换帧，封装成函数返回 VNode。

```ts
// components/Spinner.ts
import { Text, type TextOptions, type RenderContext } from "@opentui/core"
import type { VNode } from "@opentui/core"

export interface SpinnerProps extends Omit<TextOptions, "content"> {
  frames?: string[]
  interval?: number
  label?: string
  color?: TextOptions["fg"]
}

/**
 * 自定义 Loading Spinner 组件
 * 用法: renderer.root.add(Spinner({ label: "加载中...", color: "#4CAF50" }))
 */
export function Spinner(props: SpinnerProps): VNode {
  const {
    frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    interval = 80,
    label = "",
    color,
    id,
    ...textOpts
  } = props

  // 创建 Text VNode，初始内容
  const vnode = Text({
    id,
    content: `${frames[0]} ${label}`,
    fg: color,
    ...textOpts,
  })

  // VNode 入树后才会有真实 Renderable，用 onAttach 或 renderer.on 启动定时器
  // 更简单：在 add 之后手动调 startSpinner(renderer, vnodeId)
  return vnode
}

/** 启动 spinner 动画（需在 renderer.root.add(vnode) 之后调用）*/
export function startSpinner(
  renderer: Awaited<ReturnType<typeof import("@opentui/core").createCliRenderer>>,
  id: string,
  frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"],
  interval = 80,
  label = ""
) {
  const el = renderer.getRenderableById(id)
  if (!el || !("content" in el)) return

  let i = 0
  const tid = setInterval(() => {
    el.content = `${frames[i % frames.length]} ${label}`
    i++
  }, interval)

  // 返回 stop 函数
  return () => clearInterval(tid)
}
```

使用：

```ts
// src/main.ts
import { createCliRenderer } from "@opentui/core"
import { Spinner, startSpinner } from "./components/Spinner"

async function main() {
  const renderer = await createCliRenderer({ fps: 30 })

  const spinnerVNode = Spinner({
    id: "main-spinner",
    label: "正在连接数据库...",
    color: "#4CAF50",
  })
  renderer.root.add(spinnerVNode)

  // 启动动画
  const stop = startSpinner(renderer, "main-spinner")

  // 模拟 3 秒后停止
  setTimeout(() => {
    stop?.()
    const el = renderer.getRenderableById("main-spinner")
    if (el && "content" in el) el.content = "✓ 加载完成"
  }, 3000)

  renderer.on("key", (k) => {
    if (k.name === "q") { renderer.stop(); process.exit(0) }
  })
  renderer.start()
}

main()
```

---

## 方式二：继承 Renderable —— 自定义 SpinnerRenderable（底层）

没有特殊情况，设计新组件时默认通过 **继承** `Renderable` 的方式进行创建。

适合需要完全控制 `renderSelf`、尺寸测量等场景：

```ts
// components/CustomSpinnerRenderable.ts
import {
  TextRenderable,
  type RenderContext,
  type TextOptions,
  RGBA,
} from "@opentui/core"

export class CustomSpinnerRenderable extends TextRenderable {
  private frames: string[]
  private idx = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private _label = ""

  constructor(
    ctx: RenderContext,
    opts: TextOptions & { frames?: string[]; interval?: number; label?: string } = {}
  ) {
    const {
      frames = ["◐","◓","◑","◒"],
      interval = 100,
      label = "",
      ...rest
    } = opts
    super(ctx, { content: frames[0] + " " + label, ...rest })
    this.frames = frames
    this._label = label
    this.start(interval)
  }

  start(interval: number) {
    this.timer = setInterval(() => {
      this.idx = (this.idx + 1) % this.frames.length
      this.content = `${this.frames[this.idx]} ${this._label}`
    }, interval)
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  set label(v: string) { this._label = v; this.requestRender() }
}
```

使用：

```ts
import { createCliRenderer } from "@opentui/core"
import { CustomSpinnerRenderable } from "./components/CustomSpinnerRenderable"

const renderer = await createCliRenderer()
const spinner = new CustomSpinnerRenderable(renderer, {
  label: "处理中...",
  fg: RGBA.fromHex("#BB9AF7"),
  frames: ["◜","◠","◝","◞","◡","◟"],
  interval: 120,
})
renderer.root.add(spinner)

// spinner.stop() 停止
renderer.start()
```

---

## 方式三：React/Solid 声明式（如果用 @opentui/react）

```tsx
import { useState, useEffect } from "react"
import { Text, Box } from "@opentui/react"

const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]

export function LoadingSpinner({ label = "加载中...", color = "#4CAF50" }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % frames.length), 80)
    return () => clearInterval(t)
  }, [])
  return (
    <Box flexDirection="row" gap={1}>
      <Text fg={color}>{frames[i]}</Text>
      <Text>{label}</Text>
    </Box>
  )
}
```

---

## 方式四：带百分比的进度条组件

```ts
// components/ProgressBar.ts
import { Box, Text } from "@opentui/core"

export function ProgressBar(opts: {
  id?: string
  width?: number
  percent?: number   // 0~100
  label?: string
}) {
  const w = opts.width ?? 30
  const p = Math.max(0, Math.min(100, opts.percent ?? 0))
  const filled = Math.round(w * p / 100)
  const bar = "█".repeat(filled) + "░".repeat(w - filled)

  return Box(
    { id: opts.id, flexDirection: "column", gap: 0 },
    Text({ content: `${opts.label ?? ""} ${bar} ${p}%` }),
  )
}

// 动态更新：保存 id，定时改 percent 后重建或改 TextRenderable.content
```

---

## 快速选用建议

| 需求 | 推荐方式 |
|------|---------|
| 一般 TUI 应用复用 Spinner | **方式一** `Spinner()` Construct + `startSpinner()` |
| 需要自定义绘制/尺寸/事件 | **方式二** 继承 `TextRenderable` |
| 用了 React 模板 | **方式三** `useState` + `useEffect` |
| 带百分比进度条 | **方式四** 或结合之前讲的动态 `content` 更新 |

如果你用的是 React 模板（`@opentui/react`）想看更完整的用法，或者想做带取消按钮的加载弹窗，把入口文件贴给我就行。