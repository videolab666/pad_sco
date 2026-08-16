import { describe, it, expect } from "vitest"
import { deriveServerForNextGame, getServerForGameNumber } from "../lib/doubles-serve-sequence"

describe("Task 11 — A1B1A2B2 default cycle", () => {
  it("cycles A1 B1 A2 B2 A1 B1 A2 B2", () => {
    const expected = [
      { team: "teamA", playerIndex: 0 },
      { team: "teamB", playerIndex: 0 },
      { team: "teamA", playerIndex: 1 },
      { team: "teamB", playerIndex: 1 },
    ]
    for (let g = 0; g < 12; g++) {
      expect(getServerForGameNumber("A1B1A2B2", g)).toEqual(expected[g % 4])
    }
  })
})

describe("Task 11 — A1A2B1B2 team-block cycle", () => {
  it("each player serves once per 4 games", () => {
    const seq = ["A1", "A2", "B1", "B2"]
    for (let g = 0; g < 8; g++) {
      const s = getServerForGameNumber("A1A2B1B2", g)
      expect(s.team[s.team.length - 1] === "A" ? "A" : "B").toBe(seq[g % 4][0])
      expect(s.playerIndex).toBe(Number(seq[g % 4][1]) - 1)
    }
  })
})

describe("Task 11 — A1B1A1B1 squash-doubles two-player cycle", () => {
  it("alternates A1 / B1 forever", () => {
    for (let g = 0; g < 10; g++) {
      expect(getServerForGameNumber("A1B1A1B1", g).playerIndex).toBe(0)
      expect(getServerForGameNumber("A1B1A1B1", g).team).toBe(g % 2 === 0 ? "teamA" : "teamB")
    }
  })
})

describe("Task 11 — A2B1B2_then_A1A2B1B2 intro + cycle", () => {
  it("first three games match the intro pattern", () => {
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 0)).toEqual({ team: "teamA", playerIndex: 1 })
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 1)).toEqual({ team: "teamB", playerIndex: 0 })
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 2)).toEqual({ team: "teamB", playerIndex: 1 })
  })

  it("game 3..6 plays the A1A2B1B2 body once", () => {
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 3)).toEqual({ team: "teamA", playerIndex: 0 })
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 4)).toEqual({ team: "teamA", playerIndex: 1 })
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 5)).toEqual({ team: "teamB", playerIndex: 0 })
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 6)).toEqual({ team: "teamB", playerIndex: 1 })
  })

  it("game 7 must continue the body (NOT wrap back into the intro)", () => {
    // Regression for the v1 bug where the whole sequence was treated as a
    // 7-element cycle: game 7 would wrap to A2 (intro[0]) instead of A1.
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 7)).toEqual({ team: "teamA", playerIndex: 0 })
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 8)).toEqual({ team: "teamA", playerIndex: 1 })
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 9)).toEqual({ team: "teamB", playerIndex: 0 })
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 10)).toEqual({ team: "teamB", playerIndex: 1 })
    expect(getServerForGameNumber("A2B1B2_then_A1A2B1B2", 11)).toEqual({ team: "teamA", playerIndex: 0 })
  })
})

describe("Task 11 — A1B1B2_then_A1A2B1B2 intro + cycle", () => {
  it("intro then body, never wraps into intro", () => {
    expect(getServerForGameNumber("A1B1B2_then_A1A2B1B2", 0)).toEqual({ team: "teamA", playerIndex: 0 })
    expect(getServerForGameNumber("A1B1B2_then_A1A2B1B2", 1)).toEqual({ team: "teamB", playerIndex: 0 })
    expect(getServerForGameNumber("A1B1B2_then_A1A2B1B2", 2)).toEqual({ team: "teamB", playerIndex: 1 })
    expect(getServerForGameNumber("A1B1B2_then_A1A2B1B2", 3)).toEqual({ team: "teamA", playerIndex: 0 })
    expect(getServerForGameNumber("A1B1B2_then_A1A2B1B2", 7)).toEqual({ team: "teamA", playerIndex: 0 })
  })
})

describe("Task 11 — deriveServerForNextGame integration", () => {
  it("returns null for the default sequence (engine keeps its built-in rotation)", () => {
    const m = {
      settings: { doublesServeSequence: "A1B1A2B2" },
      score: { sets: [], currentSet: { teamA: 0, teamB: 0 } },
    }
    expect(deriveServerForNextGame(m)).toBeNull()
  })

  it("uses total games across closed and current set", () => {
    const m = {
      settings: { doublesServeSequence: "A1A2B1B2" },
      score: {
        sets: [{ teamA: 6, teamB: 4, winner: "teamA" }], // 10 games done
        currentSet: { teamA: 2, teamB: 1 }, // +3 → next is game 13
      },
    }
    // game 13 % 4 = 1 → A2
    expect(deriveServerForNextGame(m)).toEqual({ team: "teamA", playerIndex: 1 })
  })
})
