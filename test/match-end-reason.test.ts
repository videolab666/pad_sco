import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import { endMatchManually } from "../lib/match-end-reason"
import { ensureCurrentGameTiming } from "../lib/match-timing"

const baseMatch = () =>
  ensureCurrentGameTiming(
    backfillExtendedMatchState({
      id: "m",
      isCompleted: false,
      score: {
        teamA: 1,
        teamB: 0,
        sets: [{ teamA: 6, teamB: 4, winner: "teamA" }],
        currentSet: { teamA: 3, teamB: 2, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
    }),
    new Date("2026-05-27T10:00:00Z"),
  )

describe("Task 13 — endMatchManually", () => {
  it("sets isCompleted, winner, endMatchReason and finalises timing", () => {
    const end = new Date("2026-05-27T11:30:00Z")
    const m = endMatchManually(baseMatch(), "retired-injury", "teamA", end)
    expect(m.isCompleted).toBe(true)
    expect(m.winner).toBe("teamA")
    expect(m.endMatchReason).toBe("retired-injury")
    expect(m.timing.matchEndedAt).toBe(end.toISOString())
    expect(m.events.find((e: any) => e.type === "end-match-manual")).toMatchObject({
      payload: { reason: "retired-injury", winnerTeam: "teamA" },
    })
  })

  it("supports conduct and time-up reasons", () => {
    const m1 = endMatchManually(baseMatch(), "conduct", "teamB")
    expect(m1.endMatchReason).toBe("conduct")
    const m2 = endMatchManually(baseMatch(), "time-up", "teamA")
    expect(m2.endMatchReason).toBe("time-up")
  })
})
