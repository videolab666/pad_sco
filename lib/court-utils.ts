import { createClientSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"
import { getMatch } from "./match-storage"
import { getTennisPointName } from "./tennis-utils"
import { tSync } from "./log-i18n"
import { matchFromRow } from "./match-supabase"

export const MAX_COURTS = 10

/**
 * True for an aborted / timed-out request — an expected, benign condition
 * (5s query timeout, navigation). Such cases are logged as `warn`, not `error`,
 * so they do not surface as a red Console Error in dev.
 */
function isAbortError(e: any): boolean {
  if (!e) return false
  return (
    e.name === "AbortError" ||
    /abort/i.test(String(e.name || "")) ||
    /abort/i.test(String(e.message || ""))
  )
}

// Функция для форматирования данных матча для vMix
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatVmixData = (match: any) => {
  if (!match) return {}

  const teamA = match.teamA
  const teamB = match.teamB
  const currentSet = match.score.currentSet

  return [
    {
      match_id: match.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teamA_name: teamA.players.map((p: any) => p.name).join(" / "),
      teamA_score: match.score.teamA,
      teamA_game_score: currentSet
        ? currentSet.isTiebreak
          ? currentSet.currentGame.teamA
          : getTennisPointName(currentSet.currentGame.teamA)
        : "0",
      teamA_current_set: currentSet ? currentSet.teamA : 0,
      teamA_serving: match.currentServer && match.currentServer.team === "teamA" ? "Да" : "Нет",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teamB_name: teamB.players.map((p: any) => p.name).join(" / "),
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getMatchByCourtNumber = async (
  courtNumber: any,
  options: { includeCompletedFallback?: boolean } = {},
) => {
  const includeCompletedFallback = options.includeCompletedFallback !== false
  try {
    logEvent("info", tSync("logMessages.gettingMatchByCourt", { court: courtNumber }), "getMatchByCourtNumber")

    // Проверяем, что номер корта - число
    const courtNum = Number.parseInt(courtNumber)
    if (isNaN(courtNum)) {
      logEvent("error", tSync("logMessages.invalidCourtNumber"), "getMatchByCourtNumber", { courtNumber })
      return null
    }

    // Создаем клиент Supabase
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      logEvent("error", tSync("logMessages.failedCreateClient"), "getMatchByCourtNumber")
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
        // Abort/таймаут — ожидаемо, не настоящая ошибка → warn вместо error.
        logEvent(
          isAbortError(error) ? "warn" : "error",
          tSync("logMessages.errorMatchFromSupabase", { error: error.message }),
          "getMatchByCourtNumber",
          { error, courtNumber },
        )
        return null
      }

      // Interactive scoreboards must never resurrect the last completed match.
      // Read-only court/status pages can retain the historical fallback.
      if (!data && !includeCompletedFallback) return null

      // Если активный матч не найден, пытаемся получить последний завершенный матч
      if (!data) {
        logEvent("info", tSync("logMessages.activeMatchNotFoundSeekCompleted", { court: courtNumber }), "getMatchByCourtNumber")

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
            tSync("logMessages.errorCompletedMatch", { error: completedError.message }),
            "getMatchByCourtNumber",
            {
              error: completedError,
              courtNumber,
            },
          )
          return null
        }

        if (!completedData) {
          logEvent("warn", tSync("logMessages.matchNotFoundActiveOrCompleted"), "getMatchByCourtNumber", {
            courtNumber,
          })
          return null
        }

        // Преобразуем данные из Supabase
        const completedMatch = matchFromRow(completedData)

        // Убедимся, что структура матча полная
        if (!completedMatch.score.sets) {
          completedMatch.score.sets = []
          logEvent("warn", tSync("logMessages.initEmptySetsCompleted"), "getMatchByCourtNumber", {
            matchId: completedData.id,
            courtNumber,
          })
        }

        logEvent("info", tSync("logMessages.gotCompletedMatchByCourt"), "getMatchByCourtNumber", {
          matchId: completedData.id,
          courtNumber,
        })

        return completedMatch
      }

      // Преобразуем данные из Supabase для активного матча
      const match = matchFromRow(data)

      // Убедимся, что структура матча полная
      if (!match.score.sets) {
        match.score.sets = []
        logEvent("warn", tSync("logMessages.initEmptySetsSupabase"), "getMatchByCourtNumber", {
          matchId: data.id,
          courtNumber,
        })
      }

      logEvent("info", tSync("logMessages.gotMatchByCourt"), "getMatchByCourtNumber", {
        matchId: data.id,
        courtNumber,
      })

      return match
    } catch (err) {
      const fetchError = err as Error
      if (isAbortError(fetchError)) {
        // Таймаут запроса — ожидаемое поведение, не ошибка.
        logEvent("warn", tSync("logMessages.timeoutGetMatchByCourt"), "getMatchByCourtNumber", { courtNumber })
      } else {
        logEvent("error", tSync("logMessages.supabaseQueryError", { error: fetchError.message }), "getMatchByCourtNumber", {
          error: fetchError,
          courtNumber,
        })
      }
      return null
    }
  } catch (err) {
    const error = err as Error
    // Abort/таймаут — ожидаемо → warn; настоящие сбои → error.
    logEvent(
      isAbortError(error) ? "warn" : "error",
      tSync("logMessages.errorGetMatchByCourt", { error: error.message }),
      "getMatchByCourtNumber",
      {
        error: { name: error.name, message: error.message, stack: error.stack },
        courtNumber,
      },
    )
    return null
  }
}

