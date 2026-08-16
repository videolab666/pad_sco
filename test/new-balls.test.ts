import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import {
  isNewBallsDueNow,
  markNewBallsChanged,
  newBallsInXGames,
  totalGamesPlayed,
} from "../lib/new-balls"

const baseMatch = (overrides: any = {}) =>
  backfillExtendedMatchState({
    id: "m1",
    isCompleted: false,
    settings: { tiebreakEnabled: true, tiebreakAt: "6-6" },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [] as any[],
      currentSet: {
        teamA: 0,
        teamB: 0,
        games: [],
        currentGame: { teamA: 0, teamB: 0 },
        isTiebreak: false,
      },
    },
    ...overrides,
  })

describe("Task 5 — totalGamesPlayed", () => {
  it("sums completed sets plus current set games", () => {
    const m = baseMatch({
      score: {
        teamA: 1,
        teamB: 1,
        sets: [
          { teamA: 6, teamB: 4, winner: "teamA" },
          { teamA: 3, teamB: 6, winner: "teamB" },
        ],
        currentSet: { teamA: 2, teamB: 1, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
    })
    expect(totalGamesPlayed(m)).toBe(6 + 4 + 3 + 6 + 2 + 1)
  })
})

describe("Task 5 — newBallsInXGames mode 'off'", () => {
  it("returns null", () => {
    expect(newBallsInXGames(baseMatch())).toBeNull()
  })
})

describe("Task 5 — newBallsInXGames mode 'after-first-9-then-each-11'", () => {
  const m0 = () =>
    baseMatch({
      newBalls: { mode: "after-first-9-then-each-11", lastChangeAtStartOfGame: 0, pendingInGames: null },
    })

  it("at the start of a fresh match the next change is in 9 games", () => {
    expect(newBallsInXGames(m0())).toBe(9)
  })

  it("after 9 games played → due NOW (0)", () => {
    const m = m0()
    m.score.sets = [{ teamA: 6, teamB: 3, winner: "teamA" }] // 9 games, set won
    m.score.currentSet = { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false }
    expect(newBallsInXGames(m)).toBe(0)
  })

  it("after lastChangeAtStartOfGame=9 → next at 20, so at 9 games returns 11", () => {
    const m = m0()
    m.newBalls.lastChangeAtStartOfGame = 9
    m.score.sets = [{ teamA: 6, teamB: 3, winner: "teamA" }]
    m.score.currentSet = { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false }
    expect(newBallsInXGames(m)).toBe(11)
  })

  it("mid-game (any point scored) returns null", () => {
    const m = m0()
    m.score.currentSet.currentGame = { teamA: 15, teamB: 0 }
    expect(newBallsInXGames(m)).toBeNull()
  })

  it("when due is at 6-6 tiebreak game → postpone by 2", () => {
    const m = m0()
    // 6 + 4 + 6 + 5 + 6 + 6 = 33  — far past first(9) + each(11) cycle.
    m.score.sets = [
      { teamA: 6, teamB: 4, winner: "teamA" },
      { teamA: 6, teamB: 5, winner: "teamA" },
    ]
    m.score.currentSet = { teamA: 6, teamB: 6, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false }
    // total = 6+4+6+5+6+6 = 33; cycle 9, 20, 31, 42 → next at 42, gap 9, NOT 0.
    // So pick a scenario where the gap IS 0 at 6-6:
    // lastChange=20, next=31; total = 6+4+6+5+5+5 = 31 → due now at start of 6-6.
    m.newBalls.lastChangeAtStartOfGame = 20
    m.score.sets = [
      { teamA: 6, teamB: 4, winner: "teamA" },
      { teamA: 6, teamB: 5, winner: "teamA" },
    ]
    m.score.currentSet = { teamA: 5, teamB: 5, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false }
    // total = 6+4+6+5+5+5 = 31; remaining at 5-5 (not tiebreak yet) = 0
    // wait — at 5-5 currentSet, gamesInCurrent = 10, NEXT game is game 11, which starts at 5-5 (regular game), not tiebreak.
    // So we need 6-6 currentSet:
    m.score.currentSet = { teamA: 6, teamB: 6, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false }
    // total now = 6+4+6+5+6+6 = 33; lastChange=20; next=31; while(31<33) next=42; remaining=9.
    // So with lastChange=20 and 6-6 we don't get 0. Set lastChange so next=33.
    m.newBalls.lastChangeAtStartOfGame = 22 // first 9 then each 11 — next slot from 22 would be 22 (=lastChange), then 33.
    // Actually our formula: nextAt = lastChange || first; if lastChange != 0 → nextAt = lastChange. Then while(nextAt < total) nextAt += each.
    // total=33, lastChange=22 → nextAt=22, +11=33. remaining = 33-33 = 0.
    expect(newBallsInXGames(m)).toBe(2)
  })

  it("does NOT postpone if next game is a normal game", () => {
    const m = m0()
    m.newBalls.lastChangeAtStartOfGame = 9
    m.score.sets = [
      { teamA: 6, teamB: 4, winner: "teamA" },
      { teamA: 6, teamB: 4, winner: "teamA" },
    ]
    m.score.currentSet = { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false }
    // total = 6+4+6+4 = 20; nextAt = 9 → +11 = 20 → remaining 0; not tiebreak → returns 0
    expect(newBallsInXGames(m)).toBe(0)
  })
})

describe("Task 5 — newBallsInXGames mode 'before-set-3'", () => {
  it("returns 0 exactly at the start of set 3", () => {
    const m = baseMatch({
      newBalls: { mode: "before-set-3", lastChangeAtStartOfGame: 0, pendingInGames: null },
      score: {
        teamA: 1,
        teamB: 1,
        sets: [
          { teamA: 6, teamB: 4, winner: "teamA" },
          { teamA: 4, teamB: 6, winner: "teamB" },
        ],
        currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
    })
    expect(newBallsInXGames(m)).toBe(0)
  })

  it("returns null after any game in set 3 has been played", () => {
    const m = baseMatch({
      newBalls: { mode: "before-set-3", lastChangeAtStartOfGame: 0, pendingInGames: null },
      score: {
        teamA: 1,
        teamB: 1,
        sets: [
          { teamA: 6, teamB: 4, winner: "teamA" },
          { teamA: 4, teamB: 6, winner: "teamB" },
        ],
        currentSet: { teamA: 1, teamB: 0, games: [{ winner: "teamA" }], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
    })
    expect(newBallsInXGames(m)).toBeNull()
  })

  it("returns null in set 1 / 2", () => {
    const m = baseMatch({
      newBalls: { mode: "before-set-3", lastChangeAtStartOfGame: 0, pendingInGames: null },
    })
    expect(newBallsInXGames(m)).toBeNull()
  })
})

describe("Task 5 — markNewBallsChanged + isNewBallsDueNow", () => {
  it("isNewBallsDueNow mirrors newBallsInXGames === 0", () => {
    const m = baseMatch({
      newBalls: { mode: "after-first-9-then-each-11", lastChangeAtStartOfGame: 0, pendingInGames: null },
      score: {
        teamA: 1,
        teamB: 0,
        sets: [{ teamA: 6, teamB: 3, winner: "teamA" }],
        currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
    })
    expect(isNewBallsDueNow(m)).toBe(true)
  })

  it("records the change at the current game count and emits an event", () => {
    let m = baseMatch({
      newBalls: { mode: "after-first-9-then-each-11", lastChangeAtStartOfGame: 0, pendingInGames: null },
      score: {
        teamA: 1,
        teamB: 0,
        sets: [{ teamA: 6, teamB: 3, winner: "teamA" }],
        currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
    })
    m = markNewBallsChanged(m, new Date("2026-05-27T10:00:00.000Z"))
    expect(m.newBalls.lastChangeAtStartOfGame).toBe(9)
    const last = m.events[m.events.length - 1]
    expect(last.type).toBe("new-balls")
    expect(last.payload.atGame).toBe(9)
  })
})
