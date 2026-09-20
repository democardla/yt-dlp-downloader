import { randomUUID } from "node:crypto"
import {
  startMediaConversion,
  type MediaConversionCallbacks,
  type MediaConversionOptions,
} from "./MediaConverter"
import type { Toolchain } from "./Toolchain"

export type ConversionTaskStatus = "waiting" | "running" | "complete" | "failed" | "cancelled"

export interface ConversionTaskSnapshot {
  id: string
  inputPath: string
  status: ConversionTaskStatus
  percent: number
  outputPath?: string
  error?: string
}

export interface ConversionTaskCallbacks {
  onState: (status: ConversionTaskStatus) => void
  onProgress: (percent: number) => void
  onDone: (outputPath: string) => void
  onError: (message: string) => void
}

export interface ConversionTaskHandle {
  id: string
  cancel: () => void
}

interface InternalTask {
  snapshot: ConversionTaskSnapshot
  options: MediaConversionOptions
  callbacks: ConversionTaskCallbacks
  cancelActive: (() => void) | null
}

type StartConversion = typeof startMediaConversion

/** Runs independent conversions asynchronously with a bounded active queue. */
export class ConversionScheduler {
  private readonly toolchain: Toolchain
  private maxConcurrentTasks: number
  private readonly startConversion: StartConversion
  private readonly tasks = new Map<string, InternalTask>()
  private readonly waiting: string[] = []
  private readonly running = new Set<string>()

  constructor(toolchain: Toolchain, maxConcurrentTasks = 2, startConversion: StartConversion = startMediaConversion) {
    this.toolchain = toolchain
    this.maxConcurrentTasks = Math.max(1, Math.floor(maxConcurrentTasks))
    this.startConversion = startConversion
  }

  setMaxConcurrentTasks(maxConcurrentTasks: number): void {
    if (!Number.isFinite(maxConcurrentTasks)) return
    this.maxConcurrentTasks = Math.max(1, Math.floor(maxConcurrentTasks))
    this.pump()
  }

  enqueue(options: MediaConversionOptions, callbacks: ConversionTaskCallbacks): ConversionTaskHandle {
    const id = randomUUID()
    const task: InternalTask = {
      snapshot: { id, inputPath: options.inputPath, status: "waiting", percent: 0 },
      options,
      callbacks,
      cancelActive: null,
    }
    this.tasks.set(id, task)
    this.waiting.push(id)
    callbacks.onState("waiting")
    this.pump()
    return { id, cancel: () => this.cancel(id) }
  }

  cancel(id: string): void {
    const task = this.tasks.get(id)
    if (!task || task.snapshot.status === "complete" || task.snapshot.status === "failed" || task.snapshot.status === "cancelled") return

    if (task.snapshot.status === "waiting") {
      task.snapshot.status = "cancelled"
      this.removeFromWaiting(id)
      task.callbacks.onState("cancelled")
      return
    }

    task.snapshot.status = "cancelled"
    this.running.delete(id)
    task.cancelActive?.()
    task.cancelActive = null
    task.callbacks.onState("cancelled")
    this.pump()
  }

  cancelAll(): void {
    for (const id of [...this.tasks.keys()]) this.cancel(id)
  }

  isBusy(): boolean {
    return this.waiting.length > 0 || this.running.size > 0
  }

  getTasks(): ConversionTaskSnapshot[] {
    return [...this.tasks.values()].map((task) => ({ ...task.snapshot }))
  }

  clearFinished(): void {
    for (const [id, task] of this.tasks) {
      if (task.snapshot.status === "complete" || task.snapshot.status === "failed" || task.snapshot.status === "cancelled") {
        this.tasks.delete(id)
      }
    }
  }

  private removeFromWaiting(id: string): void {
    const index = this.waiting.indexOf(id)
    if (index >= 0) this.waiting.splice(index, 1)
  }

  private pump(): void {
    while (this.running.size < this.maxConcurrentTasks && this.waiting.length > 0) {
      const id = this.waiting.shift()!
      const task = this.tasks.get(id)
      if (!task || task.snapshot.status !== "waiting") continue

      task.snapshot.status = "running"
      this.running.add(id)
      task.callbacks.onState("running")
      const callbacks: MediaConversionCallbacks = {
        onProgress: (percent) => {
          if (task.snapshot.status !== "running") return
          task.snapshot.percent = percent
          task.callbacks.onProgress(percent)
        },
        onDone: (outputPath) => {
          if (task.snapshot.status !== "running") return
          task.snapshot.status = "complete"
          task.snapshot.percent = 100
          task.snapshot.outputPath = outputPath
          this.running.delete(id)
          task.cancelActive = null
          task.callbacks.onDone(outputPath)
          task.callbacks.onState("complete")
          this.pump()
        },
        onError: (message) => {
          if (task.snapshot.status !== "running") return
          task.snapshot.status = "failed"
          task.snapshot.error = message
          this.running.delete(id)
          task.cancelActive = null
          task.callbacks.onError(message)
          task.callbacks.onState("failed")
          this.pump()
        },
      }
      task.cancelActive = this.startConversion(task.options, callbacks, this.toolchain)
    }
  }
}
