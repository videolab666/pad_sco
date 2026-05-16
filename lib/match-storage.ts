// Функции для работы с хранилищем матчей
import { compressToUTF16, decompressFromUTF16 } from "lz-string"
import { createClientSupabaseClient, checkAndEnableRealtime } from "./supabase"
import { logEvent } from "./error-logger"
import { tSync } from "./log-i18n"
import { v4 as uuidv4 } from "uuid"
import { syncMatchToServer, initSyncRecovery, reconcileServerSnapshot } from "./match-sync"
import { clearSyncRecord } from "./match-operation-log"
import { backfillRuleMetadata } from "./match-rule-change"

// Максимальное количество хранимых матчей в локальном хранилище
const MAX_MATCHES = 10

// Простой кэш для матчей
const matchCache = new Map()
// Увеличим время жизни кэша с 5 секунд до 30 секунд
const CACHE_TTL = 30000 // 30 секунд вместо 5 секунд

// Добавим кэш для проверки доступности Supabase
let supabaseAvailabilityCache: { available: boolean | null, timestamp: number } = {
  available: null,
  timestamp: 0,
}

// Проверка валидности JSON строки
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isValidJSON = (str: string) => {
  try {
    JSON.parse(str)
    return true
  } catch (e) {
    return false
  }
}

// Безопасное получение данных из localStorage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const safeGetItem = (key: string, defaultValue: any = null) => {
  try {
    const item = localStorage.getItem(key)
    if (!item) return defaultValue

    // Пробуем распаковать сжатые данные
    try {
      const decompressed = decompressFromUTF16(item)
      // Проверяем, что распакованные данные - валидный JSON
      if (decompressed && isValidJSON(decompressed)) {
        return JSON.parse(decompressed)
      }
    } catch (decompressError) {
      logEvent("warn", tSync("logMessages.errorDecompress", { key }), "safeGetItem", decompressError)
    }

    // Если не удалось распаковать или данные не валидны,
    // проверяем, может быть это нормальный JSON
    if (isValidJSON(item)) {
      return JSON.parse(item)
    }

    // Если все проверки не прошли, возвращаем значение по умолчанию
    logEvent("warn", tSync("logMessages.dataCorrupted", { key }), "safeGetItem")
    return defaultValue
  } catch (error) {
    logEvent("error", tSync("logMessages.errorGetLocal", { key }), "safeGetItem", error)
    return defaultValue
  }
}

// Безопасное сохранение данных в localStorage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const safeSetItem = (key: string, value: any) => {
  try {
    // Если value - объект, преобразуем его в JSON строку
    const stringValue = typeof value === "string" ? value : JSON.stringify(value)

    // Сжимаем данные
    const compressed = compressToUTF16(stringValue)

    // Сохраняем в localStorage
    localStorage.setItem(key, compressed)
    return true
  } catch (error) {
    logEvent("error", tSync("logMessages.errorSetLocal", { key }), "safeSetItem", error)
    return false
  }
}

// Изменим функцию transformMatchForSupabase, чтобы не отправлять поле code в Supabase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformMatchForSupabase = (match: any) => {
  // Добавляем логирование перед отправкой данных в Supabase
  console.log("Отправка данных в Supabase:", {
    shouldChangeSides: match.shouldChangeSides,
    should_change_sides: match.shouldChangeSides,
  })
  return {
    id: match.id,
    // Удаляем поле code, так как такого столбца нет в Supabase
    type: match.type,
    format: match.format,
    created_at: match.createdAt,
    settings: match.settings,
    team_a: match.teamA,
    team_b: match.teamB,
    score: match.score,
    current_server: match.currentServer,
    court_sides: match.courtSides,
    should_change_sides: match.shouldChangeSides,
    is_completed: match.isCompleted,
    winner: match.winner || null,
    court_number: match.courtNumber,
    created_via_court_link: match.created_via_court_link,
  }
}

// Сброс кэша доступности Supabase — вызывается при возврате связи/фокусе,
// чтобы не использовать устаревший offline-результат до 60 секунд (failure mode #2).
export const resetSupabaseAvailabilityCache = () => {
  supabaseAvailabilityCache = { available: null, timestamp: 0 }
}

// Инвалидация кэша конкретного матча — вызывается при локальной мутации,
// переподключении и успешной realtime/replay-доставке (failure mode #1, #10).
export const invalidateMatchCache = (idOrCode?: string) => {
  if (!idOrCode) {
    matchCache.clear()
    return
  }
  matchCache.delete(idOrCode)
}

// Обновим функцию transformMatchFromSupabase, добавив поле code
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformMatchFromSupabase = (match: any) => {
  return {
    id: match.id,
    code: match.code,
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
    revision: typeof match.revision === "number" ? match.revision : 0,
    history: [],
  }
}

