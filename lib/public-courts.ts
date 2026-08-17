// Клиентский доступ к публичному реестру кортов (GET /api/v1/courts).
//
// localStorage-first: свежие данные по TTL, при офлайне/ошибке — последний
// кэш (тот же паттерн, что у матчей и игроков). Чистые хелперы кэша
// вынесены отдельно и покрыты тестами.

export interface PublicCourt {
  id: string
  name: string
  shortCode: string
  legacyNumber: number | null
  sortOrder: number
}

const CACHE_KEY = "padel_public_courts_v1"
const CACHE_TTL_MS = 60_000

interface CacheEnvelope {
  savedAt: number
  courts: PublicCourt[]
}

/** Чистый парсер кэша: валидная запись с непросроченным TTL или null. */
export function parseCourtsCache(raw: string | null, now = Date.now()): PublicCourt[] | null {
  if (!raw) return null
  try {
    const env = JSON.parse(raw) as CacheEnvelope
    if (
      typeof env?.savedAt !== "number" ||
      !Array.isArray(env.courts) ||
      env.courts.some((c) => typeof c?.id !== "string" || typeof c?.name !== "string")
    ) {
      return null
    }
    if (now - env.savedAt > CACHE_TTL_MS) return null
    return env.courts
  } catch {
    return null
  }
}

/** Сериализация кэша (чистая, для тестов). */
export function buildCourtsCache(courts: PublicCourt[], now = Date.now()): string {
  return JSON.stringify({ savedAt: now, courts })
}

/**
 * Активные корты: кэш → /api/v1/courts → снова кэш (даже просроченный,
 * лучше старые данные, чем никакие). Возвращает [] только если ничего нет.
 */
export async function fetchActiveCourts(): Promise<PublicCourt[]> {
  if (typeof window === "undefined") return []
  let cached: PublicCourt[] | null = null
  try {
    cached = parseCourtsCache(window.localStorage.getItem(CACHE_KEY))
  } catch {
    cached = null
  }
  if (cached) return cached

  try {
    const res = await fetch("/api/v1/courts", { cache: "no-store" })
    if (!res.ok) throw new Error(`courts api: ${res.status}`)
    const data = (await res.json()) as { courts?: PublicCourt[] }
    const courts = Array.isArray(data.courts) ? data.courts : []
    if (courts.length > 0) {
      try {
        window.localStorage.setItem(CACHE_KEY, buildCourtsCache(courts))
      } catch {
        /* quota — не критично */
      }
    }
    return courts
  } catch {
    // Оффлайн/ошибка — отдаём даже просроченный кэш.
    try {
      const raw = window.localStorage.getItem(CACHE_KEY)
      if (raw) return (JSON.parse(raw) as CacheEnvelope).courts ?? []
    } catch {
      /* ignore */
    }
    return []
  }
}
