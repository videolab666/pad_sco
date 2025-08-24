import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { logEvent } from "./error-logger"

// Обновим функцию transformMatchFromSupabase, добавив поле courtNumber
const transformMatchFromSupabase = (match) => {
  return {
    id: match.id,
    type: match.type,
    format: match.format,
    createdAt: match.created_at,
    settings: match.settings,
    teamA: match.team_a,
    teamB: match.team_b,
    score: match.score,
    currentServer: match.current_server,
    courtSides: match.court_sides,
    shouldChangeSides: match.should_change_sides,
    isCompleted: match.is_completed,
    winner: match.winner,
    courtNumber: match.court_number,
    history: [],
    created_via_court_link: match.created_via_court_link,
  }
}

// Получение конкретного матча по ID (серверная версия)
export const getMatchFromServer = async (id) => {
  try {
    logEvent("info", `Получение матча по ID (сервер): ${id}`, "getMatchFromServer")

    // Создаем клиент Supabase для серверного компонента
    const supabase = createServerComponentClient({ cookies })

    // Получаем матч из Supabase
    const { data, error, status } = await supabase.from("matches").select("*").eq("id", id).single()

    if (error) {
      logEvent("error", `Ошибка при получении матча из Supabase: ${error.message}`, "getMatchFromServer", {
        error,
        status,
        matchId: id,
      })
      return null
    }

    if (!data) {
      logEvent("warn", "Матч не найден в Supabase", "getMatchFromServer", { matchId: id })
      return null
    }

    logEvent("info", "Матч успешно получен из Supabase (сервер)", "getMatchFromServer", { matchId: id })

    // Преобразуем данные из Supabase
    const match = transformMatchFromSupabase(data)

    // Убедимся, что структура матча полная
    if (!match.score.sets) {
      match.score.sets = []
      logEvent("warn", "Инициализирован пустой массив sets для матча из Supabase", "getMatchFromServer", {
        matchId: id,
      })
    }

    return match
  } catch (error) {
    logEvent("error", `Ошибка при получении матча (сервер): ${error.message}`, "getMatchFromServer", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      matchId: id,
    })
    return null
  }
}

// Изменим функцию getMatchFromServerByCourtNumber, чтобы она возвращала и завершенные матчи
export const getMatchFromServerByCourtNumber = async (courtNumber) => {
  try {
    logEvent("info", `Получение матча по номеру корта (сервер): ${courtNumber}`, "getMatchFromServerByCourtNumber")

    // Создаем клиент Supabase для серверного компонента
    const supabase = createServerComponentClient({ cookies })

    // Сначала пытаемся получить активный (незавершенный) матч
    let { data, error, status } = await supabase
      .from("matches")
      .select("*")
      .eq("court_number", courtNumber)
      .eq("is_completed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Если активный матч не найден, пытаемся получить последний завершенный матч
    if (!data && !error) {
      logEvent(
        "info",
        `Активный матч на корте ${courtNumber} не найден, ищем завершенный`,
        "getMatchFromServerByCourtNumber",
      )

      const completedMatchResult = await supabase
        .from("matches")
        .select("*")
        .eq("court_number", courtNumber)
        .eq("is_completed", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      data = completedMatchResult.data
      error = completedMatchResult.error
      status = completedMatchResult.status
    }

    if (error) {
      logEvent("error", `Ошибка при получении матча из Supabase: ${error.message}`, "getMatchFromServerByCourtNumber", {
        error,
        status,
        courtNumber,
      })
      return null
    }

    if (!data) {
      logEvent("warn", "Матч не найден в Supabase", "getMatchFromServerByCourtNumber", { courtNumber })
      return null
    }

    logEvent("info", "Матч успешно получен из Supabase (сервер)", "getMatchFromServerByCourtNumber", {
      matchId: data.id,
      courtNumber,
      isCompleted: data.is_completed,
    })

    // Преобразуем данные из Supabase
    const match = transformMatchFromSupabase(data)

    // Убедимся, что структура матча полная
    if (!match.score.sets) {
      match.score.sets = []
      logEvent("warn", "Инициализирован пустой массив sets для матча из Supabase", "getMatchFromServerByCourtNumber", {
        matchId: data.id,
        courtNumber,
      })
    }

    return match
  } catch (error) {
    logEvent("error", `Ошибка при получении матча (сервер): ${error.message}`, "getMatchFromServerByCourtNumber", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      courtNumber,
    })
    return null
  }
}