// Изменим функцию getMatches, чтобы она гарантированно возвращала все матчи, включая незавершенные
export const getMatches = async () => {
  if (typeof window === "undefined") return []

  try {
    logEvent("info", tSync("logMessages.gettingMatches"), "getMatches")

    // Проверяем доступность Supabase
    const supabaseAvailable = await isSupabaseAvailable()

    if (supabaseAvailable) {
      // Проверяем существование таблиц
      const tablesStatus = await checkTablesExist()

      if (tablesStatus.exists) {
        logEvent("debug", tSync("logMessages.supabaseAvailableGetting"), "getMatches")
        const supabase = createClientSupabaseClient()

        // Оптимизация: выбираем только нужные поля и увеличиваем лимит до 50 матчей
        // Важно: НЕ фильтруем по is_completed, чтобы получить ВСЕ матчи
        const { data, error, status } = await supabase
          .from("matches")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50) // Увеличиваем лимит с 20 до 50

        if (error) {
          logEvent("error", tSync("logMessages.errorMatchFromSupabase", { error: error.message }), "getMatches", {
            error,
            status,
          })
        } else if (data && data.length > 0) {
          logEvent("info", tSync("logMessages.restoredFromLocal", { count: data.length }), "getMatches")

          // Преобразуем данные из Supabase в нужный формат с проверкой на undefined
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const matches = data.map((match: any) => {
            // Безопасное получение данных с проверкой на undefined
            const teamAPlayers = match.team_a?.players || []
            const teamBPlayers = match.team_b?.players || []
            const scoreTeamA = match.score?.teamA || 0
            const scoreTeamB = match.score?.teamB || 0

            return {
              created_via_court_link: match.created_via_court_link,
              id: match.id,
              code: match.code,
              type: match.type,
              format: match.format,
              createdAt: match.created_at,
              teamA: {
                players: teamAPlayers,
              },
              teamB: {
                players: teamBPlayers,
              },
              score: {
                teamA: scoreTeamA,
                teamB: scoreTeamB,
                // Добавляем информацию о сетах
                sets: match.score?.sets || [],
                currentSet: match.score?.currentSet || null,
              },
              isCompleted: match.is_completed,
              winner: match.winner,
              courtNumber: match.court_number,
            }
          })

          return matches
        } else {
          logEvent("info", tSync("logMessages.matchesNotFoundInSupabase"), "getMatches")
        }
      } else {
        logEvent("warn", tSync("logMessages.tablesNotExistUseLocal"), "getMatches")
      }
    } else {
      logEvent("warn", tSync("logMessages.supabaseUnavailableUseLocal"), "getMatches")
    }

    // Если Supabase недоступен или нет матчей, используем локальное хранилище
    const matches = safeGetItem("tennis_padel_matches", [])

    // Проверяем, есть ли в локальном хранилище матчи
    if (!matches || matches.length === 0) {
      // Если нет, попробуем найти матчи по всем ключам в localStorage
      const allMatches = findAllMatchesInLocalStorage()
      if (allMatches.length > 0) {
        // Сохраняем найденные матчи в основное хранилище для будущего использования
        safeSetItem("tennis_padel_matches", allMatches)
        logEvent("info", tSync("logMessages.restoredFromLocal", { count: allMatches.length }), "getMatches")
        return allMatches
      }
    }

    logEvent("info", tSync("logMessages.gotFromLocal", { count: matches.length }), "getMatches")
    return matches || []
  } catch (error) {
    logEvent("error", tSync("logMessages.errorGettingMatches"), "getMatches", error)
    return []
  }
}

// Добавим новую функцию для поиска всех матчей в localStorage
const findAllMatchesInLocalStorage = () => {
  try {
    const foundMatches = []

    // Перебираем все ключи в localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("match_")) {
        try {
          const item = localStorage.getItem(key)
          if (item) {
            // Пробуем распаковать, если это сжатые данные
            try {
              const decompressed = decompressFromUTF16(item)
              if (decompressed && isValidJSON(decompressed)) {
                const match = JSON.parse(decompressed)
                if (match && match.id) {
                  // Добавляем только основную информацию о матче
                  foundMatches.push({
                    id: match.id,
                    code: match.code,
                    type: match.type,
                    format: match.format,
                    createdAt: match.createdAt,
                    teamA: {
                      players: match.teamA.players,
                    },
                    teamB: {
                      players: match.teamB.players,
                    },
                    score: {
                      teamA: match.score?.teamA || 0,
                      teamB: match.score?.teamB || 0,
                      // Добавляем информацию о сетах
                      sets: match.score?.sets || [],
                      currentSet: match.score?.currentSet || null,
                    },
                    isCompleted: match.isCompleted,
                    courtNumber: match.courtNumber,
                  })
                }
              }
            } catch (e) {
              // Если не удалось распаковать, пробуем как обычный JSON
              if (isValidJSON(item)) {
                const match = JSON.parse(item)
                if (match && match.id) {
                  foundMatches.push({
                    id: match.id,
                    code: match.code,
                    type: match.type,
                    format: match.format,
                    createdAt: match.createdAt,
                    teamA: {
                      players: match.teamA.players,
                    },
                    teamB: {
                      players: match.teamB.players,
                    },
                    score: {
                      teamA: match.score.teamA,
                      teamB: match.score.teamB,
                    },
                    isCompleted: match.isCompleted,
                    courtNumber: match.courtNumber,
                  })
                }
              }
            }
          }
        } catch (e) {
          logEvent("warn", tSync("logMessages.errorProcessingKey", { key }), "findAllMatchesInLocalStorage", e)
        }
      }
    }

    // Сортируем матчи по дате создания (от новых к старым)
    foundMatches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return foundMatches
  } catch (error) {
    logEvent("error", tSync("logMessages.errorSearchLocal"), "findAllMatchesInLocalStorage", error)
    return []
  }
}

