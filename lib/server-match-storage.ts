import { createServerSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"
import { tSync } from "./log-i18n"
import { matchFromRow } from "./match-supabase"

// Единый источник преобразования row → match — lib/match-supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformMatchFromSupabase = (match: any) => matchFromRow(match)

// Получение конкретного матча по ID (серверная версия)
export const getMatchFromServer = async (id: string) => {
  try {
    logEvent("info", tSync("logMessages.gettingMatchServer", { id }), "getMatchFromServer")

    // Серверный клиент с service-role ключом (без cookie/auth-helpers).
    const supabase = createServerSupabaseClient()

    // Получаем матч из Supabase
    const lookupKey = /^\d{11}$/.test(id) ? "extras->>code" : "id"
    const { data, error, status } = await supabase.from("matches").select("*").eq(lookupKey, id).single()

    if (error) {
      logEvent("error", tSync("logMessages.errorMatchFromSupabase", { error: error.message }), "getMatchFromServer", {
        error,
        status,
        matchId: id,
      })
      return null
    }

    if (!data) {
      logEvent("warn", tSync("logMessages.matchNotFoundSupabase"), "getMatchFromServer", { matchId: id })
      return null
    }

    logEvent("info", tSync("logMessages.matchGotServer"), "getMatchFromServer", { matchId: id })

    // Преобразуем данные из Supabase
    const match = transformMatchFromSupabase(data)

    // Убедимся, что структура матча полная
    if (!match.score.sets) {
      match.score.sets = []
      logEvent("warn", tSync("logMessages.initEmptySetsSupabase"), "getMatchFromServer", {
        matchId: id,
      })
    }

    return match
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorGettingMatch", { error: error.message }), "getMatchFromServer", {
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
export const getMatchFromServerByCourtNumber = async (courtNumber: number) => {
  try {
    logEvent("info", tSync("logMessages.gettingMatchByCourtServer", { court: courtNumber }), "getMatchFromServerByCourtNumber")

    // Серверный клиент с service-role ключом (без cookie/auth-helpers).
    const supabase = createServerSupabaseClient()

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
      logEvent("error", tSync("logMessages.errorMatchFromSupabase", { error: error.message }), "getMatchFromServerByCourtNumber", {
        error,
        status,
        courtNumber,
      })
      return null
    }

    if (!data) {
      logEvent("warn", tSync("logMessages.matchNotFoundSupabase"), "getMatchFromServerByCourtNumber", { courtNumber })
      return null
    }

    logEvent("info", tSync("logMessages.matchGotByCourtServer"), "getMatchFromServerByCourtNumber", {
      matchId: data.id,
      courtNumber,
      isCompleted: data.is_completed,
    })

    // Преобразуем данные из Supabase
    const match = transformMatchFromSupabase(data)

    // Убедимся, что структура матча полная
    if (!match.score.sets) {
      match.score.sets = []
      logEvent("warn", tSync("logMessages.initEmptySetsSupabase"), "getMatchFromServerByCourtNumber", {
        matchId: data.id,
        courtNumber,
      })
    }

    return match
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorGettingMatch", { error: error.message }), "getMatchFromServerByCourtNumber", {
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

/**
 * Резолв матча для корта из реестра (Шаг 2, §246/§247).
 *
 * Порядок попыток: активный матч по court_id → (для legacy-кортов) активный
 * по court_number → завершённый по court_id → завершённый по court_number.
 * Для нечисловых кортов работает только court_id — матчи привязываются
 * командой assign-court с аргументом courtId.
 */
export const getMatchFromServerByCourt = async (court: {
  id: string
  legacyNumber: number | null
}) => {
  try {
    const supabase = createServerSupabaseClient()

    const tryFetch = async (useCourtId: boolean, completed: boolean) => {
      let query = supabase
        .from("matches")
        .select("*")
        .eq("is_completed", completed)
        .order("created_at", { ascending: false })
        .limit(1)
      query = useCourtId
        ? query.eq("court_id", court.id)
        : query.eq("court_number", court.legacyNumber as number)
      return query.maybeSingle()
    }

    const attempts: Array<Promise<{ data: any; error: any }>> = [
      tryFetch(true, false),
    ]
    if (court.legacyNumber !== null) attempts.push(tryFetch(false, false))
    attempts.push(tryFetch(true, true))
    if (court.legacyNumber !== null) attempts.push(tryFetch(false, true))

    for (const attempt of attempts) {
      const { data, error } = await attempt
      if (error) {
        logEvent("error", `getMatchFromServerByCourt: ${error.message}`, "getMatchFromServerByCourt", { courtId: court.id })
        return null
      }
      if (data) return transformMatchFromSupabase(data)
    }

    logEvent("warn", `Матч для корта ${court.id} не найден`, "getMatchFromServerByCourt")
    return null
  } catch (err) {
    const error = err as Error
    logEvent("error", `getMatchFromServerByCourt: ${error.message}`, "getMatchFromServerByCourt", { error })
    return null
  }
}
