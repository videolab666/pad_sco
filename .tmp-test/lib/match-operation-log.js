"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStorageAvailable = isStorageAvailable;
exports.getClientId = getClientId;
exports.loadSyncRecord = loadSyncRecord;
exports.saveSyncRecord = saveSyncRecord;
exports.enqueueOperation = enqueueOperation;
exports.markOperationsSynced = markOperationsSynced;
exports.markOperationFailed = markOperationFailed;
exports.markConflict = markConflict;
exports.setSyncStatus = setSyncStatus;
exports.toSyncState = toSyncState;
exports.listMatchesWithPendingOperations = listMatchesWithPendingOperations;
exports.clearSyncRecord = clearSyncRecord;
// Durable local operation log for match sync (Task 2, Step 2).
//
// Every score press, rule change, roster edit and court edit is persisted here
// as a MatchOperation *before* any network call. The record also keeps the last
// known match snapshot, the pending queue, the last synced revision and the
// sync status, so the app can recover after a reload, crash or offline period.
const uuid_1 = require("uuid");
const error_logger_1 = require("./error-logger");
const types_1 = require("./types");
const OPLOG_PREFIX = "match_oplog_";
const CLIENT_ID_KEY = "padel_sync_client_id";
/** Hard cap on the live queue length — guards against unbounded growth. */
const MAX_QUEUE_LENGTH = 500;
/** In-memory fallback used when localStorage is unavailable (private mode etc). */
const memoryRecords = new Map();
let storageAvailable = null;
let storageWarned = false;
const isBrowser = () => typeof window !== "undefined";
/** Detects whether localStorage can actually be written to (failure mode #17). */
function isStorageAvailable() {
    if (!isBrowser())
        return false;
    if (storageAvailable !== null)
        return storageAvailable;
    try {
        const probe = "__padel_oplog_probe__";
        localStorage.setItem(probe, "1");
        localStorage.removeItem(probe);
        storageAvailable = true;
    }
    catch {
        storageAvailable = false;
        if (!storageWarned) {
            storageWarned = true;
            (0, error_logger_1.logEvent)("warn", "localStorage недоступен — синхронизация работает в ограниченном режиме", "match-operation-log");
        }
    }
    return storageAvailable;
}
/** Stable per-browser id, used to attribute operations and break cross-tab ties. */
function getClientId() {
    if (!isBrowser())
        return "server";
    try {
        let id = localStorage.getItem(CLIENT_ID_KEY);
        if (!id) {
            id = (0, uuid_1.v4)();
            localStorage.setItem(CLIENT_ID_KEY, id);
        }
        return id;
    }
    catch {
        return `ephemeral-${Math.random().toString(36).slice(2)}`;
    }
}
function freshRecord(matchId, snapshot, revision = 0) {
    return {
        schemaVersion: types_1.SYNC_SCHEMA_VERSION,
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
    };
}
/** Validates a parsed record before it is allowed to drive the scoring state. */
function isValidRecord(value) {
    return (value &&
        typeof value === "object" &&
        value.schemaVersion === types_1.SYNC_SCHEMA_VERSION &&
        typeof value.matchId === "string" &&
        typeof value.revision === "number" &&
        typeof value.lastSyncedRevision === "number" &&
        Array.isArray(value.queue) &&
        Array.isArray(value.deadLetter));
}
/**
 * Loads the persisted sync record for a match. Returns a fresh record if none
 * exists or the stored payload is corrupt / from an incompatible schema.
 */
function loadSyncRecord(matchId, fallbackSnapshot = null) {
    if (memoryRecords.has(matchId))
        return memoryRecords.get(matchId);
    if (!isStorageAvailable())
        return freshRecord(matchId, fallbackSnapshot);
    try {
        const raw = localStorage.getItem(OPLOG_PREFIX + matchId);
        if (!raw)
            return freshRecord(matchId, fallbackSnapshot);
        const parsed = JSON.parse(raw);
        if (!isValidRecord(parsed)) {
            (0, error_logger_1.logEvent)("warn", `Журнал операций повреждён или устарел: ${matchId}`, "match-operation-log");
            return freshRecord(matchId, fallbackSnapshot);
        }
        return parsed;
    }
    catch (error) {
        (0, error_logger_1.logEvent)("warn", `Не удалось прочитать журнал операций: ${matchId}`, "match-operation-log", error);
        return freshRecord(matchId, fallbackSnapshot);
    }
}
/** Persists a sync record. Falls back to memory if storage is full/unavailable. */
function saveSyncRecord(record) {
    record.updatedAt = new Date().toISOString();
    memoryRecords.set(record.matchId, record);
    if (!isStorageAvailable())
        return;
    try {
        localStorage.setItem(OPLOG_PREFIX + record.matchId, JSON.stringify(record));
    }
    catch (error) {
        // Quota exhaustion — surface it explicitly instead of pretending sync works.
        (0, error_logger_1.logEvent)("error", `Не удалось сохранить журнал операций (квота?): ${record.matchId}`, "match-operation-log", error);
        record.syncStatus = "limited";
    }
}
/**
 * Appends a new operation. Bumps the local revision and stores the resulting
 * snapshot so the operation can be replayed deterministically later.
 */