// Изменим функцию getMatch, чтобы не искать по коду в Supabase
export const getMatch = async (idOrCode: string) => {
  if (typeof window === "undefined") return null

  try {
    logEvent("info", tSync("logMessages.gettingMatchById", { id: idOrCode }), "getMatch")

    // Проверяем кэш
    if (matchCache.has(idOrCode)) {
      const { data, timestamp } = matchCache.get(idOrCode)
      // Если кэш не устарел
      if (Date.now() - timestamp < CACHE_TTL) {
        logEvent("debug", tSync("logMessages.matchFromCache", { id: idOrCode }), "getMatch")
        return data
      }
    }

    // Проверяем доступность Supabase
    const supabaseAvailable = await isSupabaseAvailable()

    if (supabaseAvailable) {
      // Проверяем существование таблиц
      const tablesStatus = await checkTablesExist()

      if (tablesStatus.exists) {
        logEvent("debug", tSync("logMessages.supabaseAvailableGettingMatch"), "getMatch")
        const supabase = createClientSupabaseClient()

        // Проверяем, похоже ли idOrCode на UUID
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

        // Если это UUID, ищем по ID в Supabase
        if (uuidPattern.test(idOrCode)) {
          const { data, error, status } = await supabase.from("matches").select("*").eq("id", idOrCode).single()

          if (error) {
            logEvent("error", tSync("logMessages.errorMatchFromSupabase", { error: error.message }), "getMatch", {
              error,
              status,
              matchIdOrCode: idOrCode,
            })
          } else if (data) {
            logEvent("info", tSync("logMessages.matchGotFromSupabase"), "getMatch", { matchIdOrCode: idOrCode })
            // Преобразуем данные из Supabase
            const match = transformMatchFromSupabase(data)

            // Бэкфилл недостающих правил для старых матчей (Task 7).
            backfillRuleMetadata(match)

            // Засеваем журнал операций ревизией с сервера, чтобы первая локальная
            // запись не вызвала ложный конфликт (boot snapshot reconciliation).
            reconcileServerSnapshot(match)

            // Добавляем код для локального использования, если его нет
            if (!match.code) {
              match.code = generateNumericCode()
            }

            // Убедимся, что структура матча полная
            if (!match.score.sets) {
              match.score.sets = []
              logEvent("warn", tSync("logMessages.initEmptySetsSupabase"), "getMatch", {
                matchIdOrCode: idOrCode,
              })
            }

            // Загружаем информацию о странах игроков
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const playerIds = [
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ...match.teamA.players.map((p: any) => p.id),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ...match.teamB.players.map((p: any) => p.id),
              ].filter((id, index, self) => self.indexOf(id) === index) // Убираем дубликаты

              if (playerIds.length > 0) {
                // Получаем информацию о странах игроков
                const { data: playersData, error: playersError } = await supabase
                  .from("players")
                  .select("id, country")
                  .in("id", playerIds)

                if (!playersError && playersData) {
                  // Создаем карту игрок ID -> страна
                  const playerCountryMap: Record<string, string> = {}
                  playersData.forEach((player: any) => {
                    if (player.country) {
                      playerCountryMap[player.id] = player.country
                    }
                  })

                  // Обновляем информацию о странах в объекте матча
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  match.teamA.players.forEach((player: any) => {
                    if (playerCountryMap[player.id]) {
                      player.country = playerCountryMap[player.id]
                    }
                  })

                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  match.teamB.players.forEach((player: any) => {
                    if (playerCountryMap[player.id]) {
                      player.country = playerCountryMap[player.id]
                    }
                  })

                  logEvent("info", tSync("logMessages.playerCountriesLoaded"), "getMatch", {
                    matchIdOrCode: idOrCode,
                  })
                } else {
                  logEvent("warn", tSync("logMessages.playerCountriesLoadFailed"), "getMatch", {
                    matchIdOrCode: idOrCode,
                    error: playersError,
                  })
                  // Возвращаем матч без информации о странах, чтобы не терять актуальное состояние
                  matchCache.set(match.id, { data: match, timestamp: Date.now() })
                  if (match.code) {
                    matchCache.set(match.code, { data: match, timestamp: Date.now() })
                  }
                  return match;
                }
              }
            } catch (countryError) {
               logEvent("error", tSync("logMessages.playerCountriesError"), "getMatch", {
                error: countryError,
                matchIdOrCode: idOrCode,
              })
              // Возвращаем матч без информации о странах, чтобы не терять актуальное состояние
              matchCache.set(match.id, { data: match, timestamp: Date.now() })
              if (match.code) {
                matchCache.set(match.code, { data: match, timestamp: Date.now() })
              }
              return match;
            }

            // Сохраняем в кэш по ID и по коду
            matchCache.set(match.id, { data: match, timestamp: Date.now() })
            if (match.code) {
              matchCache.set(match.code, { data: match, timestamp: Date.now() })
            }

            return match
          } else {
            logEvent("warn", tSync("logMessages.matchNotFoundSupabase"), "getMatch", { matchIdOrCode: idOrCode })
          }
        }
        // Если это не UUID, то это цифровой код, и мы не можем искать по нему в Supabase
        // Продолжаем поиск в локальном хранилище
      } else {
        logEvent("warn", tSync("logMessages.tablesNotExistUseLocal"), "getMatch")
      }
    } else {
      logEvent("warn", tSync("logMessages.supabaseUnavailableUseLocal"), "getMatch")
    }

    // Если Supabase недоступен или матч не найден, используем локальное хранилище
    // Сначала проверяем, есть ли матч с таким ID или кодом
    const singleMatchKey = `match_${idOrCode}`
    const match = safeGetItem(singleMatchKey, null)

    if (match) {
      logEvent("info", tSync("logMessages.matchFoundLocal"), "getMatch", { matchIdOrCode: idOrCode, source: "direct" })
      // Убедимся, что структура матча полная
      if (!match.score.sets) {
        match.score.sets = []
        logEvent("warn", tSync("logMessages.initEmptySetsLocal"), "getMatch", {
          matchIdOrCode: idOrCode,
        })
      }

      // Бэкфилл недостающих правил для старых матчей (Task 7).
      backfillRuleMetadata(match)

      // Сохраняем в кэш
      matchCache.set(idOrCode, { data: match, timestamp: Date.now() })
      if (match.id !== idOrCode && match.id) {
        matchCache.set(match.id, { data: match, timestamp: Date.now() })
      }
      if (match.code && match.code !== idOrCode) {
        matchCache.set(match.code, { data: match, timestamp: Date.now() })
      }

      return match
    }

    // Если нет, ищем в общем списке по ID или коду
    const matches = safeGetItem("tennis_padel_matches", [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const foundMatch = matches.find((m: any) => m.id === idOrCode || m.code === idOrCode) || null

    if (foundMatch) {
      logEvent("info", tSync("logMessages.matchFoundInList"), "getMatch", {
        matchIdOrCode: idOrCode,
        source: "list",
      })
      // Убедимся, что структура матча полная
      if (!foundMatch.score.sets) {
        foundMatch.score.sets = []
        logEvent("warn", tSync("logMessages.initEmptySetsList"), "getMatch", {
          matchIdOrCode: idOrCode,
        })
      }

      // Бэкфилл недостающих правил для старых матчей (Task 7).
      backfillRuleMetadata(foundMatch)

      // Сохраняем в кэш
      matchCache.set(idOrCode, { data: foundMatch, timestamp: Date.now() })
      if (foundMatch.id !== idOrCode && foundMatch.id) {
        matchCache.set(foundMatch.id, { data: foundMatch, timestamp: Date.now() })
      }
      if (foundMatch.code && foundMatch.code !== idOrCode) {
        matchCache.set(foundMatch.code, { data: foundMatch, timestamp: Date.now() })
      }
    } else {
      logEvent("warn", tSync("logMessages.matchNotFoundAnywhere"), "getMatch", {
        matchIdOrCode: idOrCode,
      })
    }

    return foundMatch
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorGettingMatch", { error: error.message }), "getMatch", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      matchIdOrCode: idOrCode,
    })
    return null
  }
}

