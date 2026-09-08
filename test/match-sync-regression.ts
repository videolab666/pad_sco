// Integration test for the durable sync engine (Task 2, Step 6).
//
// Emulates the runtime scenarios deterministically with an in-memory fake
// Supabase backend and a localStorage polyfill — no browser, no live database:
//   A. score clicks while offline, then reconnect (+ collapsed batch)
//   B. the same operation delivered twice (lost-ack idempotency)
//   C. two devices producing a conflict; the server always wins for snapshots
//   D. a permanent error landing in the dead-letter list
//   E. a transient failure mid-replay, then recovery
//   F. a database missing the `revision` column (graceful fallback)
//   G. the public syncMatchToServer entry point
import assert from "node:assert/strict"

// ─── Minimal browser polyfills (must exist before the engine runs) ─────────────
const _ls = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (_ls.has(k) ? _ls.get(k)! : null),
  setItem: (k: string, v: string) => void _ls.set(k, String(v)),
  removeItem: (k: string) => void _ls.delete(k),
  clear: () => _ls.clear(),
  key: (i: number) => Array.from(_ls.keys())[i] ?? null,
  get length() {
    return _ls.size
  },
}
;(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
}

import {
  drainMatch,
  getMatchSyncState,
  resolveConflict,
  syncMatchToServer,
  __resetSyncTestState,
  __setSyncTestHooks,
} from "../lib/match-sync"
import { enqueueOperation } from "../lib/match-operation-log"

// ─── In-memory fake Supabase backend ───────────────────────────────────────────
type FailMode = "none" | "network" | "permission" | "no-revision-col"

const db = {
  matches: new Map<string, any>(),
  operations: new Map<string, any>(),
  failMode: "none" as FailMode,
}
let serverOnline = true

class FakeBuilder {
  private op: "update" | "insert" | "select" | null = null
  private payload: any = null
  private filters: [string, any][] = []
  private returning = false
  private single = false

  constructor(private table: string) {}

  update(p: any) {
    this.op = "update"
    this.payload = p
    return this
  }
  insert(p: any) {
    this.op = "insert"
    this.payload = p
    return this
  }
  select() {
    if (this.op === "update") this.returning = true
    else this.op = "select"
    return this
  }
  eq(c: string, v: any) {
    this.filters.push([c, v])
    return this
  }
  maybeSingle() {
    this.single = true
    return this
  }
  then(resolve: (v: any) => void, reject: (e: any) => void) {
    this.run().then(resolve, reject)
  }

  private filterVal(c: string) {
    return this.filters.find((f) => f[0] === c)?.[1]
  }

  private async run(): Promise<{ data: any; error: any }> {
    if (this.table === "match_operations") {
      if (this.op === "insert") {
        db.operations.set(this.payload.operation_id, this.payload)
        return { data: null, error: null }
      }
      const row = db.operations.get(this.filterVal("operation_id")) ?? null
      return { data: this.single ? row : row ? [row] : [], error: null }
    }

    // matches table
    if (this.op === "update") {
      const hasRevisionKey =
        this.payload && Object.prototype.hasOwnProperty.call(this.payload, "revision")
      if (db.failMode === "network") return { data: null, error: { message: "fetch failed" } }
      if (db.failMode === "permission")
        return { data: null, error: { message: "permission denied for table matches" } }
      if (db.failMode === "no-revision-col" && hasRevisionKey)
        return { data: null, error: { message: "column matches.revision does not exist" } }

      const row = db.matches.get(this.filterVal("id"))
      let matched = false
      if (row) {
        const revFilter = this.filters.find((f) => f[0] === "revision")
        if (!revFilter || row.revision === revFilter[1]) {
          matched = true
          Object.assign(row, this.payload)
        }
      }
      return { data: this.returning ? (matched ? [{ ...row }] : []) : null, error: null }
    }

    if (this.op === "select") {
      const row = db.matches.get(this.filterVal("id")) ?? null
      if (this.single) return { data: row ? { ...row } : null, error: null }
      return { data: row ? [{ ...row }] : [], error: null }
    }
    return { data: null, error: null }
  }
}

const fakeClient = { from: (table: string) => new FakeBuilder(table) }

__setSyncTestHooks({
  createClient: (() => fakeClient) as any,
  isAvailable: async () => serverOnline,
  checkTables: async () => ({ exists: true }),
})

// ─── Helpers ───────────────────────────────────────────────────────────────────
function makeMatch(id: string): any {
  return {
    id,
    type: "padel",
    format: "doubles",
    createdAt: new Date().toISOString(),
    settings: { sets: 3 },
    teamA: { players: [] },
    teamB: { players: [] },
    score: { teamA: 0, teamB: 0, sets: [], currentSet: { teamA: 0, teamB: 0 } },
    currentServer: { team: "teamA", playerIndex: 0 },
    courtSides: { teamA: "left", teamB: "right" },
    shouldChangeSides: false,
    isCompleted: false,
    winner: null,
    courtNumber: 1,
  }
}

