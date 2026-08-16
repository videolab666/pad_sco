import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import {
  aggregateRallyStats,
  isRallyStatsEnabled,
  recordRallyStat,
  removeLastRallyStat,
} from "../lib/rally-stats"

const baseMatch = (overrides: any = {}) =>
  backfillExtendedMatchState({
    id: "m",
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
    ...overrides,
  })

describe("Task 9 — recordRallyStat", () => {
  it("appends a stat with autofilled id / at", () => {
    const m = recordRallyStat(baseMatch(), {
      scoringTeam: "teamA",
      creditedTeam: "teamA",
      kind: "winner",
      racketSide: "forehand",
    })
    expect(m.rallyStats).toHaveLength(1)
    const stat = m.rallyStats[0]
    expect(stat.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(stat.kind).toBe("winner")
    // pairs with a rally-stat event
    expect(m.events[m.events.length - 1]).toMatchObject({ type: "rally-stat", actor: "teamA" })
  })

  it("immutable — input is unchanged", () => {
    const m = baseMatch()
    const before = JSON.stringify(m)
    recordRallyStat(m, { scoringTeam: "teamA", creditedTeam: "teamA", kind: "winner" })
    expect(JSON.stringify(m)).toBe(before)
  })
})

describe("Task 9 — removeLastRallyStat", () => {
  it("pops only the last stat", () => {
    let m = recordRallyStat(baseMatch(), { scoringTeam: "teamA", creditedTeam: "teamA", kind: "winner" })
    m = recordRallyStat(m, { scoringTeam: "teamB", creditedTeam: "teamA", kind: "error" })
    m = removeLastRallyStat(m)
    expect(m.rallyStats).toHaveLength(1)
    expect(m.rallyStats[0].kind).toBe("winner")
  })
})

describe("Task 9 — aggregateRallyStats", () => {
  it("counts winners / errors / forehand / backhand by credited team", () => {
    let m = baseMatch()
    m = recordRallyStat(m, { scoringTeam: "teamA", creditedTeam: "teamA", kind: "winner", racketSide: "forehand" })
    m = recordRallyStat(m, { scoringTeam: "teamA", creditedTeam: "teamA", kind: "winner", racketSide: "backhand" })
    m = recordRallyStat(m, { scoringTeam: "teamA", creditedTeam: "teamB", kind: "error", racketSide: "forehand" })
    m = recordRallyStat(m, { scoringTeam: "teamB", creditedTeam: "teamB", kind: "winner" })
    const agg = aggregateRallyStats(m)
    expect(agg.teamA).toEqual({ winners: 2, errors: 0, forehand: 1, backhand: 1 })
    expect(agg.teamB).toEqual({ winners: 1, errors: 1, forehand: 1, backhand: 0 })
  })

  it("handles missing rallyStats array", () => {
    const agg = aggregateRallyStats({})
    expect(agg.teamA.winners).toBe(0)
    expect(agg.teamB.errors).toBe(0)
  })
})

describe("Task 9 — isRallyStatsEnabled", () => {
  it("respects settings.recordRallyStats", () => {
    expect(isRallyStatsEnabled(baseMatch())).toBe(false)
    expect(isRallyStatsEnabled(baseMatch({ settings: { recordRallyStats: true } }))).toBe(true)
  })
})
