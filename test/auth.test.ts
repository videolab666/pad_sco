// Чистые хелперы auth-контура (plan 2026-09-02 player-auth-video-cabinet):
// participant-матч по metadata.participants[].playerId, гостевые записи,
// имя профиля из OAuth-метаданных.

import { describe, expect, it } from "vitest"
import { displayNameFromAuth, hasPlayerParticipants, isRecordingParticipant } from "../lib/auth"

const meta = (participants: unknown[]) => ({ participants })

describe("isRecordingParticipant (Task 1/7: свои не чужие)", () => {
  it("совпадение playerId → участник", () => {
    expect(isRecordingParticipant(meta([{ name: "A", playerId: "p1" }, { name: "B", playerId: "p2" }]), "p2")).toBe(true)
  })

  it("чужой playerId → не участник", () => {
    expect(isRecordingParticipant(meta([{ name: "A", playerId: "p1" }]), "pX")).toBe(false)
  })

  it("гости без playerId не открывают доступ никому", () => {
    expect(isRecordingParticipant(meta([{ name: "Гость" }]), "p1")).toBe(false)
  })

  it("нет participants / нет playerId → false", () => {
    expect(isRecordingParticipant({}, "p1")).toBe(false)
    expect(isRecordingParticipant(meta([]), "p1")).toBe(false)
    expect(isRecordingParticipant(meta([{ playerId: "p1" }]), null)).toBe(false)
    expect(isRecordingParticipant(null, "p1")).toBe(false)
  })
})

describe("hasPlayerParticipants (гостевая запись или нет)", () => {
  it("хоть один playerId → не гостевая", () => {
    expect(hasPlayerParticipants(meta([{ name: "Гость" }, { name: "A", playerId: "p1" }]))).toBe(true)
  })

  it("только имена → гостевая (доступна по ссылке)", () => {
    expect(hasPlayerParticipants(meta([{ name: "A" }, { name: "B" }]))).toBe(false)
  })

  it("пустой playerId не считается", () => {
    expect(hasPlayerParticipants(meta([{ name: "A", playerId: "" }]))).toBe(false)
  })

  it("нет metadata → гостевая", () => {
    expect(hasPlayerParticipants(undefined)).toBe(false)
  })
})

describe("displayNameFromAuth (Task 2: имя профиля)", () => {
  it("full_name из OAuth приоритетнее email", () => {
    expect(displayNameFromAuth({ email: "ivan@gmail.com", userMetadata: { full_name: "Иван Петров" } })).toBe(
      "Иван Петров",
    )
  })

  it("без метаданных — локальная часть email", () => {
    expect(displayNameFromAuth({ email: "sergey.k@gmail.com" })).toBe("sergey.k")
  })

  it("совсем ничего — дефолт", () => {
    expect(displayNameFromAuth({})).toBe("Игрок")
  })

  it("длинные имена обрезаются до 60", () => {
    expect(displayNameFromAuth({ userMetadata: { full_name: "A".repeat(80) } })).toHaveLength(60)
  })
})