/** Active-only lookup for interactive scoring surfaces. */
export const getActiveMatchByCourtNumber = (courtNumber: any) =>
  getMatchByCourtNumber(courtNumber, { includeCompletedFallback: false })

// Получение списка занятых кортов
export const getOccupiedCourts = async () => {
  try {
    logEvent("info", tSync("logMessages.gettingOccupiedCourts"), "getOccupiedCourts")

    // Создаем клиент Supabase
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      logEvent("error", tSync("logMessages.failedCreateClient"), "getOccupiedCourts")
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
        logEvent("error", tSync("logMessages.errorOccupiedCourts", { error: error.message }), "getOccupiedCourts", {
          error,
        })
        return []
      }

      if (!data || data.length === 0) {
        logEvent("info", tSync("logMessages.noActiveMatchesOnCourts"), "getOccupiedCourts")
        return []
      }

      // Преобразуем данные
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const occupiedCourts = data.map((match: any) => match.court_number)

      logEvent("info", tSync("logMessages.gotOccupiedCourts", { count: occupiedCourts.length }), "getOccupiedCourts")
      return occupiedCourts
    } catch (err) {
      const fetchError = err as Error
      if (fetchError.name === "AbortError") {
        logEvent("error", tSync("logMessages.timeoutOccupiedCourts"), "getOccupiedCourts")
      } else {
        logEvent("error", tSync("logMessages.supabaseQueryError", { error: fetchError.message }), "getOccupiedCourts", {
          error: fetchError,
        })
      }
      return []
    }
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorOccupiedCourts", { error: error.message }), "getOccupiedCourts", {
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
      logEvent("warn", tSync("logMessages.failedOccupiedUseLocal"), "getFreeCourts", {
        error,
      })

      // Если не удалось получить данные из Supabase, используем локальные данные
      // Получаем активные матчи из localStorage
      if (typeof window !== "undefined") {
        try {
          const matches = JSON.parse(localStorage.getItem("tennis_padel_matches") || "[]")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const activeMatches = matches.filter((match: any) => !match.isCompleted && match.courtNumber)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          occupiedCourts = activeMatches.map((match: any) => match.courtNumber)
        } catch (localError) {
          logEvent("error", tSync("logMessages.errorLocalCourts"), "getFreeCourts", { error: localError })
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const occupiedCourtNumbers = occupiedCourts.map((court: any) => court)

    // Создаем массив всех кортов
    const allCourts = Array.from({ length: totalCourts }, (_, i) => i + 1)

    // Фильтруем свободные корты
    const freeCourts = allCourts.filter((courtNumber) => !occupiedCourtNumbers.includes(courtNumber))

    logEvent("info", tSync("logMessages.gotFreeCourts", { count: freeCourts.length }), "getFreeCourts")
    return freeCourts
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorFreeCourts", { error: error.message }), "getFreeCourts", {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isCourtAvailable = async (courtNumber: any) => {
  try {
    const occupiedCourts = await getOccupiedCourts()
    return !occupiedCourts.includes(courtNumber)
  } catch (error) {
    console.error("Ошибка при проверке доступности корта:", error)

    // В случае ошибки, проверяем локальные данные
    if (typeof window !== "undefined") {
      try {
        const matches = JSON.parse(localStorage.getItem("tennis_padel_matches") || "[]")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isOccupied = matches.some((match: any) => !match.isCompleted && match.courtNumber === courtNumber)
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const assignMatchToCourt = async (matchId: any, courtNumber: any) => {
  try {
    logEvent("info", tSync("logMessages.assigningMatchToCourt", { matchId, court: courtNumber }), "assignMatchToCourt")

    // Получаем текущий матч
    const match = await getMatch(matchId)
    if (!match) {
      logEvent("error", tSync("logMessages.matchNotFound"), "assignMatchToCourt", { matchId })
      return false
    }

    // Обновляем номер корта
    match.courtNumber = courtNumber

    // Сохраняем обновленный матч
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      logEvent("error", tSync("logMessages.failedCreateClient"), "assignMatchToCourt")
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
        logEvent("error", tSync("logMessages.errorAssigningCourt", { error: error.message }), "assignMatchToCourt", {
          error,
          matchId,
          courtNumber,
        })
        return false
      }

      logEvent("info", tSync("logMessages.matchAssignedToCourt", { matchId, court: courtNumber }), "assignMatchToCourt")
      return true
    } catch (err) {
      const fetchError = err as Error
      if (fetchError.name === "AbortError") {
        logEvent("error", tSync("logMessages.timeoutAssigningCourt"), "assignMatchToCourt")
      } else {
        logEvent("error", tSync("logMessages.supabaseQueryError", { error: fetchError.message }), "assignMatchToCourt", {
          error: fetchError,
          matchId,
          courtNumber,
        })
      }
      return false
    }
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorAssigningCourt", { error: error.message }), "assignMatchToCourt", {
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
//
// Фикс 2026-09-04 (тихий no-op под RLS): прямой anon-PATCH по matches после
// снятия pre-step3 write-политик (миграция 20260818030000) НЕ пишет ничего —
// PostgREST возвращает 200 с 0 строк и без ошибки, «Завершить» «успешно» не
// делал ничего. Теперь всё пишет серверный роут service-ключом:
// завершает ВСЕ активные матчи корта по любой привязке (court_number —
// легаси-числовые корты; court_id — именные/QR-корты, у них court_number
// равен null; баг 2026-08-16: матч с court_id-привязкой висел на корте).
// court_id в строке НЕ трогаем — история помнит корт, а /c/{code} больше не
// показывает завершённые (фильтр isCompleted).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const freeUpCourt = async (courtNumber: any) => {
  try {
    logEvent("info", tSync("logMessages.freeingCourt", { court: courtNumber }), "freeUpCourt")

    const courtNum = Number.parseInt(String(courtNumber), 10)
    if (Number.isNaN(courtNum)) {
      logEvent("warn", `Некорректный номер корта: ${courtNumber}`, "freeUpCourt", { courtNumber })
      return false
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const res = await fetch("/api/courts/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber: courtNum }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        logEvent("error", `free-court API http_${res.status}: ${body?.message ?? body?.error ?? ""}`, "freeUpCourt", {
          courtNumber,
        })
        return false
      }

      const data = (await res.json().catch(() => ({}))) as { completed?: number; total?: number }
      if (
        typeof data.completed !== "number" ||
        typeof data.total !== "number" ||
        data.completed !== data.total
      ) {
        logEvent("warn", tSync("logMessages.matchOnCourtNotFound"), "freeUpCourt", { courtNumber, ...data })
        return false
      }

      logEvent(
        "info",
        `Корт ${courtNumber} освобождён: завершено матчей — ${data.completed} из ${data.total ?? data.completed}`,
        "freeUpCourt",
      )
      return true
    } catch (err) {
      clearTimeout(timeoutId)
      const fetchError = err as Error
      if (fetchError.name === "AbortError") {
        logEvent("error", tSync("logMessages.timeoutFreeingCourt"), "freeUpCourt")
      } else {
        logEvent("error", tSync("logMessages.supabaseQueryError", { error: fetchError.message }), "freeUpCourt", {
          error: fetchError,
          courtNumber,
        })
      }
      return false
    }
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorFreeingCourt", { error: error.message }), "freeUpCourt", {
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
