// MediaMTX Control API-клиент (plan 2026-09-02, Task 1).
//
// Чистые хелперы + HTTP-обёртка с замоканным fetch: override-тело, upsert
// (POST → PATCH), идемпотентный DELETE, таймаут/ретраи, фильтр записывающих
// путей для сверки состояния (plan Task 2.4).

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  MediaMTXApiError,
  MediaMTXUnavailable,
  MediaMTXValidationError,
  buildRecordingOverride,
  disableRecording,
  enableRecording,
  getPathConfig,
  isValidStreamKey,
  listRecordingPaths,
  retentionToMediaMTX,
  validateRetentionDays,
} from "../lib/mediamtx-client"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.MEDIAMTX_CONTROL_URL
})

describe("isValidStreamKey", () => {
  it("принимает ключи court-{код}-{роль}", () => {
    expect(isValidStreamKey("court-7dkrYGs-main")).toBe(true)
    expect(isValidStreamKey("court-ABC1234-tactical")).toBe(true)
    expect(isValidStreamKey("court-test12-player-a")).toBe(true)
  })

  it("отклоняет чужие форматы", () => {
    expect(isValidStreamKey("all")).toBe(false)
    expect(isValidStreamKey("court-x-main")).toBe(false) // код < 3 символов
    expect(isValidStreamKey("court-abcdef-live")).toBe(false) // неизвестная роль
    expect(isValidStreamKey("")).toBe(false)
  })
})

describe("retentionToMediaMTX (§148)", () => {
  it("дни → строка MediaMTX", () => {
    expect(retentionToMediaMTX(7)).toBe("7d")
    expect(retentionToMediaMTX(30)).toBe("30d")
  })

  it("валидация: только целые 1..3650", () => {
    expect(validateRetentionDays(0)).toHaveLength(1)
    expect(validateRetentionDays(3.5)).toHaveLength(1)
    expect(validateRetentionDays(5000)).toHaveLength(1)
    expect(validateRetentionDays(7)).toHaveLength(0)
    expect(() => retentionToMediaMTX(0)).toThrow(MediaMTXValidationError)
  })
})

describe("buildRecordingOverride", () => {
  it("тело override: record + ретенция", () => {
    expect(buildRecordingOverride(30)).toEqual({ record: true, recordDeleteAfter: "30d" })
  })
})

describe("enableRecording", () => {
  it("happy path: один POST с телом override", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({}))
    await enableRecording("court-7dkrYGs-main", { fetchFn, retentionDays: 30 })

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe("http://127.0.0.1:9997/v3/config/paths/add/court-7dkrYGs-main")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ record: true, recordDeleteAfter: "30d" })
  })

  it("override уже есть (400) → PATCH-обновление", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "path already exists" }, 400))
      .mockResolvedValueOnce(json({}))
    await enableRecording("court-7dkrYGs-main", { fetchFn, retentionDays: 7 })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(fetchFn.mock.calls[1][0]).toContain("/v3/config/paths/patch/court-7dkrYGs-main")
    expect(fetchFn.mock.calls[1][1].method).toBe("PATCH")
  })

  it("невалидный ключ отклоняется до HTTP", async () => {
    const fetchFn = vi.fn()
    await expect(enableRecording("all", { fetchFn })).rejects.toThrow(MediaMTXValidationError)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("упорная ошибка API → MediaMTXApiError со статусом", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: "bad" }, 403))
    await expect(enableRecording("court-7dkrYGs-main", { fetchFn })).rejects.toThrow(MediaMTXApiError)
  })
})

describe("disableRecording", () => {
  it("DELETE override", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({}))
    await disableRecording("court-7dkrYGs-main", { fetchFn })
    expect(fetchFn.mock.calls[0][1].method).toBe("DELETE")
  })

  it("404 = уже выключено → не ошибка (идемпотентность)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: "not found" }, 404))
    await expect(disableRecording("court-7dkrYGs-main", { fetchFn })).resolves.toEqual({ gatewayTime: null })
  })
})

describe("getPathConfig", () => {
  it("404 → null, 200 → конфиг", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "not found" }, 404))
      .mockResolvedValueOnce(json({ name: "court-7dkrYGs-main", record: true }))
    expect(await getPathConfig("court-7dkrYGs-main", { fetchFn })).toBeNull()
    expect(await getPathConfig("court-7dkrYGs-main", { fetchFn })).toEqual({
      name: "court-7dkrYGs-main",
      record: true,
    })
  })
})

describe("listRecordingPaths (сверка БД ↔ gateway)", () => {
  it("разворачивает пагинированный конверт и оставляет record:true", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        itemCount: 4,
        pageCount: 1,
        items: [
          { name: "court-aaa-main", record: true },
          { name: "~^court-", record: false },
          { name: "court-bbb-main", record: false },
          { name: "court-ccc-tactical", record: true },
        ],
      }),
    )
    expect(await listRecordingPaths({ fetchFn })).toEqual(["court-aaa-main", "court-ccc-tactical"])
  })
})

describe("устойчивость HTTP-обёртки", () => {
  it("сеть упала (после ретраев) → MediaMTXUnavailable", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    await expect(enableRecording("court-7dkrYGs-main", { fetchFn, retries: 1 })).rejects.toThrow(
      MediaMTXUnavailable,
    )
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it("5xx ретраится и проходит со второй попытки", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({}))
    await expect(enableRecording("court-7dkrYGs-main", { fetchFn, retries: 1 })).resolves.toEqual({ gatewayTime: null })
  })

  it("MEDIAMTX_CONTROL_URL перекрывает дефолт", async () => {
    process.env.MEDIAMTX_CONTROL_URL = "http://gateway.internal:9997/"
    const fetchFn = vi.fn().mockResolvedValue(json({}))
    await disableRecording("court-7dkrYGs-main", { fetchFn })
    expect(fetchFn.mock.calls[0][0]).toBe("http://gateway.internal:9997/v3/config/paths/delete/court-7dkrYGs-main")
  })
})

describe("gatewayTime (единый источник времени, plan 2026-09-02)", () => {
  it("enableRecording возвращает часы gateway из HTTP Date", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { Date: "Wed, 02 Sep 2026 19:00:00 GMT" } }),
    )
    const effect = await enableRecording("court-7dkrYGs-main", { fetchFn })
    expect(effect.gatewayTime).toBe("2026-09-02T19:00:00.000Z")
  })

  it("без заголовка Date → null (фолбэк на таймстампы приложения)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({}))
    const effect = await disableRecording("court-7dkrYGs-main", { fetchFn })
    expect(effect.gatewayTime).toBeNull()
  })
})
