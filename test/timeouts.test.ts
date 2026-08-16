import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import { getTimeoutCount, recordTimeout } from "../lib/timeouts"

const baseMatch = () =>
  backfillExtendedMatchState({
    id: "m",
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 2, teamB: 1, games: [], currentGame: { teamA: 30, teamB: 15 }, isTiebreak: false },
    },
  })

describe("Task 13 — timeouts", () => {
  it("records a timeout with the current set/game score and starts a timer", () => {
    const now = new Date("2026-05-27T12:00:00Z")
    const m = recordTimeout(baseMatch(), "teamA", now)
    expect(m.timeouts.teamA).toHaveLength(1)
    expect(m.timeouts.teamA[0]).toEqual({
      at: now.toISOString(),
      setScore: { teamA: 2, teamB: 1 },
      gameScore: { teamA: 30, teamB: 15 },
    })
    expect(m.timing.activeTimer).toMatchObject({ type: "timeout", team: "teamA", durationSec: 60 })
    expect(m.events.find((e: any) => e.type === "timeout")).toBeTruthy()
  })

  it("getTimeoutCount tallies per team", () => {
    let m = baseMatch()
    m = recordTimeout(m, "teamA")
    m = recordTimeout(m, "teamA")
    m = recordTimeout(m, "teamB")
    expect(getTimeoutCount(m, "teamA")).toBe(2)
    expect(getTimeoutCount(m, "teamB")).toBe(1)
  })
})
