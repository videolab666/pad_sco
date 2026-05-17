import { describe, it, expect } from "vitest"
import {
  buildVmixFlatData,
  getCurrentSetNumber,
  getDisplaySets,
  getGameScoreDisplay,
  getImportantEventType,
  getMatchSetsToWin,
  getMatchTotalSets,
  getServeSide,
  getSetCellDisplay,
  getSetCount,
  getSetScoreColumns,
  getTeamDisplayName,
  isTeamServing,
} from "../lib/match-view"

// ─────────────────────────────────────────────────────────────────────────────
// This is the reference suite: copy its shape for every new sport / module.
//   • one `describe` per module or feature,
//   • one `it` per behaviour, with a sentence describing the expectation,
//   • a small `make…()` factory for fixtures, overridable per test.
// See test/README.md for the full convention.
// ─────────────────────────────────────────────────────────────────────────────

function makeMatch(overrides: Record<string, any> = {}) {
  return {
    id: "m-test",
    courtNumber: 3,
    isCompleted: false,
    winner: null,
    settings: { sets: 3 },
    teamA: { players: [{ name: "A1" }, { name: "A2" }] },
    teamB: { players: [{ name: "B1" }, { name: "B2" }] },
    currentServer: { team: "teamA", playerIndex: 0 },
    score: {
      teamA: 1,
      teamB: 0,
      sets: [{ teamA: 6, teamB: 4, winner: "teamA" }],
      currentSet: {
        teamA: 2,
        teamB: 3,
        games: [],
        currentGame: { teamA: 30, teamB: 15 },
        isTiebreak: false,
      },
    },
    ...overrides,
  }
}

describe("match-view: getSetCount", () => {
  it("returns the configured set count", () => {
    expect(getSetCount(makeMatch())).toBe(3)
  })

  it("falls back to 3 when the setting is missing or invalid", () => {
    expect(getSetCount(makeMatch({ settings: {} }))).toBe(3)
    expect(getSetCount(makeMatch({ settings: { sets: 0 } }))).toBe(3)
  })
})

describe("match-view: getGameScoreDisplay", () => {
  it("maps tennis points to their labels in a normal game", () => {
    const m = makeMatch()
    expect(getGameScoreDisplay(m, "teamA")).toBe("30")
    expect(getGameScoreDisplay(m, "teamB")).toBe("15")
  })

  it("returns the raw point count during a tiebreak", () => {
    const m = makeMatch()
    m.score.currentSet.isTiebreak = true
    m.score.currentSet.currentGame = { teamA: 5, teamB: 3 }
    expect(getGameScoreDisplay(m, "teamA")).toBe(5)
  })
})

describe("match-view: team helpers", () => {
  it("joins player names for display", () => {
    expect(getTeamDisplayName(makeMatch(), "teamA")).toBe("A1 / A2")
  })

  it("reports which team is serving", () => {
    const m = makeMatch()
    expect(isTeamServing(m, "teamA")).toBe(true)
    expect(isTeamServing(m, "teamB")).toBe(false)
  })
})

describe("match-view: set columns", () => {
  it("includes the live current set while the match runs", () => {
    const cols = getSetScoreColumns(makeMatch())
    expect(cols.teamA).toEqual([6, 2])
    expect(cols.teamB).toEqual([4, 3])
  })

  it("omits the current set once the match is completed", () => {
    const cols = getSetScoreColumns(makeMatch({ isCompleted: true }))
    expect(cols.teamA).toEqual([6])
    expect(cols.teamB).toEqual([4])
  })
})

describe("match-view: getDisplaySets", () => {
  it("returns completed, current and padded future sets", () => {
    const sets = getDisplaySets(makeMatch())
    expect(sets).toHaveLength(3)
    expect(sets[0]).toMatchObject({ teamA: 6, teamB: 4 })
    expect(sets[1]).toMatchObject({ teamA: 2, teamB: 3, isCurrent: true })
    expect(sets[2]).toMatchObject({ isFuture: true })
  })
})

