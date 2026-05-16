"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Integration test for the durable sync engine (Task 2, Step 6).
//
// Emulates the runtime scenarios deterministically with an in-memory fake
// Supabase backend and a localStorage polyfill — no browser, no live database:
//   A. score clicks while offline, then reconnect (+ collapsed batch)
//   B. the same operation delivered twice (lost-ack idempotency)
//   C. two devices producing a conflict, resolved both ways
//   D. a permanent error landing in the dead-letter list
//   E. a transient failure mid-replay, then recovery
//   F. a database missing the `revision` column (graceful fallback)
//   G. the public syncMatchToServer entry point
const strict_1 = __importDefault(require("node:assert/strict"));
// ─── Minimal browser polyfills (must exist before the engine runs) ─────────────
const _ls = new Map();
globalThis.localStorage = {
    getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
    setItem: (k, v) => void _ls.set(k, String(v)),
    removeItem: (k) => void _ls.delete(k),
    clear: () => _ls.clear(),
    key: (i) => Array.from(_ls.keys())[i] ?? null,
    get length() {
        return _ls.size;
    },
};
globalThis.window = {
    addEventListener: () => { },
    removeEventListener: () => { },
    dispatchEvent: () => { },
};
const match_sync_1 = require("../lib/match-sync");
const match_operation_log_1 = require("../lib/match-operation-log");
const db = {
    matches: new Map(),
    operations: new Map(),
    failMode: "none",
};
let serverOnline = true;
class FakeBuilder {
    constructor(table) {
        this.table = table;
        this.op = null;
        this.payload = null;
        this.filters = [];
        this.returning = false;
        this.single = false;
    }
    update(p) {
        this.op = "update";
        this.payload = p;
        return this;
    }
    insert(p) {
        this.op = "insert";
        this.payload = p;
        return this;
    }
    select() {
        if (this.op === "update")
            this.returning = true;
        else
            this.op = "select";
        return this;
    }
    eq(c, v) {
        this.filters.push([c, v]);
        return this;
    }
    maybeSingle() {
        this.single = true;
        return this;
    }
    then(resolve, reject) {
        this.run().then(resolve, reject);
    }
    filterVal(c) {
        return this.filters.find((f) => f[0] === c)?.[1];
    }
    async run() {
        if (this.table === "match_operations") {
            if (this.op === "insert") {
                db.operations.set(this.payload.operation_id, this.payload);
                return { data: null, error: null };
            }
            const row = db.operations.get(this.filterVal("operation_id")) ?? null;
            return { data: this.single ? row : row ? [row] : [], error: null };
        }
        // matches table
        if (this.op === "update") {
            const hasRevisionKey = this.payload && Object.prototype.hasOwnProperty.call(this.payload, "revision");
            if (db.failMode === "network")
                return { data: null, error: { message: "fetch failed" } };
            if (db.failMode === "permission")
                return { data: null, error: { message: "permission denied for table matches" } };
            if (db.failMode === "no-revision-col" && hasRevisionKey)
                return { data: null, error: { message: "column matches.revision does not exist" } };
            const row = db.matches.get(this.filterVal("id"));
            let matched = false;
            if (row) {
                const revFilter = this.filters.find((f) => f[0] === "revision");
                if (!revFilter || row.revision === revFilter[1]) {
                    matched = true;
                    Object.assign(row, this.payload);
                }
            }
            return { data: this.returning ? (matched ? [{ ...row }] : []) : null, error: null };
        }
        if (this.op === "select") {
            const row = db.matches.get(this.filterVal("id")) ?? null;
            if (this.single)
                return { data: row ? { ...row } : null, error: null };
            return { data: row ? [{ ...row }] : [], error: null };
        }
        return { data: null, error: null };
    }
}
const fakeClient = { from: (table) => new FakeBuilder(table) };
(0, match_sync_1.__setSyncTestHooks)({
    createClient: (() => fakeClient),
    isAvailable: async () => serverOnline,
    checkTables: async () => ({ exists: true }),
});
// ─── Helpers ───────────────────────────────────────────────────────────────────
function makeMatch(id) {
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
    };
}
function seedServerMatch(id, revision, extra = {}) {
    const m = makeMatch(id);
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
    });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// ─── Scenario A: offline clicks, reconnect, collapsed batch ────────────────────
