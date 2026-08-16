import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import {
  buildNewCurrentGame,
  clearHandicap,
  getGameHandicap,
  hasActiveHandicap,
  pointIndexToTennisScore,
  setPerGameHandicap,
  setSameHandicap,
} from "../lib/handicap"

const baseMatch = () =>
  backfillExtendedMatchState({
    id: "m",
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
  })

describe("Task 7 — pointIndexToTennisScore mapping", () => {
  it("0..3 maps to 0/15/30/40", () => {
    expect(pointIndexToTennisScore(0)).toBe(0)
    expect(pointIndexToTennisScore(1)).toBe(15)
    expect(pointIndexToTennisScore(2)).toBe(30)
    expect(pointIndexToTennisScore(3)).toBe(40)
  })
  it("clamps out-of-range values", () => {
    expect(pointIndexToTennisScore(-5)).toBe(0)
    expect(pointIndexToTennisScore(10)).toBe(40)
  })
})

describe("Task 7 — none format", () => {
  it("returns zero handicap", () => {
    const m = baseMatch()
    expect(getGameHandicap(m, 0, 0)).toEqual({ teamA: 0, teamB: 0 })
    expect(hasActiveHandicap(m)).toBe(false)
    expect(buildNewCurrentGame(m)).toEqual({ teamA: 0, teamB: 0 })
  })
})

describe("Task 7 — same-for-all-games format", () => {
  it("returns the configured pair for every game", () => {
    const m = setSameHandicap(baseMatch(), 1, 0) // 15-0
    expect(getGameHandicap(m, 0, 0)).toEqual({ teamA: 1, teamB: 0 })
    expect(getGameHandicap(m, 4, 11)).toEqual({ teamA: 1, teamB: 0 })
    expect(hasActiveHandicap(m)).toBe(true)
    expect(buildNewCurrentGame(m)).toEqual({ teamA: 15, teamB: 0 })
  })

  it("clamps negative / oversize values", () => {
    const m = setSameHandicap(baseMatch(), -2, 99)
    expect(m.handicap.sameForAllGames).toEqual({ teamA: 0, teamB: 3 })
  })
})

describe("Task 7 — different-for-all-games format", () => {
  it("returns configured per-game value, zero for missing entries", () => {
    let m = setPerGameHandicap(baseMatch(), 0, 0, 2, 1)
    m = setPerGameHandicap(m, 0, 1, 3, 0)
    expect(getGameHandicap(m, 0, 0)).toEqual({ teamA: 2, teamB: 1 })
    expect(getGameHandicap(m, 0, 1)).toEqual({ teamA: 3, teamB: 0 })
    expect(getGameHandicap(m, 1, 0)).toEqual({ teamA: 0, teamB: 0 })
  })

  it("buildNewCurrentGame reflects the active set/game pair", () => {
    let m = setPerGameHandicap(baseMatch(), 0, 0, 2, 0) // first game 30-0
    expect(buildNewCurrentGame(m)).toEqual({ teamA: 30, teamB: 0 })
    // advance to game 1
    m.score.currentSet.games.push({ winner: "teamA" })
    m = setPerGameHandicap(m, 0, 1, 0, 1) // second game 0-15
    expect(buildNewCurrentGame(m)).toEqual({ teamA: 0, teamB: 15 })
  })
})

describe("Task 7 — clearHandicap", () => {
  it("resets to none", () => {
    const m = clearHandicap(setSameHandicap(baseMatch(), 2, 0))
    expect(m.handicap).toEqual({ format: "none" })
    expect(hasActiveHandicap(m)).toBe(false)
  })
})
