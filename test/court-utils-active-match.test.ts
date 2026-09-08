import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  active: null as any,
  completed: null as any,
  completedQueries: 0,
}))

vi.mock("../lib/error-logger", () => ({ logEvent: vi.fn() }))
vi.mock("../lib/match-storage", () => ({ getMatch: vi.fn() }))
vi.mock("../lib/supabase", () => ({
  createClientSupabaseClient: () => ({
    from: () => {
      let completed = false
      const builder: any = {
        select: () => builder,
        eq: (field: string, value: unknown) => {
          if (field === "is_completed") completed = value === true
          return builder
        },
        order: () => builder,
        limit: () => builder,
        maybeSingle: () => builder,
        abortSignal: async () => {
          if (completed) state.completedQueries += 1
          return { data: completed ? state.completed : state.active, error: null }
        },
      }
      return builder
    },
  }),
}))

import { getActiveMatchByCourtNumber, getMatchByCourtNumber } from "../lib/court-utils"

describe("court match lookup", () => {
  beforeEach(() => {
    state.active = null
    state.completed = {
      id: "finished-1",
      type: "padel",
      format: "double",
      created_at: new Date().toISOString(),
      settings: {},
      team_a: { players: [] },
      team_b: { players: [] },
      score: { teamA: 2, teamB: 0, sets: [] },
      current_server: null,
      court_sides: null,
      should_change_sides: false,
      is_completed: true,
      winner: "teamA",
      court_number: 3,
      revision: 8,
    }
    state.completedQueries = 0
  })

  it("does not return a completed match to an interactive scoreboard", async () => {
    await expect(getActiveMatchByCourtNumber(3)).resolves.toBeNull()
    expect(state.completedQueries).toBe(0)
  })

  it("retains completed fallback for read-only legacy callers", async () => {
    await expect(getMatchByCourtNumber(3)).resolves.toMatchObject({ id: "finished-1", isCompleted: true })
    expect(state.completedQueries).toBe(1)
  })
})
