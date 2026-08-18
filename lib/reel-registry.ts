// Highlight Reel (plan-4 §144): автосборка топ-N моментов записи в один
// ролик. Топ выбирается по важности маркеров (§140); reel собирается из
// ВЕРТИКАЛЬНЫХ клипов (одинаковые параметры кодирования → concat copy).

import { createServerSupabaseClient } from "./supabase"

// ─── Чистые хелперы ─────────────────────────────────────────────────────────

export interface ReelMarker {
  id: string
  importance: number
  positionMs: number
}

/**
 * Топ-N маркеров по важности (§140); при равенстве — раньше по времени.
 * Ручной MANUAL_HIGHLIGHT (10) всегда выше матч-пойнта (7) — как в плане.
 */
export function selectTopMarkers<T extends ReelMarker>(markers: T[], topN: number): T[] {
  return [...markers]
    .sort((a, b) => b.importance - a.importance || a.positionMs - b.positionMs)
    .slice(0, Math.max(1, topN))
}

/** Вертикальный клип (§143 v1 — фиксированный центр-кроп): нужен re-encode. */
export function buildVerticalClipArgs(input: {
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
    "-vf", "crop=ih*9/16:ih,scale=1080:1920",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-c:a", "copy",
    "-movflags", "+faststart",
    input.outPath,
  ]
}

// ─── CRUD (service role) ─────────────────────────────────────────────────────

export interface ReelRecord {
  id: string
  recordingSessionId: string
  matchId: string | null
  status: "pending" | "processing" | "ready" | "failed"
  topN: number
  fileName: string | null
  thumbName: string | null
  durationMs: number | null
  error: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToReel(row: any): ReelRecord {
  return {
    id: row.id,
    recordingSessionId: row.recording_session_id,
    matchId: row.match_id ?? null,
    status: row.status,
    topN: row.top_n ?? 5,
    fileName: row.file_name ?? null,
    thumbName: row.thumb_name ?? null,
    durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    error: row.error ?? null,
  }
}

export async function createReel(input: { recordingSessionId: string; topN?: number }): Promise<ReelRecord> {
  const supabase = createServerSupabaseClient()
  const rec = await supabase.from("recording_sessions").select("id").eq("id", input.recordingSessionId).single()
  if (rec.error || !rec.data) throw new ReelValidationError("Сессия записи не найдена")
  const topN = Math.min(10, Math.max(1, Math.trunc(input.topN ?? 5)))
  const insert = await supabase
    .from("highlight_reels")
    .insert({
      recording_session_id: input.recordingSessionId,
      top_n: topN,
    })
    .select("*")
    .single()
  if (insert.error || !insert.data) throw new Error(`createReel: ${insert.error?.message}`)
  return rowToReel(insert.data)
}

export async function listReels(filter: { status?: string; recordingSessionId?: string } = {}): Promise<ReelRecord[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase.from("highlight_reels").select("*").order("created_at", { ascending: true }).limit(50)
  if (filter.status) query = query.eq("status", filter.status)
  if (filter.recordingSessionId) query = query.eq("recording_session_id", filter.recordingSessionId)
  const { data, error } = await query
  if (error) throw new Error(`listReels: ${error.message}`)
  return (data ?? []).map(rowToReel)
}

export async function getReel(id: string): Promise<ReelRecord | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.from("highlight_reels").select("*").eq("id", id).single()
  if (error || !data) return null
  return rowToReel(data)
}

export async function updateReel(
  id: string,
  patch: {
    status?: "pending" | "processing" | "ready" | "failed"
    fileName?: string
    thumbName?: string
    durationMs?: number
    error?: string | null
  },
): Promise<ReelRecord> {
  const supabase = createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {}
  if (patch.status !== undefined) row.status = patch.status
  if (patch.fileName !== undefined) row.file_name = patch.fileName
  if (patch.thumbName !== undefined) row.thumb_name = patch.thumbName
  if (patch.durationMs !== undefined) row.duration_ms = Math.trunc(patch.durationMs)
  if (patch.error !== undefined) row.error = patch.error
  const { data, error } = await supabase.from("highlight_reels").update(row).eq("id", id).select("*").single()
  if (error || !data) throw new Error(`updateReel: ${error?.message}`)
  return rowToReel(data)
}

export class ReelValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReelValidationError"
  }
}
