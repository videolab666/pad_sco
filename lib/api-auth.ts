// API-key guard for the mutating HTTP endpoints (remote command API and the
// whole-snapshot PUT). The UI password gate is client-side only, so every
// server-side write path must authenticate on its own.
//
// The key lives in SCOREBOARD_API_KEY (.env.local). Fails CLOSED: if the env
// variable is unset, no request is authorized.

import { timingSafeEqual } from "node:crypto"

/** Constant-time string comparison (length differences leak only the length). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) {
    // Compare against itself to keep the timing profile, then fail.
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

/**
 * True when the request carries a valid X-API-Key header. Reads the key from
 * the environment on every call (no caching) so rotation applies immediately.
 */
export function isAuthorizedApiRequest(request: Request): boolean {
  const expected = process.env.SCOREBOARD_API_KEY
  if (!expected) return false // fail closed
  const provided =
    request.headers.get("x-api-key") ??
    // Bearer form, for clients that prefer the standard header.
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")!.slice("Bearer ".length)
      : null)
  if (!provided) return false
  return safeEqual(provided, expected)
}

/**
 * Чистая проверка «тот же сайт» (Шаг 3, §99): Origin (fallback Referer)
 * совпадает с собственным хостом запроса. Браузеры всегда шлют Origin на
 * same-origin POST — публичные табло могут слать команды матча без ключа,
 * внешние клиенты (curl/интеграции) — нет (им нужен X-API-Key).
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")
  const ownOrigin = new URL(request.url).origin
  const originToCheck = origin ?? (referer ? new URL(referer, request.url).origin : null)
  if (!originToCheck) return false
  try {
    return new URL(originToCheck).origin === ownOrigin
  } catch {
    return false
  }
}

/**
 * Командный доступ матча (§99): X-API-Key (машины/интеграции) или браузер
 * того же сайта (публичные табло). Уровень доверия не ниже текущего
 * (pre-Step3: anon может писать matches напрямую) — но теперь централизованно:
 * один код-путь, идемпотентность, журнал, позже — rate limit (§117).
 */
export function isAuthorizedMatchCommandRequest(request: Request): boolean {
  return isAuthorizedApiRequest(request) || isSameOriginRequest(request)
}
