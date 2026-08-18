// URL-билдеры публичного видео (lib/video-public, §146).

import { describe, expect, it } from "vitest"
import { buildClipFileUrl, buildFullMatchVodUrl, buildLiveHlsUrl } from "../lib/video-public"

describe("buildLiveHlsUrl", () => {
  it("LL-HLS плейлист на gateway", () => {
    expect(buildLiveHlsUrl("court-3-main", "http://gw:8888/")).toBe(
      "http://gw:8888/court-3-main/index.m3u8",
    )
  })
})

describe("buildFullMatchVodUrl", () => {
  it("playback API: path/start закодированы, duration округлён", () => {
    const url = buildFullMatchVodUrl({
      streamKey: "court-3-main",
      startedAt: "2026-08-18T10:17:28.840741+03:00",
      durationSec: 95.6,
      base: "http://pb:9996",
    })
    expect(url).toContain("http://pb:9996/get?path=court-3-main&start=")
    expect(url).toContain(encodeURIComponent("2026-08-18T10:17:28.840741+03:00"))
    expect(url.endsWith("&duration=96")).toBe(true)
  })

  it("минимальная длительность — 1с", () => {
    expect(buildFullMatchVodUrl({ streamKey: "k", startedAt: "2026-01-01T00:00:00Z", durationSec: 0, base: "http://x" }).endsWith("duration=1")).toBe(true)
  })
})

describe("buildClipFileUrl", () => {
  it("файл и миниатюра", () => {
    expect(buildClipFileUrl("abc")).toBe("/api/v1/video/clips/abc/file")
    expect(buildClipFileUrl("abc", true)).toBe("/api/v1/video/clips/abc/file?variant=thumb")
    expect(buildClipFileUrl("abc", false, "https://club.app/")).toBe("https://club.app/api/v1/video/clips/abc/file")
  })
})
