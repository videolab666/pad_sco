import { describe, it, expect } from "vitest"
import {
  commitSetWin,
  getImportantPoint,
  getPointIndex,
  getTiebreakPointsToWin,
  isGamePoint,
  isMatchPoint,
  isSetPoint,
  swapCourtSides,
} from "../lib/scoring-logic"

// A match one point away from winning: teamA leads 1-0 in sets, 5-0 in games,
// 40-0 in the current game — so the same point is game, set and match point.
function matchPointMatch() {
  return {
    isCompleted: false,
    winner: null,
    format: "doubles",
    settings: {
      sets: 3,
      scoringSystem: "classic",
      gamesPerSet: 6,
      tiebreakEnabled: true,
      tiebreakAt: "6-6",
      tiebreakLength: 7,
      finalSetFinish: "standard-7",
    },
    score: {
      teamA: 1,
      teamB: 0,
      sets: [{ teamA: 6, teamB: 3, winner: "teamA" }],
      currentSet: {
        teamA: 5,
        teamB: 0,
        games: [],
        currentGame: { teamA: 40, teamB: 0 },
        isTiebreak: false,
      },
    },
    currentServer: { team: "teamA", playerIndex: 0 },
    courtSides: { teamA: "left", teamB: "right" },
  }
}

describe("scoring-indicators: getPointIndex", () => {
  it("maps point values to ladder indices", () => {
    expect(getPointIndex(0)).toBe(0)
    expect(getPointIndex(15)).toBe(1)
    expect(getPointIndex(30)).toBe(2)
    expect(getPointIndex(40)).toBe(3)
    expect(getPointIndex("Ad")).toBe(4)
  })
})

describe("scoring-indicators: game / set / match point", () => {
  it("flags a game point at 40-0", () => {
    expect(isGamePoint(matchPointMatch())).toBe("teamA")
  })

  it("flags a set point when the game point also wins the set", () => {
    expect(isSetPoint(matchPointMatch())).toBe("teamA")
  })

  it("flags a match point when the set point also wins the match", () => {
    expect(isMatchPoint(matchPointMatch())).toBe("teamA")
  })

  it("reports no game point at the start of a game", () => {
    const m = matchPointMatch()
    m.score.currentSet.currentGame = { teamA: 0, teamB: 0 }
    expect(isGamePoint(m)).toBe(false)
  })
})

describe("scoring-indicators: getImportantPoint", () => {
  it("labels the highest-severity point as MATCH POINT", () => {
    const point = getImportantPoint(matchPointMatch())
    expect(point.type).toBe("MATCH POINT")
    expect(point.team).toBe("teamA")
  })

  it("returns no type for an ordinary score", () => {
    const m = matchPointMatch()
    m.score.currentSet.teamA = 2
    m.score.currentSet.currentGame = { teamA: 15, teamB: 15 }
    expect(getImportantPoint(m).type).toBeNull()
  })
})

describe("scoring-indicators: getTiebreakPointsToWin", () => {
  it("uses the configured tiebreak length", () => {
    const m = matchPointMatch()
    m.score.currentSet.isTiebreak = true
    expect(getTiebreakPointsToWin(m)).toBe(7)
  })
})

