import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import { applyConductPenalty, getOfficialCalls, recordOfficialCall } from "../lib/match-official-calls"

const baseMatch = (overrides: any = {}) =>
  backfillExtendedMatchState({
    id: "m",
    format: "doubles",
    settings: { sets: 3, scoringSystem: "classic", goldenPointFormat: "none", tiebreakEnabled: true, tiebreakAt: "6-6" },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
    currentServer: { team: "teamA", playerIndex: 0 },
    courtSides: { teamA: "left", teamB: "right" },
    isCompleted: false,
    ...overrides,
  })

describe("Task 13 — official calls", () => {
  it("recordOfficialCall appends without changing the score", () => {
    const m = recordOfficialCall(baseMatch(), { type: "appeal", team: "teamA", decision: "let" })
    expect(getOfficialCalls(m)).toHaveLength(1)
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 0, teamB: 0 })
  })

  it("appeal vs conduct vs broken-equipment all produce events of distinct types", () => {
    let m = baseMatch()
    m = recordOfficialCall(m, { type: "appeal", team: "teamA" })
    m = recordOfficialCall(m, { type: "conduct", team: "teamA", penalty: "warning" })
    m = recordOfficialCall(m, { type: "broken-equipment", team: "teamA", equipment: "string" })
    const types = m.events.filter((e: any) => ["appeal", "conduct", "broken-equipment"].includes(e.type)).map((e: any) => e.type)
    expect(types).toEqual(["appeal", "conduct", "broken-equipment"])
  })

  it("applyConductPenalty 'stroke' awards a point to the other team", () => {
    const m = applyConductPenalty(baseMatch(), "teamA", "stroke")
    // 0 → 15 for teamB
    expect(m.score.currentSet.currentGame.teamB).toBe(15)
    expect(getOfficialCalls(m)).toHaveLength(1)
  })

  it("applyConductPenalty 'warning' records but does not change score", () => {
    const m = applyConductPenalty(baseMatch(), "teamA", "warning")
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 0, teamB: 0 })
    expect(getOfficialCalls(m)).toHaveLength(1)
  })
})
