import { beforeEach, describe, expect, it, vi } from "vitest"
import { matchFromRow, matchToRow } from "../lib/match-supabase"
import { applyRemoteCommand } from "../lib/remote-commands"

const db = vi.hoisted(() => ({ row: null as any, audit: new Map<string, any>(), failAudit: false, writes: [] as any[], loseCas: false, failReads: false }))
vi.mock("@/lib/api-auth", () => ({ isAuthorizedMatchCommandRequest: () => true }))
vi.mock("@/lib/error-logger", () => ({ logEvent: vi.fn() }))
vi.mock("@/lib/video-registry", () => ({ autoMarkVideoEvents: vi.fn() }))
vi.mock("@/lib/rating-service", () => ({ applyCompletionRatings: vi.fn() }))
vi.mock("@/lib/server-match-storage", () => ({ getMatchFromServer: vi.fn() }))
vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => ({ from: (table: string) => {
    let action = "select", value: any, single = false
    const filters: [string, any][] = []
    const builder: any = {
      select: () => builder,
      eq: (key: string, val: any) => { filters.push([key, val]); return builder },
      is: (key: string, val: any) => { filters.push([key, val]); return builder },
      update: (val: any) => { action = "update"; value = val; return builder },
      insert: (val: any) => { action = "insert"; value = val; return builder },
      maybeSingle: () => { single = true; return builder },
      then: (resolve: any, reject: any) => Promise.resolve().then(() => {
        if (table === "match_operations") {
          if (action === "insert") {
            if (db.failAudit) return { data: null, error: { message: "audit unavailable" } }
            db.audit.set(value.operation_id, value)
            return { data: null, error: null }
          }
          return { data: db.audit.get(filters.find(([k]) => k === "operation_id")?.[1]) ?? null, error: null }
        }
        if (action === "select" && db.failReads) return { data: null, error: { message: "temporary database outage" } }
        if (action === "update" && db.loseCas) { db.failReads = true; return { data: [], error: null } }
        const matches = db.row && filters.every(([key, val]) => db.row[key] === val)
        if (action === "update") {
          db.writes.push({ filters, value })
          if (!matches) return { data: [], error: null }
          db.row = { ...db.row, ...structuredClone(value) }
        }
        return { data: matches ? (single ? structuredClone(db.row) : [structuredClone(db.row)]) : (single ? null : []), error: null }
      }).then(resolve, reject),
    }
    return builder
  } }),
}))

import { POST } from "../app/api/match/[id]/command/route"
import { PUT } from "../app/api/match/[id]/route"
import { POST as BATCH } from "../app/api/match/[id]/commands/route"

const initial = () => ({
  id: "route-match", revision: 0, type: "padel", format: "doubles", isCompleted: false,
  settings: { sets: 3, gamesPerSet: 6, scoringSystem: "classic", tiebreakEnabled: true },
  teamA: { players: [] }, teamB: { players: [] },
  currentServer: { team: "teamA", playerIndex: 0 }, courtSides: { teamA: "left", teamB: "right" },
  score: { teamA: 0, teamB: 0, sets: [], currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false } },
})
const params = { params: Promise.resolve({ id: "route-match" }) }
const command = (operationId: string, command: string, args: any = {}) => POST(new Request("http://localhost/api/match/route-match/command", {
  method: "POST", body: JSON.stringify({ operationId, command, args }),
}), params)
const snapshot = (match: any, baseRevision: number) => PUT(new Request("http://localhost/api/match/route-match", {
  method: "PUT", body: JSON.stringify({ match, operation: { operationId: "snapshot-op", baseRevision } }),
}), params)

beforeEach(() => {
  db.row = { ...matchToRow(initial()), revision: 0 }
  db.audit.clear(); db.writes = []; db.failAudit = false; db.loseCas = false; db.failReads = false
})

