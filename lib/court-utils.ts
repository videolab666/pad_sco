import { createClientSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"
import { getMatch } from "./match-storage"
import { getTennisPointName } from "./tennis-utils"

export const MAX_COURTS = 10

// Функция для форматирования данных матча для vMix
export const formatVmixData = (match) => {
  if (!match) return {}

  const teamA = match.teamA
  const teamB = match.teamB
  const currentSet = match.score.currentSet

  return [
    {
      match_id: match.id,
      teamA_name: teamA.players.map((p) => p.name).join(" / "),
      teamA_score: match.score.teamA,
      teamA_game_score: currentSet
        ? currentSet.isTiebreak
          ? currentSet.currentGame.teamA
          : getTennisPointName(currentSet.currentGame.teamA)
        : "0",
      teamA_current_set: currentSet ? currentSet.teamA : 0,
      teamA_serving: match.currentServer && match.currentServer.team === "teamA" ? "Да" : "Нет",
      teamB_name: teamB.players.map((p) => p.name).join(" / "),
      teamB_score: match.score.teamB,
      teamB_game_score: currentSet
        ? currentSet.isTiebreak
          ? currentSet.currentGame.teamB
          : getTennisPointName(currentSet.currentGame.teamB)
        : "0",
      teamB_current_set: currentSet ? currentSet.teamB : 0,
      teamB_serving: match.currentServer && match.currentServer.team === "teamB" ? "Да" : "Нет",
      is_tiebreak: currentSet ? (currentSet.isTiebreak ? "Да" : "Нет") : "Нет",
      is_completed: match.isCompleted ? "Да" : "Нет",
      winner: match.winner || "",
      timestamp: new Date().toISOString(),
      update_time: new Date().toLocaleTimeString(),
    },
  ]
}

// Получение матча по номеру корта
export const getMatchByCourtNumber = async (courtNumber) => {
  try {
    logEvent("info", `Получение матча по номеру корта: ${courtNumber}`, "getMatchByCourtNumber")

    // Проверяем, что номер корта - число
    const courtNum = Number.parseInt(courtNumber)
    if (isNaN(courtNum)) {
      logEvent("error", "Некорректный номер корта", "getMatchByCourtNumber", { courtNumber })
      return null
    }

    // Создаем клиент Supabase
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      logEvent("error", "Не удалось создать клиент Supabase", "getMatchByCourtNumber")
      return null
    }

    try {
      // Используем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 секунд таймаут

      // Сначала пытаемся получить активный (незавершенный) матч
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("court_number", courtNum)
        .eq("is_completed", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .abortSignal(controller.signal)

      clearTimeout(timeoutId)

      if (error) {
        logEvent("error", `Ошибка при получении матча из Supabase: ${error.message}`, "getMatchByCourtNumber", {
          error,
          courtNumber,
        })
        return null
      }

      // Если активный матч не найден, пытаемся получить последний завершенный матч
      if (!data) {
        logEvent("info", `Активный матч на корте ${courtNumber} не найден, ищем завершенный`, "getMatchByCourtNumber")

        const controller2 = new AbortController()
        const timeoutId2 = setTimeout(() => controller2.abort(), 5000) // 5 секунд таймаут

        const { data: completedData, error: completedError } = await supabase
          .from("matches")
          .select("*")
          .eq("court_number", courtNum)
          .eq("is_completed", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .abortSignal(controller2.signal)

        clearTimeout(timeoutId2)

        if (completedError) {
          logEvent(
            "error",
            `Ошибка при получении завершенного матча: ${completedError.message}`,
            "getMatchByCourtNumber",
            {
              error: completedError,
              courtNumber,
            },
          )
          return null
        }

        if (!completedData) {
          logEvent("warn", "Матч не найден в Supabase (ни активный, ни завершенный)", "getMatchByCourtNumber", {
            courtNumber,
          })
          return null
        }

        // Преобразуем данные из Supabase
        const completedMatch = {
          id: completedData.id,
          type: completedData.type,
          format: completedData.format,
          createdAt: completedData.created_at,
          settings: completedData.settings,
          teamA: completedData.team_a,
          teamB: completedData.team_b,
          score: completedData.score,
          currentServer: completedData.current_server,
          courtSides: completedData.court_sides,
          shouldChangeSides: completedData.should_change_sides,
          isCompleted: completedData.is_completed,
          winner: completedData.winner,
          courtNumber: completedData.court_number,
          history: [],
        }

        // Убедимся, что структура матча полная
        if (!completedMatch.score.sets) {
          completedMatch.score.sets = []
          logEvent("warn", "Инициализирован пустой массив sets для завершенного матча", "getMatchByCourtNumber", {
            matchId: completedData.id,
            courtNumber,
          })
        }

        logEvent("info", "Получен завершенный матч по номеру корта", "getMatchByCourtNumber", {
          matchId: completedData.id,
          courtNumber,
        })

        return completedMatch
      }

      // Преобразуем данные из Supabase для активного матча
      const match = {
        id: data.id,
        type: data.type,
        format: data.format,
        createdAt: data.created_at,
        settings: data.settings,
        teamA: data.team_a,
        teamB: data.team_b,
        score: data.score,
        currentServer: data.current_server,
        courtSides: data.court_sides,
        shouldChangeSides: data.should_change_sides,
        isCompleted: data.is_completed,
        winner: data.winner,
        courtNumber: data.court_number,
        history: [],
      }

      // Убедимся, что структура матча полная
      if (!match.score.sets) {
        match.score.sets = []
        logEvent("warn", "Инициализирован пустой массив sets для матча из Supabase", "getMatchByCourtNumber", {
          matchId: data.id,
          courtNumber,
        })
      }

      logEvent("info", "Матч успешно получен по номеру корта", "getMatchByCourtNumber", {
        matchId: data.id,
        courtNumber,
      })

      return match
    } catch (fetchError) {
      if (fetchError.name === "AbortError") {
        logEvent("error", "Таймаут при получении матча по номеру корта", "getMatchByCourtNumber", { courtNumber })
      } else {
        logEvent("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "getMatchByCourtNumber", {
          error: fetchError,
          courtNumber,
        })
      }
      return null
    }
  } catch (error) {
    logEvent("error", `Ошибка при получении матча по номеру корта: ${error.message}`, "getMatchByCourtNumber", {
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

// Получение списка занятых кортов
export const getOccupiedCourts = async () => {
  try {
    logEvent("info", "Получение списка занятых кортов", "getOccupiedCourts")

    // Создаем клиент Supabase
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      logEvent("error", "Не удалось создать клиент Supabase", "getOccupiedCourts")
      return []
    }

    try {
      // Используем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 секунд таймаут

      const { data, error } = await supabase
        .from("matches")
        .select("id, court_number, is_completed")
        .eq("is_completed", false)
        .not("court_number", "is", null)
        .abortSignal(controller.signal)

      clearTimeout(timeoutId)

      if (error) {
        logEvent("error", `Ошибка при получении списка занятых кортов: ${error.message}`, "getOccupiedCourts", {
          error,
        })
        return []
      }

      if (!data || data.length === 0) {
        logEvent("info", "Нет активных матчей на кортах", "getOccupiedCourts")
        return []
      }

      // Преобразуем данные
      const occupiedCourts = data.map((match) => match.court_number)

      logEvent("info", `Получено ${occupiedCourts.length} занятых кортов`, "getOccupiedCourts")
      return occupiedCourts
    } catch (fetchError) {
      if (fetchError.name === "AbortError") {
        logEvent("error", "Таймаут при получении списка занятых кортов", "getOccupiedCourts")
      } else {
        logEvent("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "getOccupiedCourts", {
          error: fetchError,
        })
      }
      return []
    }
  } catch (error) {
    logEvent("error", `Ошибка при получении списка занятых кортов: ${error.message}`, "getOccupiedCourts", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })

    // В случае ошибки возвращаем пустой массив
    return []
  }
}

// Получение списка свободных кортов с локальной резервной копией
export const getFreeCourts = async (totalCourts = 10) => {
  try {
    // Сначала пробуем получить занятые корты из Supabase
    let occupiedCourts = []
    try {
      occupiedCourts = await getOccupiedCourts()
    } catch (error) {
      logEvent("warn", "Не удалось получить занятые корты из Supabase, используем локальные данные", "getFreeCourts", {
        error,
      })

      // Если не удалось получить данные из Supabase, используем локальные данные
      // Получаем активные матчи из localStorage
      if (typeof window !== "undefined") {
        try {
          const matches = JSON.parse(localStorage.getItem("tennis_padel_matches") || "[]")
          const activeMatches = matches.filter((match) => !match.isCompleted && match.courtNumber)
          occupiedCourts = activeMatches.map((match) => match.courtNumber)
        } catch (localError) {
          logEvent("error", "Ошибка при получении локальных данных о кортах", "getFreeCourts", { error: localError })
        }
      }
    }

    const occupiedCourtNumbers = occupiedCourts.map((court) => court)

    // Создаем массив всех кортов
    const allCourts = Array.from({ length: totalCourts }, (_, i) => i + 1)

    // Фильтруем свободные корты
    const freeCourts = allCourts.filter((courtNumber) => !occupiedCourtNumbers.includes(courtNumber))

    logEvent("info", `Получено ${freeCourts.length} свободных кортов`, "getFreeCourts")
    return freeCourts
  } catch (error) {
    logEvent("error", `Ошибка при получении списка свободных кортов: ${error.message}`, "getFreeCourts", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })

    // В случае ошибки возвращаем все корты как свободные
    const allCourts = Array.from({ length: totalCourts }, (_, i) => i + 1)
    return allCourts
  }
}

// Проверка доступности корта
export const isCourtAvailable = async (courtNumber) => {
  try {
    const occupiedCourts = await getOccupiedCourts()
    return !occupiedCourts.includes(courtNumber)
  } catch (error) {
    console.error("Ошибка при проверке доступности корта:", error)

    // В случае ошибки, проверяем локальные данные
    if (typeof window !== "undefined") {
      try {
        const matches = JSON.parse(localStorage.getItem("tennis_padel_matches") || "[]")
        const isOccupied = matches.some((match) => !match.isCompleted && match.courtNumber === courtNumber)
        return !isOccupied
      } catch (localError) {
        console.error("Ошибка при проверке локальных данных:", localError)
      }
    }

    // Если все проверки не удались, предполагаем, что корт свободен
    return true
  }
}

// Назначение матча на корт
export const assignMatchToCourt = async (matchId, courtNumber) => {
  try {
    logEvent("info", `Назначение матча ${matchId} на корт ${courtNumber}`, "assignMatchToCourt")

    // Получаем текущий матч
    const match = await getMatch(matchId)
    if (!match) {
      logEvent("error", "Матч не найден", "assignMatchToCourt", { matchId })
      return false
    }

    // Обновляем номер корта
    match.courtNumber = courtNumber

    // Сохраняем обновленный матч
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      logEvent("error", "Не удалось создать клиент Supabase", "assignMatchToCourt")
      return false
    }

    try {
      // Используем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 секунд таймаут

      const { error } = await supabase
        .from("matches")
        .update({ court_number: courtNumber })
        .eq("id", matchId)
        .abortSignal(controller.signal)

      clearTimeout(timeoutId)

      if (error) {
        logEvent("error", `Ошибка при назначении матча на корт: ${error.message}`, "assignMatchToCourt", {
          error,
          matchId,
          courtNumber,
        })
        return false
      }

      logEvent("info", `Матч ${matchId} успешно назначен на корт ${courtNumber}`, "assignMatchToCourt")
      return true
    } catch (fetchError) {
      if (fetchError.name === "AbortError") {
        logEvent("error", "Таймаут при назначении матча на корт", "assignMatchToCourt")
      } else {
        logEvent("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "assignMatchToCourt", {
          error: fetchError,
          matchId,
          courtNumber,
        })
      }
      return false
    }
  } catch (error) {
    logEvent("error", `Ошибка при назначении матча на корт: ${error.message}`, "assignMatchToCourt", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      matchId,
      courtNumber,
    })
    return false
  }
}

