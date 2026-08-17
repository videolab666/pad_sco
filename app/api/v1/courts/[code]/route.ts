// GET /api/v1/courts/{short_code} — публичный state корта по вечной ссылке
// (plan-4 §247). CORS * — читают QR-страницы, PWA и внешние интеграции.
//
// Код глобально уникален (§246), поэтому корты разных клубов не конфликтуют.
// Для archived-кортов — 404: ссылка не должна «зависнуть» навсегда, но
// выключенный из эксплуатации корт не вещается.

import { type NextRequest, NextResponse } from "next/server"
import { ensureCourtSchema, getCourtByShortCode } from "@/lib/court-registry"
import { getMatchFromServerByCourt } from "@/lib/server-match-storage"
import { getActiveSessionByCourt } from "@/lib/court-session"

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

    // Шаг 2: резолв по court_id (нечисловые корты) с fallback на legacy-номер.
    let matchId: string | null = null
    let isCompleted: boolean | null = null
    const match = await getMatchFromServerByCourt({ id: court.id, legacyNumber: court.legacyNumber })
    if (match) {
      matchId = match.id ?? null
      isCompleted = Boolean(match.isCompleted)
    }

    // Активная Court Session на корте (§5): тип, участники, время старта.
    let session: Record<string, unknown> | null = null
    try {
      const active = await getActiveSessionByCourt(court.id)
      if (active) {
        session = {
          id: active.id,
          type: active.type,
          status: active.status,
          startedAt: active.startedAt,
        }
      }
    } catch {
      // Sessions-таблицы может не быть (до миграции) — state корта не должен падать.
    }

    return NextResponse.json(
      {
        court: {
          id: court.id,
          name: court.name,
          slug: court.slug,
          shortCode: court.shortCode,
          number: court.legacyNumber,
          status: court.status,
        },
        scoreboardUrl: `/c/${court.shortCode}`,
        session,
        matchId,
        isCompleted,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: "internal_error", message: (error as Error).message },
      { status: 500 },
    )
  }
}
