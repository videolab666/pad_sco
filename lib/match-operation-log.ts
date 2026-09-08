// Durable local operation log for match sync (Task 2, Step 2).
//
// Every score press, rule change, roster edit and court edit is persisted here
// as a MatchOperation *before* any network call. The record also keeps the last
// known match snapshot, the pending queue, the last synced revision and the
// sync status, so the app can recover after a reload, crash or offline period.
import { v4 as uuidv4 } from "uuid"
import { logEvent } from "./error-logger"
import { tSync } from "./log-i18n"
import {
  SYNC_SCHEMA_VERSION,
  type MatchOperation,
  type MatchOperationKind,
  type MatchSyncRecord,
  type SyncState,
} from "./types"

const OPLOG_PREFIX = "match_oplog_"
const COMMAND_PREFIX = "match_pending_command_"
const volatileCommands = new Set<string>()
let commandOrder = 0

function persistCommand(op: MatchOperation): void {
  if (!isStorageAvailable()) return
  try {
    commandOrder = Math.max(commandOrder + 1, Date.now() * 1000)
    localStorage.setItem(COMMAND_PREFIX + op.operationId, JSON.stringify({ operation: op, order: commandOrder }))
  } catch {
    volatileCommands.add(op.operationId)
  }
}

function removeCommand(id: string): void {
  volatileCommands.delete(id)
  if (isStorageAvailable()) localStorage.removeItem(COMMAND_PREFIX + id)
}

/** One key per command prevents two tabs overwriting each other's outbox. */
function mergeCommandIndex(record: MatchSyncRecord): MatchSyncRecord {
  if (!isStorageAvailable()) return record
  if (record.commandIndexVersion !== 1) {
    for (const op of record.queue) if (op.kind === "command") persistCommand(op)
    record.commandIndexVersion = 1
  }
  const pending: Array<{ operation: MatchOperation; order: number }> = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(COMMAND_PREFIX)) continue
      const entry = JSON.parse(localStorage.getItem(key) || "null")
      if (entry?.operation?.matchId === record.matchId && entry.operation.kind === "command") pending.push(entry)
    }
    pending.sort((a, b) => a.order - b.order || a.operation.operationId.localeCompare(b.operation.operationId))
    const existing = new Map(record.queue.map(op => [op.operationId, op]))
    record.queue = [
      ...record.queue.filter(op => op.kind !== "command" || volatileCommands.has(op.operationId)),
      ...pending.map(entry => existing.get(entry.operation.operationId) ?? entry.operation),
    ]
  } catch {
    // Keep in-memory intent if storage becomes unavailable mid-session.
  }
  return record
}
const CLIENT_ID_KEY = "padel_sync_client_id"

/** Hard cap on the live queue length — guards against unbounded growth. */
const MAX_QUEUE_LENGTH = 500

/** In-memory fallback used when localStorage is unavailable (private mode etc). */
const memoryRecords = new Map<string, MatchSyncRecord>()
let storageAvailable: boolean | null = null
let storageWarned = false

const isBrowser = () => typeof window !== "undefined"

/** Detects whether localStorage can actually be written to (failure mode #17). */
export function isStorageAvailable(): boolean {
  if (!isBrowser()) return false
  if (storageAvailable !== null) return storageAvailable
  try {
    const probe = "__padel_oplog_probe__"
    localStorage.setItem(probe, "1")
    localStorage.removeItem(probe)
    storageAvailable = true
  } catch {
    storageAvailable = false
    if (!storageWarned) {
      storageWarned = true
      logEvent("warn", tSync("logMessages.localStorageUnavailable"), "match-operation-log")
    }
  }
  return storageAvailable
}

/** Stable per-browser id, used to attribute operations and break cross-tab ties. */
export function getClientId(): string {
  if (!isBrowser()) return "server"
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = uuidv4()
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return `ephemeral-${Math.random().toString(36).slice(2)}`
  }
}

function freshRecord(matchId: string, snapshot: any, revision = 0): MatchSyncRecord {
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    matchId,
    clientId: getClientId(),
    revision,
    lastSyncedRevision: revision,
    snapshot: snapshot ?? null,
    queue: [],
    deadLetter: [],
    syncStatus: "idle",
    lastError: null,
    conflictReason: null,
    conflictSnapshot: null,
    lastSyncedAt: null,
    updatedAt: new Date().toISOString(),
  }
}

