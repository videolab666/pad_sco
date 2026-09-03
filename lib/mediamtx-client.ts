// MediaMTX Control API-клиент (plan 2026-09-02, Task 1).
//
// QR-gated recording: платформа включает/выключает запись конкретного корта
// через runtime path-override — точное имя пути (court-{code}-main) приори-
// тетнее регекса "~^court-" в mediamtx.yml. Камера стримит всегда (live +
// heartbeat), на диск пишем только пока активна recording_session.
//
// Чистые хелперы (валидация ключа, тело override, срок ретенции) без I/O
// покрыты тестами (test/mediamtx-client.test.ts); HTTP — тонкая обёртка с
// таймаутом и одним ретраем. Control API (:9997) наружу не выставляется.

const DEFAULT_CONTROL_URL = "http://127.0.0.1:9997"

/** Тот же формат ключа, что и в video-registry isValidHeartbeat (§152). */
const STREAM_KEY_RE =
  /^court-[A-Za-z0-9]{3,20}-(main|tactical|closeup|player-[ab]|overhead|custom)$/

export function isValidStreamKey(streamKey: string): boolean {
  return STREAM_KEY_RE.test(streamKey)
}

/** Ретенция в формате MediaMTX: 7 → "7d", 30 → "30d" (§148). */
export function retentionToMediaMTX(days: number): string {
  const errs = validateRetentionDays(days)
  if (errs.length > 0) throw new MediaMTXValidationError(errs)
  return `${days}d`
}

export function validateRetentionDays(days: number): string[] {
  const errors: string[] = []
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    errors.push("retentionDays должен быть целым от 1 до 3650")
  }
  return errors
}

/**
 * Тело runtime path-override: включить запись с ретенцией тарифа.
 * Остальные параметры записи (recordPath/format/segmentDuration) наследуются
 * из pathDefaults — проверено живым тестом на MediaMTX 1.20 (см. план Task 1).
 */
export function buildRecordingOverride(retentionDays: number): Record<string, unknown> {
  return { record: true, recordDeleteAfter: retentionToMediaMTX(retentionDays) }
}

// ─── Ошибки ────────────────────────────────────────────────────────────────

export class MediaMTXValidationError extends Error {
  constructor(message: string | string[]) {
    super(Array.isArray(message) ? message.join("; ") : message)
    this.name = "MediaMTXValidationError"
  }
}

/** Сеть/таймаут/5xx — gateway недоступен или нездоров. */
export class MediaMTXUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MediaMTXUnavailable"
  }
}

/** Control API ответил ошибкой (4xx/5xx без ретрая). */
export class MediaMTXApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message)
    this.name = "MediaMTXApiError"
  }
}

// ─── HTTP-обёртка ──────────────────────────────────────────────────────────

export interface MtxClientOptions {
  /** База Control API; дефолт — MEDIAMTX_CONTROL_URL или localhost:9997. */
  baseUrl?: string
  /** Инъекция для тестов. */
  fetchFn?: typeof fetch
  timeoutMs?: number
  retries?: number
}

function resolveBaseUrl(baseUrl?: string): string {
  return (baseUrl ?? process.env.MEDIAMTX_CONTROL_URL ?? DEFAULT_CONTROL_URL).replace(/\/$/, "")
}

async function request(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  opts: MtxClientOptions & { body?: Record<string, unknown> } = {},
): Promise<Response> {
  const fetchFn = opts.fetchFn ?? fetch
  const timeoutMs = opts.timeoutMs ?? 3000
  const retries = opts.retries ?? 1
  const url = `${resolveBaseUrl(opts.baseUrl)}${path}`

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetchFn(url, {
        method,
        headers: opts.body ? { "Content-Type": "application/json" } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      })
      // 5xx — ретраим; 4xx — осмысленный ответ API, отдаём как есть.
      if (res.status >= 500 && attempt < retries) {
        lastError = new MediaMTXUnavailable(`MediaMTX ${method} ${path} → ${res.status}`)
        continue
      }
      return res
    } catch (err) {
      lastError = new MediaMTXUnavailable(`MediaMTX ${method} ${path}: ${(err as Error).message}`)
      if (attempt >= retries) break
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError ?? new MediaMTXUnavailable(`MediaMTX ${method} ${path}: недоступен`)
}

