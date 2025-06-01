import { createClient } from "@supabase/supabase-js"
import { logEvent } from "./error-logger"

// Создаем клиент Supabase для использования на стороне сервера
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    logEvent("error", "Отсутствуют переменные окружения для Supabase на сервере", "createServerSupabaseClient", {
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey,
    })
    throw new Error("Отсутствуют переменные окружения для Supabase")
  }

  logEvent("info", "Создание серверного клиента Supabase", "createServerSupabaseClient", { url: supabaseUrl })
  return createClient(supabaseUrl, supabaseKey, {
    // Оптимизация: уменьшаем таймаут для более быстрого обнаружения ошибок
    global: {
      fetch: (url, options) => {
        return fetch(url, { ...options, timeout: 10000 }) // 10 секунд таймаут
      },
    },
  })
}

// Создаем клиент Supabase для использования на стороне клиента
// Используем синглтон для предотвращения создания множества экземпляров
let clientSupabaseInstance = null

export const createClientSupabaseClient = () => {
  if (clientSupabaseInstance) return clientSupabaseInstance

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    logEvent("error", "Отсутствуют переменные окружения для Supabase на клиенте", "createClientSupabaseClient", {
      supabaseUrl: !!supabaseUrl,
      supabaseAnonKey: !!supabaseAnonKey,
      env: Object.keys(process.env).filter((key) => key.includes("SUPABASE") || key.includes("NEXT_PUBLIC")),
    })
    return null
  }

  try {
    logEvent("info", "Создание клиентского клиента Supabase", "createClientSupabaseClient", { url: supabaseUrl })

    // Создаем клиент с более надежными настройками
    clientSupabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      // Оптимизация: настройки для более быстрой работы
      realtime: {
        params: {
          eventsPerSecond: 5, // Уменьшаем с 10 до 5 для снижения нагрузки
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: {
        // Увеличиваем таймаут и добавляем повторные попытки
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            // Не используем timeout в options, так как это может вызвать проблемы
            // Вместо этого используем AbortController в вызывающем коде
          })
        },
      },
    })
    return clientSupabaseInstance
  } catch (error) {
    logEvent("error", "Ошибка при создании клиента Supabase", "createClientSupabaseClient", error)
    return null
  }
}

// Оптимизируем функцию isSupabaseAvailable для более быстрой проверки
export const isSupabaseAvailable = async () => {
  try {
    // Используем простую проверку - если клиент создан, считаем Supabase доступным
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      return false
    }

    // Проверяем, что у нас есть URL и ключ
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return false
    }

    // Выполняем простой запрос для проверки соединения
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 секунды таймаут

      const { error } = await supabase
        .from("_http_response")
        .select("*")
        .limit(1)
        .maybeSingle()
        .abortSignal(controller.signal)

      clearTimeout(timeoutId)

      // Если получили ошибку о том, что таблица не существует - это нормально,
      // главное что соединение работает
      if (error && !error.message.includes("does not exist")) {
        return false
      }

      return true
    } catch (fetchError) {
      if (fetchError.name === "AbortError") {
        logEvent("error", "Таймаут при проверке доступности Supabase", "isSupabaseAvailable")
      } else {
        logEvent("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "isSupabaseAvailable", {
          error: fetchError,
        })
      }
      return false
    }
  } catch (error) {
    logEvent("error", "Исключение при проверке доступности Supabase", "isSupabaseAvailable", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })
    return false
  }
}

// Обновляем функцию проверки существования таблиц
export const checkTablesExist = async () => {
  try {
    const supabase = createClientSupabaseClient()
    if (!supabase) return { exists: false, error: "Клиент Supabase не создан" }

    try {
      // Используем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 секунд таймаут

      // Оптимизация: выполняем запросы параллельно
      const [matchesResponse, playersResponse] = await Promise.all([
        supabase.from("matches").select("id").limit(1).abortSignal(controller.signal),
        supabase.from("players").select("id").limit(1).abortSignal(controller.signal),
      ])

      clearTimeout(timeoutId)

      const matchesError = matchesResponse.error
      const playersError = playersResponse.error
      const matchesData = matchesResponse.data
      const playersData = playersResponse.data

      const matchesExists = !matchesError || (matchesError && !matchesError.message.includes("does not exist"))
      const playersExists = !playersError || (playersError && !playersError.message.includes("does not exist"))

      if (!matchesExists || !playersExists) {
        logEvent("warn", "Таблицы в базе данных не существуют (проверка через прямые запросы)", "checkTablesExist", {
          matchesError,
          playersError,
        })
      } else {
        logEvent("info", "Таблицы в базе данных существуют", "checkTablesExist", {
          matchesCount: matchesData?.length || 0,
          playersCount: playersData?.length || 0,
        })
      }

      return {
        exists: matchesExists && playersExists,
        matchesExists,
        playersExists,
        errors: {
          matches: matchesError?.message,
          players: playersError?.message,
        },
      }
    } catch (fetchError) {
      if (fetchError.name === "AbortError") {
        logEvent("error", "Таймаут при проверке существования таблиц", "checkTablesExist")
      } else {
        logEvent("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "checkTablesExist", {
          error: fetchError,
        })
      }
      return { exists: false, error: fetchError.message }
    }
  } catch (error) {
    logEvent("error", "Ошибка при проверке существования таблиц", "checkTablesExist", error)
    return { exists: false, error: error.message }
  }
}

