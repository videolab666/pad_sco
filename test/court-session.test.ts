// Чистые хелперы Court Session (plan-4 §5-6): типы/статусы/участники.

import { describe, expect, it } from "vitest"
import {
  PARTICIPANT_ROLES,
  PARTICIPANT_STATUSES,
  QUICK_PLAY_TYPES,
  SESSION_STATUSES,
  SESSION_TYPES,
  isQuickPlayType,
  normalizeParticipant,
  validateSessionInput,
} from "../lib/court-session"

describe("константы §5-6", () => {
  it("типы сессий покрывают форматы плана", () => {
    for (const t of ["match", "training", "open_play", "americano", "mexicano", "king_of_court", "tournament", "custom"]) {
      expect(SESSION_TYPES).toContain(t)
    }
  })

  it("статусы и роли валидны", () => {
    expect(SESSION_STATUSES).toEqual(["preparing", "active", "completed", "cancelled"])
    expect(PARTICIPANT_ROLES).toEqual(["player", "guest", "coach"])
    expect(PARTICIPANT_STATUSES).toContain("checked_in")
    expect(PARTICIPANT_STATUSES).toContain("waiting")
  })

  it("Quick Play (§15): только «самообслуживаемые» типы", () => {
    expect(QUICK_PLAY_TYPES).toEqual(["match", "open_play", "training"])
    expect(isQuickPlayType("match")).toBe(true)
    expect(isQuickPlayType("open_play")).toBe(true)
    // Турнирные форматы — только через управляющие API персонала.
    expect(isQuickPlayType("americano")).toBe(false)
    expect(isQuickPlayType("tournament")).toBe(false)
    expect(isQuickPlayType(undefined)).toBe(false)
  })
})

describe("normalizeParticipant", () => {
  it("гость: имя без playerId, роль guest по умолчанию", () => {
    expect(normalizeParticipant({ name: " Олександр " })).toEqual({
      playerId: null,
      displayName: "Олександр",
      role: "guest",
      status: "expected",
    })
  })

  it("игрок: playerId → роль player по умолчанию", () => {
    expect(normalizeParticipant({ playerId: "uuid-1", name: "Alex" })).toEqual({
      playerId: "uuid-1",
      displayName: "Alex",
      role: "player",
      status: "expected",
    })
  })

  it("тренер и статус check-in", () => {
    const coach = normalizeParticipant({ name: "Coach", role: "coach", status: "checked_in" })
    expect(coach.role).toBe("coach")
    expect(coach.status).toBe("checked_in")
  })

  it("требует имя или playerId", () => {
    expect(() => normalizeParticipant({})).toThrow(/имя или playerId/)
    expect(() => normalizeParticipant({ name: "   " })).toThrow(/имя или playerId/)
  })

  it("отклоняет плохие роль/статус/длину", () => {
    expect(() => normalizeParticipant({ name: "A", role: "referee" })).toThrow(/role/)
    expect(() => normalizeParticipant({ name: "A", status: "late" })).toThrow(/status/)
    expect(() => normalizeParticipant({ name: "A".repeat(101) })).toThrow(/слишком длинное/)
  })
})

describe("validateSessionInput", () => {
  it("принимает корректный набор", () => {
    expect(
      validateSessionInput({
        type: "training",
        status: "preparing",
        courtId: "c-1",
        participants: [
          { name: "Guest" },
          { playerId: "p-1", name: "Player" },
          { name: "Coach", role: "coach" },
        ],
      }),
    ).toEqual([])
  })

  it("собирает все ошибки сразу", () => {
    const errors = validateSessionInput({
      type: "bowling",
      status: "paused",
      courtId: 7,
      participants: [{ name: "" }, { name: "A", role: "hacker" }],
    })
    expect(errors.length).toBe(5)
    expect(errors.some((e) => e.includes("type"))).toBe(true)
    expect(errors.some((e) => e.includes("courtId"))).toBe(true)
    expect(errors.some((e) => e.includes("participants[0]"))).toBe(true)
    expect(errors.some((e) => e.includes("participants[1]"))).toBe(true)
  })

  it("пустой input валиден (defaults)", () => {
    expect(validateSessionInput({})).toEqual([])
  })
})
