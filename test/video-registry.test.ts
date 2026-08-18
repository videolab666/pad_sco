// Чистые хелперы видео-реестра (plan-4 §133/§138/§140/§152).

import { describe, expect, it } from "vitest"
import {
  MARKER_IMPORTANCE,
  buildStreamKey,
  canTransitionRecording,
  isValidHeartbeat,
  markerDefaults,
} from "../lib/video-registry"

describe("buildStreamKey (§130)", () => {
  it("court-{shortCode}-{роль}", () => {
    expect(buildStreamKey("7dkrYGs")).toBe("court-7dkrYGs-main")
    expect(buildStreamKey("Ab3xK9Q", "tactical")).toBe("court-Ab3xK9Q-tactical")
  })
})

describe("важность маркеров (§140)", () => {
  it("ключевые значения из плана", () => {
    expect(MARKER_IMPORTANCE.MATCH_POINT).toBe(7)
    expect(MARKER_IMPORTANCE.MATCH_WON).toBe(8)
    expect(MARKER_IMPORTANCE.GOLDEN_POINT).toBe(4)
    expect(MARKER_IMPORTANCE.MANUAL_HIGHLIGHT).toBe(10)
  })

  it("важность растёт с драматургией момента", () => {
    const order = ["NORMAL_POINT", "GAME_POINT", "BREAK_POINT", "SET_POINT", "MATCH_POINT", "MATCH_WON"]
    for (let i = 1; i < order.length; i++) {
      expect(MARKER_IMPORTANCE[order[i]]).toBeGreaterThan(MARKER_IMPORTANCE[order[i - 1]])
    }
  })
})

describe("markerDefaults: pre/post-roll (§138)", () => {
  it("MATCH_POINT: 20с до / 10с после", () => {
    expect(markerDefaults("MATCH_POINT")).toEqual({ importance: 7, preRollMs: 20000, postRollMs: 10000 })
  })

  it("SET_WON: 15с / 8с", () => {
    expect(markerDefaults("SET_WON").preRollMs).toBe(15000)
    expect(markerDefaults("SET_WON").postRollMs).toBe(8000)
  })

  it("MANUAL_HIGHLIGHT: важность 10", () => {
    expect(markerDefaults("MANUAL_HIGHLIGHT").importance).toBe(10)
  })

  it("неизвестный тип — базовые значения", () => {
    expect(markerDefaults("SOMETHING")).toEqual({ importance: 1, preRollMs: 10000, postRollMs: 5000 })
  })
})

describe("машина состояний записи (§133)", () => {
  it("допустимые переходы", () => {
    expect(canTransitionRecording("idle", "arming")).toBe(true)
    expect(canTransitionRecording("arming", "recording")).toBe(true)
    expect(canTransitionRecording("recording", "finalizing")).toBe(true)
    expect(canTransitionRecording("finalizing", "uploading")).toBe(true)
    expect(canTransitionRecording("finalizing", "ready")).toBe(true)
    expect(canTransitionRecording("uploading", "ready")).toBe(true)
    expect(canTransitionRecording("failed", "arming")).toBe(true) // повторная попытка
  })

  it("недопустимые переходы", () => {
    expect(canTransitionRecording("recording", "ready")).toBe(false) // только через finalizing/uploading
    expect(canTransitionRecording("idle", "recording")).toBe(false)
    expect(canTransitionRecording("ready", "recording")).toBe(false) // терминальный
    expect(canTransitionRecording("ready", "arming")).toBe(false)
  })
})

describe("isValidHeartbeat (§152)", () => {
  it("принимает корректный ключ и статус", () => {
    expect(isValidHeartbeat({ streamKey: "court-7dkrYGs-main", status: "recording" })).toEqual([])
    expect(isValidHeartbeat({ streamKey: "court-Ab3xK9Q-tactical" })).toEqual([])
  })

  it("отклоняет чужие префиксы, короткие коды и плохие роли", () => {
    expect(isValidHeartbeat({ streamKey: "camera-1-main" }).length).toBeGreaterThan(0)
    expect(isValidHeartbeat({ streamKey: "court-ab-main" }).length).toBeGreaterThan(0)
    expect(isValidHeartbeat({ streamKey: "court-7dkrYGs-video" }).length).toBeGreaterThan(0)
    expect(isValidHeartbeat({ streamKey: "court-7dkrYGs-main", status: "hot" }).length).toBeGreaterThan(0)
  })
})
