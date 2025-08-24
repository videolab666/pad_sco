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

// Получение журнала ошибок из localStorage
export const getErrorLog = (): LogEntry[] => {
  if (typeof window === "undefined") return []

  try {
    const log = localStorage.getItem("tennis_padel_error_log")
    return log ? JSON.parse(log) : []
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
    // Получаем текущий журнал
    const log = getErrorLog()

    // Создаем новую запись
    const newEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source,
      details: details ? JSON.stringify(details) : undefined,
    }

    // Добавляем запись в начало журнала
    log.unshift(newEntry)

    // Ограничиваем размер журнала
    const trimmedLog = log.slice(0, MAX_LOG_ENTRIES)

    // Сохраняем журнал
    localStorage.setItem("tennis_padel_error_log", JSON.stringify(trimmedLog))

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
