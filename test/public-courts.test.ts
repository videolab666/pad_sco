// Кэш публичного реестра кортов (lib/public-courts) — чистые хелперы.

import { describe, expect, it } from "vitest"
import { buildCourtsCache, parseCourtsCache, type PublicCourt } from "../lib/public-courts"

const court = (id: string, name: string, legacyNumber: number | null = null): PublicCourt => ({
  id,
  name,
  shortCode: "Ab3xK9Q",
  legacyNumber,
  sortOrder: 1,
})

describe("parseCourtsCache", () => {
  it("принимает свежий валидный кэш", () => {
    const now = Date.now()
    const raw = buildCourtsCache([court("id-1", "1", 1), court("id-2", "Центральный")], now)
    const parsed = parseCourtsCache(raw, now + 30_000)
    expect(parsed?.length).toBe(2)
    expect(parsed?.[1].name).toBe("Центральный")
  })

  it("отклоняет просроченный кэш (TTL 60s)", () => {
    const now = Date.now()
    const raw = buildCourtsCache([court("id-1", "1", 1)], now)
    expect(parseCourtsCache(raw, now + 61_000)).toBeNull()
  })

  it("отклоняет мусор и записи без полей", () => {
    expect(parseCourtsCache(null)).toBeNull()
    expect(parseCourtsCache("not json")).toBeNull()
    expect(parseCourtsCache(JSON.stringify({ savedAt: Date.now() }))).toBeNull()
    expect(
      parseCourtsCache(JSON.stringify({ savedAt: Date.now(), courts: [{ id: "x" }] })),
    ).toBeNull()
  })

  it("buildCourtsCache → parseCourtsCache — roundtrip", () => {
    const courts = [court("a", "Court A"), court("b", "Корт Б", 3)]
    expect(parseCourtsCache(buildCourtsCache(courts))).toEqual(courts)
  })
})
