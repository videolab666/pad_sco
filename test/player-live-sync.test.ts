import { describe, it, expect } from "vitest"
import { applyPlayerToMatch } from "../lib/player-live-sync"

const match = (overrides: any = {}) => ({
  isCompleted: false,
  teamA: { players: [{ id: "p1", name: "Anna Petrova", country: "" }] },
  teamB: { players: [{ id: "p2", name: "Bob" }] },
  score: { sets: [], currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 } } },
  ...overrides,
})

describe("applyPlayerToMatch (live sync of pool edits)", () => {
  it("merges display fields into the live copy of the player", () => {
    const next = applyPlayerToMatch(match(), { id: "p1", name: "Anna Petrova", country: "UA", seed: "4", club: "NC" } as any)
    expect(next.teamA.players[0].country).toBe("UA")
    expect(next.teamA.players[0].seed).toBe("4")
    expect(next.teamA.players[0].club).toBe("NC")
    // untouched player
    expect(next.teamB.players[0]).toEqual({ id: "p2", name: "Bob" })
    // score/sides untouched
    expect(next.score).toEqual(match().score)
  })

  it("returns the SAME reference on a no-op (caller skips the write)", () => {
    const m = match()
    const next = applyPlayerToMatch(m, { id: "p1", name: "Anna Petrova" } as any)
    expect(next).toBe(m)
  })

  it("never touches completed matches", () => {
    const m = match({ isCompleted: true, teamA: { players: [{ id: "p1", name: "Old" }] } })
    expect(applyPlayerToMatch(m, { id: "p1", name: "New" } as any)).toBe(m)
  })

  it("matches by string id regardless of numeric/string pool ids", () => {
    const next = applyPlayerToMatch(match(), { id: 1, name: "X" } as any) // p1 ≠ 1 → no-op
    expect(next.teamA.players[0].name).toBe("Anna Petrova")
    const next2 = applyPlayerToMatch(match({ teamA: { players: [{ id: 1, name: "Old" }] } }), { id: "1", name: "New" } as any)
    expect(next2.teamA.players[0].name).toBe("New")
  })
})

import { syncPlayerFields } from "../lib/player-live-sync"

describe("syncPlayerFields", () => {
  it("pushes fields into every active match except the origin and finished ones", async () => {
    const matches = [
      match(),                                              // holds p1, active → synced
      match(),                                              // duplicate object, also synced
      match({ isCompleted: true }),                          // finished → skipped
      { ...match(), id: "origin" },                          // origin → skipped
      match({ teamA: { players: [{ id: "zzz", name: "X" }] } }), // no p1 → no-op
    ]
    const saved: any[] = []
    const n = await syncPlayerFields(
      async () => matches,
      async (m) => { saved.push(m) },
      "p1",
      { name: "Fixed", country: "UA" },
      "origin",
    )
    expect(n).toBe(2)
    expect(saved).toHaveLength(2)
    for (const m of saved) {
      expect(m.teamA.players[0].name).toBe("Fixed")
      expect(m.teamA.players[0].country).toBe("UA")
      expect(m.revision).toBe(1) // bumped for realtime
    }
  })
})
