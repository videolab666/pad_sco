import { describe, it, expect } from "vitest"
import {
  addPointTiming,
  endCurrentGameTiming,
  ensureCurrentGameTiming,
  finalizeMatchTiming,
  formatDurationMs,
  getCurrentGameDurationMs,
  getCurrentSetDurationMs,
  getMatchDurationMs,
  removeLastPointTiming,
} from "../lib/match-timing"
import { backfillExtendedMatchState } from "../lib/match-extended-state"

const baseMatch = () =>
  backfillExtendedMatchState({
    id: "m1",
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
  })

describe("Task 3 — ensureCurrentGameTiming", () => {
  it("creates a GameTiming on first point and seeds matchStartedAt", () => {
    const now = new Date("2026-05-27T10:00:00.000Z")
    const m = ensureCurrentGameTiming(baseMatch(), now)
    expect(m.timing.games).toHaveLength(1)
    expect(m.timing.games[0].startedAt).toBe(now.toISOString())
    expect(m.timing.games[0].scoreTimingsSec).toEqual([])
    expect(m.timing.matchStartedAt).toBe(now.toISOString())
  })

  it("is idempotent for the same current game indices", () => {
    const t1 = new Date("2026-05-27T10:00:00.000Z")
    const t2 = new Date("2026-05-27T10:00:05.000Z")
    let m = ensureCurrentGameTiming(baseMatch(), t1)
    m = ensureCurrentGameTiming(m, t2)
    expect(m.timing.games).toHaveLength(1)
    expect(m.timing.games[0].startedAt).toBe(t1.toISOString())
  })

  it("opens a new entry when the current game indices advance", () => {
    const t1 = new Date("2026-05-27T10:00:00.000Z")
    const t2 = new Date("2026-05-27T10:04:00.000Z")
    let m = ensureCurrentGameTiming(baseMatch(), t1)
    m.score.currentSet.games.push({ winner: "teamA" })
    m = ensureCurrentGameTiming(m, t2)
    expect(m.timing.games).toHaveLength(2)
    expect(m.timing.games[1].gameIndex).toBe(1)
    expect(m.timing.games[1].startedAt).toBe(t2.toISOString())
  })
})

describe("Task 3 — addPointTiming", () => {
  it("first point at t=0 appends 0 seconds", () => {
    const start = new Date("2026-05-27T10:00:00.000Z")
    const m = addPointTiming(baseMatch(), start)
    expect(m.timing.games[0].scoreTimingsSec).toEqual([0])
  })

  it("subsequent points record seconds since the game's startedAt", () => {
    const t0 = new Date("2026-05-27T10:00:00.000Z")
    const t1 = new Date("2026-05-27T10:00:30.000Z")
    const t2 = new Date("2026-05-27T10:01:00.000Z")
    let m = addPointTiming(baseMatch(), t0)
    m = addPointTiming(m, t1)
    m = addPointTiming(m, t2)
    expect(m.timing.games[0].scoreTimingsSec).toEqual([0, 30, 60])
  })

  it("removeLastPointTiming pops only the last point", () => {
    let m = addPointTiming(baseMatch(), new Date("2026-05-27T10:00:00.000Z"))
    m = addPointTiming(m, new Date("2026-05-27T10:00:30.000Z"))
    m = removeLastPointTiming(m)
    expect(m.timing.games[0].scoreTimingsSec).toEqual([0])
  })
})

describe("Task 3 — endCurrentGameTiming and finalizeMatchTiming", () => {
  it("endCurrentGameTiming sets endedAt on the current entry", () => {
    let m = ensureCurrentGameTiming(baseMatch(), new Date("2026-05-27T10:00:00.000Z"))
    m = endCurrentGameTiming(m, new Date("2026-05-27T10:04:00.000Z"))
    expect(m.timing.games[0].endedAt).toBe("2026-05-27T10:04:00.000Z")
  })

  it("finalizeMatchTiming fixes matchEndedAt and closes the last game", () => {
    let m = ensureCurrentGameTiming(baseMatch(), new Date("2026-05-27T10:00:00.000Z"))
    m = finalizeMatchTiming(m, new Date("2026-05-27T11:30:00.000Z"))
    expect(m.timing.matchEndedAt).toBe("2026-05-27T11:30:00.000Z")
    expect(m.timing.games[0].endedAt).toBe("2026-05-27T11:30:00.000Z")
  })

  it("does not regress matchEndedAt when called twice", () => {
    let m = ensureCurrentGameTiming(baseMatch(), new Date("2026-05-27T10:00:00.000Z"))
    m = finalizeMatchTiming(m, new Date("2026-05-27T11:30:00.000Z"))
    m = finalizeMatchTiming(m, new Date("2026-05-27T12:00:00.000Z"))
    expect(m.timing.matchEndedAt).toBe("2026-05-27T11:30:00.000Z")
  })
})

describe("Task 3 — duration helpers and formatter", () => {
  it("getMatchDurationMs handles live and completed cases", () => {
    let m = ensureCurrentGameTiming(baseMatch(), new Date("2026-05-27T10:00:00.000Z"))
    expect(getMatchDurationMs(m, new Date("2026-05-27T10:05:00.000Z"))).toBe(5 * 60 * 1000)
    m = finalizeMatchTiming(m, new Date("2026-05-27T11:30:00.000Z"))
    expect(getMatchDurationMs(m, new Date("2030-01-01"))).toBe(90 * 60 * 1000)
  })

  it("getCurrentGameDurationMs is 0 before the first point", () => {
    expect(getCurrentGameDurationMs(baseMatch())).toBe(0)
  })

  it("formatDurationMs uses mm:ss under 1h and h:mm:ss otherwise", () => {
    expect(formatDurationMs(0)).toBe("00:00")
    expect(formatDurationMs(59_000)).toBe("00:59")
    expect(formatDurationMs(60_000)).toBe("01:00")
    expect(formatDurationMs(3 * 60 * 60_000 + 5 * 60_000 + 7_000)).toBe("3:05:07")
  })

  it("getCurrentSetDurationMs sums finished and ongoing games of the current set only", () => {
    const now = new Date("2026-05-27T10:00:00.000Z")
    let m = ensureCurrentGameTiming(baseMatch(), now)
    m = endCurrentGameTiming(m, new Date("2026-05-27T10:04:00.000Z")) // game 0-0: 4 min
    // advance to the next game inside the same set
    m.score.currentSet.games.push({ teamA: 1, teamB: 0 })
    m = ensureCurrentGameTiming(m, new Date("2026-05-27T10:05:00.000Z"))
    const at = new Date("2026-05-27T10:07:30.000Z")
    expect(getCurrentSetDurationMs(m, at)).toBe(4 * 60_000 + 2.5 * 60_000)

    // finished game from a previous set must not count toward the current set
    m.timing.games[0].setIndex = -1
    expect(getCurrentSetDurationMs(m, at)).toBe(2.5 * 60_000)
  })
})
