import { describe, it, expect } from "vitest"
import { parseScoreboardSettings, resolveSettings } from "../lib/scoreboard-settings"

describe("scoreboard-settings: parseScoreboardSettings", () => {
  it("returns the documented defaults for an empty query", () => {
    const s = parseScoreboardSettings(new URLSearchParams(""))
    expect(s.theme).toBe("default")
    expect(s.showNames).toBe(true)
    expect(s.showCountry).toBe(true)
    expect(s.fontSize).toBe("normal")
    expect(s.bgOpacity).toBe(0.5)
    expect(s.playerNamesFontSize).toBe(1.2)
    expect(s.textColor).toBe("#ffffff")
    expect(s.accentColor).toBe("#a4fb23")
    expect(s.namesBgColor).toBe("#0369a1")
    expect(s.setsBgColor).toBe("#ffffff")
    expect(s.indicatorGradient).toBe(false)
    expect(s.outputFormat).toBe("html")
    expect(s.showDebug).toBe(false)
    expect(s.showBreakPoint).toBe(true)
  })

  it("showBreakPoint is on by default, off only when exactly 'false'", () => {
    expect(parseScoreboardSettings(new URLSearchParams("showBreakPoint=whatever")).showBreakPoint).toBe(true)
    expect(parseScoreboardSettings(new URLSearchParams("showBreakPoint=false")).showBreakPoint).toBe(false)
  })

  it("reads explicitly provided values", () => {
    const s = parseScoreboardSettings(
      new URLSearchParams("theme=dark&showNames=false&namesGradient=true&bgOpacity=0.8&debug=true"),
    )
    expect(s.theme).toBe("dark")
    expect(s.showNames).toBe(false)
    expect(s.namesGradient).toBe(true)
    expect(s.bgOpacity).toBe(0.8)
    expect(s.showDebug).toBe(true)
  })

  it("show* flags are true unless the value is exactly 'false'", () => {
    expect(parseScoreboardSettings(new URLSearchParams("showSets=whatever")).showSets).toBe(true)
    expect(parseScoreboardSettings(new URLSearchParams("showSets=false")).showSets).toBe(false)
  })

  it("gradient flags are false unless the value is exactly 'true'", () => {
    expect(parseScoreboardSettings(new URLSearchParams("setsGradient=1")).setsGradient).toBe(false)
    expect(parseScoreboardSettings(new URLSearchParams("setsGradient=true")).setsGradient).toBe(true)
  })

  it("prepends '#' to a color param that lacks it", () => {
    expect(parseScoreboardSettings(new URLSearchParams("textColor=ff0000")).textColor).toBe("#ff0000")
    expect(parseScoreboardSettings(new URLSearchParams("textColor=%23abcdef")).textColor).toBe("#abcdef")
  })
})

describe("scoreboard-settings: resolveSettings", () => {
  const base = parseScoreboardSettings(new URLSearchParams(""))

  it("returns the common block flat, with no per-variant sub-sections", () => {
    const r = resolveSettings(base, "overlay")
    expect(r.theme).toBe("default")
    expect("court" in r).toBe(false)
    expect("overlay" in r).toBe(false)
    expect("fullscreen" in r).toBe(false)
  })

  it("applies only the requested variant's override section", () => {
    const settings = {
      ...base,
      overlay: { fontSize: "large" },
      fullscreen: { fontSize: "xlarge", showCountry: false },
    }
    expect(resolveSettings(settings, "overlay").fontSize).toBe("large")
    expect(resolveSettings(settings, "fullscreen").fontSize).toBe("xlarge")
    expect(resolveSettings(settings, "fullscreen").showCountry).toBe(false)
    // court has no override → keeps the common value
    expect(resolveSettings(settings, "court").fontSize).toBe("normal")
    expect(resolveSettings(settings, "court").showCountry).toBe(true)
  })

  it("leaves the common block untouched when a variant has no overrides", () => {
    expect(resolveSettings(base, "fullscreen")).toMatchObject({ theme: "default", fontSize: "normal" })
  })
})