async function readError(res: Response): Promise<never> {
  const body = await res.text().catch(() => "")
  throw new MediaMTXApiError(
    `MediaMTX ${res.status} ${res.url.split("/v3/")[1] ?? ""}: ${body.slice(0, 200)}`,
    res.status,
    body,
  )
}

function assertStreamKey(streamKey: string): void {
  if (!isValidStreamKey(streamKey)) {
    throw new MediaMTXValidationError(["streamKey должен иметь вид court-{код}-{роль}"])
  }
}

// ─── Публичные операции ────────────────────────────────────────────────────
//
// Эндпоинты Control API v1.20 используют глагольные сегменты:
// /v3/config/paths/{add|patch|delete|get}/{name} (проверено живым тестом на
// MediaMTX 1.20.0 — см. план Task 1: override применяется к уже активному
// публикатору, recorder стартует/стопается на лету, pathDefaults наследуются).
//
// ЕДИНЫЙ ИСТОЧНИК ВРЕМЕНИ ДЛЯ МЕДИА (plan 2026-09-02): часы gateway — только
// он называет fMP4-сегменты и интерпретирует start/duration playback API.
// Каждый успешный вызов возвращает gatewayTime из HTTP-заголовка Date
// (секундная точность) — платформа сохраняет его как mediaStartedAt /
// mediaEndedAt, и окно VOD строится в домене часов gateway без поправок
// на сдвиги часов БД/приложения.

export interface GatewayEffect {
  /** Часы gateway в момент обработки запроса (RFC-3339) или null. */
  gatewayTime: string | null
}

function httpDate(res: Response): string | null {
  const raw = res.headers.get("date")
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/**
 * Включить запись потока: создать (или обновить) path-override.
 * Happy path — POST add; если override уже существует (400), дообновляем patch.
 */
export async function enableRecording(
  streamKey: string,
  opts: MtxClientOptions & { retentionDays?: number } = {},
): Promise<GatewayEffect> {
  assertStreamKey(streamKey)
  const body = buildRecordingOverride(opts.retentionDays ?? 7)
  const path = `/v3/config/paths/add/${encodeURIComponent(streamKey)}`

  const post = await request("POST", path, { ...opts, body })
  if (post.ok) return { gatewayTime: httpDate(post) }
  if (post.status === 400) {
    // Override существует → обновляем (смена ретенции тарифа).
    const patch = await request("PATCH", `/v3/config/paths/patch/${encodeURIComponent(streamKey)}`, {
      ...opts,
      body,
    })
    if (!patch.ok) await readError(patch)
    return { gatewayTime: httpDate(patch) }
  }
  return readError(post)
}

/**
 * Выключить запись: удалить override (поток вернётся к regex-fallback
 * record:false). Идемпотентно — 404 означает «уже выключено».
 */
export async function disableRecording(
  streamKey: string,
  opts: MtxClientOptions = {},
): Promise<GatewayEffect> {
  assertStreamKey(streamKey)
  const res = await request("DELETE", `/v3/config/paths/delete/${encodeURIComponent(streamKey)}`, opts)
  if (!res.ok && res.status !== 404) await readError(res)
  return { gatewayTime: httpDate(res) }
}

/** Конфиг пути (включая runtime-override), null — пути нет. */
export async function getPathConfig(
  streamKey: string,
  opts: MtxClientOptions = {},
): Promise<Record<string, unknown> | null> {
  assertStreamKey(streamKey)
  const res = await request("GET", `/v3/config/paths/get/${encodeURIComponent(streamKey)}`, opts)
  if (res.status === 404) return null
  if (!res.ok) await readError(res)
  return (await res.json()) as Record<string, unknown>
}

/**
 * Пути с включённой записью (для сверки состояния БД ↔ gateway).
 * Возвращает точные имена override-путей с record:true.
 *
 * Ответ list-эндпоинта пагинирован конвертом {itemCount, pageCount, items}
 * (проверено на MediaMTX 1.20); берём items первой страницы — override-путей
 * у клуба единицы, пагинация не актуальна.
 */
export async function listRecordingPaths(opts: MtxClientOptions = {}): Promise<string[]> {
  const res = await request("GET", "/v3/config/paths/list", opts)
  if (!res.ok) await readError(res)
  const body = (await res.json()) as unknown
  const items = (Array.isArray(body) ? body : ((body as { items?: unknown }).items ?? [])) as Array<
    Record<string, unknown>
  >
  return items.filter((p) => p.record === true).map((p) => String(p.name))
}
