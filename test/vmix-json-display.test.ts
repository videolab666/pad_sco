import { describe, it, expect } from "vitest"
import { buildCourtVmixPayload } from "../lib/match-view"
import { parseScoreboardSettings } from "../lib/scoreboard-settings"

const match = {
  teamA: {
    players: [
      { name: "Anna Petrova", country: "UKR", avatar: "https://x/a.png" },
      { name: "Bjorn" },
    ],
  },
  teamB: { players: [{ name: "Ivan Ivanov" }] },
}

const parse = (q: string) => parseScoreboardSettings(new URLSearchParams(q))

describe("buildCourtVmixPayload display fields", () => {
  it("court_name: display-имя корта из реестра, пусто по умолчанию (Шаг 2)", () => {
    const d = buildCourtVmixPayload(match, null)
    expect(d.court_name).toBe("")
    const named = buildCourtVmixPayload(match, 4, undefined, "Центральный корт")
    expect(named.court_name).toBe("Центральный корт")
    expect(named.court_number).toBe(4)
    // нечисловой корт: court_number 0, имя — главный идентификатор
    const nonNumeric = buildCourtVmixPayload(match, null, undefined, "Центральний")
    expect(nonNumeric.court_number).toBe(0)
    expect(nonNumeric.court_name).toBe("Центральний")
  })

  it("defaults: full name single line, as-is case, flag emoji", () => {
    const d = buildCourtVmixPayload(match, null)
    expect(d.teamA_player1_first).toBe("Anna")
    expect(d.teamA_player1_last).toBe("Petrova")
    expect(d.teamA_player1_line1).toBe("Anna Petrova")
    expect(d.teamA_player1_line2).toBe("")
    expect(d.teamA_player1_flag).toBe("🇺🇦") // ISO3 UKR normalised
    expect(d.teamA_player1_country_code).toBe("UA")
    expect(d.teamA_player1_country_name).toBe("Украина")
    expect(d.teamA_player1_avatar).toBe("https://x/a.png")
  })

  it("single-word names keep line2 empty and survive", () => {
    const d = buildCourtVmixPayload(match, null)
    expect(d.teamA_player2_first).toBe("Bjorn")
    expect(d.teamA_player2_last).toBe("")
    expect(d.teamA_player2_line1).toBe("Bjorn")
  })

  it("two lines + last-on-top + UPPER case", () => {
    const d = buildCourtVmixPayload(match, null, parse("nameLines=two&nameLineOrder=last-top&nameCase=upper"))
    expect(d.teamA_player1_line1).toBe("PETROVA")
    expect(d.teamA_player1_line2).toBe("ANNA")
    expect(d.teamB_player1_line1).toBe("IVANOV")
  })

  it("single line last-first order", () => {
    const d = buildCourtVmixPayload(match, null, parse("nameLineOrder=last-top"))
    expect(d.teamA_player1_line1).toBe("Petrova Anna")
  })

  it("nameAs=last collapses to one part", () => {
    const d = buildCourtVmixPayload(match, null, parse("nameAs=last"))
    expect(d.teamA_player1_first).toBe("Petrova")
    expect(d.teamA_player1_last).toBe("")
    expect(d.teamA_player1_line1).toBe("Petrova")
  })

  it("countryAs=code / name changes country_display but not flag", () => {
    const d = buildCourtVmixPayload(match, null, parse("countryAs=name"))
    expect(d.teamA_player1_country_display).toBe("Украина")
    expect(d.teamA_player1_flag).toBe("🇺🇦")
  })

  it("empty players yield empty strings, never undefined", () => {
    const d = buildCourtVmixPayload(match, null)
    expect(d.teamB_player2_first).toBe("")
    expect(d.teamB_player2_flag).toBe("")
    expect(d.teamB_player2_avatar).toBe("")
  })
})
