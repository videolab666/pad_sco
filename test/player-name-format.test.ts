import { describe, it, expect } from "vitest"
import { formatPlayerName } from "../lib/player-name-format"
import { parseScoreboardSettings } from "../lib/scoreboard-settings"

describe("formatPlayerName (APK NamePart)", () => {
  it("full mode returns the name as-is", () => {
    expect(formatPlayerName("Anna Petrova", "full")).toBe("Anna Petrova")
  })

  it("first / last pick the corresponding word", () => {
    expect(formatPlayerName("Anna Petrova", "first")).toBe("Anna")
    expect(formatPlayerName("Anna Petrova", "last")).toBe("Petrova")
    expect(formatPlayerName("Anna Maria Petrova", "last")).toBe("Petrova")
    expect(formatPlayerName("Anna Maria Petrova", "first")).toBe("Anna")
  })

  it("single-word names survive every mode; empties stay empty", () => {
    expect(formatPlayerName("Bjorn", "last")).toBe("Bjorn")
    expect(formatPlayerName("Bjorn", "first")).toBe("Bjorn")
    expect(formatPlayerName("", "full")).toBe("")
    expect(formatPlayerName(undefined, "first")).toBe("")
    expect(formatPlayerName("  Anna  Petrova ", "first")).toBe("Anna")
  })
})

describe("scoreboard settings: nameAs URL param", () => {
  const parse = (q: string) => parseScoreboardSettings(new URLSearchParams(q))

  it("defaults to the full name", () => {
    expect(parse("").playerNameFormat).toBe("full")
  })

  it("reads first/last from the URL and falls back on unknown values", () => {
    expect(parse("nameAs=last").playerNameFormat).toBe("last")
    expect(parse("nameAs=first").playerNameFormat).toBe("first")
    expect(parse("nameAs=nickname").playerNameFormat).toBe("full")
  })
})

import { splitNameParts, applyNameCase } from "../lib/player-name-format"

describe("splitNameParts", () => {
  it("splits two-word names and keeps single words in first", () => {
    expect(splitNameParts("Anna Petrova")).toEqual({ first: "Anna", last: "Petrova" })
    expect(splitNameParts("Bjorn")).toEqual({ first: "Bjorn", last: "" })
    expect(splitNameParts("Anna Maria Petrova")).toEqual({ first: "Anna", last: "Petrova" })
  })

  it("empty/null names produce empty parts", () => {
    expect(splitNameParts("")).toEqual({ first: "", last: "" })
    expect(splitNameParts(null)).toEqual({ first: "", last: "" })
    expect(splitNameParts("   ")).toEqual({ first: "", last: "" })
  })
})

describe("applyNameCase", () => {
  it("upper / lower / capitalize / as-is", () => {
    expect(applyNameCase("Anna Petrova", "upper")).toBe("ANNA PETROVA")
    expect(applyNameCase("Anna Petrova", "lower")).toBe("anna petrova")
    expect(applyNameCase("aNnA pEtRoVa", "capitalize")).toBe("Anna Petrova")
    expect(applyNameCase("Anna Petrova", "as-is")).toBe("Anna Petrova")
  })

  it("empty text stays empty", () => {
    expect(applyNameCase("", "upper")).toBe("")
  })
})

describe("scoreboard settings: name layout URL params", () => {
  const parse = (q: string) => parseScoreboardSettings(new URLSearchParams(q))

  it("defaults: single line, first on top, as-is case, linked styles", () => {
    const s = parse("")
    expect(s.nameLines).toBe("single")
    expect(s.nameLineOrder).toBe("first-top")
    expect(s.nameCase).toBe("as-is")
    expect(s.nameSizeLinked).toBe(true)
    expect(s.nameWeightLinked).toBe(true)
    expect(s.nameSizeFirst).toBe(1)
    expect(s.nameWeightFirst).toBe("700")
  })

  it("reads two-line order, case and per-part styles", () => {
    const s = parse("nameLines=two&nameLineOrder=last-top&nameCase=upper&nameSizeLinked=false&nameSizeFirst=1.4&nameSizeLast=1&nameWeightLinked=false&nameWeightFirst=800&nameWeightLast=400")
    expect(s.nameLines).toBe("two")
    expect(s.nameLineOrder).toBe("last-top")
    expect(s.nameCase).toBe("upper")
    expect(s.nameSizeLinked).toBe(false)
    expect(s.nameSizeFirst).toBe(1.4)
    expect(s.nameWeightFirst).toBe("800")
    expect(s.nameWeightLast).toBe("400")
  })

  it("invalid values fall back to defaults", () => {
    const s = parse("nameCase=weird&nameSizeFirst=abc&nameLines=three")
    expect(s.nameCase).toBe("as-is")
    expect(s.nameSizeFirst).toBe(1)
    expect(s.nameLines).toBe("single")
  })
})

import { sanitizeScoreboardSettings } from "../lib/scoreboard-settings"

describe("sanitizeScoreboardSettings", () => {
  it("keeps known keys with valid types and drops everything else", () => {
    const out = sanitizeScoreboardSettings({
      nameLines: "two",
      nameCase: "upper",
      showAvatar: true,
      nameSizeFirst: 1.4,
      nameWeightFirst: "800",
      textColor: "#fff",
      // мусор — отбрасывается
      hacked: "x",
      nameLines2: "two",
      theme: 123,
      bgOpacity: "not-a-number",
    })
    expect(out.nameLines).toBe("two")
    expect(out.nameCase).toBe("upper")
    expect(out.showAvatar).toBe(true)
    expect(out.nameSizeFirst).toBe(1.4)
    expect(out.nameWeightFirst).toBe("800")
    expect((out as Record<string, unknown>).hacked).toBeUndefined()
    expect((out as Record<string, unknown>).theme).toBeUndefined()
    expect((out as Record<string, unknown>).bgOpacity).toBeUndefined()
  })

  it("rejects invalid enum values and non-finite numbers", () => {
    const out = sanitizeScoreboardSettings({ countryAs: "picture", nameSizeLast: -2 })
    expect(out.countryAs).toBeUndefined()
    expect(out.nameSizeLast).toBeUndefined()
  })

  it("tolerates null/garbage input", () => {
    expect(sanitizeScoreboardSettings(null)).toEqual({})
    expect(sanitizeScoreboardSettings("str")).toEqual({})
  })
})
