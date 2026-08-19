// Video Platform — реестр источников, сессии записи, маркеры
// (plan-4 §129-143, Шаг Video slice E2).
//
// Чистые хелперы (stream-key, важность маркеров §140, pre/post-roll §138,
// переходы статусов §133) не имеют I/O и покрыты тестами; серверный CRUD
// идёт через service role (таблицы закрыты RLS без политик).

import { createServerSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"
import { isGamePoint, isSetPoint, isMatchPoint } from "./scoring-logic"

// ─── Чистые хелперы ─────────────────────────────────────────────────────────

/** Имя потока на gateway: court-{shortCode}-{role} (§130). */
export function buildStreamKey(courtShortCode: string, role = "main"): string {
  return `court-${courtShortCode}-${role}`
}

/** §140: важность маркеров — не каждый кадр достоин клипа. */
export const MARKER_IMPORTANCE: Record<string, number> = {
  MATCH_START: 1,
  NORMAL_POINT: 1,
  GAME_POINT: 2,
  BREAK_POINT: 3,
  GOLDEN_POINT: 4,
  SET_POINT: 5,
  TIEBREAK_POINT: 5,
  TIEBREAK_START: 5,
  SUPER_TIEBREAK: 5,
  SET_WON: 6,
  MATCH_POINT: 7,
  MATCH_WON: 8,
  COMEBACK: 6,
  MANUAL_HIGHLIGHT: 10,
  CUSTOM: 1,
}

export const DEFAULT_MARKER_TYPE = "CUSTOM"

/** §138: pre/post-roll по типу маркера (мс), переопределяется вызовом. */
export const MARKER_ROLLS_MS: Record<string, { pre: number; post: number }> = {
  MATCH_POINT: { pre: 20000, post: 10000 },
  SET_WON: { pre: 15000, post: 8000 },
  MATCH_WON: { pre: 25000, post: 20000 },
  MANUAL_HIGHLIGHT: { pre: 20000, post: 10000 },
}
const DEFAULT_ROLLS_MS = { pre: 10000, post: 5000 }

export function markerDefaults(type: string): { importance: number; preRollMs: number; postRollMs: number } {
  const rolls = MARKER_ROLLS_MS[type] ?? DEFAULT_ROLLS_MS
  return {
    importance: MARKER_IMPORTANCE[type] ?? 1,
    preRollMs: rolls.pre,
    postRollMs: rolls.post,
  }
}

/** §133: машина состояний сессии записи. */
export const RECORDING_STATUSES = [
  "idle",
  "arming",
  "recording",
  "finalizing",
  "uploading",
  "ready",
  "failed",
] as const
export type RecordingStatus = (typeof RECORDING_STATUSES)[number]

const RECORDING_TRANSITIONS: Record<RecordingStatus, RecordingStatus[]> = {
  idle: ["arming"],
  arming: ["recording", "failed"],
  recording: ["finalizing", "failed"],
  finalizing: ["uploading", "ready", "failed"],
  uploading: ["ready", "failed"],
  ready: [],
  failed: ["arming"],
}

export function canTransitionRecording(from: string, to: string): boolean {
  const allowed = RECORDING_TRANSITIONS[from as RecordingStatus]
  return Array.isArray(allowed) && allowed.includes(to as RecordingStatus)
}

/** §152: здоровье камеры, которое присылает агент. */
export const VIDEO_SOURCE_STATUSES = ["offline", "online", "recording"] as const
export type VideoSourceStatus = (typeof VIDEO_SOURCE_STATUSES)[number]

export function isValidHeartbeat(input: {
  streamKey?: unknown
  status?: unknown
}): string[] {
  const errors: string[] = []
  const streamKey = typeof input.streamKey === "string" ? input.streamKey : ""
  if (!/^court-[A-Za-z0-9]{3,20}-(main|tactical|closeup|player-[ab]|overhead|custom)$/.test(streamKey)) {
    errors.push("streamKey должен иметь вид court-{код}-{роль}")
  }
  if (input.status !== undefined && !VIDEO_SOURCE_STATUSES.includes(input.status as VideoSourceStatus)) {
    errors.push(`status должен быть одним из: ${VIDEO_SOURCE_STATUSES.join(", ")}`)
  }
  return errors
}

// ─── Серверный CRUD (service role) ─────────────────────────────────────────

export interface VideoSourceRecord {
  id: string
  clubId: string
  courtId: string | null
  name: string
  sourceType: string
  protocol: string
  streamKey: string
  status: VideoSourceStatus
  health: Record<string, unknown>
  lastSeenAt: string | null
}

async function defaultClubId(): Promise<string> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.from("clubs").select("id").limit(1)
  if (error || !data || data.length === 0) throw new Error(`clubs: ${error?.message ?? "пусто"}`)
  return data[0].id as string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSource(row: any): VideoSourceRecord {
  return {
    id: row.id,
    clubId: row.club_id,
    courtId: row.court_id ?? null,
    name: row.name,
    sourceType: row.source_type,
    protocol: row.protocol,
    streamKey: row.stream_key,
    status: row.status,
    health: row.health ?? {},
    lastSeenAt: row.last_seen_at ?? null,
  }
}

/**
 * Heartbeat устройства (§152/§194): upsert по stream_key. Корт ищется по
 * shortCode из ключа — телефон остаётся «глупым»: где публиковать, говорит
 * конфигурация платформы (§188: у телефона нет hardcoded court).
 */
export async function heartbeatSource(input: {
  streamKey: string
  status: VideoSourceStatus
  name?: string
  health?: Record<string, unknown>
}): Promise<VideoSourceRecord> {
  const errors = isValidHeartbeat(input)
  if (errors.length > 0) throw new VideoValidationError(errors)

  const supabase = createServerSupabaseClient()
  const clubId = await defaultClubId()

  // court-{shortCode}-{role} → корт по shortCode
  const parts = input.streamKey.split("-")
  const role = parts[parts.length - 1]
  const shortCode = parts.slice(1, -1).join("-")
  const court = await supabase.from("courts").select("id").eq("short_code", shortCode).limit(1)
  const courtId = court.data && court.data.length > 0 ? (court.data[0].id as string) : null

  const { data, error } = await supabase
    .from("video_sources")
    .upsert(
      {
        club_id: clubId,
        court_id: courtId,
        name: input.name ?? input.streamKey,
        source_type: "phone_agent",
        protocol: "srt",
        stream_key: input.streamKey,
        status: input.status,
        health: input.health ?? {},
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "stream_key" },
    )
    .select("*")
    .single()
  if (error || !data) throw new Error(`heartbeatSource: ${error?.message}`)
  return rowToSource(data)
}

export async function listSources(): Promise<VideoSourceRecord[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("video_sources")
    .select("*")
    .order("stream_key", { ascending: true })
  if (error) throw new Error(`listSources: ${error?.message}`)
  return (data ?? []).map(rowToSource)
}

export interface RecordingSessionRecord {
  id: string
  courtId: string | null
  courtSessionId: string | null
  sourceId: string | null
  status: RecordingStatus
  storage: string
  storageKey: string | null
  startedAt: string
  endedAt: string | null
  metadata: Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecording(row: any): RecordingSessionRecord {
  return {
    id: row.id,
    courtId: row.court_id ?? null,
    courtSessionId: row.court_session_id ?? null,
    sourceId: row.source_id ?? null,
    status: row.status,
    storage: row.storage,
    storageKey: row.storage_key ?? null,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    metadata: row.metadata ?? {},
  }
}

/** Старт записи (§134): источник по streamKey или courtId. */
export async function startRecording(input: {
  streamKey?: string
  courtId?: string
  courtSessionId?: string
  metadata?: Record<string, unknown>
}): Promise<RecordingSessionRecord> {
  const supabase = createServerSupabaseClient()
  const clubId = await defaultClubId()

  let sourceId: string | null = null
  let courtId: string | null = input.courtId ?? null
  let storageKey: string | null = null

  if (input.streamKey) {
    const src = await supabase.from("video_sources").select("*").eq("stream_key", input.streamKey).limit(1)
    if (!src.data || src.data.length === 0) {
      throw new VideoValidationError([`Источник ${input.streamKey} не найден — нужен heartbeat`])
    }
    const record = rowToSource(src.data[0])
    sourceId = record.id
    courtId = courtId ?? record.courtId
    storageKey = `./recordings/${input.streamKey}/`
  }

  const { data, error } = await supabase
    .from("recording_sessions")
    .insert({
      club_id: clubId,
      court_id: courtId,
      court_session_id: input.courtSessionId ?? null,
      source_id: sourceId,
      status: "recording",
      storage: "venue-gateway",
      storage_key: storageKey,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(`startRecording: ${error?.message}`)

  if (sourceId) {
    await supabase.from("video_sources").update({ status: "recording" }).eq("id", sourceId)
  }
  return rowToRecording(data)
}

/** Финализация (§133/§135): готово или ошибка; ended_at + статус источника. */
export async function updateRecording(
  id: string,
  patch: { status?: string; metadata?: Record<string, unknown> },
): Promise<RecordingSessionRecord> {
  const supabase = createServerSupabaseClient()
  const current = await supabase.from("recording_sessions").select("*").eq("id", id).single()
  if (current.error || !current.data) throw new VideoNotFoundError(id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {}
  if (patch.status !== undefined) {
    const from = current.data.status as RecordingStatus
    const to = patch.status as RecordingStatus
    if (!RECORDING_STATUSES.includes(to)) {
      throw new VideoValidationError([`status должен быть одним из: ${RECORDING_STATUSES.join(", ")}`])
    }
    if (!canTransitionRecording(from, to)) {
      throw new VideoValidationError([`Недопустимый переход записи: ${from} → ${to}`])
    }
    row.status = to
    if (to === "ready" || to === "failed") row.ended_at = new Date().toISOString()
  }
  if (patch.metadata !== undefined) row.metadata = patch.metadata
  if (Object.keys(row).length === 0) return rowToRecording(current.data)

  const { data, error } = await supabase.from("recording_sessions").update(row).eq("id", id).select("*").single()
  if (error) throw new Error(`updateRecording: ${error?.message}`)
  const rec = rowToRecording(data)

  if ((rec.status === "ready" || rec.status === "failed") && rec.sourceId) {
    await supabase.from("video_sources").update({ status: "online" }).eq("id", rec.sourceId)
  }
  return rec
}

export async function listRecordings(filter: { active?: boolean; courtId?: string; limit?: number } = {}): Promise<RecordingSessionRecord[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("recording_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(Math.min(filter.limit ?? 50, 200))
  if (filter.active) query = query.eq("status", "recording")
  if (filter.courtId) query = query.eq("court_id", filter.courtId)
  const { data, error } = await query
  if (error) throw new Error(`listRecordings: ${error?.message}`)
  return (data ?? []).map(rowToRecording)
}

// ─── Маркеры (§137-140) ─────────────────────────────────────────────────────

export interface VideoMarkerRecord {
  id: string
  recordingSessionId: string
  matchId: string | null
  markerType: string
  occurredAt: string
  videoPositionMs: number
  importance: number
  preRollMs: number
  postRollMs: number
  metadata: Record<string, unknown>
}

export async function addMarker(input: {
  recordingSessionId: string
  matchId?: string | null
  eventId?: string
  markerType?: string
  occurredAt?: string
  videoPositionMs?: number
  importance?: number
  preRollMs?: number
  postRollMs?: number
  metadata?: Record<string, unknown>
}): Promise<VideoMarkerRecord> {
  const type = input.markerType ?? DEFAULT_MARKER_TYPE
  const defaults = markerDefaults(type)
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("video_markers")
    .insert({
      recording_session_id: input.recordingSessionId,
      match_id: input.matchId ?? null,
      event_id: input.eventId ?? null,
      marker_type: type,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      video_position_ms: Math.max(0, Math.trunc(input.videoPositionMs ?? 0)),
      importance: Math.min(10, Math.max(1, Math.trunc(input.importance ?? defaults.importance))),
      pre_roll_ms: input.preRollMs ?? defaults.preRollMs,
      post_roll_ms: input.postRollMs ?? defaults.postRollMs,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(`addMarker: ${error?.message}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = data
  return {
    id: row.id,
    recordingSessionId: row.recording_session_id,
    matchId: row.match_id ?? null,
    markerType: row.marker_type,
    occurredAt: row.occurred_at,
    videoPositionMs: row.video_position_ms,
    importance: row.importance,
    preRollMs: row.pre_roll_ms,
    postRollMs: row.post_roll_ms,
    metadata: row.metadata ?? {},
  }
}

export async function listMarkers(filter: { recordingSessionId?: string; matchId?: string; minImportance?: number } = {}): Promise<VideoMarkerRecord[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("video_markers")
    .select("*")
    .order("video_position_ms", { ascending: true })
    .limit(500)
  if (filter.recordingSessionId) query = query.eq("recording_session_id", filter.recordingSessionId)
  if (filter.matchId) query = query.eq("match_id", filter.matchId)
  if (filter.minImportance !== undefined) query = query.gte("importance", filter.minImportance)
  const { data, error } = await query
  if (error) throw new Error(`listMarkers: ${error?.message}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    recordingSessionId: row.recording_session_id,
    matchId: row.match_id ?? null,
    markerType: row.marker_type,
    occurredAt: row.occurred_at,
    videoPositionMs: row.video_position_ms,
    importance: row.importance,
    preRollMs: row.pre_roll_ms,
    postRollMs: row.post_roll_ms,
    metadata: row.metadata ?? {},
  }))
}

// ─── Автопривязка маркеров к событиям матча (§70, Шаг 3 slice C) ──────────

/**
 * После point-команды: находит активную запись для корта/сессии матча и
 * создаёт видео-маркеры для ключевых моментов (MATCH_POINT, SET_POINT,
 * GAME_POINT, SET_WON, MATCH_WON) из движковых индикаторов.
 *
 * Вызывается из командного роута — ТОЛЬКО после успешной записи команды.
 * Не бросает: ошибки логируются, но не ломают счёт.
 */
export async function autoMarkVideoEvents(match: any): Promise<void> {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) return

    // Ищем активную запись: по courtId или court_session_id (sessionId)
    const courtId = match?.courtId
    const courtSessionId = match?.sessionId
    if (!courtId && !courtSessionId) return

    let query = supabase
      .from("recording_sessions")
      .select("id, started_at")
      .eq("status", "recording")
      .limit(1)
    if (courtSessionId) {
      query = query.eq("court_session_id", courtSessionId)
    } else if (courtId) {
      query = query.eq("court_id", courtId)
    }
    const { data: recs } = await query
    const rec = recs?.[0]
    if (!rec) return // нет активной записи — выходим тихо

    // Индикаторы из движка (единый источник, lib/scoring-logic)
    const markers: Array<{ type: string; importance: number }> = []
    const mp = isMatchPoint(match)
    const sp = isSetPoint(match)
    const gp = isGamePoint(match)

    if (match?.isCompleted && match?.winner) markers.push({ type: "MATCH_WON", importance: 8 })
    if (mp) markers.push({ type: "MATCH_POINT", importance: 7 })
    if (sp && !mp) markers.push({ type: "SET_POINT", importance: 5 })
    if (gp && !sp && !mp) markers.push({ type: "GAME_POINT", importance: 2 })

    if (markers.length === 0) return

    // Позиция в записи: elapsed от started_at записи до occurred_at матча
    const occurredAt = new Date()
    const recordingStart = new Date(rec.started_at)
    const videoPositionMs = Math.max(0, occurredAt.getTime() - recordingStart.getTime())

    for (const m of markers) {
      const defaults = markerDefaults(m.type)
      await supabase.from("video_markers").insert({
        recording_session_id: rec.id,
        match_id: match?.id ?? null,
        marker_type: m.type,
        occurred_at: occurredAt.toISOString(),
        video_position_ms: videoPositionMs,
        importance: m.importance,
        pre_roll_ms: defaults.preRollMs,
        post_roll_ms: defaults.postRollMs,
        metadata: { source: "auto", command: "point" },
      })
    }

    logEvent(
      "info",
      `autoMarkVideoEvents: ${markers.length} маркер(ов) для записи ${rec.id.slice(0, 8)} (${markers.map((m) => m.type).join(", ")})`,
      "auto-mark-video",
    )
  } catch (err) {
    // Тихо: маркеры — опциональная функция, не ломают счёт
    logEvent("warn", `autoMarkVideoEvents: ${(err as Error).message}`, "auto-mark-video")
  }
}

export class VideoValidationError extends Error {
  constructor(errors: string[]) {
    super(errors.join("; "))
    this.name = "VideoValidationError"
  }
}

export class VideoNotFoundError extends Error {
  constructor(id: string) {
    super(`Сессия записи ${id} не найдена`)
    this.name = "VideoNotFoundError"
  }
}
