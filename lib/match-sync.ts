// Durable sync engine for matches (Task 2, Steps 3-5).
//
// Responsibilities:
//  - turn every match write into a durable, idempotent operation,
//  - replay the queue against the server with optimistic-concurrency control,
//  - never double-apply (revision check) and never silently overwrite newer
//    server data (stale writes fail fast instead of clobbering),
//  - retry transient failures with exponential backoff + jitter,
//  - drain automatically on startup / online / focus / manual retry,
//  - detect conflicts and surface them instead of guessing.
import { createClientSupabaseClient, isSupabaseAvailable, checkTablesExist } from "./supabase"
import { logEvent } from "./error-logger"
import { tSync } from "./log-i18n"
import {
  enqueueOperation,
  loadSyncRecord,
  listMatchesWithPendingOperations,
  markConflict,
  markOperationFailed,
  markOperationsSynced,
  saveSyncRecord,
  setSyncStatus,
  toSyncState,
} from "./match-operation-log"
import type { MatchOperationKind, SyncState } from "./types"
import { matchToRow, matchFromRow } from "./match-supabase"

/** Maximum transient retries before an operation is dead-lettered. */
const MAX_RETRIES = 6
/** Backoff parameters (ms). */
const BACKOFF_BASE = 1000
const BACKOFF_FACTOR = 2
const BACKOFF_CAP = 30000

/** Whether the live database is missing the `revision` column (un-migrated). */
let revisionColumnMissing = false

/** Matches currently being drained — prevents overlapping replays. */
const draining = new Set<string>()
/** Pending backoff timers, keyed by matchId. */
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ─── Test seam ─────────────────────────────────────────────────────────────────
// These indirections let the integration test inject a fake Supabase backend.
// They are inert in production (default to the real implementations).
// Инжект createClient переключает drain и на ЛЕГАСИ-транспорт (прямой
// supabase-клиент): регрессионные сценарии эмулируют PostgREST, а не HTTP.
let _createClient: typeof createClientSupabaseClient = createClientSupabaseClient
let _isAvailable: () => Promise<boolean> = isSupabaseAvailable
let _checkTables: () => Promise<any> = checkTablesExist
let _useClientTransport = false

export function __setSyncTestHooks(hooks: {
  createClient?: typeof createClientSupabaseClient
  isAvailable?: () => Promise<boolean>
  checkTables?: () => Promise<any>
}): void {
  if (hooks.createClient) {
    _createClient = hooks.createClient
    _useClientTransport = true
  }
  if (hooks.isAvailable) _isAvailable = hooks.isAvailable
  if (hooks.checkTables) _checkTables = hooks.checkTables
}

export function __resetSyncTestState(): void {
  revisionColumnMissing = false
  envCache = null
  draining.clear()
  for (const t of retryTimers.values()) clearTimeout(t)
  retryTimers.clear()
}

// ─── Environment check cache ───────────────────────────────────────────────────
// Probing Supabase availability + table existence on every drain adds network
// round-trips that delay each write (and widen the optimistic-UI flicker window).
// The result barely changes, so it is cached briefly and invalidated on failure
// / reconnect.
const ENV_CACHE_TTL = 30000
let envCache: { ok: boolean; tablesExist: boolean; ts: number } | null = null

async function checkEnv(): Promise<{ ok: boolean; tablesExist: boolean }> {
  if (envCache && Date.now() - envCache.ts < ENV_CACHE_TTL) {
    return { ok: envCache.ok, tablesExist: envCache.tablesExist }
  }
  const ok = await _isAvailable()
  let tablesExist = false
  if (ok) {
    const tables = await _checkTables()
    tablesExist = Boolean(tables?.exists)
  }
  envCache = { ok, tablesExist, ts: Date.now() }
  return { ok, tablesExist }
}

// ─── Sync-state pub/sub (Observability — guardrail #4) ─────────────────────────

const stateListeners = new Map<string, Set<(s: SyncState) => void>>()

/** Subscribes to sync-state changes for a match. Returns an unsubscribe fn. */
export function subscribeSyncState(matchId: string, cb: (state: SyncState) => void): () => void {
  let set = stateListeners.get(matchId)
  if (!set) {
    set = new Set()
    stateListeners.set(matchId, set)
  }
  set.add(cb)
  cb(getMatchSyncState(matchId))
  return () => {
    set?.delete(cb)
  }
}

/** Current observable sync state for a match. */
export function getMatchSyncState(matchId: string): SyncState {
  return toSyncState(loadSyncRecord(matchId))
}