function setWinMatch(overrides: Record<string, any> = {}) {
  return {
    isCompleted: false,
    winner: null,
    format: "doubles",
    settings: { sets: 3, scoringSystem: "classic", gamesPerSet: 6, finalSetFinish: "standard-7" },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [] as any[],
      currentSet: { teamA: 6, teamB: 4, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
    currentServer: { team: "teamA", playerIndex: 0 },
    courtSides: { teamA: "left", teamB: "right" },
    ...overrides,
  }
}

describe("scoring-logic: commitSetWin", () => {
  it("records a normal set win and starts the next set", () => {
    const r: any = commitSetWin(setWinMatch() as any, "teamA")
    expect(r.score.sets).toHaveLength(1)
    expect(r.score.sets[0]).toMatchObject({ teamA: 6, teamB: 4, winner: "teamA" })
    expect(r.score.sets[0].tiebreak).toBeUndefined()
    expect(r.score.teamA).toBe(1)
    expect(r.score.currentSet.teamA).toBe(0) // fresh next set
    expect(r.isCompleted).toBe(false)
  })

  it("saves the tiebreak score from a manually-ended tiebreak (currentSet.tiebreak)", () => {
    const m = setWinMatch()
    m.score.currentSet.teamA = 7
    ;(m.score.currentSet as any).tiebreak = { teamA: 9, teamB: 7 }
    const r: any = commitSetWin(m as any, "teamA")
    expect(r.score.sets[0].tiebreak).toEqual({ teamA: 9, teamB: 7 })
  })

  it("saves the tiebreak score from an in-play tiebreak (currentGame)", () => {
    const m = setWinMatch()
    m.score.currentSet.teamA = 7
    m.score.currentSet.isTiebreak = true
    m.score.currentSet.currentGame = { teamA: 7, teamB: 5 }
    const r: any = commitSetWin(m as any, "teamA")
    expect(r.score.sets[0].tiebreak).toEqual({ teamA: 7, teamB: 5 })
  })

  it("completes the match when the winner reaches setsToWin", () => {
    const m = setWinMatch()
    m.score.sets = [{ teamA: 6, teamB: 2, winner: "teamA" }]
    m.score.teamA = 1
    const r: any = commitSetWin(m as any, "teamA")
    expect(r.isCompleted).toBe(true)
    expect(r.winner).toBe("teamA")
  })

  it("does not mutate the input match", () => {
    const m = setWinMatch()
    const before = JSON.stringify(m)
    commitSetWin(m as any, "teamA")
    expect(JSON.stringify(m)).toBe(before)
  })
})

describe("scoring-logic: swapCourtSides", () => {
  it("flips both teams' sides", () => {
    expect(swapCourtSides({ teamA: "left", teamB: "right" })).toEqual({
      teamA: "right",
      teamB: "left",
    })
    expect(swapCourtSides({ teamA: "right", teamB: "left" })).toEqual({
      teamA: "left",
      teamB: "right",
    })
  })
})

describe("scoring-indicators: golden game set point", () => {
  it("flags a set point at 5-5 40-0 when goldenGame is on", () => {
    const m = matchPointMatch()
    ;(m.settings as any).goldenGame = true
    m.score.currentSet.teamA = 5
    m.score.currentSet.teamB = 5
    m.score.currentSet.currentGame = { teamA: 40, teamB: 0 }
    // next game → 6-5 → golden game wins the set
    expect(isSetPoint(m)).toBe("teamA")
  })

  it("does NOT flag a set point at 5-5 40-0 without goldenGame", () => {
    const m = matchPointMatch()
    ;(m.settings as any).goldenGame = false
    m.score.currentSet.teamA = 5
    m.score.currentSet.teamB = 5
    m.score.currentSet.currentGame = { teamA: 40, teamB: 0 }
    // 6-5 is not a set win (needs a 2-game margin or a tiebreak)
    expect(isSetPoint(m)).toBe(false)
  })
})

describe("scoring-indicators: a completed match shows no live indicators", () => {
  it("isGamePoint / isSetPoint / isMatchPoint are all false once completed", () => {
    const m = matchPointMatch()
    m.isCompleted = true
    ;(m as any).winner = "teamA"
    expect(isGamePoint(m)).toBe(false)
    expect(isSetPoint(m)).toBe(false)
    expect(isMatchPoint(m)).toBe(false)
  })

  it("getImportantPoint returns no type for a completed match", () => {
    const m = matchPointMatch()
    m.isCompleted = true
    expect(getImportantPoint(m).type).toBeNull()
  })

  it("getImportantPoint stays silent even if the final set ended in a tiebreak", () => {
    const m = matchPointMatch()
    m.isCompleted = true
    m.score.currentSet.isTiebreak = true
    expect(getImportantPoint(m).type).toBeNull()
  })
})