function seedServerMatch(id: string, revision: number, extra: any = {}) {
  const m = makeMatch(id)
  db.matches.set(id, {
    id,
    type: m.type,
    format: m.format,
    created_at: m.createdAt,
    settings: m.settings,
    team_a: m.teamA,
    team_b: m.teamB,
    score: m.score,
    current_server: m.currentServer,
    court_sides: m.courtSides,
    should_change_sides: false,
    is_completed: false,
    winner: null,
    court_number: 1,
    revision,
    ...extra,
  })
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── Scenario A: offline clicks, reconnect, collapsed batch ────────────────────
async function scenarioOfflineReconnect() {
  __resetSyncTestState()
  const id = "m-A"
  seedServerMatch(id, 0)
  serverOnline = false

  // Three score presses while offline — each becomes a durable operation.
  enqueueOperation(id, "snapshot", makeMatch(id), makeMatch(id))
  enqueueOperation(id, "snapshot", makeMatch(id), makeMatch(id))
  enqueueOperation(id, "snapshot", makeMatch(id), makeMatch(id))
  await drainMatch(id)

  let state = getMatchSyncState(id)
  assert.equal(state.pendingCount, 3, "A: offline clicks must be retained in the queue")
  assert.equal(state.syncStatus, "offline", "A: status must reflect offline")
  assert.equal(db.matches.get(id).revision, 0, "A: nothing reaches the server while offline")

  // Reconnect — the queue drains, three operations collapse into one write.
  serverOnline = true
  __resetSyncTestState() // clear the pending offline retry timer
  await drainMatch(id)

  state = getMatchSyncState(id)
  assert.equal(state.pendingCount, 0, "A: queue drained after reconnect")
  assert.equal(state.syncStatus, "idle", "A: status idle after successful drain")
  assert.equal(db.matches.get(id).revision, 3, "A: revision advances past every collapsed op")
  console.log("  A. offline clicks + reconnect + collapsed batch — OK")
}

// ─── Scenario B: same operation twice (lost-ack idempotency) ───────────────────
async function scenarioIdempotency() {
  __resetSyncTestState()
  const id = "m-B"
  // The server already advanced to revision 1 — i.e. our write landed but the
  // acknowledgement was lost, leaving the operation still in the local queue.
  seedServerMatch(id, 1)
  enqueueOperation(id, "snapshot", makeMatch(id), makeMatch(id))

  await drainMatch(id)

  const state = getMatchSyncState(id)
  assert.equal(state.pendingCount, 0, "B: replayed operation is acknowledged")
  assert.equal(db.matches.get(id).revision, 1, "B: no double apply — revision stays at 1")
  console.log("  B. duplicate delivery / lost-ack idempotency — OK")
}

// ─── Scenario C: cross-device conflict, resolved both ways ─────────────────────
async function scenarioConflict() {
  // Automatic conflict handling adopts the server state and discards the stale
  // whole snapshot. A client must use a semantic command to express new intent.
  __resetSyncTestState()
  const id = "m-C"
  seedServerMatch(id, 1)
  enqueueOperation(id, "snapshot", makeMatch(id), makeMatch(id))
  // Another device writes in the meantime, pushing the server to revision 5.
  Object.assign(db.matches.get(id), { revision: 5, score: { teamA: 9, teamB: 9 } })

  await drainMatch(id)
  let state = getMatchSyncState(id)
  assert.equal(state.syncStatus, "idle", "C1: stale snapshot is resolved automatically")
  assert.equal(state.pendingCount, 0, "C1: stale local snapshot is discarded")
  const { loadSyncRecord, saveSyncRecord } = await import("../lib/match-operation-log")
  assert.equal(loadSyncRecord(id).snapshot.revision, 5, "C1: server revision is adopted")
  assert.deepEqual(db.matches.get(id).score, { teamA: 9, teamB: 9 }, "C1: server score is not overwritten")

  // Legacy UI may still call resolveConflict(..., "local") for an already
  // recorded conflict. It must still adopt the authoritative server snapshot.
  __resetSyncTestState()
  const id2 = "m-C2"
  seedServerMatch(id2, 5)
  enqueueOperation(id2, "snapshot", makeMatch(id2), makeMatch(id2))
  const rec = loadSyncRecord(id2)
  rec.lastSyncedRevision = 1
  rec.syncStatus = "conflict"
  rec.conflictSnapshot = { ...makeMatch(id2), revision: 5, score: { teamA: 7, teamB: 6 } }
  rec.conflictReason = "server_ahead"
  saveSyncRecord(rec)

  const adopted = await resolveConflict(id2, "local")
  state = getMatchSyncState(id2)
  assert.equal(state.syncStatus, "idle", "C2: legacy conflict resolution clears state")
  assert.equal(state.pendingCount, 0, "C2: legacy local queue is discarded")
  assert.equal(adopted.revision, 5, "C2: server snapshot is returned")
  assert.deepEqual(adopted.score, { teamA: 7, teamB: 6 }, "C2: server score is authoritative")
  assert.equal(db.matches.get(id2).revision, 5, "C2: server row is not rewritten")
  console.log("  C. stale snapshot conflicts always adopt server — OK")
}

// ─── Scenario D: permanent error → dead-letter ─────────────────────────────────
async function scenarioDeadLetter() {
  __resetSyncTestState()
  const id = "m-D"
  seedServerMatch(id, 0)
  db.failMode = "permission"
  enqueueOperation(id, "snapshot", makeMatch(id), makeMatch(id))

  await drainMatch(id)

  const state = getMatchSyncState(id)
  assert.equal(state.syncStatus, "dead-letter", "D: a permission error is classified as permanent")
  assert.equal(state.deadLetterCount, 1, "D: the operation is moved to the dead-letter list")
  assert.equal(state.pendingCount, 0, "D: a dead operation leaves the live queue")
  db.failMode = "none"
  console.log("  D. permanent error → dead-letter — OK")
}

// ─── Scenario E: transient failure mid-replay, then recovery ───────────────────
async function scenarioTransientRetry() {
  __resetSyncTestState()
  const id = "m-E"
  seedServerMatch(id, 0)
  db.failMode = "network"
  enqueueOperation(id, "snapshot", makeMatch(id), makeMatch(id))

  await drainMatch(id)
  let state = getMatchSyncState(id)
  assert.equal(state.syncStatus, "error", "E: a network error is transient, not fatal")
  assert.equal(state.pendingCount, 1, "E: the operation is retained for retry")
  assert.ok(state.retryCount >= 1, "E: the retry counter advanced")

  // Connection restored — the queue drains on the next attempt.
  db.failMode = "none"
  __resetSyncTestState() // clear the pending backoff timer
  await drainMatch(id)
  state = getMatchSyncState(id)
  assert.equal(state.syncStatus, "idle", "E: recovers after the failure clears")
  assert.equal(state.pendingCount, 0, "E: queue drained on recovery")
  assert.equal(db.matches.get(id).revision, 1, "E: the change reaches the server after recovery")
  console.log("  E. transient failure mid-replay + recovery — OK")
}

// ─── Scenario F: un-migrated database (no `revision` column) ───────────────────
async function scenarioNoRevisionColumn() {
  __resetSyncTestState()
  const id = "m-F"
  seedServerMatch(id, 0)
  db.failMode = "no-revision-col"
  enqueueOperation(id, "snapshot", makeMatch(id), makeMatch(id))

  await drainMatch(id)

  const state = getMatchSyncState(id)
  assert.equal(state.syncStatus, "idle", "F: falls back to last-writer-wins when revision column is missing")
  assert.equal(state.pendingCount, 0, "F: the write still succeeds on an un-migrated database")
  db.failMode = "none"
  console.log("  F. un-migrated database fallback — OK")
}

// ─── Scenario G: public syncMatchToServer entry point ──────────────────────────
async function scenarioPublicEntry() {
  __resetSyncTestState()
  const id = "m-G"
  seedServerMatch(id, 0)
  serverOnline = true

  syncMatchToServer(makeMatch(id))
  await wait(60) // let the non-blocking internal drain finish

  const state = getMatchSyncState(id)
  assert.equal(state.pendingCount, 0, "G: syncMatchToServer enqueues and drains")
  assert.equal(db.matches.get(id).revision, 1, "G: the change reached the server")
  console.log("  G. public syncMatchToServer entry point — OK")
}

// Exported so the Vitest wrapper (test/match-sync.test.ts) can await it.
// Still runnable standalone via `npx tsx test/match-sync-regression.ts`.
export async function main() {
  console.log("match-sync regression:")
  await scenarioOfflineReconnect()
  await scenarioIdempotency()
  await scenarioConflict()
  await scenarioDeadLetter()
  await scenarioTransientRetry()
  await scenarioNoRevisionColumn()
  await scenarioPublicEntry()
  __resetSyncTestState() // clear any lingering timers so the process exits
  console.log("match-sync regression checks passed")
}

// Self-run only when executed directly (tsx/node), not when imported by Vitest.
const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  /match-sync-regression\.(ts|js|mjs)$/.test(process.argv[1].replace(/\\/g, "/"))

if (isDirectRun) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
