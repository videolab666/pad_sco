import { describe, it, expect } from "vitest"
import { parseScoreboardSettings } from "../lib/scoreboard-settings"

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
