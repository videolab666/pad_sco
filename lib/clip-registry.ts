// Clip pipeline (plan-4 §141): маркер → диапазон → FFmpeg-воркер → mp4+jpg.
//
// Чистые хелперы (диапазон §138, разбор имён сегментов MediaMTX, выбор
// перекрывающихся сегментов, аргументы FFmpeg) без I/O — покрыты тестами.

import { createServerSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"

// ─── Чистые хелперы ─────────────────────────────────────────────────────────

/** Диапазон клипа из маркера (§138): position-pre … position+post, без ухода <0. */
export function computeClipRange(marker: {
  videoPositionMs: number
  preRollMs: number
  postRollMs: number
}): { inMs: number; outMs: number } {
  const inMs = Math.max(0, Math.trunc(marker.videoPositionMs - marker.preRollMs))
  const outMs = Math.trunc(marker.videoPositionMs + marker.postRollMs)
  return { inMs, outMs }
}

/**
 * Старт сегмента из имени файла MediaMTX (recordPath %Y-%m-%d_%H-%M-%S_%f),
 * например "2026-08-18_10-17-28_840741.mp4" → epoch ms (локальное время —
 * MediaMTX пишет локальную зону).
 */
export function parseSegmentStartMs(fileName: string): number | null {
  const m = fileName.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})[_-](\d{1,6})\.mp4$/)
  if (!m) return null
  const [, Y, Mo, D, H, Mi, S, micro] = m
  const ms = Math.floor(Number(micro.padEnd(6, "0")) / 1000)
  const time = new Date(
    Number(Y), Number(Mo) - 1, Number(D),
    Number(H), Number(Mi), Number(S), ms,
  ).getTime()
  return Number.isFinite(time) ? time : null
}

export interface SegmentRef {
  name: string
  /** Старт сегмента относительно начала записи (ms). */
  startMs: number
}

/**
 * Сегменты, перекрывающие [inMs, outMs]. Точная длительность сегмента
 * неизвестна до парсинга — используем оценку (шаг нарезки + запас).
 */
export function selectSegments(
  segments: SegmentRef[],
  inMs: number,
  outMs: number,
  assumedSegmentMs = 31_000,
): string[] {
  return segments
    .filter((s) => s.startMs <= outMs && s.startMs + assumedSegmentMs >= inMs)
    .sort((a, b) => a.startMs - b.startMs)
    .map((s) => s.name)
}

/** ffconcat-плейлист для демуксера ffmpeg (fMP4-сегменты склеиваются без перекодирования). */
export function buildConcatList(files: string[]): string {
  return (
    "ffconcat version 1.0\n" +
    files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") +
    "\n"
  )
}

/** Извлечение клипа: concat → -ss/-to, stream copy (keyframe-aware §141). */
export function buildClipArgs(input: {
  listPath: string
  inMs: number
  outMs: number
  outPath: string
}): string[] {
  return [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "concat", "-safe", "0",
    "-ss", (input.inMs / 1000).toFixed(3),
    "-i", input.listPath,
    "-to", ((input.outMs - input.inMs) / 1000).toFixed(3),
    "-c", "copy",
    "-movflags", "+faststart",
    input.outPath,
  ]
}

/** Миниатюра из готового клипа. */
export function buildThumbArgs(input: { clipPath: string; outPath: string; seekSec?: number }): string[] {
  return [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(input.seekSec ?? 0.5),
    "-i", input.clipPath,
    "-frames:v", "1",
    "-vf", "scale=640:-2",
    input.outPath,
  ]
}

// ─── Серверная часть (service role) ─────────────────────────────────────────