// Добавляем функцию для проверки содержимого таблиц
export const checkTablesContent = async () => {
  try {
    const supabase = createClientSupabaseClient()
    if (!supabase) return { success: false, error: "Клиент Supabase не создан" }

    try {
      // Используем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 секунд таймаут

      // Оптимизация: выполняем запросы параллельно и выбираем только нужные поля
      const [playersResponse, matchesResponse] = await Promise.all([
        supabase.from("players").select("id, name, created_at").limit(10).abortSignal(controller.signal),
        supabase
          .from("matches")
          .select("id, type, format, created_at, is_completed")
          .limit(10)
          .abortSignal(controller.signal),
      ])

      clearTimeout(timeoutId)

      return {
        success: !playersResponse.error && !matchesResponse.error,
        players: playersResponse.data || [],
        matches: matchesResponse.data || [],
        errors: {
          players: playersResponse.error?.message,
          matches: matchesResponse.error?.message,
        },
      }
    } catch (fetchError) {
      if (fetchError.name === "AbortError") {
        logEvent("error", "Таймаут при проверке содержимого таблиц", "checkTablesContent")
      } else {
        logEvent("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "checkTablesContent", {
          error: fetchError,
        })
      }
      return { success: false, error: fetchError.message }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Получение информации о соединении с Supabase
export const getSupabaseConnectionInfo = async () => {
  try {
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      return {
        available: false,
        error: "Клиент Supabase не создан",
        details: {
          supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
      }
    }

    try {
      // Используем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 секунды таймаут

      // Проверяем соединение с Supabase
      const startTime = Date.now()
      const { error } = await supabase
        .from("_http_response")
        .select("*")
        .limit(1)
        .maybeSingle()
        .abortSignal(controller.signal)

      clearTimeout(timeoutId)
      const endTime = Date.now()

      // Проверяем существование таблиц
      const tablesStatus = await checkTablesExist()

      if (error && !error.message.includes("does not exist")) {
        return {
          available: false,
          error: error.message,
          details: {
            code: error.code,
            responseTime: endTime - startTime,
            tablesStatus,
          },
        }
      }

      return {
        available: true,
        details: {
          responseTime: endTime - startTime,
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          tablesStatus,
        },
      }
    } catch (fetchError) {
      if (fetchError.name === "AbortError") {
        return {
          available: false,
          error: "Timeout при проверке соединения",
          details: {
            name: fetchError.name,
            message: fetchError.message,
          },
        }
      } else {
        return {
          available: false,
          error: fetchError.message,
          details: {
            name: fetchError.name,
            message: fetchError.message,
            stack: fetchError.stack,
          },
        }
      }
    }
  } catch (error) {
    return {
      available: false,
      error: error.message,
      details: {
        name: error.name,
        stack: error.stack,
      },
    }
  }
}

// SQL для создания таблиц
export const getCreateTablesSql = () => {
  return `
-- Создаем таблицу для хранения матчей
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  format TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settings JSONB NOT NULL,
  team_a JSONB NOT NULL,
  team_b JSONB NOT NULL,
  score JSONB NOT NULL,
  current_server JSONB NOT NULL,
  court_sides JSONB NOT NULL,
  should_change_sides BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  winner TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  court_number INTEGER
);

-- Создаем таблицу для хранения игроков
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создаем индекс для быстрого поиска по имени игрока
CREATE INDEX IF NOT EXISTS players_name_idx ON players (name);

-- Оптимизация: добавляем индексы для часто используемых полей
CREATE INDEX IF NOT EXISTS matches_created_at_idx ON matches (created_at DESC);
CREATE INDEX IF NOT EXISTS matches_is_completed_idx ON matches (is_completed);
CREATE INDEX IF NOT EXISTS matches_court_number_idx ON matches (court_number);
CREATE INDEX IF NOT EXISTS matches_type_idx ON matches (type);

-- Создаем функцию для обновления timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Создаем триггер для автоматического обновления timestamp
DROP TRIGGER IF EXISTS update_matches_updated_at ON matches;
CREATE TRIGGER update_matches_updated_at
BEFORE UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Включаем расширение для генерации UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Включаем публикацию для Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE matches, players;
COMMIT;
  `
}

// Инициализация базы данных
export const initializeDatabase = async () => {
  try {
    logEvent("info", "Начало инициализации базы данных", "initializeDatabase")

    const supabase = createClientSupabaseClient()
    if (!supabase) {
      return { success: false, error: "Клиент Supabase не создан" }
    }

    // Проверяем существование таблиц
    const tablesStatus = await checkTablesExist()

    if (tablesStatus.exists) {
      logEvent("info", "Таблицы уже существуют, инициализация не требуется", "initializeDatabase")
      return { success: true, message: "Таблицы уже существуют" }
    }

    // Выполняем SQL для создания таблиц
    // Разбиваем SQL на отдельные запросы и выполняем их последовательно
    const sql = getCreateTablesSql()
    const statements = sql
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)
      .map((stmt) => stmt + ";")

    for (const statement of statements) {
      try {
        // Используем AbortController для таймаута
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 секунд таймаут

        const { error } = await supabase.rpc("exec_sql", { sql_query: statement }).abortSignal(controller.signal)

        clearTimeout(timeoutId)

        if (error) {
          // Если функция exec_sql не существует, пробуем выполнить запрос напрямую
          if (error.message.includes("function exec_sql") || error.message.includes("does not exist")) {
            // Для прямого выполнения SQL нужны права администратора
            // Это может не сработать с анонимным ключом
            const { error: directError } = await supabase.from("_sql").select("*").eq("query", statement).single()

            if (directError && !directError.message.includes("does not exist")) {
              logEvent("error", `Ошибка при выполнении SQL: ${directError.message}`, "initializeDatabase", {
                statement,
                error: directError,
              })
              return { success: false, error: `Ошибка при выполнении SQL: ${directError.message}` }
            }
          } else {
            logEvent("error", `Ошибка при инициализации базы данных: ${error.message}`, "initializeDatabase", {
              statement,
              error,
            })
            return { success: false, error: error.message }
          }
        }
      } catch (fetchError) {
        if (fetchError.name === "AbortError") {
          logEvent("error", "Тайма��т при выполнении SQL", "initializeDatabase", { statement })
        } else {
          logEvent("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "initializeDatabase", {
            error: fetchError,
            statement,
          })
        }
        return { success: false, error: fetchError.message }
      }
    }

    // Проверяем, что таблицы созданы
    const newTablesStatus = await checkTablesExist()

    if (!newTablesStatus.exists) {
      return {
        success: false,
        error:
          "Не удалось создать таблицы. Возможно, у вас нет прав на выполнение SQL-запросов. Попробуйте создать таблицы вручную через SQL-редактор Supabase.",
        tablesStatus: newTablesStatus,
      }
    }

    logEvent("info", "База данных успешно инициализирована", "initializeDatabase")
    return { success: true }
  } catch (error) {
    logEvent("error", "Исключение при инициализации базы данных", "initializeDatabase", error)
    return { success: false, error: error.message }
  }
}

