"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndEnableRealtime = exports.executeSql = exports.initializeDatabase = exports.getCreateTablesSql = exports.getSupabaseConnectionInfo = exports.checkTablesContent = exports.checkTablesExist = exports.isSupabaseAvailable = exports.createClientSupabaseClient = exports.createServerSupabaseClient = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const error_logger_1 = require("./error-logger");
// Создаем клиент Supabase для использования на стороне сервера
const createServerSupabaseClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        (0, error_logger_1.logEvent)("error", "Отсутствуют переменные окружения для Supabase на сервере", "createServerSupabaseClient", {
            supabaseUrl: !!supabaseUrl,
            supabaseKey: !!supabaseKey,
        });
        throw new Error("Отсутствуют переменные окружения для Supabase");
    }
    (0, error_logger_1.logEvent)("info", "Создание серверного клиента Supabase", "createServerSupabaseClient", { url: supabaseUrl });
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
        // Оптимизация: уменьшаем таймаут для более быстрого обнаружения ошибок
        global: {
            fetch: (url, options) => {
                return fetch(url, options);
            },
        },
    });
};
exports.createServerSupabaseClient = createServerSupabaseClient;
// Создаем клиент Supabase для использования на стороне клиента
// Используем синглтон для предотвращения создания множества экземпляров
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clientSupabaseInstance = null;
const createClientSupabaseClient = () => {
    if (clientSupabaseInstance)
        return clientSupabaseInstance;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        (0, error_logger_1.logEvent)("error", "Отсутствуют переменные окружения для Supabase на клиенте", "createClientSupabaseClient", {
            supabaseUrl: !!supabaseUrl,
            supabaseAnonKey: !!supabaseAnonKey,
            env: Object.keys(process.env).filter((key) => key.includes("SUPABASE") || key.includes("NEXT_PUBLIC")),
        });
        return null;
    }
    try {
        (0, error_logger_1.logEvent)("info", "Создание клиентского клиента Supabase", "createClientSupabaseClient", { url: supabaseUrl });
        // Создаем клиент с более надежными настройками
        clientSupabaseInstance = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, {
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
                    });
                },
            },
        });
        return clientSupabaseInstance;
    }
    catch (error) {
        (0, error_logger_1.logEvent)("error", "Ошибка при создании клиента Supabase", "createClientSupabaseClient", error);
        return null;
    }
};
exports.createClientSupabaseClient = createClientSupabaseClient;
// Оптимизируем функцию isSupabaseAvailable для более быстрой проверки
const isSupabaseAvailable = async () => {
    try {
        // Используем простую проверку - если клиент создан, считаем Supabase доступным
        const supabase = (0, exports.createClientSupabaseClient)();
        if (!supabase) {
            return false;
        }
        // Проверяем, что у нас есть URL и ключ
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            return false;
        }
        // Выполняем простой запрос для проверки соединения
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 секунды таймаут
            const { error } = await supabase
                .from("_http_response")
                .select("*")
                .limit(1)
                .maybeSingle()
                .abortSignal(controller.signal);
            clearTimeout(timeoutId);
            // Если получили ошибку о том, что таблица не существует - это нормально,
            // главное что соединение работает
            if (error && !error.message.includes("does not exist")) {
                return false;
            }
            return true;
        }
        catch (err) {
            const fetchError = err;
            if (fetchError.name === "AbortError") {
                (0, error_logger_1.logEvent)("error", "Таймаут при проверке доступности Supabase", "isSupabaseAvailable");
            }
            else {
                (0, error_logger_1.logEvent)("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "isSupabaseAvailable", {
                    error: fetchError,
                });
            }
            return false;
        }
    }
    catch (err) {
        const error = err;
        (0, error_logger_1.logEvent)("error", "Исключение при проверке доступности Supabase", "isSupabaseAvailable", {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
        });
        return false;
    }
};
exports.isSupabaseAvailable = isSupabaseAvailable;
// Обновляем функцию проверки существования таблиц
const checkTablesExist = async () => {
    try {
        const supabase = (0, exports.createClientSupabaseClient)();
        if (!supabase)
            return { exists: false, error: "Клиент Supabase не создан" };
        try {
            // Используем AbortController для таймаута
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
            // Оптимизация: выполняем запросы параллельно
            const [matchesResponse, playersResponse] = await Promise.all([
                supabase.from("matches").select("id").limit(1).abortSignal(controller.signal),
                supabase.from("players").select("id").limit(1).abortSignal(controller.signal),
            ]);
            clearTimeout(timeoutId);
            const matchesError = matchesResponse.error;
            const playersError = playersResponse.error;
            const matchesData = matchesResponse.data;
            const playersData = playersResponse.data;
            const matchesExists = !matchesError || (matchesError && !matchesError.message.includes("does not exist"));
            const playersExists = !playersError || (playersError && !playersError.message.includes("does not exist"));
            if (!matchesExists || !playersExists) {
                (0, error_logger_1.logEvent)("warn", "Таблицы в базе данных не существуют (проверка через прямые запросы)", "checkTablesExist", {
                    matchesError,
                    playersError,
                });
            }
            else {
                (0, error_logger_1.logEvent)("info", "Таблицы в базе данных существуют", "checkTablesExist", {
                    matchesCount: matchesData?.length || 0,
                    playersCount: playersData?.length || 0,
                });
            }
            return {
                exists: matchesExists && playersExists,
                matchesExists,
                playersExists,
                errors: {
                    matches: matchesError?.message,
                    players: playersError?.message,
                },
            };
        }
        catch (err) {
            const fetchError = err;
            if (fetchError.name === "AbortError") {
                (0, error_logger_1.logEvent)("error", "Таймаут при проверке существования таблиц", "checkTablesExist");
            }
            else {
                (0, error_logger_1.logEvent)("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "checkTablesExist", {
                    error: fetchError,
                });
            }
            return { exists: false, error: fetchError.message };
        }
    }
    catch (err) {
        const error = err;
        (0, error_logger_1.logEvent)("error", "Ошибка при проверке существования таблиц", "checkTablesExist", error);
        return { exists: false, error: error.message };
    }
};
exports.checkTablesExist = checkTablesExist;
// Добавляем функцию для проверки содержимого таблиц
const checkTablesContent = async () => {
    try {
        const supabase = (0, exports.createClientSupabaseClient)();
        if (!supabase)
            return { success: false, error: "Клиент Supabase не создан" };
        try {
            // Используем AbortController для таймаута
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
            // Оптимизация: выполняем запросы параллельно и выбираем только нужные поля
            const [playersResponse, matchesResponse] = await Promise.all([
                supabase.from("players").select("id, name, created_at").limit(10).abortSignal(controller.signal),
                supabase
                    .from("matches")
                    .select("id, type, format, created_at, is_completed")
                    .limit(10)
                    .abortSignal(controller.signal),
            ]);
            clearTimeout(timeoutId);
            return {
                success: !playersResponse.error && !matchesResponse.error,
                players: playersResponse.data || [],
                matches: matchesResponse.data || [],
                errors: {
                    players: playersResponse.error?.message,
                    matches: matchesResponse.error?.message,
                },
            };
        }
        catch (err) {
            const fetchError = err;
            if (fetchError.name === "AbortError") {
                (0, error_logger_1.logEvent)("error", "Таймаут при проверке содержимого таблиц", "checkTablesContent");
            }
            else {
                (0, error_logger_1.logEvent)("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "checkTablesContent", {
                    error: fetchError,
                });
            }
            return { success: false, error: fetchError.message };
        }
    }
    catch (err) {
        const error = err;
        return { success: false, error: error.message };
    }
};
exports.checkTablesContent = checkTablesContent;
// Получение информации о соединении с Supabase
const getSupabaseConnectionInfo = async () => {
    try {
        const supabase = (0, exports.createClientSupabaseClient)();
        if (!supabase) {
            return {
                available: false,
                error: "Клиент Supabase не создан",
                details: {
                    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                },
            };
        }
        try {
            // Используем AbortController для таймаута
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 секунды таймаут
            // Проверяем соединение с Supabase
            const startTime = Date.now();
            const { error } = await supabase
                .from("_http_response")
                .select("*")
                .limit(1)
                .maybeSingle()
                .abortSignal(controller.signal);
            clearTimeout(timeoutId);
            const endTime = Date.now();
            // Проверяем существование таблиц
            const tablesStatus = await (0, exports.checkTablesExist)();
            if (error && !error.message.includes("does not exist")) {
                return {
                    available: false,
                    error: error.message,
                    details: {
                        code: error.code,
                        responseTime: endTime - startTime,
                        tablesStatus,
                    },
                };
            }
            return {
                available: true,
                details: {
                    responseTime: endTime - startTime,
                    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
                    tablesStatus,
                },
            };
        }
        catch (err) {
            const fetchError = err;
            if (fetchError.name === "AbortError") {
                return {
                    available: false,
                    error: "Timeout при проверке соединения",
                    details: {
                        name: fetchError.name,
                        message: fetchError.message,
                    },
                };
            }
            else {
                return {
                    available: false,
                    error: fetchError.message,
                    details: {
                        name: fetchError.name,
                        message: fetchError.message,
                        stack: fetchError.stack,
                    },
                };
            }
        }
    }
    catch (err) {
        const error = err;
        return {
            available: false,
            error: error.message,
            details: {
                name: error.name,
                stack: error.stack,
            },
        };
    }
};
exports.getSupabaseConnectionInfo = getSupabaseConnectionInfo;
// SQL для создания таблиц
const getCreateTablesSql = () => {
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
  court_number INTEGER,
  revision INTEGER NOT NULL DEFAULT 0
);

