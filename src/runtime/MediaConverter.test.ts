import { expect, test } from "bun:test"
import { conversionCodecArgs } from "./MediaConverter"

test("maps video conversion formats to compatible codecs", () => {
  expect(conversionCodecArgs("video-to-video", "mp4")).toContain("libx264")
  expect(conversionCodecArgs("video-to-video", "webm")).toContain("libvpx-vp9")
  expect(conversionCodecArgs("video-to-video", "webm")).toContain("libopus")
})

test("maps audio outputs for both video and audio inputs", () => {
  expect(conversionCodecArgs("video-to-audio", "mp3")).toContain("libmp3lame")
  expect(conversionCodecArgs("audio-to-audio", "flac")).toContain("flac")
  expect(conversionCodecArgs("audio-to-audio", "wav")).toContain("pcm_s16le")
})
