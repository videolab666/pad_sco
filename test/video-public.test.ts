// URL-билдеры публичного видео (lib/video-public, §146).

import { describe, expect, it } from "vitest"
import { buildClipFileUrl, buildFullMatchVodUrl, buildLiveHlsUrl, buildPlaybackWindow } from "../lib/video-public"

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

describe("buildPlaybackWindow (единый источник — часы gateway, plan 2026-09-02)", () => {
  it("gateway-таймстампы: lead 1с, pad 6с", () => {
    const win = buildPlaybackWindow({
      startedAt: "2026-09-02T18:00:00Z",
      endedAt: "2026-09-02T18:30:00Z",
      mediaStartedAt: "2026-09-02T18:00:02Z",
      mediaEndedAt: "2026-09-02T18:30:05Z",
    })
    expect(win.start).toBe("2026-09-02T18:00:03.000Z")
    expect(win.durationSec).toBe(30 * 60 + 3 + 6)
  })

  it("фолбэк без media-таймстампов: lead 4с от started_at", () => {
    const win = buildPlaybackWindow({ startedAt: "2026-09-02T18:00:00Z", endedAt: "2026-09-02T18:10:00Z" })
    expect(win.start).toBe("2026-09-02T18:00:04.000Z")
    expect(win.durationSec).toBe(10 * 60 + 6)
  })

  it("инвертированные времена (сдвиг часов) → не отрицательная длительность", () => {
    const win = buildPlaybackWindow({ startedAt: "2026-09-02T18:00:08Z", endedAt: "2026-09-02T18:00:00Z" })
    expect(win.durationSec).toBeGreaterThanOrEqual(1)
  })

  it("lead не съедает короткую запись", () => {
    const win = buildPlaybackWindow({
      startedAt: "2026-09-02T18:00:00Z",
      endedAt: "2026-09-02T18:00:01Z",
      mediaStartedAt: "2026-09-02T18:00:00Z",
      mediaEndedAt: "2026-09-02T18:00:01Z",
    })
    expect(Date.parse(win.start)).toBeLessThan(Date.parse("2026-09-02T18:00:01.500Z"))
    expect(win.durationSec).toBeGreaterThanOrEqual(1)
  })
})