/**
 * Фикс замороженных «Завершить» (баг-репорт 2026-09-04): команды очков
 * поднимают revision на сервере, но sync-запись об этом не знала — каждый
 * следующий снапшот («Завершить») шёл со старым baseRevision, получал
 * 0 строк → конфликт server_ahead → drain заблокирован навсегда.
 *
 * Вызывается при успешном ACK команды (или 409-конфликте с серверным
 * снапшотом): подтягивает baseline-ревизию и снимает конфликт — серверная
 * правда уже включает команду, поверх неё следующий снапшот ляжет чисто.
 */
export function noteCommandApplied(matchId: string, revision: number | null | undefined, serverMatch?: any): void {
  if (typeof window === "undefined" || typeof revision !== "number" || !Number.isFinite(revision)) return
  try {
    const record = loadSyncRecord(matchId)
    if (record.queue.length > 0) return // локальная очередь ждёт отправки — не трогаем базу
    if (revision < record.lastSyncedRevision) return // устаревший ack
    record.lastSyncedRevision = revision
    record.revision = revision
    if (serverMatch?.id) record.snapshot = serverMatch
    if (record.syncStatus === "conflict") {
      record.syncStatus = "idle"
      record.conflictReason = null
      record.conflictSnapshot = null
    }
    saveSyncRecord(record)
    notifyState(matchId)
  } catch (error) {
    logEvent("warn", `noteCommandApplied: ${(error as Error).message}`, "match-sync", error)
  }
}

/**
 * Seeds the local operation log from an authoritative server snapshot.
 *
 * Called whenever a match is loaded from Supabase or arrives via realtime, so a
 * client opening an already-advanced match starts its log at the correct
 * revision instead of triggering a false conflict on its first write. When the
 * queue still holds unsynced local operations the baseline is left untouched —
 * the drain / conflict path handles divergence deterministically.
 */
export function reconcileServerSnapshot(match: any): void {
  if (typeof window === "undefined" || !match?.id || typeof match.revision !== "number") return
  const record = loadSyncRecord(match.id, match)
  if (record.queue.length > 0) return // local pending work — do not clobber
  if (match.revision < record.lastSyncedRevision) return // ignore stale snapshots
  record.lastSyncedRevision = match.revision
  record.revision = match.revision
  record.snapshot = match
  if (record.syncStatus !== "conflict" && record.syncStatus !== "dead-letter") {
    record.syncStatus = "idle"
  }
  saveSyncRecord(record)
  notifyState(match.id)
}

