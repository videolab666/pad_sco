// GET /api/v1/video/courts/{short_code} — публичный видео-обзор корта (§146):
//   live: источник online/recording + активная сессия → HLS-ссылка gateway
//   recordings: последние сессии записи с маркерами и готовыми клипами
//                (VOD полного матча — через playback API gateway).
// CORS * — читают страница /c/{code}/video, PWA и публичные live-страницы.

import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { ensureCourtSchema, getCourtByShortCode } from "@/lib/court-registry"
import { buildClipFileUrl, buildFullMatchVodUrl, buildLiveHlsUrl } from "@/lib/video-public"
import { logEvent } from "@/lib/error-logger"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!(await ensureCourtSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  try {
    const court = await getCourtByShortCode(code)
    if (!court) {
      return NextResponse.json({ error: "court_not_found", code }, { status: 404 })
    }
    const supabase = createServerSupabaseClient()

    // Источник корта (последний) + активная сессия записи
    const source = await supabase
      .from("video_sources")
      .select("stream_key, status")
      .eq("court_id", court.id)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(1)
    const src = source.data?.[0] ?? null

    let live: Record<string, unknown> | null = null
    if (src && (src.status === "online" || src.status === "recording")) {
      live = {
        streamKey: src.stream_key,
        status: src.status,
        hlsUrl: buildLiveHlsUrl(src.stream_key),
      }
    }

    // Последние записи корта с маркерами и клипами
    const recs = await supabase
      .from("recording_sessions")
      .select("id, status, started_at, ended_at, source_id")
      .eq("court_id", court.id)
      .in("status", ["recording", "finalizing", "uploading", "ready"])
      .order("started_at", { ascending: false })
      .limit(10)

    // stream_key каждой записи (для VOD-ссылок)
    const sourceIds = [...new Set((recs.data ?? []).map((r: { source_id: string | null }) => r.source_id).filter(Boolean))]
    const sourcesById = new Map<string, string>()
    if (sourceIds.length > 0) {
      const srcRows = await supabase
        .from("video_sources")
        .select("id, stream_key")
        .in("id", sourceIds)
      for (const row of srcRows.data ?? []) sourcesById.set(row.id, row.stream_key)
    }

    const recordings = []
    for (const rec of recs.data ?? []) {
      const streamKey = rec.source_id ? sourcesById.get(rec.source_id) : undefined
      const markers = await supabase
        .from("video_markers")
        .select("id, marker_type, video_position_ms, importance, pre_roll_ms, post_roll_ms")
        .eq("recording_session_id", rec.id)
        .order("video_position_ms", { ascending: true })
        .limit(100)

      const clips = await supabase
        .from("clip_requests")
        .select("id, duration_ms, in_ms, out_ms")
        .eq("recording_session_id", rec.id)
        .eq("status", "ready")
        .limit(50)

      const reels = await supabase
        .from("highlight_reels")
        .select("id, duration_ms")
        .eq("recording_session_id", rec.id)
        .eq("status", "ready")
        .limit(10)

      const startedMs = Date.parse(rec.started_at)
      const endedMs = rec.ended_at ? Date.parse(rec.ended_at) : Date.now()
      const durationSec = Number.isFinite(startedMs) && endedMs > startedMs ? (endedMs - startedMs) / 1000 : 0

      recordings.push({
        id: rec.id,
        status: rec.status,
        startedAt: rec.started_at,
        endedAt: rec.ended_at,
        durationSec: Math.round(durationSec),
        vodUrl: streamKey && durationSec > 0
          ? buildFullMatchVodUrl({ streamKey, startedAt: rec.started_at, durationSec })
          : null,
        markers: (markers.data ?? []).map((m: Record<string, unknown>) => ({
          id: m.id,
          type: m.marker_type,
          positionMs: Number(m.video_position_ms ?? 0),
          importance: Number(m.importance ?? 1),
        })),
        clips: (clips.data ?? []).map((c: Record<string, unknown>) => ({
          id: c.id,
          durationMs: Number(c.duration_ms ?? 0),
          fileUrl: buildClipFileUrl(String(c.id)),
          thumbUrl: buildClipFileUrl(String(c.id), true),
        })),
        reels: (reels.data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id,
          durationMs: Number(r.duration_ms ?? 0),
          fileUrl: `/api/v1/video/reels/${r.id}/file`,
          thumbUrl: `/api/v1/video/reels/${r.id}/file?variant=thumb`,
        })),
      })
    }

    return NextResponse.json(
      { court: { name: court.name, shortCode: court.shortCode }, live, recordings },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    )
  } catch (error) {
    logEvent("error", `video court api: ${(error as Error).message}`, "video-court-api", error)
    return NextResponse.json({ error: "internal_error", message: (error as Error).message }, { status: 500 })
  }
}
