// GET /api/v1/courts/{short_code} — публичный state корта по вечной ссылке
// (plan-4 §247). CORS * — читают QR-страницы, PWA и внешние интеграции.
//
// Код глобально уникален (§246), поэтому корты разных клубов не конфликтуют.
// Для archived-кортов — 404: ссылка не должна «зависнуть» навсегда, но
// выключенный из эксплуатации корт не вещается.

import { type NextRequest, NextResponse } from "next/server"
import { ensureCourtSchema, getCourtByShortCode } from "@/lib/court-registry"
import { getMatchFromServerByCourtNumber } from "@/lib/server-match-storage"

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

    // Пока матч связан с кортом через legacy_number (§246 migration note);
    // явная связь court_id появится вместе с court_sessions (Шаг 2).
    let matchId: string | null = null
    let isCompleted: boolean | null = null
    if (court.legacyNumber !== null) {
      const match = await getMatchFromServerByCourtNumber(court.legacyNumber)
      if (match) {
        matchId = match.id ?? null
        isCompleted = Boolean(match.isCompleted)
      }
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