// Очистка старых матчей при приближении к лимиту
const cleanupStorage = () => {
  try {
    // Получаем все матчи
    const matches = safeGetItem("tennis_padel_matches", [])

    // Если матчей больше максимального количества, удаляем самые старые
    if (matches.length > MAX_MATCHES) {
      logEvent("info", tSync("logMessages.cleaningStorage", { count: matches.length, limit: MAX_MATCHES }), "cleanupStorage")

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      matches.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      // Оставляем только MAX_MATCHES матчей\
      const updatedMatches = matches.slice(0, MAX_MATCHES)

      // Сохраняем обновленный список
      safeSetItem("tennis_padel_matches", updatedMatches)

      // Удаляем отдельные записи для старых матчей
      const deletedMatches = matches.slice(MAX_MATCHES)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deletedMatches.forEach((match: any) => {
        localStorage.removeItem(`match_${match.id}`)
        if (match.code) {
          localStorage.removeItem(`match_${match.code}`)
        }
        logEvent("debug", tSync("logMessages.deletedOldMatch", { id: match.id }), "cleanupStorage")
      })
    }

    return true
  } catch (error) {
    logEvent("error", tSync("logMessages.errorCleaningStorage"), "cleanupStorage", error)
    return false
  }
}

// Генерация 11-значного цифрового кода
const generateNumericCode = () => {
  let numericCode = ""
  for (let i = 0; i < 11; i++) {
    numericCode += Math.floor(Math.random() * 10).toString()
  }
  return numericCode
}

// Создание нового матча
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createMatch = async (match: any) => {
  if (typeof window === "undefined") return null

  try {
    logEvent("info", tSync("logMessages.creatingMatch"), "createMatch", { matchId: match.id, type: match.type })

    // Инициализируем пустую историю
    match.history = []

    // Убедимся, что структура матча полная
    if (!match.score.sets) {
      match.score.sets = []
      logEvent("debug", tSync("logMessages.initEmptySetsNew"), "createMatch")
    }

    // Создаем новый матч с UUID для Supabase и цифровым кодом для пользователей
    const newMatch = {
      id: uuidv4(), // UUID для Supabase
      code: generateNumericCode(), // 11-значный цифровой код для пользователей
      type: match.type,
      format: match.format,
      createdAt: match.createdAt,
      settings: match.settings,
      teamA: match.teamA,
      teamB: match.teamB,
      score: match.score,
      currentServer: match.currentServer,
      courtSides: match.courtSides,
      shouldChangeSides: match.shouldChangeSides,
      isCompleted: match.isCompleted,
      winner: match.winner || null,
      courtNumber: match.courtNumber,
      created_via_court_link: match.created_via_court_link,
    }

    // Проверяем доступность Supabase
    const supabaseAvailable = await isSupabaseAvailable()

    if (supabaseAvailable) {
      // Проверяем существование таблиц
      const tablesStatus = await checkTablesExist()

      if (tablesStatus.exists) {
        // Проверяем и включаем Realtime
        await checkAndEnableRealtime()

        logEvent("debug", tSync("logMessages.supabaseAvailableSaving"), "createMatch")
        const supabase = createClientSupabaseClient()
        const transformedMatch = transformMatchForSupabase(newMatch)
        const { error, status, statusText } = await supabase.from("matches").insert(transformedMatch)

        if (error) {
          logEvent("error", tSync("logMessages.errorSavingSupabase", { error: error.message }), "createMatch", {
            error,
            status,
            statusText,
            matchId: newMatch.id,
            matchCode: newMatch.code,
          })
          // Явный вывод ошибки в консоль для быстрой отладки
          console.error("Ошибка Supabase:", error, { status, statusText, transformedMatch });
        } else {
          logEvent("info", tSync("logMessages.matchSavedSupabase"), "createMatch", {
            matchId: newMatch.id,
            matchCode: newMatch.code,
          })

          // Добавляем в кэш по ID и коду
          matchCache.set(newMatch.id, { data: newMatch, timestamp: Date.now() })
          matchCache.set(newMatch.code, { data: newMatch, timestamp: Date.now() })
        }
      } else {
        logEvent("warn", tSync("logMessages.tablesNotExistSaveLocal"), "createMatch")
      }
    } else {
      logEvent("warn", tSync("logMessages.supabaseUnavailableSaveLocal"), "createMatch")
    }

    // Всегда сохраняем в локальное хранилище как резервную копию
    // Очищаем локальное хранилище перед добавлением нового матча
    cleanupStorage()

    // Сохраняем в локальное хранилище по ID и коду
    const singleMatchKeyId = `match_${newMatch.id}`
    safeSetItem(singleMatchKeyId, newMatch)

    const singleMatchKeyCode = `match_${newMatch.code}`
    safeSetItem(singleMatchKeyCode, newMatch)

    // Добавляем в общий список без истории и детальных данных
    const matchSummary = {
      id: newMatch.id,
      code: newMatch.code,
      type: newMatch.type,
      format: newMatch.format,
      createdAt: newMatch.createdAt,
      teamA: {
        players: newMatch.teamA.players,
      },
      teamB: {
        players: newMatch.teamB.players,
      },
      score: {
        teamA: newMatch.score.teamA,
        teamB: newMatch.score.teamB,
      },
      isCompleted: newMatch.isCompleted,
      courtNumber: newMatch.courtNumber,
      created_via_court_link: newMatch.created_via_court_link,
    }

    const matches = safeGetItem("tennis_padel_matches", [])
    matches.unshift(matchSummary)
    safeSetItem("tennis_padel_matches", matches)

    // Уведомляем другие вкладки об изменении
    window.dispatchEvent(new Event("storage"))

    logEvent("info", tSync("logMessages.matchSavedLocal"), "createMatch", {
      matchId: newMatch.id,
      matchCode: newMatch.code,
    })

    // Возвращаем код матча для пользовательского интерфейса
    return newMatch.code
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    logEvent("error", tSync("logMessages.errorCreatingMatch", { error: error.message }), "createMatch", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      matchId: match?.id,
    })
    return null
  }
}