async function scenarioOfflineReconnect() {
    (0, match_sync_1.__resetSyncTestState)();
    const id = "m-A";
    seedServerMatch(id, 0);
    serverOnline = false;
    // Three score presses while offline — each becomes a durable operation.
    (0, match_operation_log_1.enqueueOperation)(id, "snapshot", makeMatch(id), makeMatch(id));
    (0, match_operation_log_1.enqueueOperation)(id, "snapshot", makeMatch(id), makeMatch(id));
    (0, match_operation_log_1.enqueueOperation)(id, "snapshot", makeMatch(id), makeMatch(id));
    await (0, match_sync_1.drainMatch)(id);
    let state = (0, match_sync_1.getMatchSyncState)(id);
    strict_1.default.equal(state.pendingCount, 3, "A: offline clicks must be retained in the queue");
    strict_1.default.equal(state.syncStatus, "offline", "A: status must reflect offline");
    strict_1.default.equal(db.matches.get(id).revision, 0, "A: nothing reaches the server while offline");
    // Reconnect — the queue drains, three operations collapse into one write.
    serverOnline = true;
    (0, match_sync_1.__resetSyncTestState)(); // clear the pending offline retry timer
    await (0, match_sync_1.drainMatch)(id);
    state = (0, match_sync_1.getMatchSyncState)(id);
    strict_1.default.equal(state.pendingCount, 0, "A: queue drained after reconnect");
    strict_1.default.equal(state.syncStatus, "idle", "A: status idle after successful drain");
    strict_1.default.equal(db.matches.get(id).revision, 3, "A: revision advances past every collapsed op");
    console.log("  A. offline clicks + reconnect + collapsed batch — OK");
}
// ─── Scenario B: same operation twice (lost-ack idempotency) ───────────────────
async function scenarioIdempotency() {
    (0, match_sync_1.__resetSyncTestState)();
    const id = "m-B";
    // The server already advanced to revision 1 — i.e. our write landed but the
    // acknowledgement was lost, leaving the operation still in the local queue.
    seedServerMatch(id, 1);
    (0, match_operation_log_1.enqueueOperation)(id, "snapshot", makeMatch(id), makeMatch(id));
    await (0, match_sync_1.drainMatch)(id);
    const state = (0, match_sync_1.getMatchSyncState)(id);
    strict_1.default.equal(state.pendingCount, 0, "B: replayed operation is acknowledged");
    strict_1.default.equal(db.matches.get(id).revision, 1, "B: no double apply — revision stays at 1");
    console.log("  B. duplicate delivery / lost-ack idempotency — OK");
}
// ─── Scenario C: cross-device conflict, resolved both ways ─────────────────────
async function scenarioConflict() {
    // C1 — resolve by adopting the server state.
    (0, match_sync_1.__resetSyncTestState)();
    const id = "m-C";
    seedServerMatch(id, 1);
    (0, match_operation_log_1.enqueueOperation)(id, "snapshot", makeMatch(id), makeMatch(id));
    // Another device writes in the meantime, pushing the server to revision 5.
    Object.assign(db.matches.get(id), { revision: 5, score: { teamA: 9, teamB: 9 } });
    await (0, match_sync_1.drainMatch)(id);
    let state = (0, match_sync_1.getMatchSyncState)(id);
    strict_1.default.equal(state.syncStatus, "conflict", "C1: server divergence is detected as a conflict");
    const adopted = await (0, match_sync_1.resolveConflict)(id, "server");
    strict_1.default.equal(adopted.revision, 5, "C1: resolving to server adopts the server revision");
    state = (0, match_sync_1.getMatchSyncState)(id);
    strict_1.default.equal(state.syncStatus, "idle", "C1: conflict cleared after resolution");
    strict_1.default.equal(state.pendingCount, 0, "C1: local queue discarded on server resolution");
    // C2 — resolve by keeping local: the queue is re-based and re-applied.
    (0, match_sync_1.__resetSyncTestState)();
    const id2 = "m-C2";
    seedServerMatch(id2, 5);
    (0, match_operation_log_1.enqueueOperation)(id2, "snapshot", makeMatch(id2), makeMatch(id2));
    // Local record believes it was synced at revision 1; server is ahead at 5.
    const { loadSyncRecord, saveSyncRecord } = require("../lib/match-operation-log");
    const rec = loadSyncRecord(id2);
    rec.lastSyncedRevision = 1;
    saveSyncRecord(rec);
    await (0, match_sync_1.drainMatch)(id2);
    strict_1.default.equal((0, match_sync_1.getMatchSyncState)(id2).syncStatus, "conflict", "C2: conflict detected");
    await (0, match_sync_1.resolveConflict)(id2, "local");
    state = (0, match_sync_1.getMatchSyncState)(id2);
    strict_1.default.equal(state.syncStatus, "idle", "C2: keep-local resolution drains cleanly");
    strict_1.default.equal(state.pendingCount, 0, "C2: re-based queue is fully applied");
    strict_1.default.equal(db.matches.get(id2).revision, 6, "C2: local change applied on top of server revision");
    console.log("  C. cross-device conflict (resolve server / resolve local) — OK");
}
// ─── Scenario D: permanent error → dead-letter ─────────────────────────────────
async function scenarioDeadLetter() {
    (0, match_sync_1.__resetSyncTestState)();
    const id = "m-D";
    seedServerMatch(id, 0);
    db.failMode = "permission";
    (0, match_operation_log_1.enqueueOperation)(id, "snapshot", makeMatch(id), makeMatch(id));
    await (0, match_sync_1.drainMatch)(id);
    const state = (0, match_sync_1.getMatchSyncState)(id);
    strict_1.default.equal(state.syncStatus, "dead-letter", "D: a permission error is classified as permanent");
    strict_1.default.equal(state.deadLetterCount, 1, "D: the operation is moved to the dead-letter list");
    strict_1.default.equal(state.pendingCount, 0, "D: a dead operation leaves the live queue");
    db.failMode = "none";
    console.log("  D. permanent error → dead-letter — OK");
}
// ─── Scenario E: transient failure mid-replay, then recovery ───────────────────
async function scenarioTransientRetry() {
    (0, match_sync_1.__resetSyncTestState)();
    const id = "m-E";
    seedServerMatch(id, 0);
    db.failMode = "network";
    (0, match_operation_log_1.enqueueOperation)(id, "snapshot", makeMatch(id), makeMatch(id));
    await (0, match_sync_1.drainMatch)(id);
    let state = (0, match_sync_1.getMatchSyncState)(id);
    strict_1.default.equal(state.syncStatus, "error", "E: a network error is transient, not fatal");
    strict_1.default.equal(state.pendingCount, 1, "E: the operation is retained for retry");
    strict_1.default.ok(state.retryCount >= 1, "E: the retry counter advanced");
    // Connection restored — the queue drains on the next attempt.
    db.failMode = "none";
    (0, match_sync_1.__resetSyncTestState)(); // clear the pending backoff timer
    await (0, match_sync_1.drainMatch)(id);
    state = (0, match_sync_1.getMatchSyncState)(id);
    strict_1.default.equal(state.syncStatus, "idle", "E: recovers after the failure clears");
    strict_1.default.equal(state.pendingCount, 0, "E: queue drained on recovery");
    strict_1.default.equal(db.matches.get(id).revision, 1, "E: the change reaches the server after recovery");
    console.log("  E. transient failure mid-replay + recovery — OK");
}
// ─── Scenario F: un-migrated database (no `revision` column) ───────────────────
async function scenarioNoRevisionColumn() {
    (0, match_sync_1.__resetSyncTestState)();
    const id = "m-F";
    seedServerMatch(id, 0);
    db.failMode = "no-revision-col";
    (0, match_operation_log_1.enqueueOperation)(id, "snapshot", makeMatch(id), makeMatch(id));
    await (0, match_sync_1.drainMatch)(id);
    const state = (0, match_sync_1.getMatchSyncState)(id);
    strict_1.default.equal(state.syncStatus, "idle", "F: falls back to last-writer-wins when revision column is missing");
    strict_1.default.equal(state.pendingCount, 0, "F: the write still succeeds on an un-migrated database");
    db.failMode = "none";
    console.log("  F. un-migrated database fallback — OK");
}
// ─── Scenario G: public syncMatchToServer entry point ──────────────────────────
async function scenarioPublicEntry() {
    (0, match_sync_1.__resetSyncTestState)();
    const id = "m-G";
    seedServerMatch(id, 0);
    serverOnline = true;
    (0, match_sync_1.syncMatchToServer)(makeMatch(id));
    await wait(60); // let the non-blocking internal drain finish
    const state = (0, match_sync_1.getMatchSyncState)(id);
    strict_1.default.equal(state.pendingCount, 0, "G: syncMatchToServer enqueues and drains");
    strict_1.default.equal(db.matches.get(id).revision, 1, "G: the change reached the server");
    console.log("  G. public syncMatchToServer entry point — OK");
}
async function main() {
    console.log("match-sync regression:");
    await scenarioOfflineReconnect();
    await scenarioIdempotency();
    await scenarioConflict();
    await scenarioDeadLetter();
    await scenarioTransientRetry();
    await scenarioNoRevisionColumn();
    await scenarioPublicEntry();
    (0, match_sync_1.__resetSyncTestState)(); // clear any lingering timers so the process exits
    console.log("match-sync regression checks passed");
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
