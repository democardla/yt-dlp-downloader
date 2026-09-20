import { afterEach, expect, test } from "bun:test"
import { ConversionScheduler } from "./ConversionScheduler"
import type { MediaConversionCallbacks, MediaConversionOptions } from "./MediaConverter"
import type { Toolchain } from "./Toolchain"

const toolchain: Toolchain = {
  platform: "darwin",
  operatingSystem: "macos",
  ffmpegPath: "/usr/local/bin/ffmpeg",
  ffprobePath: "/usr/local/bin/ffprobe",
  ytDlpPath: null,
  ready: true,
  diagnostics: [],
  searchedDirectories: [],
}

const option = (inputPath: string): MediaConversionOptions => ({
  kind: "video-to-video",
  inputPath,
  outputDirectory: "/tmp",
  outputFormat: "mp4",
})

const callbacks = (states: string[], done: string[]) => ({
  onState: (state: string) => states.push(state),
  onProgress: () => {},
  onDone: (outputPath: string) => done.push(outputPath),
  onError: () => {},
})

let scheduler: ConversionScheduler | null = null

afterEach(() => {
  scheduler?.cancelAll()
  scheduler = null
})

test("keeps waiting work queued and starts it after a running task completes", async () => {
  const active: Array<{ callbacks: MediaConversionCallbacks; cancel: () => void }> = []
  scheduler = new ConversionScheduler(toolchain, 1, (_options, mediaCallbacks) => {
    const item = { callbacks: mediaCallbacks, cancel: () => {} }
    active.push(item)
    return item.cancel
  })
  const firstStates: string[] = []
  const secondStates: string[] = []
  scheduler.enqueue(option("one.mp4"), callbacks(firstStates, []))
  scheduler.enqueue(option("two.mp4"), callbacks(secondStates, []))

  expect(firstStates).toEqual(["waiting", "running"])
  expect(secondStates).toEqual(["waiting"])
  active[0]!.callbacks.onDone("one-out.mp4")
  await Bun.sleep(0)
  expect(secondStates).toEqual(["waiting", "running"])
})

test("cancels waiting and running tasks independently", () => {
  const active: Array<{ callbacks: MediaConversionCallbacks; cancel: () => void }> = []
  scheduler = new ConversionScheduler(toolchain, 1, (_options, mediaCallbacks) => {
    const item = { callbacks: mediaCallbacks, cancel: () => {} }
    active.push(item)
    return item.cancel
  })
  const firstStates: string[] = []
  const secondStates: string[] = []
  const first = scheduler.enqueue(option("one.mp4"), callbacks(firstStates, []))
  const second = scheduler.enqueue(option("two.mp4"), callbacks(secondStates, []))

  second.cancel()
  expect(secondStates).toEqual(["waiting", "cancelled"])
  first.cancel()
  expect(firstStates).toEqual(["waiting", "running", "cancelled"])
  expect(scheduler.isBusy()).toBe(false)
})