-- На случай уже существующей таблицы — добавляем колонку revision
ALTER TABLE matches ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;

-- Журнал операций: серверная идемпотентность + аудит для рефери
CREATE TABLE IF NOT EXISTS match_operations (
  operation_id UUID PRIMARY KEY,
  match_id UUID NOT NULL,
  base_revision INTEGER NOT NULL,
  result_revision INTEGER NOT NULL,
  kind TEXT NOT NULL,
  client_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS match_operations_match_idx ON match_operations (match_id, result_revision);

-- Создаем таблицу для хранения игроков
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  "dyId" TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- На случай уже существующей таблицы — добавляем колонку dyId
ALTER TABLE players ADD COLUMN IF NOT EXISTS "dyId" TEXT;

-- Создаем индекс для быстрого поиска по имени игрока
CREATE INDEX IF NOT EXISTS players_name_idx ON players (name);

-- Индекс для дедупликации импортированных из фида игроков
CREATE INDEX IF NOT EXISTS players_dyid_idx ON players ("dyId");

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
  `;
};
exports.getCreateTablesSql = getCreateTablesSql;
// Инициализация базы данных
const initializeDatabase = async () => {
    try {
        (0, error_logger_1.logEvent)("info", "Начало инициализации базы данных", "initializeDatabase");
        const supabase = (0, exports.createClientSupabaseClient)();
        if (!supabase) {
            return { success: false, error: "Клиент Supabase не создан" };
        }
        // Проверяем существование таблиц
        const tablesStatus = await (0, exports.checkTablesExist)();
        if (tablesStatus.exists) {
            (0, error_logger_1.logEvent)("info", "Таблицы уже существуют, инициализация не требуется", "initializeDatabase");
            return { success: true, message: "Таблицы уже существуют" };
        }
        // Выполняем SQL для создания таблиц
        // Разбиваем SQL на отдельные запросы и выполняем их последовательно
        const sql = (0, exports.getCreateTablesSql)();
        const statements = sql
            .split(";")
            .map((stmt) => stmt.trim())
            .filter((stmt) => stmt.length > 0)
            .map((stmt) => stmt + ";");
        for (const statement of statements) {
            try {
                // Используем AbortController для таймаута
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
                const { error } = await supabase.rpc("exec_sql", { sql_query: statement }).abortSignal(controller.signal);
                clearTimeout(timeoutId);
                if (error) {
                    // Если функция exec_sql не существует, пробуем выполнить запрос напрямую
                    if (error.message.includes("function exec_sql") || error.message.includes("does not exist")) {
                        // Для прямого выполнения SQL нужны права администратора
                        // Это может не сработать с анонимным ключом
                        const { error: directError } = await supabase.from("_sql").select("*").eq("query", statement).single();
                        if (directError && !directError.message.includes("does not exist")) {
                            (0, error_logger_1.logEvent)("error", `Ошибка при выполнении SQL: ${directError.message}`, "initializeDatabase", {
                                statement,
                                error: directError,
                            });
                            return { success: false, error: `Ошибка при выполнении SQL: ${directError.message}` };
                        }
                    }
                    else {
                        (0, error_logger_1.logEvent)("error", `Ошибка при инициализации базы данных: ${error.message}`, "initializeDatabase", {
                            statement,
                            error,
                        });
                        return { success: false, error: error.message };
                    }
                }
            }
            catch (err) {
                const fetchError = err;
                if (fetchError.name === "AbortError") {
                    (0, error_logger_1.logEvent)("error", "Таймаут при выполнении SQL", "initializeDatabase", { statement });
                }
                else {
                    (0, error_logger_1.logEvent)("error", `Ошибка при запросе к Supabase: ${fetchError.message}`, "initializeDatabase", {
                        error: fetchError,
                        statement,
                    });
                }
                return { success: false, error: fetchError.message };
            }
        }
        // Проверяем, что таблицы созданы
        const newTablesStatus = await (0, exports.checkTablesExist)();
        if (!newTablesStatus.exists) {
            return {
                success: false,
                error: "Не удалось создать таблицы. Возможно, у вас нет прав на выполнение SQL-запросов. Попробуйте создать таблицы вручную через SQL-редактор Supabase.",
                tablesStatus: newTablesStatus,
            };
        }
        (0, error_logger_1.logEvent)("info", "База данных успешно инициализирована", "initializeDatabase");
        return { success: true };
    }
    catch (err) {
        const error = err;
        (0, error_logger_1.logEvent)("error", "Исключение при инициализации базы данных", "initializeDatabase", error);
        return { success: false, error: error.message };
    }
};
exports.initializeDatabase = initializeDatabase;
// Выполнение SQL-запроса
const executeSql = async (sql) => {
    try {
        const supabase = (0, exports.createClientSupabaseClient)();
        if (!supabase) {
            return { success: false, error: "Клиент Supabase не создан" };
        }
        try {
            // Используем AbortController для таймаута
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
            // Пробуем выполнить через RPC
            const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql }).abortSignal(controller.signal);
            clearTimeout(timeoutId);
            if (error) {
                // Если функция exec_sql не существует, пробуем выполнить запрос напрямую
                if (error.message.includes("function exec_sql") || error.message.includes("does not exist")) {
                    // Для прямого выполнения SQL нужны права администратора
                    const { error: directError } = await supabase.from("_sql").select("*").eq("query", sql).single();
                    if (directError && !directError.message.includes("does not exist")) {
                        return { success: false, error: directError.message };
                    }
                    // Если оба метода не сработали, возвращаем ошибку
                    return {
                        success: false,
                        error: "Не удалось выполнить SQL-запрос. У вас нет прав на выполнение SQL или функция exec_sql не существует.",
                    };
                }
                return { success: false, error: error.message };
            }
            return { success: true, data };
        }
        catch (err) {
            const fetchError = err;
            if (fetchError.name === "AbortError") {
                return { success: false, error: "Таймаут при выполнении SQL-запроса" };
            }
            else {
                return { success: false, error: fetchError.message };
            }
        }
    }
    catch (err) {
        const error = err;
        return { success: false, error: error.message };
    }
};
exports.executeSql = executeSql;
// Проверка и настройка Realtime для Supabase
const checkAndEnableRealtime = async () => {
    try {
        const supabase = (0, exports.createClientSupabaseClient)();
        if (!supabase) {
            return { success: false, error: "Клиент Supabase не создан" };
        }
        try {
            // Используем AbortController для таймаута
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
            // Проверяем существование публикации для Realtime
            const sql = `
      SELECT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
      ) as exists;
      `;
            const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql }).abortSignal(controller.signal);
            clearTimeout(timeoutId);
            if (error) {
                return { success: false, error: error.message };
            }
            // Если публикация не существует, создаем ее
            if (!data || !data.exists) {
                const createPublicationSql = `
        BEGIN;
          DROP PUBLICATION IF EXISTS supabase_realtime;
          CREATE PUBLICATION supabase_realtime FOR TABLE matches, players;
        COMMIT;
        `;
                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), 5000); // 5 секунд таймаут
                const { error: createError } = await supabase
                    .rpc("exec_sql", { sql_query: createPublicationSql })
                    .abortSignal(controller2.signal);
                clearTimeout(timeoutId2);
                if (createError) {
                    return { success: false, error: createError.message };
                }
            }
            return { success: true };
        }
        catch (err) {
            const fetchError = err;
            if (fetchError.name === "AbortError") {
                return { success: false, error: "Таймаут при проверке Realtime" };
            }
            else {
                return { success: false, error: fetchError.message };
            }
        }
    }
    catch (err) {
        const error = err;
        return { success: false, error: error.message };
    }
};
exports.checkAndEnableRealtime = checkAndEnableRealtime;
