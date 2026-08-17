import { type NextRequest, NextResponse } from "next/server"
import { logEvent } from "@/lib/error-logger"
import { getMatchFromServerByCourtNumber } from "@/lib/server-match-storage"
import { buildCourtVmixPayload } from "@/lib/match-view"
import { parseScoreboardSettings } from "@/lib/scoreboard-settings"

export async function GET(request: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  try {
    const resolvedParams = await params
    const courtNumber = Number.parseInt(resolvedParams.number)

    if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 10) {
      return NextResponse.json({ error: "Некорректный номер корта" }, { status: 400 })
    }

    logEvent("info", `Court API: запрос данных матча на корте ${courtNumber}`, "court-api")

    const match = await getMatchFromServerByCourtNumber(courtNumber)

    if (!match) {
      logEvent("error", `Court API: матч на корте ${courtNumber} не найден`, "court-api")
      return NextResponse.json(
        { error: "Матч не найден", courtNumber, timestamp: new Date().toISOString() },
        { status: 404 },
      )
    }

    // Единый источник плоского payload для vMix — lib/match-view
    // (тот же билдер, что и у /api/match/[id]).
    // Те же URL-параметры отображения, что и у HTML-табло (nameLines/nameCase/...)
    const display = parseScoreboardSettings(new URL(request.url).searchParams)
    const data = buildCourtVmixPayload(match, courtNumber, display)

    logEvent("info", `Court API: данные матча на корте ${courtNumber} успешно отправлены`, "court-api")

    return NextResponse.json([data], {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error: any) {
    logEvent("error", "Court API: ошибка при обработке запроса", "court-api", error)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера", message: error.message, timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
