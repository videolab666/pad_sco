// POST /api/v1/courts/{short_code}/quick-play — Quick Play по QR (§15).
//
// Публичный: игрок сканирует QR корта и запускает игру сам. Создаёт
// Court Session (type из QUICK_PLAY_TYPES, участники) и возвращает её id —
// клиент затем создаёт матч (createMatch) с sessionId/courtId.
//
// Защита: только не-archived корт, тип ограничен, участники валидируются
// normalizeParticipant (имя/playerId, лимиты длин), максимум 16.

import { type NextRequest, NextResponse } from "next/server"
import { ensureCourtSchema, getCourtByShortCode } from "@/lib/court-registry"
import {
  SessionValidationError,
  createSession,
  ensureSessionSchema,
  isQuickPlayType,
  QUICK_PLAY_TYPES,
  type ParticipantInput,
} from "@/lib/court-session"
import { logEvent } from "@/lib/error-logger"

const MAX_QUICK_PLAY_PARTICIPANTS = 16

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!(await ensureCourtSchema()) || !(await ensureSessionSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const type = body.type ?? "match"
  if (!isQuickPlayType(type)) {
    return NextResponse.json(
      { error: "validation", message: `type должен быть одним из: ${QUICK_PLAY_TYPES.join(", ")}` },
      { status: 400 },
    )
  }

  const participants = Array.isArray(body.participants) ? (body.participants as ParticipantInput[]) : []
  if (participants.length < 1 || participants.length > MAX_QUICK_PLAY_PARTICIPANTS) {
    return NextResponse.json(
      { error: "validation", message: `Участников: от 1 до ${MAX_QUICK_PLAY_PARTICIPANTS}` },
      { status: 400 },
    )
  }

  try {
    const court = await getCourtByShortCode(code)
    if (!court) {
      return NextResponse.json({ error: "court_not_found", code }, { status: 404 })
    }

    const session = await createSession({
      courtId: court.id,
      type,
      createdBy: "quick-play",
      participants,
    })
    logEvent(
      "info",
      `Quick Play: сессия ${session.id} (${type}, ${participants.length} уч.) на корте /c/${code}`,
      "quick-play",
    )
    return NextResponse.json(
      { session: { id: session.id, type: session.type, startedAt: session.startedAt } },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof SessionValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    logEvent("error", `Quick Play: ${(err as Error).message}`, "quick-play", err)
    return NextResponse.json({ error: "quick_play_failed", message: (err as Error).message }, { status: 500 })
  }
}
