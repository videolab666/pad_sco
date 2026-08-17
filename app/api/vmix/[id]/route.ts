import { NextResponse } from "next/server"
import { logEvent } from "@/lib/error-logger"
import { getMatchFromServer } from "@/lib/server-match-storage"
import { buildCourtVmixPayload } from "@/lib/match-view"
import { parseScoreboardSettings } from "@/lib/scoreboard-settings"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const matchId = resolvedParams.id

    if (!matchId) {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 })
    }

    // Логируем запрос к API
    logEvent("info", `vMix API запрос данных матча: ${matchId}`, "vmix-api")

    // Используем серверную функцию для получения матча вместо клиентской
    const match = await getMatchFromServer(matchId)

    if (!match) {
      logEvent("error", `Матч не найден: ${matchId}`, "vmix-api")
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }

    // Единый источник плоского payload для vMix — lib/match-view.
    // Используем тот же билдер, что и /api/court/[number] и /api/match/[id],
    // чтобы все три endpoint'а возвращали одинаковый набор полей.
    // Те же URL-параметры отображения, что и у HTML-табло (nameLines/nameCase/...)
    const display = parseScoreboardSettings(new URL(request.url).searchParams)
    const flatVmixData = buildCourtVmixPayload(match, null, display)

    // Оборачиваем объект в массив для vMix
    const vmixDataArray = [flatVmixData]

    logEvent("info", `vMix API: данные матча ${matchId} успешно отправлены`, "vmix-api")

    // Устанавливаем заголовки для CORS, чтобы vMix мог получить данные
    return NextResponse.json(vmixDataArray, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error: any) {
    logEvent("error", "vMix API: ошибка при обработке запроса", "vmix-api", error)
    return NextResponse.json(
      {
        error: "Внутренняя ошибка сервера",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
