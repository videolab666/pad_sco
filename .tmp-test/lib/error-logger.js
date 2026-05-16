"use strict";
// Модуль для централизованного логирования ошибок
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportErrorLog = exports.clearErrorLog = exports.logEvent = exports.getErrorLog = void 0;
// Максимальное количество записей в журнале
const MAX_LOG_ENTRIES = 100;
// Получение журнала ошибок из localStorage
const getErrorLog = () => {
    if (typeof window === "undefined")
        return [];
    try {
        const log = localStorage.getItem("tennis_padel_error_log");
        return log ? JSON.parse(log) : [];
    }
    catch (error) {
        console.error("Ошибка при получении журнала ошибок:", error);
        return [];
    }
};
exports.getErrorLog = getErrorLog;
// Добавление записи в журнал
const logEvent = (level, message, source, details) => {
    if (typeof window === "undefined") {
        // Если мы на сервере, просто выводим в консоль
        console[level](`[${source}] ${message}`, details);
        return;
    }
    try {
        // Получаем текущий журнал
        const log = (0, exports.getErrorLog)();
        // Создаем новую запись
        const newEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            source,
            details: details ? JSON.stringify(details) : undefined,
        };
        // Добавляем запись в начало журнала
        log.unshift(newEntry);
        // Ограничиваем размер журнала
        const trimmedLog = log.slice(0, MAX_LOG_ENTRIES);
        // Сохраняем журнал
        localStorage.setItem("tennis_padel_error_log", JSON.stringify(trimmedLog));
        // Также выводим в консоль
        console[level](`[${source}] ${message}`, details);
    }
    catch (error) {
        console.error("Ошибка при логировании:", error);
    }
};
exports.logEvent = logEvent;
// Очистка журнала ошибок
const clearErrorLog = () => {
    if (typeof window === "undefined")
        return;
    try {
        localStorage.removeItem("tennis_padel_error_log");
    }
    catch (error) {
        console.error("Ошибка при очистке журнала ошибок:", error);
    }
};
exports.clearErrorLog = clearErrorLog;
// Экспорт журнала в JSON
const exportErrorLog = () => {
    const log = (0, exports.getErrorLog)();
    return JSON.stringify(log, null, 2);
};
exports.exportErrorLog = exportErrorLog;
