// Booking Adapter (plan-4 §13) — чистые функции Playtomic → сессии.

import { describe, expect, it } from "vitest"
import {
  fetchPlaytomicBookings,
  isBookingActive,
  isBookingUpcoming,
  normalizeIsoOffset,
  normalizePlaytomicBooking,
  planBookingSync,
} from "../lib/booking/playtomic"

describe("normalizeIsoOffset", () => {
  it("добавляет двоеточие в офсет +0000 (Playtomic-формат)", () => {
    expect(normalizeIsoOffset("2026-09-02T18:00:00+0000")).toBe("2026-09-02T18:00:00+00:00")
    expect(normalizeIsoOffset("2026-09-02T18:00:00+03:00")).toBe("2026-09-02T18:00:00+03:00") // уже ок
  })
})

describe("normalizePlaytomicBooking", () => {
  it("маппит стандартную бронь booking_search", () => {
    const b = normalizePlaytomicBooking({
      id: "b-1",
      tennis_court: { id: "c-1", name: "Court 1" },
      date: "2026-09-02T18:00:00+0000",
      duration: 90,
      players_list: [
        { player: { first_name: "Иван", last_name: "Петров" } },
        { player: { first_name: "Анна" } },
      ],
      status: "BOOKED",
    })
    expect(b).not.toBeNull()
    expect(b!.externalId).toBe("b-1")
    expect(b!.courtName).toBe("Court 1")
    expect(b!.startsAt).toBe("2026-09-02T18:00:00.000Z")
    expect(b!.endsAt).toBe("2026-09-02T19:30:00.000Z")
    expect(b!.players).toEqual(["Иван Петров", "Анна"])
    expect(b!.status).toBe("booked")
  })

  it("понимает end_date и альтернативные имена полей", () => {
    const b = normalizePlaytomicBooking({
      id: "b-2",
      court_name: " Центральный ",
      start_date: "2026-09-02T10:00:00+0000",
      end_date: "2026-09-02T11:30:00+0000",
      players: ["Гость 1"],
    })
    expect(b!.courtName).toBe("Центральный")
    expect(b!.endsAt).toBe("2026-09-02T11:30:00.000Z")
    expect(b!.players).toEqual(["Гость 1"])
  })

  it("отменённая бронь → status cancelled", () => {
    const b = normalizePlaytomicBooking({ id: "b-3", court_name: "C", date: "2026-09-02T10:00:00+0000", status: "CANCELLED" })
    expect(b!.status).toBe("cancelled")
  })

  it("null для мусора: нет id / нет корта / нет даты / конец раньше начала", () => {
    expect(normalizePlaytomicBooking(null)).toBeNull()
    expect(normalizePlaytomicBooking({ date: "2026-09-02T10:00:00Z" })).toBeNull()
    expect(normalizePlaytomicBooking({ id: "x", court_name: "C" })).toBeNull()
    expect(
      normalizePlaytomicBooking({ id: "x", court_name: "C", date: "2026-09-02T12:00:00+0000", end_date: "2026-09-02T11:00:00+0000" }),
    ).toBeNull()
  })
})

describe("isBookingActive / isBookingUpcoming", () => {
  const now = new Date("2026-09-02T18:30:00Z")
  const active = normalizePlaytomicBooking({
    id: "a", court_name: "C", date: "2026-09-02T18:00:00+0000", duration: 90,
  })!
  const upcoming = normalizePlaytomicBooking({
    id: "u", court_name: "C", date: "2026-09-02T20:00:00+0000", duration: 90,
  })!
  const past = normalizePlaytomicBooking({
    id: "p", court_name: "C", date: "2026-09-02T15:00:00+0000", duration: 60,
  })!

  it("активная: start <= now < end", () => {
    expect(isBookingActive(active, now)).toBe(true)
    expect(isBookingUpcoming(active, now)).toBe(false)
  })
  it("предстоящая: start > now", () => {
    expect(isBookingUpcoming(upcoming, now)).toBe(true)
    expect(isBookingActive(upcoming, now)).toBe(false)
  })
  it("прошедшая: now >= end", () => {
    expect(isBookingActive(past, now)).toBe(false)
    expect(isBookingUpcoming(past, now)).toBe(false)
  })
})

