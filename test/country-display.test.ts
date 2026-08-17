import { describe, it, expect } from "vitest"
import { countryToFlag, getCountryName, formatCountry, isSameCountryAllPlayers, toIso2 } from "../lib/country-display"
import { parseScoreboardSettings } from "../lib/scoreboard-settings"

describe("toIso2 (DY feeds send ISO3 codes like UKR)", () => {
  it("normalises 2- and 3-letter codes", () => {
    expect(toIso2("ua")).toBe("UA")
    expect(toIso2("UKR")).toBe("UA")
    expect(toIso2("esp")).toBe("ES")
    expect(toIso2("USA")).toBe("US")
  })

  it("returns empty for unknown shapes/codes", () => {
    expect(toIso2("")).toBe("")
    expect(toIso2("XXXX")).toBe("")
    expect(toIso2("1A")).toBe("")
  })
})

describe("countryToFlag", () => {
  it("converts ISO2 codes to emoji flags", () => {
    expect(countryToFlag("UA")).toBe("🇺🇦")
    expect(countryToFlag("ua")).toBe("🇺🇦")
    expect(countryToFlag("ES")).toBe("🇪🇸")
    expect(countryToFlag("FR")).toBe("🇫🇷")
  })

  it("returns empty string for invalid input", () => {
    expect(countryToFlag("")).toBe("")
    expect(countryToFlag("U")).toBe("")
    expect(countryToFlag("UKR")).toBe("")
    expect(countryToFlag("12")).toBe("")
    expect(countryToFlag(null)).toBe("")
    expect(countryToFlag(undefined)).toBe("")
  })
})

describe("getCountryName", () => {
  it("resolves Russian names for known codes, falls back to the code", () => {
    expect(getCountryName("UA")).toBe("Украина")
    expect(getCountryName("ar")).toBe("Аргентина")
    expect(getCountryName("XX")).toBe("XX")
    expect(getCountryName("")).toBe("")
  })
})

describe("formatCountry (APK ShowCountryAs)", () => {
  it("flag mode returns the emoji, normalising ISO3 feed codes", () => {
    expect(formatCountry("UA", "flag")).toBe("🇺🇦")
    expect(formatCountry("UKR", "flag")).toBe("🇺🇦")
    expect(formatCountry("XXXX", "flag")).toBe("XXXX") // unknown → raw code
  })

  it("code mode upper-cases / normalises, name mode translates", () => {
    expect(formatCountry("ua", "code")).toBe("UA")
    expect(formatCountry("UKR", "code")).toBe("UA")
    expect(formatCountry("UKR", "name")).toBe("Украина")
    expect(formatCountry("ua", "name")).toBe("Украина")
  })

  it("empty country stays empty in every mode", () => {
    expect(formatCountry("", "flag")).toBe("")
    expect(formatCountry(undefined, "name")).toBe("")
  })
})

describe("isSameCountryAllPlayers (APK hideFlagForSameCountry)", () => {
  const match = (a: string[], b: string[]) => ({
    teamA: { players: a.map((country) => ({ country })) },
    teamB: { players: b.map((country) => ({ country })) },
  })

  it("true when every player on both sides has the same country", () => {
    expect(isSameCountryAllPlayers(match(["UA", "UA"], ["UA", "UA"]))).toBe(true)
    expect(isSameCountryAllPlayers(match(["ES"], ["es"]))).toBe(true)
  })

  it("false for mixed countries or any unknown country", () => {
    expect(isSameCountryAllPlayers(match(["UA", "ES"], ["UA", "UA"]))).toBe(false)
    expect(isSameCountryAllPlayers(match(["UA", ""], ["UA", "UA"]))).toBe(false)
    expect(isSameCountryAllPlayers(match([], []))).toBe(false)
  })
})

describe("scoreboard settings: countryAs / hideSameCountry URL params", () => {
  const parse = (q: string) => parseScoreboardSettings(new URLSearchParams(q))

  it("defaults to flag mode, hide off", () => {
    const s = parse("")
    expect(s.countryAs).toBe("flag")
    expect(s.hideSameCountry).toBe(false)
  })

  it("reads countryAs and hideSameCountry from the URL", () => {
    const s = parse("countryAs=name&hideSameCountry=true")
    expect(s.countryAs).toBe("name")
    expect(s.hideSameCountry).toBe(true)
  })

  it("falls back to flag for an unknown countryAs value", () => {
    expect(parse("countryAs=picture").countryAs).toBe("flag")
  })
})

describe("scoreboard settings: showAvatar / hideSameAvatar URL params", () => {
  const parse = (q: string) => parseScoreboardSettings(new URLSearchParams(q))

  it("avatar column is off by default", () => {
    const s = parse("")
    expect(s.showAvatar).toBe(false)
  })

  it("reads showAvatar and hideSameAvatar from the URL", () => {
    const s = parse("showAvatar=true&hideSameAvatar=false")
    expect(s.showAvatar).toBe(true)
    expect(s.hideSameAvatar).toBe(false)
  })
})

import { COUNTRIES, countryByCode, iso2Flag } from "../lib/countries"

describe("countries reference (combobox source)", () => {
  it("has unique ISO2/ISO3 codes and the key racket-sport countries", () => {
    expect(new Set(COUNTRIES.map((c) => c.iso2)).size).toBe(COUNTRIES.length)
    expect(new Set(COUNTRIES.map((c) => c.iso3)).size).toBe(COUNTRIES.length)
    for (const code of ["UA", "ES", "AR", "FR", "US", "GB", "IT", "BR", "DE"]) {
      expect(countryByCode(code)).toBeDefined()
    }
  })

  it("countryByCode accepts ISO2 and ISO3; iso2Flag renders emoji", () => {
    expect(countryByCode("ukr")?.iso2).toBe("UA")
    expect(countryByCode("ESP")?.ru).toBe("Испания")
    expect(iso2Flag("UA")).toBe("🇺🇦")
    expect(iso2Flag("XXX")).toBe("")
  })
})
