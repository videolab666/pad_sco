import { beforeEach, describe, expect, it, vi } from "vitest"

const storage = new Map<string, string>()
vi.stubGlobal("window", {})
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size },
})

describe("durable outbox across tabs", () => {
  beforeEach(() => { storage.clear(); vi.resetModules() })
  it("merges independent tab writes and does not resurrect acknowledged commands from a stale cache", async () => {
    const tabA = await import("../lib/match-operation-log")
    const a = tabA.enqueueOperation("tabs", "command", { command: "point", args: { team: "teamA" } }, { id: "tabs" })
    vi.resetModules()
    const tabB = await import("../lib/match-operation-log")
    const b = tabB.enqueueOperation("tabs", "command", { command: "point", args: { team: "teamB" } }, { id: "tabs" })
    tabA.saveSyncRecord(a.record) // older tab overwrites the per-match cache
    expect(tabA.loadSyncRecord("tabs").queue.map(op => op.operationId)).toEqual([a.operation.operationId, b.operation.operationId])
    tabA.markOperationsSynced("tabs", [a.operation.operationId], 1)
    tabB.saveSyncRecord(b.record) // stale queue still contains the ACK'd A
    expect(tabB.loadSyncRecord("tabs").queue.map(op => op.operationId)).toEqual([b.operation.operationId])
    tabB.markOperationsSynced("tabs", [b.operation.operationId], 2)
    expect(tabA.loadSyncRecord("tabs").queue).toEqual([])
    expect(tabA.listMatchesWithPendingOperations()).toEqual([])
  })
  it("retains more than 500 offline commands without silent truncation", async () => {
    const log = await import("../lib/match-operation-log")
    for (let i = 0; i < 505; i++) log.enqueueOperation("long-offline", "command", { command: "point", args: { team: "teamA" } }, { id: "long-offline" })
    expect(log.loadSyncRecord("long-offline").queue).toHaveLength(505)
  })
  it("does not replace newer server truth with a delayed acknowledgement", async () => {
    const log = await import("../lib/match-operation-log")
    const pending = log.enqueueOperation("late-ack", "command", { command: "point" }, { id: "late-ack" })
    const latest = { id: "late-ack", revision: 4, isCompleted: true }
    log.saveSyncRecord({ ...pending.record, lastSyncedRevision: 4, authoritativeSnapshot: latest, snapshot: latest })
    const acked = log.markOperationsSynced("late-ack", [pending.operation.operationId], 3, { id: "late-ack", revision: 3, isCompleted: false })
    expect(acked.snapshot).toEqual(latest)
    expect(acked.queue).toHaveLength(0)
  })
})
