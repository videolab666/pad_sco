// GET /api/v1/courts/{short_code}/vmix — vMix payload по вечной ссылке (§247).
// Тот же builder, что у /api/court/[number] и /api/vmix/[id] (lib/match-view).
//
// Шаг 2: матч резолвится по court_id (для нечисловых кортов) с fallback на
// legacy court_number; в payload добавлено court_name — display-имя корта.

import { type NextRequest, NextResponse } from "next/server"
import { ensureCourtSchema, getCourtByShortCode } from "@/lib/court-registry"
import { getMatchFromServerByCourt } from "@/lib/server-match-storage"
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

    const match = await getMatchFromServerByCourt({
      id: court.id,
      legacyNumber: court.legacyNumber,
    })
    if (!match) {
      return NextResponse.json(
        { error: "match_not_found", court: court.name, timestamp: new Date().toISOString() },
        { status: 404 },
      )
    }

    const display = parseScoreboardSettings(new URL(request.url).searchParams)
    const data = buildCourtVmixPayload(match, court.legacyNumber, display, court.name)

    logEvent("info", `Court v1 API: vMix payload для /c/${code} («${court.name}»)`, "court-api")

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