// Освобождение корта
export const freeUpCourt = async (courtNumber) => {
  try {
    logEvent("info", `Освобождение корта ${courtNumber}`, "freeUpCourt")

    // Получаем матч на этом корте
    const match = await getMatchByCourtNumber(courtNumber)
    if (!match) {
      logEvent("warn", "Матч на корте не найден", "freeUpCourt", { courtNumber })
      return false
    }

    // Обновляем матч, убирая номер корта
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      logEvent("error", "Не удалось создать клиент Supabase", "freeUpCourt")
      return false
    }

    try {
      // Используем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 секунд таймаут

      const { error } = await supabase
        .from("matches")
        .update({ court_number: null })
        .eq("id", match.id)
        .abortSignal(controller.signal)

      clearTimeout(timeoutId)

      if (error) {
        logEvent("error", `Ошибка при освобождении корта: ${error.message}`, "freeUpCourt", {
          error,
          courtNumber,
          matchId: match.id,
        })
        return false
      }

      logEvent("info", `Корт ${courtNumber} успешно освобожден`, "freeUpCourt")
      return true
    } catch (fetchError) {
      if (fetchError.name === "AbortError") {
        logEvent("error", "Таймаут при освобождении корта", "freeUpCourt")
      } else {
        logEvent("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "freeUpCourt", {
          error: fetchError,
          courtNumber,
          matchId: match.id,
        })
      }
      return false
    }
  } catch (error) {
    logEvent("error", `Ошибка при освобождении корта: ${error.message}`, "freeUpCourt", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      courtNumber,
    })
    return false
  }
}
