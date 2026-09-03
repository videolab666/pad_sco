// GET /api/v1/me/recordings — готовые записи игрока (plan 2026-09-02,
// Task 6). Cookie-сессия → профиль игрока (players.user_id) → записи, где
// игрок среди участников (metadata.participants[].playerId, JSONB contains).
// VOD-ссылка собирается на сервере (env gateway не бывают в клиентском бандле).

import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { getAuthUser, getPlayerForUser } from "@/lib/auth"
import { buildPaddedMatchVodUrl } from "@/lib/video-public"
import { logEvent } from "@/lib/error-logger"

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "auth_required", message: "Войдите, чтобы увидеть свои записи" }, { status: 401 })
    }
    const player = await getPlayerForUser(user.id)
    if (!player) {
      // профиль создастся на /api/v1/me/profile; сюда попадаем сразу после
      return NextResponse.json({ recordings: [] }, { headers: { "Cache-Control": "no-store" } })
    }

    const supabase = createServerSupabaseClient()
    // JSONB-contains на весь metadata (PostgREST не принимает cs по пути
    // metadata->participants — проверено живым запросом): массив справа
    // содержится, если хоть один элемент participants ⊇ {playerId}
    const { data, error } = await supabase
      .from("recording_sessions")
      .select("id, started_at, ended_at, court_id, metadata")
      .eq("status", "ready")
      .contains("metadata", { participants: [{ playerId: player.id }] })
      .order("started_at", { ascending: false })
      .limit(20)
    if (error) throw new Error(error.message)

    // имена кортов для подписей
    const courtIds = [...new Set((data ?? []).map((r: { court_id: string | null }) => r.court_id).filter(Boolean))]
    const courtsById = new Map<string, string>()
    if (courtIds.length > 0) {
      const { data: courts } = await supabase.from("courts").select("id, name").in("id", courtIds)
      for (const c of courts ?? []) courtsById.set(c.id, c.name)
    }

    const recordings = (data ?? []).map(
      (rec: {
        id: string
        started_at: string
        ended_at: string | null
        court_id: string | null
        metadata: Record<string, unknown>
      }) => {
        const startedMs = Date.parse(rec.started_at)
        const endedMs = rec.ended_at ? Date.parse(rec.ended_at) : Date.now()
        const durationSec = endedMs > startedMs ? Math.round((endedMs - startedMs) / 1000) : 0
        const streamKey = typeof rec.metadata?.streamKey === "string" ? rec.metadata.streamKey : null
        return {
          id: rec.id,
          startedAt: rec.started_at,
          endedAt: rec.ended_at,
          durationSec,
          courtName: rec.court_id ? (courtsById.get(rec.court_id) ?? "Корт") : "Корт",
          vodUrl:
            streamKey && durationSec > 0
              ? buildPaddedMatchVodUrl({
                  streamKey,
                  startedAt: rec.started_at,
                  endedAt: rec.ended_at,
                  mediaStartedAt:
                    typeof rec.metadata?.mediaStartedAt === "string" ? rec.metadata.mediaStartedAt : null,
                  mediaEndedAt:
                    typeof rec.metadata?.mediaEndedAt === "string" ? rec.metadata.mediaEndedAt : null,
                })
              : null,
          downloadUrl: `/api/v1/video/recordings/${rec.id}/download`,
        }
      },
    )

    return NextResponse.json({ recordings }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    logEvent("error", `me/recordings: ${(err as Error).message}`, "me-recordings", err)
    return NextResponse.json({ error: "recordings_failed" }, { status: 500 })
  }
}