/** Validates a parsed record before it is allowed to drive the scoring state. */
function isValidRecord(value: any): value is MatchSyncRecord {
  return (
    value &&
    typeof value === "object" &&
    value.schemaVersion === SYNC_SCHEMA_VERSION &&
    typeof value.matchId === "string" &&
    typeof value.revision === "number" &&
    typeof value.lastSyncedRevision === "number" &&
    Array.isArray(value.queue) &&
    Array.isArray(value.deadLetter)
  )
}

/**
 * Loads the persisted sync record for a match. Returns a fresh record if none
 * exists or the stored payload is corrupt / from an incompatible schema.
 */
export function loadSyncRecord(matchId: string, fallbackSnapshot: any = null): MatchSyncRecord {
  if (memoryRecords.has(matchId)) return mergeCommandIndex(memoryRecords.get(matchId)!)
  if (!isStorageAvailable()) return freshRecord(matchId, fallbackSnapshot)

  try {
    const raw = localStorage.getItem(OPLOG_PREFIX + matchId)
    if (!raw) return mergeCommandIndex(freshRecord(matchId, fallbackSnapshot))
    const parsed = JSON.parse(raw)
    if (!isValidRecord(parsed)) {
      logEvent("warn", tSync("logMessages.operationLogCorrupted", { id: matchId }), "match-operation-log")
      return freshRecord(matchId, fallbackSnapshot)
    }
    return mergeCommandIndex(parsed)
  } catch (error) {
    logEvent("warn", tSync("logMessages.operationLogReadError", { id: matchId }), "match-operation-log", error)
    return freshRecord(matchId, fallbackSnapshot)
  }
}

/** Persists a sync record. Falls back to memory if storage is full/unavailable. */
export function saveSyncRecord(record: MatchSyncRecord): void {
  record.updatedAt = new Date().toISOString()
  memoryRecords.set(record.matchId, record)
  if (!isStorageAvailable()) return
  try {
    localStorage.setItem(OPLOG_PREFIX + record.matchId, JSON.stringify(record))
  } catch (error) {
    // Quota exhaustion — surface it explicitly instead of pretending sync works.
    logEvent("error", tSync("logMessages.operationLogSaveError", { id: record.matchId }), "match-operation-log", error)
    record.syncStatus = "limited"
  }
}

/**
 * Appends a new operation. Bumps the local revision and stores the resulting
 * snapshot so the operation can be replayed deterministically later.
 */
export function enqueueOperation(
  matchId: string,
  kind: MatchOperationKind,
  payload: any,
  snapshot: any,
): { record: MatchSyncRecord; operation: MatchOperation } {
  const record = loadSyncRecord(matchId, snapshot)
  const operation: MatchOperation = {
    operationId: uuidv4(),
    matchId,
    baseRevision: record.revision,
    kind,
    payload,
    createdAt: new Date().toISOString(),
    clientId: getClientId(),
    retryCount: 0,
    lastError: null,
  }
  record.queue.push(operation)
  if (kind === "command") persistCommand(operation)
  record.revision += 1
  record.snapshot = snapshot ?? record.snapshot
  record.syncStatus = "pending"
  record.lastError = null

  // Compaction guardrail: never let the live queue grow without bound.
  if (record.queue.length > MAX_QUEUE_LENGTH && record.queue.every(op => op.kind !== "command")) {
    record.queue = record.queue.slice(-MAX_QUEUE_LENGTH)
  }

  saveSyncRecord(record)
  return { record, operation }
}

/** Removes confirmed operations from the queue and advances the synced revision. */
export function markOperationsSynced(
  matchId: string,
  operationIds: string[],
  serverRevision: number,
  serverSnapshot?: any,
): MatchSyncRecord {
  const record = loadSyncRecord(matchId)
  const done = new Set(operationIds)
  for (const op of record.queue) if (op.kind === "command" && done.has(op.operationId)) removeCommand(op.operationId)
  record.queue = record.queue.filter((op) => !done.has(op.operationId))
  record.lastSyncedRevision = Math.max(record.lastSyncedRevision, serverRevision)
  record.revision = Math.max(record.revision, record.lastSyncedRevision)
  if (serverSnapshot && serverRevision >= record.lastSyncedRevision) record.snapshot = serverSnapshot
  record.lastSyncedAt = new Date().toISOString()
  record.lastError = null
  record.conflictReason = null
  record.conflictSnapshot = null
  record.syncStatus = record.queue.length > 0 ? "pending" : "idle"
  saveSyncRecord(record)
  return record
}

