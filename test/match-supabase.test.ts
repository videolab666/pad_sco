import { describe, it, expect } from "vitest"
import { matchToRow, matchFromRow } from "../lib/match-supabase"

function sampleMatch(overrides: Record<string, any> = {}) {
  return {
    id: "m1",
    code: "12345",
    type: "padel",
    format: "doubles",
    createdAt: "2026-05-17T00:00:00.000Z",
    settings: { sets: 3 },
    teamA: { players: [{ name: "A1" }] },
    teamB: { players: [{ name: "B1" }] },
    score: { teamA: 1, teamB: 0, sets: [] },
    currentServer: { team: "teamA", playerIndex: 0 },
    courtSides: { teamA: "left", teamB: "right" },
    shouldChangeSides: false,
    isCompleted: false,
    winner: null,
    courtNumber: 2,
    created_via_court_link: true,
    revision: 5,
    history: [{ marker: 1 }],
    ...overrides,
  }
}

function sampleRow(overrides: Record<string, any> = {}) {
  return {
    id: "m1",
    code: "12345",
    type: "padel",
    format: "doubles",
    created_at: "2026-05-17T00:00:00.000Z",
    settings: { sets: 3 },
    team_a: { players: [{ name: "A1" }] },
    team_b: { players: [{ name: "B1" }] },
    score: { teamA: 1, teamB: 0, sets: [] },
    current_server: { team: "teamA", playerIndex: 0 },
    court_sides: { teamA: "left", teamB: "right" },
    should_change_sides: false,
    is_completed: false,
    winner: null,
    court_number: 2,
    created_via_court_link: true,
    revision: 5,
    ...overrides,
  }
}

describe("match-supabase: matchToRow", () => {
  it("maps camelCase fields to the snake_case row", () => {
    const row = matchToRow(sampleMatch())
    expect(row.team_a).toEqual({ players: [{ name: "A1" }] })
    expect(row.current_server).toEqual({ team: "teamA", playerIndex: 0 })
    expect(row.court_sides).toEqual({ teamA: "left", teamB: "right" })
    expect(row.should_change_sides).toBe(false)
    expect(row.court_number).toBe(2)
    expect(row.created_via_court_link).toBe(true)
  })

  it("omits the code column and coerces a missing winner to null", () => {
    const row = matchToRow(sampleMatch({ winner: undefined }))
    expect("code" in row).toBe(false)
    expect(row.extras.code).toBe("12345")
    expect(matchFromRow(row).code).toBe("12345")
    expect(row.winner).toBeNull()
  })
})

describe("match-supabase: matchFromRow", () => {
  it("maps the snake_case row back to a camelCase match", () => {
    const m = matchFromRow(sampleRow())
    expect(m.teamA).toEqual({ players: [{ name: "A1" }] })
    expect(m.currentServer).toEqual({ team: "teamA", playerIndex: 0 })
    expect(m.courtSides).toEqual({ teamA: "left", teamB: "right" })
    expect(m.isCompleted).toBe(false)
    expect(m.history).toEqual([])
  })

  it("keeps code, revision and created_via_court_link (the previously diverging fields)", () => {
    const m = matchFromRow(sampleRow())
    expect(m.code).toBe("12345")
    expect(m.revision).toBe(5)
    expect(m.created_via_court_link).toBe(true)
  })

  it("defaults a missing/invalid revision to 0", () => {
    expect(matchFromRow(sampleRow({ revision: undefined })).revision).toBe(0)
    expect(matchFromRow(sampleRow({ revision: "x" })).revision).toBe(0)
  })

  it("round-trips applied operation ids inside extras", () => {
    const source = sampleMatch({
      appliedOperationIds: ["11111111-1111-4111-8111-111111111111"],
    })

    const restored = matchFromRow(matchToRow(source))

    expect(restored.appliedOperationIds).toEqual((source as any).appliedOperationIds)
  })
})
