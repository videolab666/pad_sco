// Модуль для централизованного логирования ошибок

// Максимальное количество записей в журнале
const MAX_LOG_ENTRIES = 100

// Типы записей журнала
export type LogLevel = "info" | "warn" | "error" | "debug"

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  details?: any
  source: string
}

// ─── Кэш журнала + отложенный флеш (фикс 2026-09-04) ───────────────────────────
// logEvent дёргается на КАЖДОЕ realtime-событие и sync-шаг. Прежняя схема
// «parse всего журнала → unshift → stringify → localStorage.setItem» на
// каждый лог грузила главный поток синхронным JSON по 100 записей —
// Firefox на живом матче заметно подтормаживал. Теперь журнал живёт в
// памяти, а в localStorage пишется не чаще раза в секунду.
let logCache: LogEntry[] | null = null
let logFlushTimer: ReturnType<typeof setTimeout> | null = null
const LOG_FLUSH_DELAY_MS = 1000

function loadLogCache(): LogEntry[] {
  if (logCache !== null) return logCache
  const fresh: LogEntry[] = []
  try {
    const stored = localStorage.getItem("tennis_padel_error_log")
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) fresh.push(...parsed)
    }
  } catch {
    /* битый журнал — начинаем с чистого */
  }
  logCache = fresh
  return fresh
}

function scheduleLogFlush(): void {
  if (logFlushTimer !== null) return
  logFlushTimer = setTimeout(() => {
    logFlushTimer = null
    try {
      localStorage.setItem("tennis_padel_error_log", JSON.stringify(loadLogCache().slice(0, MAX_LOG_ENTRIES)))
    } catch {
      /* квота localStorage — записи всё ещё есть в консоли */
    }
  }, LOG_FLUSH_DELAY_MS)
}

// Получение журнала ошибок из localStorage
export const getErrorLog = (): LogEntry[] => {
  if (typeof window === "undefined") return []

  try {
    return loadLogCache().slice()
  } catch (error) {
    console.error("Ошибка при получении журнала ошибок:", error)
    return []
  }
}

// Добавление записи в журнал
export const logEvent = (level: LogLevel, message: string, source: string, details?: any) => {
  if (typeof window === "undefined") {
    // Если мы на сервере, просто выводим в консоль
    console[level](`[${source}] ${message}`, details)
    return
  }

  try {
    const newEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source,
      details: details ? JSON.stringify(details) : undefined,
    }

    // Добавляем запись в начало журнала (в памяти), флеш — по таймеру.
    const log = loadLogCache()
    log.unshift(newEntry)
    if (log.length > MAX_LOG_ENTRIES) log.length = MAX_LOG_ENTRIES
    scheduleLogFlush()

    // Также выводим в консоль
    console[level](`[${source}] ${message}`, details)
  } catch (error) {
    console.error("Ошибка при логировании:", error)
  }
}

// Очистка журнала ошибок
export const clearErrorLog = () => {
  if (typeof window === "undefined") return

  try {
    logCache = []
    if (logFlushTimer !== null) {
      clearTimeout(logFlushTimer)
      logFlushTimer = null
    }
    localStorage.removeItem("tennis_padel_error_log")
  } catch (error) {
    console.error("Ошибка при очистке журнала ошибок:", error)
  }
}

// Экспорт журнала в JSON
export const exportErrorLog = (): string => {
  const log = getErrorLog()
  return JSON.stringify(log, null, 2)
}