describe("match-view: getServeSide", () => {
  it("serves from the right on an even point count", () => {
    const m = makeMatch()
    m.score.currentSet.currentGame = { teamA: 0, teamB: 0 }
    expect(getServeSide(m)).toBe("R")
  })

  it("serves from the left on an odd point count", () => {
    const m = makeMatch()
    m.score.currentSet.currentGame = { teamA: 15, teamB: 0 }
    expect(getServeSide(m)).toBe("L")
  })
})

describe("match-view: match-set metadata (JSON helpers)", () => {
  it("getMatchTotalSets reads settings.sets, then format fallbacks, else 3", () => {
    expect(getMatchTotalSets(makeMatch())).toBe(3)
    expect(getMatchTotalSets(makeMatch({ settings: {}, format: { bestOf: 5 } }))).toBe(5)
    expect(getMatchTotalSets(makeMatch({ settings: {}, format: "doubles" }))).toBe(3)
  })

  it("getMatchSetsToWin honours an explicit override, else derives it", () => {
    expect(getMatchSetsToWin(makeMatch())).toBe(2) // best-of-3 → 2
    expect(getMatchSetsToWin(makeMatch({ settings: { sets: 3, setsToWin: 1 } }))).toBe(1)
  })

  it("getCurrentSetNumber counts the set in play, or the last one if completed", () => {
    // makeMatch: 1 completed set, in progress → set 2
    expect(getCurrentSetNumber(makeMatch())).toBe(2)
    expect(getCurrentSetNumber(makeMatch({ isCompleted: true }))).toBe(1)
  })
})

describe("match-view: getImportantEventType", () => {
  it("returns the match-over label for a completed match", () => {
    expect(getImportantEventType(makeMatch({ isCompleted: true }), "OVER")).toBe("OVER")
  })

  it("returns null for an ordinary in-progress score", () => {
    expect(getImportantEventType(makeMatch(), "OVER")).toBeNull()
  })
})

describe("match-view: getSetCellDisplay", () => {
  it("shows a plain set as just the games, no superscript", () => {
    const set = { teamA: 6, teamB: 4, winner: "teamA" }
    expect(getSetCellDisplay(set, "teamA")).toEqual({ main: 6, sup: null })
    expect(getSetCellDisplay(set, "teamB")).toEqual({ main: 4, sup: null })
  })

  it("puts the tiebreak superscript on the set LOSER only", () => {
    // teamB won 7-6, tiebreak 9-7.
    const set = { teamA: 6, teamB: 7, winner: "teamB", tiebreak: { teamA: 7, teamB: 9 } }
    expect(getSetCellDisplay(set, "teamB")).toEqual({ main: 7, sup: null }) // winner — no sup
    expect(getSetCellDisplay(set, "teamA")).toEqual({ main: 6, sup: 7 }) // loser — sup = own tb pts
  })

  it("shows a match super-tiebreak as the tiebreak points, no superscript", () => {
    // Deciding set played as a 10-point tiebreak, recorded as a 0-1 'set'.
    const set = { teamA: 0, teamB: 1, winner: "teamB", tiebreak: { teamA: 5, teamB: 10 } }
    expect(getSetCellDisplay(set, "teamA")).toEqual({ main: 5, sup: null })
    expect(getSetCellDisplay(set, "teamB")).toEqual({ main: 10, sup: null })
  })

  it("falls back to a games comparison when winner is missing", () => {
    const set = { teamA: 6, teamB: 7, tiebreak: { teamA: 4, teamB: 7 } }
    expect(getSetCellDisplay(set, "teamA")).toEqual({ main: 6, sup: 4 }) // teamA lost
    expect(getSetCellDisplay(set, "teamB")).toEqual({ main: 7, sup: null })
  })
})

describe("match-view: buildVmixFlatData", () => {
  it("produces the flat vMix payload with dynamic set columns", () => {
    const data = buildVmixFlatData(makeMatch())
    expect(data.match_id).toBe("m-test")
    expect(data.teamA_name).toBe("A1 / A2")
    expect(data.teamA_serving).toBe("True")
    expect(data.is_completed).toBe("False")
    // at least 5 set columns for vMix template compatibility
    expect(data.teamA_set1).toBe(6)
    expect(data.teamA_set2).toBe(2)
    expect(data.teamA_set5).toBe("")
  })
})
