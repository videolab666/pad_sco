// Remote Camera Settings — чистая логика (plan 2026-09-02): sanitize ключей,
// merge, протокол синхронизации push/adopt/none на монотонных счётчиках.

import { describe, expect, it } from "vitest"
import {
  mergeDesired,
  resolveSettingsSync,
  sanitizeCameraPatch,
  sanitizeStreamPatch,
} from "../lib/camera-remote-settings"

describe("sanitizeCameraPatch (whitelist + клампинг)", () => {
  it("пропускает валидные ключи", () => {
    const out = sanitizeCameraPatch({
      camera_exposure_mode: "manualShutter",
      camera_exposure_ns: 20_000_000,
      camera_iso: 800,
      camera_auto_focus: false,
    })
    expect(out).toEqual({
      camera_exposure_mode: "manualShutter",
      camera_exposure_ns: 20_000_000,
      camera_iso: 800,
      camera_auto_focus: false,
    })
  })

  it("клампитOutOfRange-значения", () => {
    const out = sanitizeCameraPatch({ camera_iso: 999_999, camera_exposure_ns: 5, camera_gamma: 9 })
    expect(out.camera_iso).toBe(102_400)
    expect(out.camera_exposure_ns).toBe(1_000_000)
    expect(out.camera_gamma).toBe(2)
  })

  it("отбрасывает мусорные ключи и битые типы", () => {
    const out = sanitizeCameraPatch({
      hacked_key: "x",
      camera_iso: "восемьсот",
      camera_exposure_mode: "cinema",
      camera_auto_focus: "yes",
    })
    expect(out).toEqual({})
  })

  it("не-объект → пустой патч", () => {
    expect(sanitizeCameraPatch(null)).toEqual({})
    expect(sanitizeCameraPatch("manual")).toEqual({})
  })
})

describe("sanitizeStreamPatch", () => {
  it("чёткое разрешение и код корта проходят", () => {
    expect(sanitizeStreamPatch({ resolution: "1280x720", courtCode: "nivki01" })).toEqual({
      resolution: "1280x720",
      courtCode: "nivki01",
    })
  })

  it("нечётное/битое разрешение и плохой код отбрасываются", () => {
    expect(sanitizeStreamPatch({ resolution: "1281x720", courtCode: "ок" })).toEqual({})
  })
})

describe("mergeDesired (частичный PUT)", () => {
  it("мержит camera поверх текущего, сохраняя остальное", () => {
    const current = { camera: { camera_iso: 800, camera_gamma: 1 }, stream: { resolution: "1920x1080" } }
    const next = mergeDesired(current, { camera: { camera_iso: 1600 } })
    expect(next.camera).toEqual({ camera_iso: 1600, camera_gamma: 1 })
    expect(next.stream).toEqual({ resolution: "1920x1080" })
  })
})

describe("resolveSettingsSync (протокол без часов)", () => {
  const server = { settingsVersion: 5, ackedLocalSeq: 2, desired: { camera: { camera_iso: 800 } } }

  it("телефон отстал и не менял → push", () => {
    const decision = resolveSettingsSync(server, { settingsVersion: 3, localSeq: 2 })
    expect(decision.action).toBe("push")
    if (decision.action === "push") {
      expect(decision.version).toBe(5)
      expect(decision.desired.camera).toEqual({ camera_iso: 800 })
    }
  })

  it("телефон менял локально → adopt его конфига (version+1, acked обновлён)", () => {
    const decision = resolveSettingsSync(server, {
      settingsVersion: 5,
      localSeq: 3,
      settings: { camera_iso: 1600 },
    })
    expect(decision.action).toBe("adopt")
    if (decision.action === "adopt") {
      expect(decision.version).toBe(6)
      expect(decision.desired.camera).toEqual({ camera_iso: 1600 })
      expect(decision.ackedLocalSeq).toBe(3)
      // stream не теряется
      expect(decision.desired.stream).toBeUndefined()
    }
  })

  it("синхронизированы → none", () => {
    expect(
      resolveSettingsSync(server, { settingsVersion: 5, localSeq: 2, settings: { camera_iso: 800 } }).action,
    ).toBe("none")
  })

  it("adopt не срабатывает без тела конфига (защита от пустышек)", () => {
    expect(resolveSettingsSync(server, { settingsVersion: 5, localSeq: 9, settings: {} }).action).toBe("none")
    expect(resolveSettingsSync(server, { settingsVersion: 5, localSeq: 9 }).action).toBe("none")
  })

  it("свежая камера (version 0) получает push даже без localSeq", () => {
    const decision = resolveSettingsSync(
      { settingsVersion: 1, ackedLocalSeq: 0, desired: { camera: { camera_exposure_mode: "manualShutter" } } },
      { settingsVersion: 0, localSeq: 0 },
    )
    expect(decision.action).toBe("push")
  })
})