// Выполнение SQL-запроса
export const executeSql = async (sql) => {
  try {
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      return { success: false, error: "Клиент Supabase не создан" }
    }

    try {
      // Используем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 секунд таймаут

      // Пробуем выполнить через RPC
      const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql }).abortSignal(controller.signal)

      clearTimeout(timeoutId)

      if (error) {
        // Если функция exec_sql не существует, пробуем выполнить запрос напрямую
        if (error.message.includes("function exec_sql") || error.message.includes("does not exist")) {
          // Для прямого выполнения SQL нужны права администратора
          const { error: directError } = await supabase.from("_sql").select("*").eq("query", sql).single()

          if (directError && !directError.message.includes("does not exist")) {
            return { success: false, error: directError.message }
          }

          // Если оба метода не сработали, возвращаем ошибку
          return {
            success: false,
            error:
              "Не удалось выполнить SQL-запрос. У вас нет прав на выполнение SQL или функция exec_sql не существует.",
          }
        }

        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (fetchError) {
      if (fetchError.name === "AbortError") {
        return { success: false, error: "Таймаут при выполнении SQL-запроса" }
      } else {
        return { success: false, error: fetchError.message }
      }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Проверка и настройка Realtime для Supabase
export const checkAndEnableRealtime = async () => {
  try {
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      return { success: false, error: "Клиент Supabase не создан" }
    }

    try {
      // Используем AbortController для таймаута
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 секунд таймаут

      // Проверяем существование публикации для Realtime
      const sql = `
      SELECT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
      ) as exists;
      `

      const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql }).abortSignal(controller.signal)

      clearTimeout(timeoutId)

      if (error) {
        return { success: false, error: error.message }
      }

      // Если публикация не существует, создаем ее
      if (!data || !data.exists) {
        const createPublicationSql = `
        BEGIN;
          DROP PUBLICATION IF EXISTS supabase_realtime;
          CREATE PUBLICATION supabase_realtime FOR TABLE matches, players;
        COMMIT;
        `

        const controller2 = new AbortController()
        const timeoutId2 = setTimeout(() => controller2.abort(), 5000) // 5 секунд таймаут

        const { error: createError } = await supabase
          .rpc("exec_sql", { sql_query: createPublicationSql })
          .abortSignal(controller2.signal)

        clearTimeout(timeoutId2)

        if (createError) {
          return { success: false, error: createError.message }
        }
      }

      return { success: true }
    } catch (fetchError) {
      if (fetchError.name === "AbortError") {
        return { success: false, error: "Таймаут при проверке Realtime" }
      } else {
        return { success: false, error: fetchError.message }
      }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