export interface ClipRequestRecord {
  id: string
  markerId: string
  recordingSessionId: string
  matchId: string | null
  status: "pending" | "processing" | "ready" | "failed"
  inMs: number
  outMs: number
  fileName: string | null
  thumbName: string | null
  durationMs: number | null
  error: string | null
  variant: 'wide' | 'vertical'
  /** Обогащение для воркера: где лежат сегменты записи и когда она началась. */
  streamKey: string | null
  recordingStatus: string | null
  recordingStartedAt: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToClip(row: any, streamKey?: string | null, recordingStatus?: string | null, recordingStartedAt?: string | null): ClipRequestRecord {
  return {
    id: row.id,
    markerId: row.marker_id,
    recordingSessionId: row.recording_session_id,
    matchId: row.match_id ?? null,
    status: row.status,
    inMs: Number(row.in_ms ?? 0),
    outMs: Number(row.out_ms ?? 0),
    fileName: row.file_name ?? null,
    thumbName: row.thumb_name ?? null,
    durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    error: row.error ?? null,
    variant: row.variant ?? 'wide',
    streamKey: streamKey ?? null,
    recordingStatus: recordingStatus ?? null,
    recordingStartedAt: recordingStartedAt ?? null,
  }
}

/** Создать clip_request из маркера: диапазон считается из роллов маркера. */
export async function createClipFromMarker(markerId: string, variant: 'wide' | 'vertical' = 'wide'): Promise<ClipRequestRecord> {
  const supabase = createServerSupabaseClient()
  const marker = await supabase.from("video_markers").select("*").eq("id", markerId).single()
  if (marker.error || !marker.data) throw new ClipValidationError("Маркер не найден")

  const recording = await supabase
    .from("recording_sessions")
    .select("id, source_id")
    .eq("id", marker.data.recording_session_id)
    .single()
  if (recording.error || !recording.data) throw new ClipValidationError("Сессия записи не найдена")

  const { inMs, outMs } = computeClipRange({
    videoPositionMs: Number(marker.data.video_position_ms ?? 0),
    preRollMs: Number(marker.data.pre_roll_ms ?? 0),
    postRollMs: Number(marker.data.post_roll_ms ?? 0),
  })

  const insert = await supabase
    .from("clip_requests")
    .insert({
      marker_id: markerId,
      recording_session_id: marker.data.recording_session_id,
      match_id: marker.data.match_id ?? null,
      in_ms: inMs,
      out_ms: outMs,
      variant,
    })
    .select("*")
    .single()
  if (insert.error || !insert.data) throw new Error(`createClip: ${insert.error?.message}`)
  return rowToClip(insert.data)
}

/** Список заявок (+ stream_key/статус записи для воркера). */
export async function listClips(filter: { status?: string; recordingSessionId?: string; limit?: number } = {}): Promise<ClipRequestRecord[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("clip_requests")
    .select("*, recording_sessions(status, started_at, video_sources(stream_key))")
    .order("created_at", { ascending: true })
    .limit(Math.min(filter.limit ?? 50, 200))
  if (filter.status) query = query.eq("status", filter.status)
  if (filter.recordingSessionId) query = query.eq("recording_session_id", filter.recordingSessionId)
  const { data, error } = await query
  if (error) throw new Error(`listClips: ${error.message}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => {
    const rec = row.recording_sessions ?? {}
    const src = Array.isArray(rec.video_sources) ? rec.video_sources[0] : rec.video_sources
    return rowToClip(row, src?.stream_key ?? null, rec.status ?? null, rec.started_at ?? null)
  })
}

export async function getClip(id: string): Promise<ClipRequestRecord | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("clip_requests")
    .select("*, recording_sessions(status, started_at, video_sources(stream_key))")
    .eq("id", id)
    .single()
  if (error || !data) return null
  const rec = data.recording_sessions ?? {}
  const src = Array.isArray(rec.video_sources) ? rec.video_sources[0] : rec.video_sources
  return rowToClip(data, src?.stream_key ?? null, rec.status ?? null, rec.started_at ?? null)
}

/** Обновление статуса воркером/оператором: только имена файлов, не пути. */
export async function updateClip(
  id: string,
  patch: {
    status?: "pending" | "processing" | "ready" | "failed"
    fileName?: string
    thumbName?: string
    durationMs?: number
    error?: string | null
  },
): Promise<ClipRequestRecord> {
  const supabase = createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {}
  if (patch.status !== undefined) row.status = patch.status
  if (patch.fileName !== undefined) row.file_name = patch.fileName
  if (patch.thumbName !== undefined) row.thumb_name = patch.thumbName
  if (patch.durationMs !== undefined) row.duration_ms = Math.trunc(patch.durationMs)
  if (patch.error !== undefined) row.error = patch.error

  const { data, error } = await supabase.from("clip_requests").update(row).eq("id", id).select("*").single()
  if (error || !data) throw new Error(`updateClip: ${error?.message}`)
  return rowToClip(data)
}

export class ClipValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClipValidationError"
  }
}
