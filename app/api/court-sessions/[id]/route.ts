// GET   /api/court-sessions/{id} — сессия с участниками (settings-auth)
// PATCH /api/court-sessions/{id} — { status } и/или { matchId } (settings-auth)
//
// status: preparing|active|completed|cancelled (финальный фиксирует ended_at).
// matchId: привязать матч к сессии; null — отвязать все матчи сессии (§5).

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import {
  SessionValidationError,
  ensureSessionSchema,
  getSession,
  linkMatch,
  updateSessionStatus,
} from "@/lib/court-session"
import { logEvent } from "@/lib/error-logger"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!(await ensureSessionSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  const { id } = await params
  const session = await getSession(id, true)
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!(await ensureSessionSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  const { id } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  try {
    // Привязка матча не меняет статус сессии — два независимых действия в одном PATCH.
    if (body.matchId !== undefined) {
      const matchId = body.matchId === null ? null : String(body.matchId)
      if (matchId !== null && !/^[0-9a-f-]{36}$/i.test(matchId)) {
        return NextResponse.json({ error: "validation", message: "matchId должен быть UUID или null" }, { status: 400 })
      }
      await linkMatch(id, matchId)
    }

    let session = await getSession(id, false)
    if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 })

    if (body.status !== undefined) {
      session = await updateSessionStatus(id, String(body.status))
      logEvent("info", `Court sessions API: сессия ${id} → ${session.status}`, "court-sessions-api")
    }

    return NextResponse.json({ session })
  } catch (err) {
    if (err instanceof SessionValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    logEvent("error", `Court sessions API: ошибка обновления: ${(err as Error).message}`, "court-sessions-api", err)
    return NextResponse.json({ error: "update_failed", message: (err as Error).message }, { status: 500 })
  }
}
