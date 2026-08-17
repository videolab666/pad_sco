// GET /api/v1/courts/{short_code}/vmix — vMix payload по вечной ссылке (§247).
// Тот же builder, что у /api/court/[number] и /api/vmix/[id] (lib/match-view).
//
// Ограничение Шага 1: payload строится для кортов с legacy_number
// (связь матч↔корт пока через matches.court_number). Для новых
// нечисловых кортов vMix-JSON появится вместе с court_id в matches (Шаг 2);
// HTML-табло /c/{code} уже сейчас работает для всех кортов.

import { type NextRequest, NextResponse } from "next/server"
import { ensureCourtSchema, getCourtByShortCode } from "@/lib/court-registry"
import { getMatchFromServerByCourtNumber } from "@/lib/server-match-storage"
import { buildCourtVmixPayload } from "@/lib/match-view"
import { parseScoreboardSettings } from "@/lib/scoreboard-settings"
import { logEvent } from "@/lib/error-logger"

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!(await ensureCourtSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  try {
    const court = await getCourtByShortCode(code)
    if (!court) {
      return NextResponse.json({ error: "court_not_found", code }, { status: 404 })
    }
    if (court.legacyNumber === null) {
      return NextResponse.json(
        {
          error: "vmix_requires_numbered_court",
          message:
            "vMix payload пока строится только для кортов с номером (legacy_number). Используйте HTML-табло /c/{code}.",
          court: { name: court.name, shortCode: court.shortCode },
        },
        { status: 422 },
      )
    }

    const match = await getMatchFromServerByCourtNumber(court.legacyNumber)
    if (!match) {
      return NextResponse.json(
        { error: "match_not_found", court: court.name, timestamp: new Date().toISOString() },
        { status: 404 },
      )
    }

    const display = parseScoreboardSettings(new URL(request.url).searchParams)
    const data = buildCourtVmixPayload(match, court.legacyNumber, display)

    logEvent("info", `Court v1 API: vMix payload для /c/${code} (корт ${court.legacyNumber})`, "court-api")

    return NextResponse.json([data], {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    logEvent("error", `Court v1 API: ошибка vMix payload: ${(error as Error).message}`, "court-api", error)
    return NextResponse.json({ error: "internal_error", message: (error as Error).message }, { status: 500 })
  }
}