// Обновление существующего матча
// Оптимизируем функцию updateMatch для более быстрой работы
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const updateMatch = async (updatedMatch: any) => {
  if (typeof window === "undefined") return false

  try {
    // Отключаем избыточное логирование в продакшене
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Updating match: ${updatedMatch.id}`)
    }

    // Убираем историю для экономии места
    updatedMatch.history = []

    // Убедимся, что структура матча полная
    if (!updatedMatch.score.sets) {
      updatedMatch.score.sets = []
    }

    // Обновляем кэш немедленно для быстрого доступа
    matchCache.set(updatedMatch.id, { data: updatedMatch, timestamp: Date.now() })
    if (updatedMatch.code) {
      matchCache.set(updatedMatch.code, { data: updatedMatch, timestamp: Date.now() })
    }

    // Сохраняем в локальное хранилище сразу для быстрого доступа
    const singleMatchKeyId = `match_${updatedMatch.id}`
    const singleMatchKeyCode = updatedMatch.code ? `match_${updatedMatch.code}` : null

    try {
      safeSetItem(singleMatchKeyId, updatedMatch)
      if (singleMatchKeyCode) {
        safeSetItem(singleMatchKeyCode, updatedMatch)
      }
    } catch (storageError) {
      // Если не удалось сохранить полные данные, сохраняем только самое необходимое
      const essentialMatchData = {
        id: updatedMatch.id,
        code: updatedMatch.code,
        type: updatedMatch.type,
        format: updatedMatch.format,
        createdAt: updatedMatch.createdAt,
        settings: updatedMatch.settings,
        teamA: updatedMatch.teamA,
        teamB: updatedMatch.teamB,
        score: updatedMatch.score,
        currentServer: updatedMatch.currentServer,
        courtSides: updatedMatch.courtSides,
        shouldChangeSides: updatedMatch.shouldChangeSides,
        isCompleted: updatedMatch.isCompleted,
        courtNumber: updatedMatch.courtNumber,
        history: [],
      }

      // Удаляем историю геймов для экономии места
      if (essentialMatchData.score && essentialMatchData.score.currentSet) {
        essentialMatchData.score.currentSet.games = []
      }

      if (essentialMatchData.score && essentialMatchData.score.sets) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        essentialMatchData.score.sets = essentialMatchData.score.sets.map((set: any) => ({
          teamA: set.teamA,
          teamB: set.teamB,
          winner: set.winner,
          games: [],
        }))
      }

      safeSetItem(singleMatchKeyId, essentialMatchData)
      if (singleMatchKeyCode) {
        safeSetItem(singleMatchKeyCode, essentialMatchData)
      }
    }

    // Обновляем запись в общем списке
    const matches = safeGetItem("tennis_padel_matches", [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const index = matches.findIndex((match: any) => match.id === updatedMatch.id || match.code === updatedMatch.code)

    if (index !== -1) {
      matches[index] = {
        id: updatedMatch.id,
        code: updatedMatch.code,
        type: updatedMatch.type,
        format: updatedMatch.format,
        createdAt: updatedMatch.createdAt,
        teamA: {
          players: updatedMatch.teamA.players,
        },
        teamB: {
          players: updatedMatch.teamB.players,
        },
        score: {
          teamA: updatedMatch.score.teamA,
          teamB: updatedMatch.score.teamB,
          // Добавляем информацию о сетах
          sets: updatedMatch.score.sets || [],
          currentSet: updatedMatch.score.currentSet || null,
        },
        isCompleted: updatedMatch.isCompleted,
        courtNumber: updatedMatch.courtNumber,
      }

      safeSetItem("tennis_padel_matches", matches)
    }

    // Durable sync: persist the change as an idempotent, revisioned operation
    // and let the sync engine replay it (offline-safe, retry, conflict-aware).
    // Local storage above is already authoritative; this never blocks the UI.
    syncMatchToServer(updatedMatch)

    return true
  } catch (err) {
    const error = err as Error
    // Отключаем избыточное логирование в продакшене
    if (process.env.NODE_ENV !== 'production') {
      console.error(`Critical error updating match: ${error.message}`)
    }
    throw error
  }
}

// Новая функция для частичного обновления матча - отправляет только измененные поля
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const updateMatchPartial = async (matchId: string, partialData: any) => {
  if (typeof window === "undefined") return false

  try {
    // Получаем текущий матч из кэша, если он там есть
    const cachedMatch = matchCache.get(matchId)
    let currentMatch = cachedMatch?.data

    // Если матч не найден в кэше, получаем его
    if (!currentMatch) {
      currentMatch = await getMatch(matchId)
      if (!currentMatch) {
        return false
      }
    }

    // Создаем обновленный матч, объединяя текущий матч с частичными данными
    const updatedMatch = {
      ...currentMatch,
      ...partialData,
    }

    // Обновляем кэш немедленно для быстрого доступа
    matchCache.set(updatedMatch.id, { data: updatedMatch, timestamp: Date.now() })
    if (updatedMatch.code) {
      matchCache.set(updatedMatch.code, { data: updatedMatch, timestamp: Date.now() })
    }

    // Durable sync: route the merged snapshot through the revisioned sync
    // engine instead of a blind snake_case shallow merge. This avoids the
    // partial-overwrite bug where nested camelCase keys (score, currentServer)
    // were never converted and could silently corrupt remote state.
    syncMatchToServer(updatedMatch)

    // Сохраняем в локальное хранилище сразу для быстрого доступа
    const singleMatchKeyId = `match_${updatedMatch.id}`
    const singleMatchKeyCode = updatedMatch.code ? `match_${updatedMatch.code}` : null

    try {
      safeSetItem(singleMatchKeyId, updatedMatch)
      if (singleMatchKeyCode) {
        safeSetItem(singleMatchKeyCode, updatedMatch)
      }
    } catch (storageError) {
      // В случае ошибки при сохранении, сохраняем только основные данные
      const essentialMatchData = {
        ...updatedMatch,
        history: [], // Убираем историю для экономии места
      }

      safeSetItem(singleMatchKeyId, essentialMatchData)
      if (singleMatchKeyCode) {
        safeSetItem(singleMatchKeyCode, essentialMatchData)
      }
    }

    return true
  } catch (err) {
    const error = err as Error
    if (process.env.NODE_ENV !== 'production') {
      console.error(`Error updating match partially: ${error.message}`)
    }
    return false
  }
}

// Удаление матча
export const deleteMatch = async (idOrCode: string) => {
  if (typeof window === "undefined") return false

  try {
    logEvent("info", tSync("logMessages.deletingMatch", { id: idOrCode }), "deleteMatch")

    // Получаем полную информацию о матче, чтобы иметь и ID, и код
    const match = await getMatch(idOrCode)
    if (!match) {
      logEvent("warn", tSync("logMessages.matchNotFoundForDelete", { id: idOrCode }), "deleteMatch")
      return false
    }

    // Удаляем из кэша по ID и коду
    matchCache.delete(match.id)
    if (match.code) {
      matchCache.delete(match.code)
    }

    // Проверяем доступность Supabase
    const supabaseAvailable = await isSupabaseAvailable()

    if (supabaseAvailable) {
      // Проверяем существование таблиц
      const tablesStatus = await checkTablesExist()

      if (tablesStatus.exists) {
        logEvent("debug", tSync("logMessages.supabaseAvailableDeleting"), "deleteMatch")
        const supabase = createClientSupabaseClient()
        const { error } = await supabase.from("matches").delete().eq("id", match.id)

        if (error) {
          logEvent("error", tSync("logMessages.errorDeletingSupabase", { error: error.message }), "deleteMatch", {
            error,
            matchId: match.id,
            matchCode: match.code,
          })
        } else {
          logEvent("info", tSync("logMessages.matchDeletedSupabase"), "deleteMatch", {
            matchId: match.id,
            matchCode: match.code,
          })
        }
      } else {
        logEvent("warn", tSync("logMessages.tablesNotExistDeleteLocal"), "deleteMatch")
      }
    } else {
      logEvent("warn", tSync("logMessages.supabaseUnavailableDeleteLocal"), "deleteMatch")
    }

    // Удаляем отдельные записи матча из локального хранилища
    localStorage.removeItem(`match_${match.id}`)
    if (match.code) {
      localStorage.removeItem(`match_${match.code}`)
    }

    // Удаляем журнал операций синхронизации, чтобы не реплеить удалённый матч.
    clearSyncRecord(match.id)
    if (match.code) clearSyncRecord(match.code)

    // Удаляем из общего списка
    const matches = safeGetItem("tennis_padel_matches", [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filteredMatches = matches.filter((m: any) => m.id !== match.id && m.code !== match.code)
    safeSetItem("tennis_padel_matches", filteredMatches)

    // Уведомляем другие вкладки об изменении
    window.dispatchEvent(new Event("storage"))

    logEvent("info", tSync("logMessages.matchDeletedLocal"), "deleteMatch", {
      matchId: match.id,
      matchCode: match.code,
    })
    return true
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorDeletingMatch", { error: error.message }), "deleteMatch", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      matchId: idOrCode,
    })
    return false
  }
}

// Подписка на обновления матча в реальном времени
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const subscribeToMatchUpdates = (idOrCode: string, callback: any) => {
  if (typeof window === "undefined") return () => { }

  let unsubscribe: (() => void) | null = null

  // Проверяем доступность Supabase
  isSupabaseAvailable().then(async (supabaseAvailable) => {
    if (supabaseAvailable) {
      // Проверяем существование таблиц
      const tablesStatus = await checkTablesExist()

      if (tablesStatus.exists) {
        // Проверяем и включаем Realtime
        await checkAndEnableRealtime()

        // Сначала получаем полную информацию о матче, чтобы иметь ID для подписки
        const match = await getMatch(idOrCode)
        if (!match) {
          logEvent("warn", tSync("logMessages.matchNotFoundForSubscribe", { id: idOrCode }), "subscribeToMatchUpdates")
          setupLocalSubscription()
          return
        }

        const matchId = match.id // Используем UUID для подписки в Supabase

        const supabase = createClientSupabaseClient()

        // Подписываемся на изменения матча в Supabase
        const channel = supabase
          .channel(`match-${matchId}`)
          .on(
            "postgres_changes",
            {
              event: "*", // Слушаем все события (INSERT, UPDATE, DELETE)
              schema: "public",
              table: "matches",
              filter: `id=eq.${matchId}`,
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            async (payload: any) => {
              logEvent("debug", tSync("logMessages.supabaseEventReceived", { id: matchId }), "subscribeToMatchUpdates", payload)

              if (payload.eventType === "DELETE") {
                // Если матч был удален
                matchCache.delete(matchId)
                if (match.code) {
                  matchCache.delete(match.code)
                }
                callback(null)
              } else {
                // Для INSERT или UPDATE получаем обновленные данные
                // Преобразуем данные из Supabase
                const updatedMatch = transformMatchFromSupabase(payload.new)

                // Держим журнал операций в актуальном состоянии по ревизии сервера.
                reconcileServerSnapshot(updatedMatch)

                // Обновляем кэш
                matchCache.set(matchId, { data: updatedMatch, timestamp: Date.now() })
                if (updatedMatch.code) {
                  matchCache.set(updatedMatch.code, { data: updatedMatch, timestamp: Date.now() })
                }

                callback(updatedMatch)
              }
            },
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .subscribe((status: any) => {
            logEvent("info", tSync("logMessages.subscribeStatus", { id: matchId, status }), "subscribeToMatchUpdates")
          })

        // Сохраняем функцию отписки
        unsubscribe = () => {
          logEvent("info", tSync("logMessages.unsubscribeMatch", { id: matchId }), "subscribeToMatchUpdates")
          supabase.removeChannel(channel)
        }
      } else {
        logEvent("warn", tSync("logMessages.tablesNotExistLocalSubscribe"), "subscribeToMatchUpdates")
        setupLocalSubscription()
      }
    } else {
      logEvent("warn", tSync("logMessages.supabaseUnavailableLocalSubscribe"), "subscribeToMatchUpdates")
      setupLocalSubscription()
    }
  })

  // Функция для настройки локальной подписки
  const setupLocalSubscription = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleStorageChange = async (event: any) => {
      if (event.key === `match_${idOrCode}` || event.key === "tennis_padel_matches" || !event.key) {
        const match = await getMatch(idOrCode)
        if (match) {
          callback(match)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)

    // Также настраиваем периодическую проверку обновлений
    const interval = setInterval(async () => {
      const match = await getMatch(idOrCode)
      if (match) {
        callback(match)
      }
    }, 3000) // Уменьшаем интервал до 3 секунд для более частых проверок

    // Обновляем функцию отписки
    unsubscribe = () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }

  // Возвращаем функцию отписки
  return () => {
    if (unsubscribe) unsubscribe()
  }
}

// Подписка на обновления списка матчей в реальном времени
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const subscribeToMatchesListUpdates = (callback: any) => {
  // Проверяем доступность Supabase
  isSupabaseAvailable().then(async (supabaseAvailable) => {
    if (supabaseAvailable) {
      // Проверяем существование таблиц
      const tablesStatus = await checkTablesExist()

      if (tablesStatus.exists) {
        // Проверяем и включаем Realtime
        await checkAndEnableRealtime()

        const supabase = createClientSupabaseClient()

        // Подписываемся на изменения списка матчей в Supabase
        const subscription = supabase
          .channel("matches-list")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "matches",
            },
            async () => {
              // При любом изменении в таблице матчей, получаем обновленный список
              const matches = await getMatches()
              callback(matches)
            },
          )
          .subscribe()

        // Возвращаем функцию для отписки
        return () => {
          supabase.removeChannel(subscription)
        }
      } else {
        logEvent(
          "warn",
          tSync("logMessages.tablesNotExistLocalSubscribe"),
          "subscribeToMatchesListUpdates",
        )
      }
    } else {
      logEvent("warn", tSync("logMessages.supabaseUnavailableLocalSubscribe"), "subscribeToMatchesListUpdates")
    }

    // Если Supabase недоступен или таблицы не существуют, настраиваем локальную подписку через событие storage
    const handleStorageChange = async () => {
      const matches = await getMatches()
      callback(matches)
    }

    window.addEventListener("storage", handleStorageChange)

    // Также настраиваем периодическую проверку обновлений
    const interval = setInterval(handleStorageChange, 5000)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  })

  // Возвращаем пустую функцию отписки по умолчанию
  return () => { }
}

// Сохранение матча в URL для шаринга
export const getMatchShareUrl = (idOrCode: string) => {
  if (typeof window === "undefined") return ""

  const baseUrl = window.location.origin
  return `${baseUrl}/match/${idOrCode}`
}

// Функция для экспорта матча в JSON
export const exportMatchToJson = async (idOrCode: string) => {
  if (typeof window === "undefined") return null

  try {
    const match = await getMatch(idOrCode)
    if (!match) return null

    // Создаем копию матча без истории для уменьшения размера
    const exportMatch = { ...match, history: [] }

    // Преобразуем в JSON
    return JSON.stringify(exportMatch)
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorExportingMatch", { error: error.message }), "exportMatchToJson", error)
    return null
  }
}

// Функция для импорта матча из JSON
export const importMatchFromJson = async (jsonData: string) => {
  if (typeof window === "undefined") return false

  try {
    // Проверяем, что jsonData - валидный JSON
    if (!isValidJSON(jsonData)) {
      throw new Error("Некорректный формат JSON")
    }

    const match = JSON.parse(jsonData)

    // Проверяем, что это валидный матч
    if (!match.id || !match.teamA || !match.teamB || !match.score) {
      throw new Error("Некорректный формат данных матча")
    }

    // Убедимся, что структура матча полная
    if (!match.score.sets) {
      match.score.sets = []
    }

    // Добавляем код, если его нет
    if (!match.code) {
      match.code = generateNumericCode()
    }

    // Сохраняем импортированный матч
    await createMatch(match)
    return match.code || match.id
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorImportingMatch", { error: error.message }), "importMatchFromJson", error)
    return false
  }
}

// Добавьте или обновите функцию getAllMatches, если она уже существует

export async function getAllMatches() {
  if (typeof window === "undefined") return []

  try {
    logEvent("info", tSync("logMessages.gettingAllMatches"), "getAllMatches")

    // Сначала пробуем получить матчи через основную функцию getMatches
    const matches = await getMatches()

    if (matches && matches.length > 0) {
      logEvent("info", tSync("logMessages.gotFromLocal", { count: matches.length }), "getAllMatches")

      // Преобразуем формат данных для совместимости с компонентом истории
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return matches.map((match: any) => ({
        id: match.id,
        code: match.code,
        date: match.createdAt || new Date().toISOString(),
        team1: {
          player1: match.teamA?.players?.[0]?.name || "Игрок 1",
          player2: match.teamA?.players?.[1]?.name || "Игрок 2",
          score: match.score?.teamA || 0,
        },
        team2: {
          player1: match.teamB?.players?.[0]?.name || "Игрок 3",
          player2: match.teamB?.players?.[1]?.name || "Игрок 4",
          score: match.score?.teamB || 0,
        },
        completed: match.isCompleted || false,
        courtNumber: match.courtNumber || null,
      }))
    }

    // Если основной метод не вернул матчи, пробуем альтернативные ключи
    const alternativeKeys = ["padelMatches", "tennis_padel_matches", "matches"]

    for (const key of alternativeKeys) {
      const savedMatches = localStorage.getItem(key)
      if (savedMatches) {
        try {
          const parsedMatches = JSON.parse(savedMatches)
          if (Array.isArray(parsedMatches) && parsedMatches.length > 0) {
            logEvent("info", tSync("logMessages.gotFromLocal", { count: parsedMatches.length }), "getAllMatches")
            return parsedMatches
          }
        } catch (e) {
          logEvent("warn", tSync("logMessages.errorProcessingKey", { key }), "getAllMatches", e)
        }
      }
    }

    // Если ничего не нашли, проверяем все ключи в localStorage на наличие матчей
    if (typeof localStorage !== "undefined") {
      logEvent("debug", tSync("logMessages.errorSearchLocal"), "getAllMatches")

      // Создаем временный массив для хранения найденных матчей
      const foundMatches = []

      // Перебираем все ключи в localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith("match_") || key.includes("match") || key.includes("padel"))) {
          try {
            const item = localStorage.getItem(key)
            if (item) {
              // Пробуем распаковать, если эо сжатые данные
              try {
                const decompressed = decompressFromUTF16(item)
                if (decompressed && isValidJSON(decompressed)) {
                  const match = JSON.parse(decompressed)
                  if (match && match.id) {
                    // Преобразуем в нужный формат
                    foundMatches.push({
                      id: match.id,
                      code: match.code,
                      date: match.createdAt || new Date().toISOString(),
                      team1: {
                        player1: match.teamA?.players?.[0]?.name || "Игрок 1",
                        player2: match.teamA?.players?.[1]?.name || "Игрок 2",
                        score: match.score?.teamA || 0,
                      },
                      team2: {
                        player1: match.teamB?.players?.[0]?.name || "Игрок 3",
                        player2: match.teamB?.players?.[1]?.name || "Игрок 4",
                        score: match.score?.teamB || 0,
                      },
                      completed: match.isCompleted || false,
                      courtNumber: match.courtNumber || null,
                    })
                  }
                }
              } catch (e) {
                // Если не удалось распаковать, пробуем как обычный JSON
                if (isValidJSON(item)) {
                  const match = JSON.parse(item)
                  if (match && match.id) {
                    // Преобразуем в нужный формат
                    foundMatches.push({
                      id: match.id,
                      code: match.code,
                      date: match.createdAt || new Date().toISOString(),
                      team1: {
                        player1: match.teamA?.players?.[0]?.name || "Игрок 1",
                        player2: match.teamA?.players?.[1]?.name || "Игрок 2",
                        score: match.score?.teamA || 0,
                      },
                      team2: {
                        player1: match.teamB?.players?.[0]?.name || "Игрок 3",
                        player2: match.teamB?.players?.[1]?.name || "Игрок 4",
                        score: match.score?.teamB || 0,
                      },
                      completed: match.isCompleted || false,
                      courtNumber: match.courtNumber || null,
                    })
                  }
                }
              }
            }
          } catch (e) {
            logEvent("warn", tSync("logMessages.errorProcessingKey", { key }), "getAllMatches", e)
          }
        }
      }

      if (foundMatches.length > 0) {
        logEvent("info", tSync("logMessages.restoredFromLocal", { count: foundMatches.length }), "getAllMatches")
        return foundMatches
      }
    }

    // Если ничего не нашли, возвращаем пустой массив
    logEvent("warn", tSync("logMessages.errorSearchLocal"), "getAllMatches")
    return []
  } catch (error) {
    logEvent("error", tSync("logMessages.errorGettingMatches"), "getAllMatches", error)
    return []
  }
}

// Заменим функцию isSupabaseAvailable на оптимизированную версию с кэшированием
export const isSupabaseAvailable = async () => {
  try {
    // Используем кэшированный результат, если он не устарел (действителен 60 секунд)
    if (supabaseAvailabilityCache.available !== null && Date.now() - supabaseAvailabilityCache.timestamp < 60000) {
      return supabaseAvailabilityCache.available
    }

    logEvent("info", tSync("logMessages.checkingAvailability"), "isSupabaseAvailable")

    const supabase = createClientSupabaseClient()
    if (!supabase) {
      logEvent("error", tSync("logMessages.errorCreatingClient"), "isSupabaseAvailable")
      supabaseAvailabilityCache = { available: false, timestamp: Date.now() }
      return false
    }

    // Проверяем соединение с Supabase, используя простой запрос
    logEvent("debug", tSync("logMessages.runningTestQuery"), "isSupabaseAvailable")
    const startTime = Date.now()

    // Используем простой запрос к системной информации
    const { error } = await supabase.from("_http_response").select("*").limit(1).maybeSingle()

    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Если получили ошибку о том, что таблица не существует - это нормально,
    // главное что соединение работает
    if (error && !error.message.includes("does not exist")) {
      logEvent("error", tSync("logMessages.errorCheckingAvailability", { error: error.message }), "isSupabaseAvailable", {
        error,
        responseTime,
      })
      supabaseAvailabilityCache = { available: false, timestamp: Date.now() }
      return false
    }

    logEvent("info", tSync("logMessages.supabaseAvailable"), "isSupabaseAvailable", {
      responseTime,
      error: error?.message,
    })
    supabaseAvailabilityCache = { available: true, timestamp: Date.now() }
    return true
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.exceptionCheckingAvailability"), "isSupabaseAvailable", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })
    supabaseAvailabilityCache = { available: false, timestamp: Date.now() }
    return false
  }
}

// Кэш для проверки существования таблиц
let tablesExistCache: { exists: any; timestamp: number } = {
  exists: null,
  timestamp: 0,
}

// Заменим функцию checkTablesExist на оптимизированную версию с кэшированием
export const checkTablesExist = async () => {
  try {
    // Используем кэшированный результат, если он не устарел (действителен 5 минут)
    if (tablesExistCache.exists !== null && Date.now() - tablesExistCache.timestamp < 300000) {
      return tablesExistCache.exists
    }

    const supabase = createClientSupabaseClient()
    if (!supabase) return { exists: false, error: "Клиент Supabase не создан" }

    // Оптимизация: выполняем запросы параллельно
    const [matchesResponse, playersResponse] = await Promise.all([
      supabase.from("matches").select("id").limit(1),
      supabase.from("players").select("id").limit(1),
    ])

    const matchesError = matchesResponse.error
    const playersError = playersResponse.error
    const matchesData = matchesResponse.data
    const playersData = playersResponse.data

    const matchesExists = !matchesError || (matchesError && !matchesError.message.includes("does not exist"))
    const playersExists = !playersError || (playersError && !playersError.message.includes("does not exist"))

    if (!matchesExists || !playersExists) {
      logEvent("warn", tSync("logMessages.tablesNotExistDirect"), "checkTablesExist", {
        matchesError,
        playersError,
      })
    } else {
      logEvent("info", tSync("logMessages.tablesExist"), "checkTablesExist", {
        matchesCount: matchesData?.length || 0,
        playersCount: playersData?.length || 0,
      })
    }

    const result = {
      exists: matchesExists && playersExists,
      matchesExists,
      playersExists,
      errors: {
        matches: matchesError?.message,
        players: playersError?.message,
      },
    }

    tablesExistCache = { exists: result, timestamp: Date.now() }
    return result
  } catch (err) {
    const error = err as Error
    logEvent("error", tSync("logMessages.errorCheckTables"), "checkTablesExist", error)
    return { exists: false, error: error.message }
  }
}

// ─── Sync recovery wiring ──────────────────────────────────────────────────────
// On reconnect / focus the long-lived availability cache (60s) and the per-match
// cache (30s) must not keep serving stale offline results — bypass them, then let
// the sync engine resume draining queued operations.
if (typeof window !== "undefined") {
  const onReconnect = () => {
    resetSupabaseAvailabilityCache()
    invalidateMatchCache()
  }
  window.addEventListener("online", onReconnect)
  window.addEventListener("focus", onReconnect)
  // Start automatic queue replay (startup / online / focus / visibility).
  initSyncRecovery()
}
