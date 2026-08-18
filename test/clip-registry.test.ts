// Чистые хелперы clip-pipeline (plan-4 §138/§141/§192).

import { describe, expect, it } from "vitest"
import {
  buildClipArgs,
  buildConcatList,
  buildThumbArgs,
  computeClipRange,
  parseSegmentStartMs,
  selectSegments,
} from "../lib/clip-registry"

describe("computeClipRange (§138)", () => {
  it("маркер 30с, pre 20с / post 10с → 10–40с", () => {
    expect(computeClipRange({ videoPositionMs: 30000, preRollMs: 20000, postRollMs: 10000 })).toEqual({
      inMs: 10000,
      outMs: 40000,
    })
  })

  it("не уходит в минус в начале записи", () => {
    expect(computeClipRange({ videoPositionMs: 5000, preRollMs: 20000, postRollMs: 10000 })).toEqual({
      inMs: 0,
      outMs: 15000,
    })
  })
})

describe("parseSegmentStartMs (имена сегментов MediaMTX §192)", () => {
  it("разбирает имя с микросекундами", () => {
    const ms = parseSegmentStartMs("2026-08-18_10-17-28_840741.mp4")
    expect(ms).not.toBeNull()
    const d = new Date(ms!)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7) // август
    expect(d.getDate()).toBe(18)
    expect(d.getHours()).toBe(10)
    expect(d.getMinutes()).toBe(17)
    expect(d.getSeconds()).toBe(28)
  })

  it("отклоняет чужие имена", () => {
    expect(parseSegmentStartMs("clip.mp4")).toBeNull()
    expect(parseSegmentStartMs("2026-08-18_10-17-28.mp4")).toBeNull()
  })
})

describe("selectSegments (§141: перекрытие диапазона)", () => {
  const segs = [
    { name: "a.mp4", startMs: 0 },
    { name: "b.mp4", startMs: 30_000 },
    { name: "c.mp4", startMs: 60_000 },
    { name: "d.mp4", startMs: 90_000 },
  ]

  it("диапазон 10–40с захватывает сегменты 0с и 30с", () => {
    expect(selectSegments(segs, 10_000, 40_000)).toEqual(["a.mp4", "b.mp4"])
  })

  it("диапазон внутри одного сегмента", () => {
    expect(selectSegments(segs, 65_000, 70_000)).toEqual(["c.mp4"])
  })

  it("за пределами записи — пусто", () => {
    expect(selectSegments(segs, 500_000, 510_000)).toEqual([])
  })

  it("сортирует по старту независимо от входного порядка", () => {
    expect(selectSegments([...segs].reverse(), 25_000, 65_000)).toEqual(["a.mp4", "b.mp4", "c.mp4"])
  })
})

describe("ffmpeg args", () => {
  it("buildConcatList: ffconcat с экранированием", () => {
    const list = buildConcatList(["a.mp4", "b's.mp4"])
    expect(list).toContain("ffconcat version 1.0")
    expect(list).toContain("file 'a.mp4'")
    // posix-стиль concat-демуксера: ' → '\''
    expect(list).toContain("file 'b'\\''s.mp4'")
  })

  it("buildClipArgs: concat + -ss до входа + длительность + copy (§141)", () => {
    const args = buildClipArgs({ listPath: "list.txt", inMs: 10500, outMs: 40500, outPath: "clip.mp4" })
    expect(args).toContain("concat")
    expect(args[args.indexOf("-ss") + 1]).toBe("10.500")
    expect(args[args.indexOf("-to") + 1]).toBe("30.000")
    expect(args).toContain("copy")
    expect(args).toContain("+faststart")
    expect(args.at(-1)).toBe("clip.mp4")
  })

  it("buildThumbArgs: один кадр, масштаб", () => {
    const args = buildThumbArgs({ clipPath: "c.mp4", outPath: "t.jpg", seekSec: 1.5 })
    expect(args[args.indexOf("-ss") + 1]).toBe("1.5")
    expect(args[args.indexOf("-frames:v") + 1]).toBe("1")
    expect(args).toContain("scale=640:-2")
  })
})
