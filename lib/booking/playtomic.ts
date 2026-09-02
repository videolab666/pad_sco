// Booking Adapter (plan-4 §13): Playtomic → сессии кортов.
//
// Архитектура адаптера: normalize (сырой JSON → NormalizedBooking) и
// planBookingSync (чистое планирование: что создать, что пропустить) —
// чистые функции под тестами. I/O (fetch Playtomic, запись court_sessions)
// живёт в роуте /api/booking.
//
// MVP-модель: синхронизация создаёт сессию для брони, идущей ПРЯМО СЕЙЧАС
// (start <= now < end) — сессия = живая занятость корта (§46 dashboard).
// Предстоящие брони возвращаются списком для отображения, без создания.

export interface NormalizedBooking {
  externalId: string
  courtName: string
  startsAt: string // ISO
  endsAt: string // ISO
  players: string[]
  status: "booked" | "cancelled"
}

/** Чинит Playtomic-офсет без двоеточия: "+0000" → "+00:00" (не по ECMAScript). */
export function normalizeIsoOffset(iso: string): string {
  return iso.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
}

/**
 * Сырая бронь Playtomic → NormalizedBooking. Терпима к вариациям полей
 * (booking_search / bookings / выгрузки). null = запись не опознана.
 */
export function normalizePlaytomicBooking(raw: unknown): NormalizedBooking | null {
  if (typeof raw !== "object" || raw === null) return null
  const r = raw as Record<string, any>

  const externalId = typeof r.id === "string" && r.id ? r.id : null
  const courtName =
    (typeof r.tennis_court === "object" && r.tennis_court !== null
      ? (r.tennis_court as Record<string, any>).name
      : undefined) ??
    (typeof r.court_name === "string" ? r.court_name : undefined) ??
    (typeof r.court === "object" && r.court !== null ? (r.court as Record<string, any>).name : undefined)

  if (!externalId || typeof courtName !== "string" || !courtName) return null

  const dateRaw = typeof r.date === "string" ? r.date : typeof r.start_date === "string" ? r.start_date : null
  if (!dateRaw) return null
  const startMs = Date.parse(normalizeIsoOffset(dateRaw))
  if (!Number.isFinite(startMs)) return null

  // duration — минуты (Playtomic); endDate — альтернативное поле
  let endMs: number
  if (typeof r.end_date === "string" && r.end_date) {
    endMs = Date.parse(normalizeIsoOffset(r.end_date))
  } else {
    const minutes = typeof r.duration === "number" && r.duration > 0 ? r.duration : 90
    endMs = startMs + minutes * 60_000
  }
  if (!Number.isFinite(endMs)) endMs = startMs + 90 * 60_000
  if (endMs < startMs) return null

  const players: string[] = []
  const list = Array.isArray(r.players_list) ? r.players_list : Array.isArray(r.players) ? r.players : []
  for (const p of list) {
    if (typeof p === "string") {
      if (p.trim()) players.push(p.trim())
    } else if (p && typeof p === "object") {
      const pl = (p as Record<string, any>).player ?? p
      const name = [pl.first_name, pl.last_name].filter((s) => typeof s === "string" && s).join(" ").trim()
      if (name) players.push(name)
    }
  }

  const statusRaw = typeof r.status === "string" ? r.status.toUpperCase() : "BOOKED"
  return {
    externalId,
    courtName: courtName.trim(),
    startsAt: new Date(startMs).toISOString(),
    endsAt: new Date(endMs).toISOString(),
    players,
    status: statusRaw.includes("CANCEL") ? "cancelled" : "booked",
  }
}

/** Бронь идёт прямо сейчас: start <= now < end. */
export function isBookingActive(b: NormalizedBooking, now: Date): boolean {
  const t = now.getTime()
  return Date.parse(b.startsAt) <= t && t < Date.parse(b.endsAt)
}

/** Бронь в будущем (ещё не началась). */
export function isBookingUpcoming(b: NormalizedBooking, now: Date): boolean {
  return Date.parse(b.startsAt) > now.getTime()
}

export interface SyncCourt {
  id: string
  name: string
}

export interface BookingSyncPlan {
  toCreate: Array<{ courtId: string; booking: NormalizedBooking }>
  upcoming: NormalizedBooking[]
  skipped: {
    cancelled: number
    unmapped: string[] // имена внешних кортов без маппинга
    past: number
    duplicate: number
  }
}

/**
 * Чистое планирование синхронизации (§13): какие сессии создать сейчас.
 *
 * Разрешение корта: явный courtMapping (внешнее имя → courtId) имеет
 * приоритет; иначе — автосовпадение по имени корта (trim/case-insensitive).
 * duplicate — externalId уже есть в metadata сессий (idempotency).
 */
export function planBookingSync(input: {
  bookings: NormalizedBooking[]
  courts: SyncCourt[]
  courtMapping: Record<string, string>
  existingExternalIds: Set<string>
  now: Date
}): BookingSyncPlan {
  const plan: BookingSyncPlan = {
    toCreate: [],
    upcoming: [],
    skipped: { cancelled: 0, unmapped: [], past: 0, duplicate: 0 },
  }

  const byLowerName = new Map(input.courts.map((c) => [c.name.trim().toLowerCase(), c.id]))

  for (const b of input.bookings) {
    if (b.status === "cancelled") {
      plan.skipped.cancelled++
      continue
    }

    const courtId =
      input.courtMapping[b.courtName] ?? byLowerName.get(b.courtName.trim().toLowerCase()) ?? null
    if (!courtId) {
      if (!plan.skipped.unmapped.includes(b.courtName)) plan.skipped.unmapped.push(b.courtName)
      continue
    }

    if (isBookingUpcoming(b, input.now)) {
      plan.upcoming.push(b)
      continue
    }
    if (!isBookingActive(b, input.now)) {
      plan.skipped.past++
      continue
    }
    if (input.existingExternalIds.has(b.externalId)) {
      plan.skipped.duplicate++
      continue
    }

    plan.toCreate.push({ courtId, booking: b })
  }

  return plan
}

// ─── Живой fetch Playtomic (нужен токен партнёрского API) ────────────────────

/**
 * GET booking_search за период. Токен — Bearer. Возвращает сырые записи;
 * normalizePlaytomicBooking вызовет вызывающий код (роут).
 * Ошибки сети/авторизации прокидываются наверх как Error.
 */
export async function fetchPlaytomicBookings(opts: {
  token: string
  tenantId?: string
  from: Date
  to: Date
}): Promise<unknown[]> {
  const params = new URLSearchParams({
    sport: "PADEL",
    start_date: opts.from.toISOString().slice(0, 10),
    end_date: opts.to.toISOString().slice(0, 10),
  })
  if (opts.tenantId) params.set("tenant_id", opts.tenantId)

  const res = await fetch(`https://api.playtomic.com/v1/booking_search?${params}`, {
    headers: { Authorization: `Bearer ${opts.token}`, Accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Playtomic API ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 300))
  }
  const data = await res.json()
  return Array.isArray(data) ? data : []
}