describe("planBookingSync (§13)", () => {
  const now = new Date("2026-09-02T18:30:00Z")
  const courts = [
    { id: "court-1", name: "Корт 1" },
    { id: "court-2", name: "Корт 2" },
  ]

  const mk = (id: string, court: string, offsetMin: number, durMin = 90, status?: string) =>
    normalizePlaytomicBooking({
      id, court_name: court,
      date: new Date(now.getTime() + offsetMin * 60_000).toISOString(),
      duration: durMin,
      status,
    })!

  it("создаёт сессии только для активных броней, остальные — по категориям", () => {
    const plan = planBookingSync({
      bookings: [
        mk("active-1", "Court 1", -30),          // идёт сейчас (30 мин назад началась)
        mk("future-1", "Court 2", 60),           // через час
        mk("past-1", "Court 1", -180, 60),       // закончилась
        mk("dup-1", "Court 1", -10),             // дубль (уже в existing)
        mk("cancel-1", "Court 2", -10, 90, "CANCELLED"),
      ],
      courts,
      courtMapping: { "Court 1": "court-1", "Court 2": "court-2" },
      existingExternalIds: new Set(["dup-1"]),
      now,
    })

    expect(plan.toCreate.map((c) => c.booking.externalId)).toEqual(["active-1"])
    expect(plan.toCreate[0].courtId).toBe("court-1")
    expect(plan.upcoming.map((b) => b.externalId)).toEqual(["future-1"])
    expect(plan.skipped).toEqual({ cancelled: 1, unmapped: [], past: 1, duplicate: 1 })
  })

  it("автосовпадение имени корта без явного маппинга (trim + case-insensitive)", () => {
    const plan = planBookingSync({
      bookings: [mk("a1", "  корт 1 ", -15)],
      courts,
      courtMapping: {},
      existingExternalIds: new Set(),
      now,
    })
    expect(plan.toCreate).toHaveLength(1)
    expect(plan.toCreate[0].courtId).toBe("court-1")
  })

  it("явный courtMapping приоритетнее совпадения имени", () => {
    const plan = planBookingSync({
      bookings: [mk("a2", "Корт 1", -15)],
      courts,
      courtMapping: { "Корт 1": "court-2" },
      existingExternalIds: new Set(),
      now,
    })
    expect(plan.toCreate[0].courtId).toBe("court-2")
  })

  it("немаппированный корт → skipped.unmapped (уникальные имена)", () => {
    const plan = planBookingSync({
      bookings: [mk("x1", "Стена", -15), mk("x2", "Стена", -10)],
      courts,
      courtMapping: {},
      existingExternalIds: new Set(),
      now,
    })
    expect(plan.toCreate).toHaveLength(0)
    expect(plan.skipped.unmapped).toEqual(["Стена"])
  })
})

describe("fetchPlaytomicBookings", () => {
  it("строит URL с датами и tenant_id (mock fetch)", async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = []
    const originalFetch = global.fetch
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), headers: init?.headers as Record<string, string> })
      return new Response(JSON.stringify([{ id: "b1" }]), { status: 200 })
    }) as typeof fetch

    try {
      const raw = await fetchPlaytomicBookings({
        token: "tok",
        tenantId: "t-9",
        from: new Date("2026-09-02T00:00:00Z"),
        to: new Date("2026-09-03T00:00:00Z"),
      })
      expect(raw).toEqual([{ id: "b1" }])
      expect(calls[0].url).toContain("sport=PADEL")
      expect(calls[0].url).toContain("tenant_id=t-9")
      expect(calls[0].url).toContain("start_date=2026-09-02")
      expect(calls[0].headers.Authorization).toBe("Bearer tok")
    } finally {
      global.fetch = originalFetch
    }
  })

  it("прокидывает ошибку не-200", async () => {
    const originalFetch = global.fetch
    global.fetch = (async () => new Response("denied", { status: 403 })) as typeof fetch
    try {
      await expect(
        fetchPlaytomicBookings({ token: "bad", from: new Date(), to: new Date() }),
      ).rejects.toThrow("Playtomic API 403")
    } finally {
      global.fetch = originalFetch
    }
  })
})
