// POST   /api/v1/courts/{short_code}/recording — «Записать матч» по QR (§15).
// DELETE /api/v1/courts/{short_code}/recording — стоп записи.
//
// Публичный, как Quick Play: игрок на QR-странице корта. Гейты:
//   - тариф клуба: feature video_recording (§94);
//   - камера корта online по последнему heartbeat (§152);
//   - court session активна и принадлежит этому корту.
// Старт идемпотентен (повторный POST возвращает идущую запись), как и стоп.
// Запись на диске включает runtime-override MediaMTX (plan 2026-09-02).

import { type NextRequest, NextResponse } from "next/server"
import { getCourtByShortCode } from "@/lib/court-registry"
import { getSession, finalStatuses, getActiveSessionByCourt } from "@/lib/court-session"
import {
  VideoValidationError,
  buildStreamKey,
  getActiveRecordingByStreamKey,
  getSourceByKey,
  startRecording,
  stopRecording,
} from "@/lib/video-registry"
import { PLANS, getClubPlan, hasPlanFeature, type PlanTier } from "@/lib/billing-plans"
import { createServerSupabaseClient } from "@/lib/supabase"
import { logEvent } from "@/lib/error-logger"

async function resolveClubTier(clubId: string): Promise<PlanTier> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase.from("clubs").select("metadata").eq("id", clubId).limit(1)
  const metadata = (data && data[0]?.metadata as Record<string, unknown>) ?? null
  return getClubPlan(metadata).tier
}

function recordingView(rec: {
  id: string
  status: string
  startedAt: string
  courtSessionId?: string | null
}): Record<string, unknown> {
  return {
    id: rec.id,
    status: rec.status,
    startedAt: rec.startedAt,
    ...(rec.courtSessionId ? { courtSessionId: rec.courtSessionId } : {}),
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const courtSessionId = typeof body.courtSessionId === "string" ? body.courtSessionId : ""
  if ("courtSessionId" in body && !courtSessionId) {
    return NextResponse.json({ error: "validation", message: "courtSessionId не может быть пустым" }, { status: 400 })
  }

  try {
    const court = await getCourtByShortCode(code)
    if (!court) return NextResponse.json({ error: "court_not_found", code }, { status: 404 })

    const tier = await resolveClubTier(court.clubId)
    if (!hasPlanFeature(tier, "video_recording")) {
      return NextResponse.json({ error: "plan_feature", message: "Запись видео недоступна на тарифе клуба" }, { status: 403 })
    }

    // courtSessionId не передан — берём активную сессию корта (кнопка на панели)
    let sessionId = courtSessionId
    if (!sessionId) {
      const active = await getActiveSessionByCourt(court.id)
      if (!active) {
        return NextResponse.json(
          { error: "no_active_session", message: "Нет активной игры — начните матч, чтобы записать его" },
          { status: 400 },
        )
      }
      sessionId = active.id
    }
    const session = await getSession(sessionId)
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 })
    if (session.courtId !== court.id) {
      return NextResponse.json({ error: "validation", message: "Сессия принадлежит другому корту" }, { status: 400 })
    }
    if (finalStatuses().includes(session.status as never)) {
      return NextResponse.json({ error: "session_finished", message: "Сессия уже завершена" }, { status: 400 })
    }

    const streamKey = buildStreamKey(court.shortCode)
    const source = await getSourceByKey(streamKey)
    if (!source) {
      return NextResponse.json({ error: "camera_not_connected", message: "Камера корта не подключена" }, { status: 409 })
    }
    if (source.status === "offline") {
      return NextResponse.json({ error: "camera_offline", message: "Камера корта offline" }, { status: 409 })
    }

    // Идемпотентность: запись уже идёт — возвращаем её
    const active = await getActiveRecordingByStreamKey(streamKey)
    if (active) return NextResponse.json({ recording: recordingView(active) })

    // Ретенция — из тарифа клуба (§148); при выключенном видео — fallback 7d
    const retentionDays = PLANS[tier].limits.videoRetentionDays || 7

    const recording = await startRecording({
      streamKey,
      courtId: court.id,
      courtSessionId: sessionId,
      retentionDays,
      metadata: {
        startedBy: "qr-player",
        participants: (session.participants ?? []).map((p) => ({
          name: p.displayName,
          playerId: p.playerId ?? null,
        })),
      },
    })
    logEvent(
      "info",
      `QR recording: сессия ${sessionId.slice(0, 8)} → запись ${recording.id.slice(0, 8)} на корте /c/${code}`,
      "qr-recording",
    )
    return NextResponse.json({ recording: recordingView(recording) }, { status: 201 })
  } catch (err) {
    if (err instanceof VideoValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    logEvent("error", `QR recording: ${(err as Error).message}`, "qr-recording", err)
    return NextResponse.json({ error: "start_failed", message: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  try {
    const court = await getCourtByShortCode(code)
    if (!court) return NextResponse.json({ error: "court_not_found", code }, { status: 404 })

    const streamKey = buildStreamKey(court.shortCode)
    const active = await getActiveRecordingByStreamKey(streamKey)
    if (!active) return NextResponse.json({ recording: null })

    const recording = await stopRecording(active.id)
    logEvent("info", `QR recording: стоп ${recording.id.slice(0, 8)} на корте /c/${code}`, "qr-recording")
    return NextResponse.json({ recording: recordingView(recording) })
  } catch (err) {
    logEvent("error", `QR recording stop: ${(err as Error).message}`, "qr-recording", err)
    return NextResponse.json({ error: "stop_failed", message: (err as Error).message }, { status: 500 })
  }
}
