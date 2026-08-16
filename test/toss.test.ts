import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import { commitToss, getTossReceiver, isTossCompleted, simulateToss } from "../lib/toss"

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

describe("Task 8 — simulateToss is deterministic with a seed", () => {
  it("returns teamA when random < 0.5", () => {
    expect(simulateToss(() => 0.0)).toBe("teamA")
    expect(simulateToss(() => 0.49)).toBe("teamA")
  })
  it("returns teamB when random >= 0.5", () => {
    expect(simulateToss(() => 0.5)).toBe("teamB")
    expect(simulateToss(() => 0.99)).toBe("teamB")
  })
})

describe("Task 8 — commitToss writes server, courtSides, toss state and event atomically", () => {
  it("winner chooses serve → winner serves, opponent receives", () => {
    const m = commitToss(baseMatch(), { winner: "teamA", choice: "serve", teamOnLeft: "teamA" })
    expect(m.currentServer).toEqual({ team: "teamA", playerIndex: 0 })
    expect(m.courtSides).toEqual({ teamA: "left", teamB: "right" })
    expect(m.toss.winner).toBe("teamA")
    expect(m.toss.winnerChoice).toBe("serve")
    expect(typeof m.toss.completedAt).toBe("string")
    expect(m.events[m.events.length - 1].type).toBe("toss")
  })

  it("winner chooses receive → opponent serves", () => {
    const m = commitToss(baseMatch(), { winner: "teamA", choice: "receive", teamOnLeft: "teamB" })
    expect(m.currentServer.team).toBe("teamB")
    expect(m.courtSides).toEqual({ teamA: "right", teamB: "left" })
  })

  it("immutable — input match is unchanged", () => {
    const m = baseMatch()
    const before = JSON.stringify(m)
    commitToss(m, { winner: "teamA", choice: "serve", teamOnLeft: "teamA" })
    expect(JSON.stringify(m)).toBe(before)
  })

  it("isTossCompleted reflects the state", () => {
    const m = baseMatch()
    expect(isTossCompleted(m)).toBe(false)
    const after = commitToss(m, { winner: "teamA", choice: "serve", teamOnLeft: "teamA" })
    expect(isTossCompleted(after)).toBe(true)
  })

  it("getTossReceiver returns the opposite team when winner chose serve", () => {
    const m = commitToss(baseMatch(), { winner: "teamA", choice: "serve", teamOnLeft: "teamA" })
    expect(getTossReceiver(m)).toBe("teamB")
  })

  it("getTossReceiver returns the winner when they chose to receive", () => {
    const m = commitToss(baseMatch(), { winner: "teamA", choice: "receive", teamOnLeft: "teamA" })
    expect(getTossReceiver(m)).toBe("teamA")
  })
})
