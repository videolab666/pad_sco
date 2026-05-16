import { type NextRequest, NextResponse } from "next/server"
import { getTennisPointName } from "@/lib/tennis-utils"
import { logEvent } from "@/lib/error-logger"
import { getMatchFromServerByCourtNumber } from "@/lib/server-match-storage"
import { getImportantPoint, isGamePoint, isSetPoint, isMatchPoint } from "@/lib/scoring-logic"
import { getSetsToWin as getConfiguredSetsToWin } from "@/lib/match-format-rules"

// getPointIndex, isGamePoint, isSetPoint, isMatchPoint, getImportantPoint
// → removed, now imported from @/lib/scoring-logic

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTotalSets = (match: any) => {
  // Проверяем различные возможные пути к данным о формате матча
  if (match.format && typeof match.format === "object") {
    // Прямое указание общего количества сетов
    if (typeof match.format.totalSets === "number") {
      return match.format.totalSets
    }
    if (typeof match.format.sets === "number") {
      return match.format.sets
    }
    // Формат "best of X sets"
    if (typeof match.format.bestOf === "number") {
      return match.format.bestOf
    }
  }

  // Проверяем настройки матча
  if (match.settings && typeof match.settings === "object") {
    // Прямое указание общего количества сетов
    if (typeof match.settings.totalSets === "number") {
      return match.settings.totalSets
    }
    if (typeof match.settings.sets === "number") {
      return match.settings.sets
    }
    // Формат "best of X sets"
    if (typeof match.settings.bestOf === "number") {
      return match.settings.bestOf
    }
  }

  // По умолчанию 3 сета
  return 3
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSetsToWin = (match: any) => {
  // Проверяем различные возможные пути к данным о формате матча
  if (match.format && typeof match.format === "object") {
    // Прямое указание количества сетов для победы
    if (typeof match.format.setsToWin === "number") {
      return match.format.setsToWin
    }
  }

  // Проверяем настройки матча
  if (match.settings && typeof match.settings === "object") {
    // Прямое указание количества сетов для победы
    if (typeof match.settings.setsToWin === "number") {
      return match.settings.setsToWin
    }
  }

  // Вычисляем на основе общего количества сетов
  return getConfiguredSetsToWin({ ...match.settings, sets: getTotalSets(match) })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getCurrentSetNumber = (match: any) => {
  if (!match || !match.score) {
    return 1
  }

  // Если матч завершен, возвращаем последний сыгранный сет
  if (match.isCompleted) {
    return match.score.sets ? match.score.sets.length : 1
  }

  // Если есть массив сетов, текущий сет = количество завершенных сетов + 1
  if (match.score.sets && Array.isArray(match.score.sets)) {
    return match.score.sets.length + 1
  }

  // По умолчанию первый сет
  return 1
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  try {
    const resolvedParams = await params
    const courtNumber = Number.parseInt(resolvedParams.number)

    if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 10) {
      return NextResponse.json({ error: "Некорректный номер корта" }, { status: 400 })
    }

    logEvent("info", `Court API: запрос данных матча на корте ${courtNumber}`, "court-api")

    // Используем серверную функцию для получения матча по номеру корта
    const match = await getMatchFromServerByCourtNumber(courtNumber)

    if (!match) {
      logEvent("error", `Court API: матч на корте ${courtNumber} не найден`, "court-api")
      return NextResponse.json(
        {
          error: "Матч не найден",
          courtNumber: courtNumber,
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      )
    }

    // Логируем структуру матча для отладки
    logEvent("debug", `Court API: структура матча`, "court-api", {
      matchId: match.id,
      format: match.format,
      settings: match.settings,
    })

    // Получаем текущие сеты для обеих команд
    // Получаем завершенные сеты
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completedTeamASets = match.score.sets ? match.score.sets.map((set: any) => set.teamA) : []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completedTeamBSets = match.score.sets ? match.score.sets.map((set: any) => set.teamB) : []

    // Создаем полные массивы сетов, включая текущий играющийся сет
    const teamASets = [...completedTeamASets]
    const teamBSets = [...completedTeamBSets]

    // Если матч не завершен и есть текущий сет, добавляем его счет
    if (!match.isCompleted && match.score.currentSet) {
      teamASets.push(match.score.currentSet.teamA)
      teamBSets.push(match.score.currentSet.teamB)
    }

    // Определяем информацию о победителе
    let winnerTeamName = ""
    let winnerName1 = ""
    let winnerName2 = ""

    if (match.isCompleted && match.winner) {
      if (match.winner === "teamA") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        winnerTeamName = match.teamA.players.map((p: any) => p.name).join(" / ")
        winnerName1 = match.teamA.players[0]?.name || ""
        winnerName2 = match.teamA.players[1]?.name || ""
      } else if (match.winner === "teamB") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        winnerTeamName = match.teamB.players.map((p: any) => p.name).join(" / ")
        winnerName1 = match.teamB.players[0]?.name || ""
        winnerName2 = match.teamB.players[1]?.name || ""
      }
    }

    // Получаем информацию о важном моменте
    const importantPoint = getImportantPoint(match)

    // Определяем общее количество сетов и сетов для победы
    const totalSets = getTotalSets(match)
    const setsToWin = getSetsToWin(match)
    const currentSetNumber = getCurrentSetNumber(match)

    // Логируем определенные значения для отладки
    logEvent("debug", `Court API: определены параметры матча`, "court-api", {
      totalSets,
      setsToWin,
      currentSetNumber,
      completedSets: match.score.sets ? match.score.sets.length : 0,
    })

    // Формируем базовый объект данных
    const flatVmixData = {
      match_id: match.id,
      court_number: courtNumber,

      // Данные команды A
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teamA_name: match.teamA.players.map((p: any) => p.name).join(" / "),
      teamA_player1_name: match.teamA.players[0]?.name || "",
      teamA_player2_name: match.teamA.players[1]?.name || "",
      teamA_score: match.score.teamA,
      teamA_game_score: match.score.currentSet
        ? match.score.currentSet.isTiebreak
          ? match.score.currentSet.currentGame.teamA
          : getTennisPointName(match.score.currentSet.currentGame.teamA)
        : "0",
      teamA_current_set: match.score.currentSet ? match.score.currentSet.teamA : 0,
      teamA_serving: match.currentServer && match.currentServer.team === "teamA" ? "True" : "False",

      // Данные команды B
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teamB_name: match.teamB.players.map((p: any) => p.name).join(" / "),
      teamB_player1_name: match.teamB.players[0]?.name || "",
      teamB_player2_name: match.teamB.players[1]?.name || "",
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
      total_sets: totalSets,
      sets_to_win: setsToWin,
      current_set_number: currentSetNumber,

      // Информация о победителе
      winner_team_name: winnerTeamName,
      winner_name1: winnerName1,
      winner_name2: winnerName2,

      // Информация о важном моменте
      important_point_type: importantPoint.type || "",
      important_point_team: importantPoint.team || "",
      is_important_p: importantPoint.team ? "True" : "False",
      is_match_point: isMatchPoint(match) ? "True" : "False",
      is_set_point: isSetPoint(match) ? "True" : "False",
      is_game_point: isGamePoint(match) ? "True" : "False",

      // Служебная информация
      timestamp: new Date().toISOString(),
      update_time: new Date().toLocaleTimeString(),
    }

    // Динамически добавляем данные о сетах в зависимости от настр��ек матча
    // Гарантируем, что будет как минимум 5 сетов для совместимости с vMix
    const maxSets = Math.max(5, totalSets)
    for (let i = 0; i < maxSets; i++) {
      ; (flatVmixData as any)[`teamA_set${i + 1}`] = teamASets[i] !== undefined ? teamASets[i] : ""
        ; (flatVmixData as any)[`teamB_set${i + 1}`] = teamBSets[i] !== undefined ? teamBSets[i] : ""
    }

    // Оборачиваем объект в массив для vMix
    const vmixDataArray = [flatVmixData]

    logEvent("info", `Court API: данные матча на корте ${courtNumber} успешно отправлены`, "court-api")

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
    logEvent("error", "Court API: ошибка при обработке запроса", "court-api", error)
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