/**
 * Records a transient failure for an operation. After `maxRetries` the operation
 * is moved out of the live queue into the dead-letter list for operator review.
 */
export function markOperationFailed(
  matchId: string,
  operationId: string,
  error: string,
  maxRetries: number,
): MatchSyncRecord {
  const record = loadSyncRecord(matchId)
  const op = record.queue.find((o) => o.operationId === operationId)
  if (op) {
    op.retryCount += 1
    op.lastError = error
    if (op.retryCount >= maxRetries) {
      if (op.kind === "command") removeCommand(operationId)
      record.queue = record.queue.filter((o) => o.operationId !== operationId)
      record.deadLetter.push(op)
      record.syncStatus = "dead-letter"
    } else {
      record.syncStatus = "error"
    }
  }
  record.lastError = error
  saveSyncRecord(record)
  return record
}

/** Stores a divergence so a resolution decision can be made deterministically. */
export function markConflict(matchId: string, reason: string, serverSnapshot: any): MatchSyncRecord {
  const record = loadSyncRecord(matchId)
  record.syncStatus = "conflict"
  record.conflictReason = reason
  record.conflictSnapshot = serverSnapshot
  saveSyncRecord(record)
  return record
}

/** Updates only the sync status (e.g. mark "syncing" / "offline"). */
export function setSyncStatus(matchId: string, status: MatchSyncRecord["syncStatus"]): MatchSyncRecord {
  const record = loadSyncRecord(matchId)
  record.syncStatus = status
  saveSyncRecord(record)
  return record
}

/** Derives the observable, UI-facing sync state from the persisted record. */
export function toSyncState(record: MatchSyncRecord): SyncState {
  const lastFailed =
    record.queue.find((o) => o.retryCount > 0) || record.deadLetter[record.deadLetter.length - 1]
  return {
    matchId: record.matchId,
    syncStatus: record.syncStatus,
    lastSuccessRevision: record.lastSyncedRevision,
    lastSyncedAt: record.lastSyncedAt ?? null,
    lastFailedOperationId: lastFailed?.operationId ?? null,
    retryCount: record.queue.reduce((sum, o) => sum + o.retryCount, 0),
    conflictReason: record.conflictReason ?? null,
    pendingCount: record.queue.length,
    deadLetterCount: record.deadLetter.length,
  }
}

/** Returns the ids of every match that currently has unsynced operations. */
export function listMatchesWithPendingOperations(): string[] {
  const ids = new Set<string>()
  for (const [id, rec] of memoryRecords) {
    if (rec.queue.length > 0) ids.add(id)
  }
  if (isStorageAvailable()) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(COMMAND_PREFIX)) {
          const entry = JSON.parse(localStorage.getItem(key) || "null")
          if (entry?.operation?.matchId) ids.add(entry.operation.matchId)
          continue
        }
        if (!key || !key.startsWith(OPLOG_PREFIX)) continue
        const matchId = key.slice(OPLOG_PREFIX.length)
        const rec = loadSyncRecord(matchId)
        if (rec.queue.length > 0) ids.add(matchId)
      }
    } catch (error) {
      logEvent("warn", tSync("logMessages.operationLogListError"), "match-operation-log", error)
    }
  }
  return [...ids]
}

/** Drops the persisted record entirely (used when a match is deleted). */
export function clearSyncRecord(matchId: string): void {
  const record = loadSyncRecord(matchId)
  for (const op of record.queue) if (op.kind === "command") removeCommand(op.operationId)
  memoryRecords.delete(matchId)
  if (!isStorageAvailable()) return
  try {
    localStorage.removeItem(OPLOG_PREFIX + matchId)
  } catch {
    /* nothing actionable */
  }
}
