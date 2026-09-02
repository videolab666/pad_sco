// Booking API (plan-4 §13) — settings-auth.
//
// GET   /api/booking — конфиг: { provider, courtMapping, lastSync }
// PATCH /api/booking — сохранить конфиг { courtMapping?, playtomicToken?, tenantId? }
// POST  /api/booking — синхронизация:
//        · body.rawBookings[] — вставка JSON (выгрузка Playtomic), ИЛИ
//        · живой fetch, если сохранён playtomicToken
//        Создаёт court_sessions для активных броней (idempotent по
//        metadata.booking_id), возвращает план и предстоящие брони.

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { listCourts } from "@/lib/court-registry"
import { createSession } from "@/lib/court-session"
import {
  fetchPlaytomicBookings,
  normalizePlaytomicBooking,
  planBookingSync,
} from "@/lib/booking/playtomic"

interface BookingConfig {
  provider: "playtomic"
  courtMapping: Record<string, string>
  playtomicToken?: string
  tenantId?: string
  lastSync?: string
}

async function readConfig(): Promise<BookingConfig> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase.from("club_settings").select("value").eq("key", "booking").maybeSingle()
  const v = (data?.value ?? {}) as Partial<BookingConfig>
  return {
    provider: "playtomic",
    courtMapping: v.courtMapping && typeof v.courtMapping === "object" ? v.courtMapping : {},
    playtomicToken: v.playtomicToken,
    tenantId: v.tenantId,
    lastSync: v.lastSync,
  }
}

async function writeConfig(patch: Partial<BookingConfig>): Promise<BookingConfig> {
  const current = await readConfig()
  const next: BookingConfig = { ...current, ...patch, provider: "playtomic" }
  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: "booking", value: next, updated_at: new Date().toISOString() }, { onConflict: "key" })
  if (error) throw new Error(`booking write: ${error.message}`)
  return next
}

/** externalId уже привязанных к сессиям броней (metadata.booking_id). */
async function existingBookingIds(externalIds: string[]): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set()
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("court_sessions")
    .select("metadata")
    .contains("metadata", { source: "playtomic" })
    .limit(500)
  const found = new Set<string>()
  for (const row of data ?? []) {
    const id = (row.metadata as Record<string, unknown>)?.booking_id
    if (typeof id === "string" && externalIds.includes(id)) found.add(id)
  }
  return found
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const config = await readConfig()
  const courts = await listCourts(false).catch(() => [])
  return NextResponse.json({
    provider: config.provider,
    courtMapping: config.courtMapping,
    hasToken: Boolean(config.playtomicToken),
    tenantId: config.tenantId ?? null,
    lastSync: config.lastSync ?? null,
    courts: courts.map((c) => ({ id: c.id, name: c.name, number: c.legacyNumber })),
  })
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: { courtMapping?: unknown; playtomicToken?: unknown; tenantId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const patch: Partial<BookingConfig> = {}
  if (body.courtMapping !== undefined) {
    if (typeof body.courtMapping !== "object" || body.courtMapping === null ||
        Object.values(body.courtMapping).some((v) => typeof v !== "string")) {
      return NextResponse.json({ error: "invalid_court_mapping" }, { status: 400 })
    }
    patch.courtMapping = body.courtMapping as Record<string, string>
  }
  if (body.playtomicToken !== undefined) {
    const token = body.playtomicToken
    if (token !== null && typeof token !== "string") {
      return NextResponse.json({ error: "invalid_token" }, { status: 400 })
    }
    patch.playtomicToken = (token as string) || undefined
  }
  if (body.tenantId !== undefined) {
    if (typeof body.tenantId !== "string") return NextResponse.json({ error: "invalid_tenant_id" }, { status: 400 })
    patch.tenantId = body.tenantId || undefined
  }

  let config: BookingConfig
  try {
    config = await writeConfig(patch)
  } catch (e) {
    return NextResponse.json({ error: "write_failed", message: (e as Error).message }, { status: 500 })
  }
  return NextResponse.json({ courtMapping: config.courtMapping, hasToken: Boolean(config.playtomicToken) })
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: { rawBookings?: unknown[] } = {}
  try {
    body = await request.json()
  } catch { /* пустое тело = живой fetch */ }

  // ── Источник данных: вставка JSON или живой fetch ──
  let raw: unknown[]
  if (Array.isArray(body.rawBookings)) {
    raw = body.rawBookings
  } else {
    const config = await readConfig()
    if (!config.playtomicToken) {
      return NextResponse.json(
        { error: "no_source", hint: "Вставьте JSON броней (rawBookings) или сохраните токен Playtomic API" },
        { status: 400 },
      )
    }
    const now = new Date()
    try {
      raw = await fetchPlaytomicBookings({
        token: config.playtomicToken,
        tenantId: config.tenantId,
        from: new Date(now.getTime() - 12 * 3600_000),
        to: new Date(now.getTime() + 36 * 3600_000),
      })
    } catch (e) {
      return NextResponse.json({ error: "playtomic_fetch_failed", message: (e as Error).message }, { status: 502 })
    }
  }

  const bookings = raw.map(normalizePlaytomicBooking).filter((b): b is NonNullable<typeof b> => b !== null)

  // ── План: чистая функция (§13) ──
  const courts = await listCourts(false).catch(() => [])
  const config = await readConfig()
  const existing = await existingBookingIds(bookings.map((b) => b.externalId))
  const plan = planBookingSync({
    bookings,
    courts: courts.map((c) => ({ id: c.id, name: c.name })),
    courtMapping: config.courtMapping,
    existingExternalIds: existing,
    now: new Date(),
  })

  // ── Создание сессий для активных броней ──
  const created: Array<{ sessionId: string; bookingId: string; courtId: string }> = []
  const errors: string[] = []
  for (const item of plan.toCreate) {
    try {
      const session = await createSession({
        courtId: item.courtId,
        type: "open_play",
        status: "active",
        metadata: {
          source: "playtomic",
          booking_id: item.booking.externalId,
          booking_starts_at: item.booking.startsAt,
          booking_ends_at: item.booking.endsAt,
          players: item.booking.players,
        },
      })
      created.push({ sessionId: session.id, bookingId: item.booking.externalId, courtId: item.courtId })
    } catch (e) {
      errors.push(`${item.booking.externalId}: ${(e as Error).message}`.slice(0, 200))
    }
  }

  try {
    await writeConfig({ lastSync: new Date().toISOString() })
  } catch { /* lastSync не критичен для результата синхронизации */ }

  return NextResponse.json({
    created,
    createdCount: created.length,
    upcoming: plan.upcoming,
    skipped: plan.skipped,
    errors,
    normalizedCount: bookings.length,
    rawCount: raw.length,
  })
}