function notifyState(matchId: string): void {
  const set = stateListeners.get(matchId)
  if (!set || set.size === 0) return
  const state = getMatchSyncState(matchId)
  for (const cb of set) {
    try {
      cb(state)
    } catch {
      /* a listener error must not break sync */
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Exponential backoff with ±30% jitter. */
function backoffDelay(attempt: number): number {
  const raw = Math.min(BACKOFF_CAP, BACKOFF_BASE * BACKOFF_FACTOR ** attempt)
  const jitter = raw * 0.3 * (Math.random() * 2 - 1)
  return Math.max(BACKOFF_BASE, Math.round(raw + jitter))
}

/**
 * Classifies an error as retryable (transient — network, timeout, 5xx) or
 * permanent (schema / auth / policy — must go to the dead-letter list).
 */
function isPermanentError(message: string): boolean {
  const m = (message || "").toLowerCase()
  return (
    m.includes("permission") ||
    m.includes("policy") ||
    m.includes("row-level security") ||
    m.includes("violates") ||
    m.includes("invalid input") ||
    m.includes("jwt") ||
    m.includes("unauthorized") ||
    m.includes("not authenticated")
  )
}

/** Snapshot → Supabase row — single source in lib/match-supabase. */
function transformForSupabase(match: any): Record<string, any> {
  return matchToRow(match)
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Records a match write as a durable operation and triggers a (non-blocking)
 * drain. The local snapshot is authoritative; this never blocks the UI.
 */
export function syncMatchToServer(match: any, kind: MatchOperationKind = "snapshot"): void {
  if (typeof window === "undefined" || !match?.id) return
  try {
    enqueueOperation(match.id, kind, match, match)
    notifyState(match.id)
    void drainMatch(match.id)
  } catch (error) {
    logEvent("error", tSync("logMessages.flushQueueError", { id: match.id }), "match-sync", error)
  }
}

/**
 * Replays the queued operations for a match against the server.
 *
 * Because the existing app writes whole match snapshots, queued snapshot
 * operations are collapsed: only the latest snapshot is sent, and the revision
 * jumps to cover every collapsed operation. This keeps long matches fast.
 */
export async function drainMatch(matchId: string): Promise<void> {
  if (typeof window === "undefined" || draining.has(matchId)) return

  const record = loadSyncRecord(matchId)
  if (record.queue.length === 0) {
    if (record.syncStatus !== "idle" && record.syncStatus !== "conflict") {
      setSyncStatus(matchId, "idle")
      notifyState(matchId)
    }
    return
  }
  // Do not drain over an unresolved conflict — wait for a decision.
  // ИСКЛЮЧЕНИЕ (фикс 2026-09-04): server_ahead-конфликт с очередью только из
  // снапшотов — рутина командного конвейера (команды подняли ревизию на
  // сервере, наш снапшот надстроен поверх той же правды). Авто-ребаза на
  // серверную ревизию и повторная отправка — иначе «Завершить» висит вечно.
  if (record.syncStatus === "conflict") {
    const rebaseable =
      record.conflictReason?.startsWith("server_ahead") &&
      record.queue.length > 0 &&
      record.queue.every((o) => o.kind === "snapshot") &&
      typeof record.conflictSnapshot?.revision === "number"
    if (!rebaseable) return
    const serverRevision = record.conflictSnapshot.revision as number
    record.lastSyncedRevision = serverRevision
    record.revision = Math.max(record.revision, serverRevision + 1)
    record.syncStatus = "pending"
    record.conflictReason = null
    record.conflictSnapshot = null
    saveSyncRecord(record)
    notifyState(matchId)
  }

  // Offline: keep the queue, mark offline, retry on recovery.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setSyncStatus(matchId, "offline")
    notifyState(matchId)
    return
  }

  draining.add(matchId)
  try {
    const env = await checkEnv()
    if (!env.ok) {
      setSyncStatus(matchId, "offline")
      notifyState(matchId)
      scheduleRetry(matchId, 0)
      return
    }
    if (!env.tablesExist) {
      // No remote tables: local storage is the only source of truth. Treat the
      // queue as confirmed locally so the UI is not stuck on "pending".
      markOperationsSynced(
        matchId,
        record.queue.map((o) => o.operationId),
        record.revision,
      )
      notifyState(matchId)
      return
    }

    setSyncStatus(matchId, "syncing")
    notifyState(matchId)

    // Collapse: the last snapshot already contains every earlier change.
    const effective = record.queue[record.queue.length - 1]
    const allIds = record.queue.map((o) => o.operationId)
    const baseRevision = record.lastSyncedRevision
    const targetRevision = record.revision

    // Шаг 3: прод-транспорт — HTTP PUT (service-роль сервера): прямой
    // anon-UPDATE на matches мёртв под RLS (тихий no-op). Легаси-клиент
    // остаётся только для инжектированных регрессионных тестов.
    const result = _useClientTransport
      ? await applyRevisionedViaClient(effective.payload, baseRevision, targetRevision)
      : await applyRevisionedViaApi(effective.payload, baseRevision, targetRevision, {
          operationId: effective.operationId,
          kind: effective.kind,
        })

    if (result.status === "ok") {
      markOperationsSynced(matchId, allIds, result.revision, result.snapshot)
      logEvent("info", tSync("logMessages.matchSynced", { id: matchId, revision: result.revision }), "match-sync")
      notifyState(matchId)
    } else if (result.status === "conflict") {
      markConflict(matchId, result.reason, result.serverSnapshot)
      logEvent("warn", tSync("logMessages.syncConflict", { id: matchId, reason: result.reason }), "match-sync")
      notifyState(matchId)
    } else {
      // Failure: dead-letter permanent errors, back off transient ones.
      if (result.permanent) {
        for (const id of allIds) markOperationFailed(matchId, id, result.error, 1)
        logEvent("error", tSync("logMessages.operationDeadLetter", { id: matchId, error: result.error }), "match-sync")
      } else {
        // A transient failure may mean we went offline — re-probe next time.
        envCache = null
        markOperationFailed(matchId, effective.operationId, result.error, MAX_RETRIES)
        scheduleRetry(matchId, effective.retryCount)
      }
      notifyState(matchId)
    }
  } catch (error: any) {
    logEvent("error", tSync("logMessages.flushQueueError", { id: matchId }), "match-sync", error)
    envCache = null
    setSyncStatus(matchId, "error")
    notifyState(matchId)
    scheduleRetry(matchId, 0)
  } finally {
    draining.delete(matchId)
  }
}

type ApplyResult =
  | { status: "ok"; revision: number; snapshot: any }
  | { status: "conflict"; reason: string; serverSnapshot: any }
  | { status: "error"; error: string; permanent: boolean }

/**
 * Прод-транспорт (Шаг 3, фикс 2026-09-04): снапшот уходит на сервер HTTP PUT
 * /api/match/[id], который пишет service-ключом. Прямой anon-UPDATE на
 * matches после снятия pre-step3 политик — тихий no-op (RLS пропускает 0
 * строк без ошибки), из-за чего «Завершить»/правила/правки счёта со страницы
 * матча «успешно» не доезжали до базы, а главная продолжала показывать матч.
 *
 * Роут даёт то же, что и старый клиентский путь: идемпотентность по
 * operationId, revision-guard, 409 + авторитетный снапшот при конфликте.
 */
async function applyRevisionedViaApi(
  snapshot: any,
  baseRevision: number,
  targetRevision: number,
  op: { operationId: string; kind?: string },
): Promise<ApplyResult> {
  try {
    const res = await fetch(`/api/match/${snapshot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: {
          operationId: op.operationId,
          baseRevision,
          kind: op.kind ?? "snapshot",
          clientId: "sync-drain",
        },
        match: snapshot,
      }),
    })

    if (res.status === 401 || res.status === 403) {
      // Auth-поломка (Origin-детект за прокси, ротация ключа) — не ретраить вслепую.
      return { status: "error", error: `http_${res.status}`, permanent: true }
    }

    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      const revision = typeof data.revision === "number" ? data.revision : targetRevision
      return { status: "ok", revision, snapshot: data.match ?? snapshot }
    }

    if (res.status === 409) {
      const serverMatch = data.match ?? null
      if (data?.reason === "match_deleted" || !serverMatch) {
        return { status: "conflict", reason: "match_deleted", serverSnapshot: null }
      }
      const reason = typeof data.reason === "string" ? data.reason : `server_ahead (server=${serverMatch.revision})`
      return { status: "conflict", reason, serverSnapshot: serverMatch }
    }

    return { status: "error", error: `http_${res.status}`, permanent: false }
  } catch {
    return { status: "error", error: "network", permanent: false }
  }
}

/**
 * Writes a snapshot to the server using optimistic concurrency:
 * `UPDATE ... WHERE id = ? AND revision = baseRevision`.
 *
 * ЛЕГАСИ-транспорт — используется только регрессионными тестами через
 * __setSyncTestHooks (фейковый PostgREST-клиент); в продакшене выключен
 * (см. applyRevisionedViaApi выше).
 *
 *  - 1 row updated  → success.
 *  - 0 rows updated → fetch the row and decide: idempotent re-apply, legacy
 *                     row without a revision, or a genuine conflict.
 *  - missing column → the database has not been migrated; fall back to a plain
 *                     last-writer-wins update so the app keeps working.
 */
async function applyRevisionedViaClient(
  snapshot: any,
  baseRevision: number,
  targetRevision: number,
): Promise<ApplyResult> {
  const supabase = _createClient()
  if (!supabase) return { status: "error", error: "Supabase client unavailable", permanent: false }

  const row = transformForSupabase(snapshot)

  // Un-migrated database: skip revision entirely, plain update.
  if (revisionColumnMissing) {
    const { error } = await supabase.from("matches").update(row).eq("id", snapshot.id)
    if (error) return { status: "error", error: error.message, permanent: isPermanentError(error.message) }
    return { status: "ok", revision: targetRevision, snapshot }
  }

  const { data, error } = await supabase
    .from("matches")
    .update({ ...row, revision: targetRevision })
    .eq("id", snapshot.id)
    .eq("revision", baseRevision)
    .select()

  if (error) {
    if (error.message?.toLowerCase().includes("revision") && error.message?.toLowerCase().includes("does not exist")) {
      // Column missing — remember it and retry without the revision guard.
      revisionColumnMissing = true
      logEvent("warn", tSync("logMessages.revisionColumnMissing"), "match-sync")
      const retry = await supabase.from("matches").update(row).eq("id", snapshot.id)
      if (retry.error)
        return { status: "error", error: retry.error.message, permanent: isPermanentError(retry.error.message) }
      return { status: "ok", revision: targetRevision, snapshot }
    }
    return { status: "error", error: error.message, permanent: isPermanentError(error.message) }
  }

  if (data && data.length > 0) {
    return { status: "ok", revision: targetRevision, snapshot }
  }

  // 0 rows updated: inspect the current server row to decide what happened.
  const current = await supabase.from("matches").select("*").eq("id", snapshot.id).maybeSingle()
  if (current.error) {
    return { status: "error", error: current.error.message, permanent: isPermanentError(current.error.message) }
  }
  if (!current.data) {
    // Row deleted remotely — terminal (failure mode #8 / edge case #8).
    return { status: "conflict", reason: "match_deleted", serverSnapshot: null }
  }

  const serverRevision: number | null | undefined = current.data.revision
  const serverSnapshot = fromSupabaseRow(current.data)

  if (serverRevision === null || serverRevision === undefined) {
    // Legacy row never had a revision — adopt it with a plain update.
    const adopt = await supabase
      .from("matches")
      .update({ ...row, revision: targetRevision })
      .eq("id", snapshot.id)
    if (adopt.error)
      return { status: "error", error: adopt.error.message, permanent: isPermanentError(adopt.error.message) }
    return { status: "ok", revision: targetRevision, snapshot }
  }

  if (serverRevision === targetRevision) {
    // Our previous write already landed; the ack was lost. Idempotent success.
    return { status: "ok", revision: targetRevision, snapshot: serverSnapshot }
  }

  if (serverRevision <= baseRevision) {
    // Server behind our base — should not happen; retry as transient.
    return { status: "error", error: `unexpected server revision ${serverRevision}`, permanent: false }
  }

  // Server moved ahead independently — a genuine cross-device conflict.
  return {
    status: "conflict",
    reason: `server_ahead (server=${serverRevision}, base=${baseRevision})`,
    serverSnapshot,
  }
}

/** Supabase row → match snapshot — single source in lib/match-supabase. */
function fromSupabaseRow(rowData: any): any {
  return matchFromRow(rowData)
}

/** Schedules a backoff retry for a match drain. */
function scheduleRetry(matchId: string, attempt: number): void {
  if (retryTimers.has(matchId)) return
  const delay = backoffDelay(attempt)
  const timer = setTimeout(() => {
    retryTimers.delete(matchId)
    void drainMatch(matchId)
  }, delay)
  retryTimers.set(matchId, timer)
}

// ─── Conflict resolution (Task 2, Step 5) ──────────────────────────────────────

/**
 * Resolves a recorded conflict.
 *  - "local"  → re-base the queue on the server revision and push local state.
 *  - "server" → discard the local queue and adopt the server snapshot.
 * Returns the snapshot the UI should now render, or null when unresolved.
 */
export async function resolveConflict(matchId: string, choice: "local" | "server"): Promise<any | null> {
  const record = loadSyncRecord(matchId)
  if (record.syncStatus !== "conflict") return record.snapshot

  if (choice === "server") {
    const server = record.conflictSnapshot
    record.queue = []
    record.snapshot = server
    record.revision = server?.revision ?? record.revision
    record.lastSyncedRevision = record.revision
    record.syncStatus = "idle"
    record.conflictReason = null
    record.conflictSnapshot = null
    saveSyncRecord(record)
    notifyState(matchId)
    return server
  }

  // Keep local: re-base queued operations onto the server revision, then drain.
  const serverRevision = record.conflictSnapshot?.revision ?? record.lastSyncedRevision
  record.lastSyncedRevision = serverRevision
  record.revision = Math.max(record.revision, serverRevision + record.queue.length)
  record.syncStatus = "pending"
  record.conflictReason = null
  record.conflictSnapshot = null
  saveSyncRecord(record)
  notifyState(matchId)
  await drainMatch(matchId)
  return loadSyncRecord(matchId).snapshot
}

// ─── Automatic drain and recovery (Task 2, Step 4) ─────────────────────────────

let recoveryInitialised = false

/** Drains every match that still has pending operations. */
export async function drainAllPending(): Promise<void> {
  const ids = listMatchesWithPendingOperations()
  for (const id of ids) {
    await drainMatch(id)
  }
}

/**
 * Registers the recovery hooks. Replay resumes automatically on app startup,
 * when connectivity returns, and when the tab regains focus / visibility.
 * Safe to call multiple times.
 */
export function initSyncRecovery(): void {
  if (recoveryInitialised || typeof window === "undefined") return
  recoveryInitialised = true

  const recover = () => {
    // Re-probe the environment on reconnect / focus instead of trusting a cache.
    envCache = null
    void drainAllPending()
  }

  window.addEventListener("online", recover)
  window.addEventListener("focus", recover)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recover()
  })

  // Startup: boot paused, then drain once the queue and snapshot are restored.
  recover()
}

/** Manual retry entry point for the UI ("retry sync" button). */
export async function retrySyncNow(matchId?: string): Promise<void> {
  // A manual retry should not be blocked by a stale availability cache.
  envCache = null
  if (matchId) {
    const rec = loadSyncRecord(matchId)
    if (rec.syncStatus === "error" || rec.syncStatus === "offline") {
      setSyncStatus(matchId, "pending")
    }
    await drainMatch(matchId)
  } else {
    await drainAllPending()
  }
}