function enqueueOperation(matchId, kind, payload, snapshot) {
    const record = loadSyncRecord(matchId, snapshot);
    const operation = {
        operationId: (0, uuid_1.v4)(),
        matchId,
        baseRevision: record.revision,
        kind,
        payload,
        createdAt: new Date().toISOString(),
        clientId: getClientId(),
        retryCount: 0,
        lastError: null,
    };
    record.queue.push(operation);
    record.revision += 1;
    record.snapshot = snapshot ?? record.snapshot;
    record.syncStatus = "pending";
    record.lastError = null;
    // Compaction guardrail: never let the live queue grow without bound.
    if (record.queue.length > MAX_QUEUE_LENGTH) {
        record.queue = record.queue.slice(-MAX_QUEUE_LENGTH);
    }
    saveSyncRecord(record);
    return { record, operation };
}
/** Removes confirmed operations from the queue and advances the synced revision. */
function markOperationsSynced(matchId, operationIds, serverRevision, serverSnapshot) {
    const record = loadSyncRecord(matchId);
    const done = new Set(operationIds);
    record.queue = record.queue.filter((op) => !done.has(op.operationId));
    record.lastSyncedRevision = Math.max(record.lastSyncedRevision, serverRevision);
    record.revision = Math.max(record.revision, record.lastSyncedRevision);
    if (serverSnapshot)
        record.snapshot = serverSnapshot;
    record.lastSyncedAt = new Date().toISOString();
    record.lastError = null;
    record.conflictReason = null;
    record.conflictSnapshot = null;
    record.syncStatus = record.queue.length > 0 ? "pending" : "idle";
    saveSyncRecord(record);
    return record;
}
/**
 * Records a transient failure for an operation. After `maxRetries` the operation
 * is moved out of the live queue into the dead-letter list for operator review.
 */
function markOperationFailed(matchId, operationId, error, maxRetries) {
    const record = loadSyncRecord(matchId);
    const op = record.queue.find((o) => o.operationId === operationId);
    if (op) {
        op.retryCount += 1;
        op.lastError = error;
        if (op.retryCount >= maxRetries) {
            record.queue = record.queue.filter((o) => o.operationId !== operationId);
            record.deadLetter.push(op);
            record.syncStatus = "dead-letter";
        }
        else {
            record.syncStatus = "error";
        }
    }
    record.lastError = error;
    saveSyncRecord(record);
    return record;
}
/** Stores a divergence so a resolution decision can be made deterministically. */
function markConflict(matchId, reason, serverSnapshot) {
    const record = loadSyncRecord(matchId);
    record.syncStatus = "conflict";
    record.conflictReason = reason;
    record.conflictSnapshot = serverSnapshot;
    saveSyncRecord(record);
    return record;
}
/** Updates only the sync status (e.g. mark "syncing" / "offline"). */
function setSyncStatus(matchId, status) {
    const record = loadSyncRecord(matchId);
    record.syncStatus = status;
    saveSyncRecord(record);
    return record;
}
/** Derives the observable, UI-facing sync state from the persisted record. */
function toSyncState(record) {
    const lastFailed = record.queue.find((o) => o.retryCount > 0) || record.deadLetter[record.deadLetter.length - 1];
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
    };
}
/** Returns the ids of every match that currently has unsynced operations. */
function listMatchesWithPendingOperations() {
    const ids = new Set();
    for (const [id, rec] of memoryRecords) {
        if (rec.queue.length > 0)
            ids.add(id);
    }
    if (isStorageAvailable()) {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || !key.startsWith(OPLOG_PREFIX))
                    continue;
                const matchId = key.slice(OPLOG_PREFIX.length);
                const rec = loadSyncRecord(matchId);
                if (rec.queue.length > 0)
                    ids.add(matchId);
            }
        }
        catch (error) {
            (0, error_logger_1.logEvent)("warn", "Не удалось перечислить журналы операций", "match-operation-log", error);
        }
    }
    return [...ids];
}
/** Drops the persisted record entirely (used when a match is deleted). */
function clearSyncRecord(matchId) {
    memoryRecords.delete(matchId);
    if (!isStorageAvailable())
        return;
    try {
        localStorage.removeItem(OPLOG_PREFIX + matchId);
    }
    catch {
        /* nothing actionable */
    }
}
