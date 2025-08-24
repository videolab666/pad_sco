import { NextResponse } from "next/server"
import { logEvent } from "@/lib/error-logger"
import { getTennisPointName } from "@/lib/tennis-utils"
import { getMatchFromServer } from "@/lib/server-match-storage"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const matchId = params.id

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

    // Получаем текущие сеты для обеих команд
    const teamASets = match.score.sets ? match.score.sets.map((set) => set.teamA) : []
    const teamBSets = match.score.sets ? match.score.sets.map((set) => set.teamB) : []

    // Формируем "плоский" JSON для vMix без вложенных объектов
    const flatVmixData = {
      match_id: match.id,
      court_number: match.courtNumber || "",

      // Данные команды A
      teamA_name: match.teamA.players.map((p) => p.name).join(" / "),
      teamA_score: match.score.teamA,
      teamA_game_score: match.score.currentSet
        ? match.score.currentSet.isTiebreak
          ? match.score.currentSet.currentGame.teamA
          : getTennisPointName(match.score.currentSet.currentGame.teamA)
        : "0",
      teamA_current_set: match.score.currentSet ? match.score.currentSet.teamA : 0,
      teamA_serving: match.currentServer && match.currentServer.team === "teamA" ? "True" : "False",

      // Данные команды B
      teamB_name: match.teamB.players.map((p) => p.name).join(" / "),
      teamB_score: match.score.teamB,
      teamB_game_score: match.score.currentSet
        ? match.score.currentSet.isTiebreak
          ? match.score.currentSet.currentGame.teamB
          : getTennisPointName(match.score.currentSet.currentGame.teamB)
        : "0",
      teamB_current_set: match.score.currentSet ? match.score.currentSet.teamB : 0,
      teamB_serving: match.currentServer && match.currentServer.team === "teamB" ? "True" : "False",

      // Общие данные матча
      is_tiebreak: match.score.currentSet ? (match.score.currentSet.isTiebreak ? "True" : "False") : "False",
      is_completed: match.isCompleted ? "True" : "False",
      winner: match.winner || "",

      // Данные сетов (до 3-х сетов)
      teamA_set1: teamASets[0] !== undefined ? teamASets[0] : "",
      teamA_set2: teamASets[1] !== undefined ? teamASets[1] : "",
      teamA_set3: teamASets[2] !== undefined ? teamASets[2] : "",

      teamB_set1: teamBSets[0] !== undefined ? teamBSets[0] : "",
      teamB_set2: teamBSets[1] !== undefined ? teamBSets[1] : "",
      teamB_set3: teamBSets[2] !== undefined ? teamBSets[2] : "",

      // Служебная информация
      timestamp: new Date().toISOString(),
      update_time: new Date().toLocaleTimeString(),
    }

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
  } catch (error) {
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
