// Reel-хелперы (plan-4 §143-144): топ маркеров + вертикальные ffmpeg-арги.

import { describe, expect, it } from "vitest"
import { buildVerticalClipArgs, selectTopMarkers } from "../lib/reel-registry"

const m = (id: string, importance: number, positionMs: number) => ({ id, importance, positionMs })

describe("selectTopMarkers (§140/§144)", () => {
  it("сортирует по важности, при равенстве — по времени", () => {
    const top = selectTopMarkers(
      [m("a", 5, 1000), m("b", 10, 9000), m("c", 7, 5000), m("d", 10, 3000)],
      3,
    )
    expect(top.map((x) => x.id)).toEqual(["d", "b", "c"])
  })

  it("MANUAL_HIGHLIGHT выше матч-пойнта", () => {
    const top = selectTopMarkers([m("mp", 7, 1000), m("hl", 10, 9000)], 2)
    expect(top[0].id).toBe("hl")
  })

  it("ограничивает topN и не падает на пустом", () => {
    expect(selectTopMarkers([m("a", 1, 0), m("b", 2, 0), m("c", 3, 0)], 2).length).toBe(2)
    expect(selectTopMarkers([], 3)).toEqual([])
  })
})

describe("buildVerticalClipArgs (§143)", () => {
  it("центр-кроп 9:16 + re-encode (не copy!)", () => {
    const args = buildVerticalClipArgs({ listPath: "l.txt", inMs: 10000, outMs: 40000, outPath: "v.mp4" })
    const vf = args[args.indexOf("-vf") + 1]
    expect(vf).toBe("crop=ih*9/16:ih,scale=1080:1920")
    expect(args).toContain("libx264")
    expect(args.join(" ")).not.toContain("-c copy") // видео перекодируется; аудио copy допустим
    expect(args[args.indexOf("-ss") + 1]).toBe("10.000")
    expect(args[args.indexOf("-to") + 1]).toBe("30.000")
  })
})
