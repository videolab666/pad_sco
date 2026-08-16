import { describe, it, expect } from "vitest"
import {
  EXTRAS_FIELDS,
  backfillExtendedMatchState,
  pickExtras,
  spreadExtras,
} from "../lib/match-extended-state"
import { matchFromRow, matchToRow } from "../lib/match-supabase"

describe("Task 1 — extended match state backfill", () => {
  it("populates every extended field on an empty match", () => {
    const match: any = {}
    backfillExtendedMatchState(match)
    expect(match.events).toEqual([])
    expect(match.timing).toEqual({ games: [] })
    expect(match.rallyStats).toEqual([])
    expect(match.newBalls).toEqual({
      mode: "off",
      lastChangeAtStartOfGame: 0,
      pendingInGames: null,
    })
    expect(match.handicap).toEqual({ format: "none" })
    expect(match.timeouts).toEqual({ teamA: [], teamB: [] })
    expect(match.officialCalls).toEqual([])
    expect(match.settings.doublesServeSequence).toBe("A1B1A2B2")
  })

  it("is idempotent — second call does not overwrite present values", () => {
    const match: any = {
      events: [{ id: "e1", type: "point", at: "2026-05-27T00:00:00Z", setIndex: 0, gameIndex: 0, payload: {} }],
      newBalls: { mode: "after-first-9-then-each-11", lastChangeAtStartOfGame: 9, pendingInGames: 1 },
      settings: { doublesServeSequence: "A1A2B1B2" },
    }
    backfillExtendedMatchState(match)
    backfillExtendedMatchState(match)
    expect(match.events).toHaveLength(1)
    expect(match.newBalls.mode).toBe("after-first-9-then-each-11")
    expect(match.newBalls.pendingInGames).toBe(1)
    expect(match.settings.doublesServeSequence).toBe("A1A2B1B2")
  })

  it("survives null / undefined input without throwing", () => {
    expect(() => backfillExtendedMatchState(null)).not.toThrow()
    expect(() => backfillExtendedMatchState(undefined)).not.toThrow()
  })

  it("fixes a partially-populated timing object", () => {
    const match: any = { timing: { matchStartedAt: "x" } }
    backfillExtendedMatchState(match)
    expect(match.timing.games).toEqual([])
    expect(match.timing.matchStartedAt).toBe("x")
  })
})

describe("Task 1 — extras pack/spread roundtrip", () => {
  it("only the EXTRAS_FIELDS allow-list is packed", () => {
    const match: any = {
      id: "m1",
      score: { teamA: 0, teamB: 0 },
      events: [{ id: "e", type: "point", at: "t", setIndex: 0, gameIndex: 0, payload: {} }],
      timing: { games: [] },
      newBalls: { mode: "off", lastChangeAtStartOfGame: 0, pendingInGames: null },
    }
    const extras = pickExtras(match)
    expect(Object.keys(extras).sort()).toEqual(["events", "newBalls", "timing"].sort())
    expect(extras).not.toHaveProperty("id")
    expect(extras).not.toHaveProperty("score")
  })

  it("spreadExtras does not overwrite already-set top-level fields", () => {
    const match: any = { events: [{ id: "a", type: "point" }] }
    spreadExtras(match, { events: [{ id: "b" }] })
    expect(match.events).toHaveLength(1)
    expect(match.events[0].id).toBe("a")
  })

  it("matchFromRow restores extras into the top-level match shape", () => {
    const row = {
      id: "m1",
      type: "padel",
      created_at: "2026-05-27T00:00:00Z",
      settings: { sets: 3 },
      team_a: { players: [] },
      team_b: { players: [] },
      score: { teamA: 0, teamB: 0, sets: [], currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false } },
      current_server: { team: "teamA", playerIndex: 0 },
      court_sides: { teamA: "left", teamB: "right" },
      is_completed: false,
      court_number: 1,
      revision: 7,
      extras: {
        events: [{ id: "e1", type: "point", at: "t", setIndex: 0, gameIndex: 0, payload: {} }],
        timing: { games: [{ setIndex: 0, gameIndex: 0, startedAt: "t", scoreTimingsSec: [] }] },
      },
    }
    const match = matchFromRow(row)
    expect(match.events).toHaveLength(1)
    expect(match.timing.games).toHaveLength(1)
    expect(match.newBalls).toEqual({ mode: "off", lastChangeAtStartOfGame: 0, pendingInGames: null })
  })

  it("matchToRow packs extras into the row's extras column", () => {
    const match: any = {
      id: "m1",
      type: "padel",
      createdAt: "2026-05-27T00:00:00Z",
      settings: { sets: 3 },
      teamA: { players: [] },
      teamB: { players: [] },
      score: {},
      currentServer: { team: "teamA", playerIndex: 0 },
      courtSides: { teamA: "left", teamB: "right" },
      isCompleted: false,
      courtNumber: 1,
      events: [{ id: "e1", type: "point", at: "t", setIndex: 0, gameIndex: 0, payload: {} }],
      timing: { games: [] },
    }
    const row = matchToRow(match)
    expect(row.extras.events).toHaveLength(1)
    expect(row.extras.timing).toEqual({ games: [] })
    expect(row.id).toBe("m1") // non-extras still at top level
  })

  it("missing extras column at read time is tolerated", () => {
    const row = {
      id: "m1",
      type: "padel",
      created_at: "t",
      settings: {},
      team_a: { players: [] },
      team_b: { players: [] },
      score: {},
      current_server: { team: "teamA", playerIndex: 0 },
      court_sides: { teamA: "left", teamB: "right" },
      is_completed: false,
      court_number: 1,
      revision: 0,
      // extras intentionally absent (un-migrated DB)
    }
    const match = matchFromRow(row)
    expect(match.events).toEqual([])
    expect(match.timing).toEqual({ games: [] })
    expect(EXTRAS_FIELDS.every((f) => Object.prototype.hasOwnProperty.call(match, f) || f === "toss" || f === "powerPlay" || f === "endMatchReason" || f === "shareUrl" || f === "matchMetadata" || f === "pendingTiebreakChoice" || f === "seedSnapshot")).toBe(true)
  })
})