describe("real match HTTP handlers with atomic compare-and-swap storage", () => {
  it("does not report deletion when a post-conflict database read fails", async () => {
    db.loseCas = true
    expect((await command("read-outage", "point", { team: "teamA" })).status).toBe(503)
    db.failReads = false
    expect((await snapshot(initial(), 0)).status).toBe(503)
  })
  it("keeps snapshot intent retryable on an initial database read outage", async () => {
    db.failReads = true
    expect((await snapshot(initial(), 0)).status).toBe(503)
  })
  it("applies a batch atomically and deduplicates a retry even without the audit log", async () => {
    db.failAudit = true
    const batch = () => BATCH(new Request("http://localhost/api/match/route-match/commands", {
      method: "POST", body: JSON.stringify({ operationId: "batch-once", commands: [
        { command: "point", args: { team: "teamA" } },
        { command: "point", args: { team: "teamB" } },
      ] }),
    }), params)
    expect((await batch()).status).toBe(200)
    expect((await batch()).status).toBe(200)
    expect(db.row.revision).toBe(1)
    expect(db.row.score.currentSet.currentGame).toEqual({ teamA: 15, teamB: 15 })
  })
  it("preserves both referees' points after an interleaved conflict", async () => {
    const inputs = [["judge-a-point", "teamA"], ["judge-b-point", "teamB"]]
    const responses = await Promise.all(inputs.map(([id, team]) => command(id, "point", { team })))
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    const losing = responses.findIndex(r => r.status === 409)
    expect((await command(inputs[losing][0], "point", { team: inputs[losing][1] })).status).toBe(200)
    expect(db.row.score.currentSet.currentGame).toEqual({ teamA: 15, teamB: 15 })
    expect(db.row.revision).toBe(2)
    const stale = matchFromRow(structuredClone(db.row))
    expect((await command("finish-a", "finish")).status).toBe(200)
    stale.teamA.name = "stale rename"
    expect((await snapshot(stale, 2)).status).toBe(409)
    expect(db.row.is_completed).toBe(true)
    const rejected = await command("late-b", "point", { team: "teamB" })
    expect(rejected.status).toBe(400)
    expect((await rejected.json()).match.isCompleted).toBe(true)
  })

  it("does not duplicate a lost-response command when audit insertion failed", async () => {
    db.failAudit = true
    expect((await command("lost-response", "point", { team: "teamA" })).status).toBe(200)
    const retry = await command("lost-response", "point", { team: "teamA" })
    expect((await retry.json()).idempotent).toBe(true)
    expect(db.row.score.currentSet.currentGame.teamA).toBe(15)
    expect(db.row.revision).toBe(1)
  })

  it("also compares null revisions atomically when two referees adopt a legacy row", async () => {
    db.row.revision = null
    const responses = await Promise.all([
      command("legacy-a", "point", { team: "teamA" }),
      command("legacy-b", "point", { team: "teamB" }),
    ])
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    expect(db.row.revision).toBe(1)
    expect(db.writes.every(w => w.filters.some(([k]: any) => k === "revision"))).toBe(true)
  })

  it("keeps transport deduplication across journal undo and rejects completed score edits", async () => {
    db.failAudit = true
    await command("once-only", "point", { team: "teamA" })
    expect((await command("undo-once", "undo-point")).status).toBe(200)
    const revision = db.row.revision
    const retry = await command("once-only", "point", { team: "teamA" })
    expect((await retry.json()).idempotent).toBe(true)
    expect(db.row.revision).toBe(revision)
    expect(db.row.score.currentSet.currentGame.teamA).toBe(0)
    await command("close", "finish")
    const corrupted = matchFromRow(structuredClone(db.row))
    corrupted.score.sets.push({ teamA: 9, teamB: 9, isTiebreak: true })
    expect((await snapshot(corrupted, db.row.revision)).status).toBe(409)
    expect(db.row.score.sets).toHaveLength(0)
  })

  it("finishes in two sets and rejects late scoring without phantom tiebreaks or a third set", async () => {
    let m: any = initial()
    for (let i = 0; i < 47; i++) m = applyRemoteCommand(m, "point", { team: "teamA" })
    db.row = { ...matchToRow(m), revision: 47 }
    expect((await command("match-point", "point", { team: "teamA" })).status).toBe(200)
    const finalScore = structuredClone(db.row.score)
    expect(db.row.is_completed).toBe(true)
    expect(db.row.score.sets).toHaveLength(2)
    expect((await command("late-point", "point", { team: "teamB" })).status).toBe(400)
    expect((await command("late-tb", "start-tiebreak")).status).toBe(400)
    expect((await command("confirm-finish", "finish")).status).toBe(200)
    expect(db.row.score).toEqual(finalScore)
  })
})
