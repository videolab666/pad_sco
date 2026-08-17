// GET  /api/court-sessions?active=true&court={courtId} — список сессий (settings-auth)
// POST /api/court-sessions — создать сессию (settings-auth)
//
// Court Session — главная сущность (plan-4 §5-6): контейнер на корте с
// участниками и 0..N матчами. Управление — settings-auth; публичный
// read-only блок сессии — в /api/v1/courts/{code}.

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import {
  SessionValidationError,
  createSession,
  ensureSessionSchema,
  listSessions,
} from "@/lib/court-session"
import { logEvent } from "@/lib/error-logger"

export async function GET(request: NextRequest) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!(await ensureSessionSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  const url = new URL(request.url)
  const sessions = await listSessions({
    active: url.searchParams.get("active") === "true",
    courtId: url.searchParams.get("court") ?? undefined,
    limit: Number.parseInt(url.searchParams.get("limit") ?? "50") || 50,
  })
  return NextResponse.json({ sessions }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!(await ensureSessionSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  try {
    const session = await createSession({
      courtId: typeof body.courtId === "string" ? body.courtId : null,
      type: typeof body.type === "string" ? body.type : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : undefined,
      metadata: (body.metadata as Record<string, unknown>) ?? undefined,
      participants: Array.isArray(body.participants) ? (body.participants as never) : undefined,
    })
    logEvent("info", `Court sessions API: создана сессия ${session.id} (${session.type})`, "court-sessions-api")
    return NextResponse.json({ session }, { status: 201 })
  } catch (err) {
    if (err instanceof SessionValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    logEvent("error", `Court sessions API: ошибка создания: ${(err as Error).message}`, "court-sessions-api", err)
    return NextResponse.json({ error: "create_failed", message: (err as Error).message }, { status: 500 })
  }
}
