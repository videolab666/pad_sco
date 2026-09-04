// Ретрай 409 в sendMatchCommand (фикс 2026-09-04 №2 — потерянные очки при
// быстрых кликах): команда, проигравшая гонку параллельных писателей,
// обязана повториться с ТЕМ ЖЕ operationId (идемпотентность на сервере
// страхует от двойного применения), а не теряться.

import { afterEach, describe, expect, it, vi } from "vitest"
import { sendMatchCommand } from "../lib/match-command-client"

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("sendMatchCommand: 409-retry", () => {
  it("первый 409 → повтор с тем же operationId → ok", async () => {
    const bodies: any[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      if (fetchMock.mock.calls.length === 1) {
        return jsonResponse(409, {
          status: "conflict",
          reason: "server_ahead (server=5)",
          revision: 5,
          match: { id: "m1", revision: 5 },
        })
      }
      return jsonResponse(200, { status: "ok", revision: 6 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const res = await sendMatchCommand("m1", "point", { team: "teamA" })

    expect(res).toEqual({ status: "ok", revision: 6 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // Один и тот же operationId в обоих заходах — идемпотентность.
    expect(bodies[0].operationId).toBe(bodies[1].operationId)
    expect(bodies[0].command).toBe("point")
  })

  it("три 409 подряд → conflict с серверным снапшотом (команда не потеряна молча)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(409, { status: "conflict", revision: 9, match: { id: "m1", revision: 9 } }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const res = await sendMatchCommand("m1", "point", { team: "teamB" })

    expect(res.status).toBe("conflict")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("400 (например, match_completed) не ретраится — результат failed сразу", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(400, { error: "The match is already completed", code: "match_completed" }))
    vi.stubGlobal("fetch", fetchMock)

    const res = await sendMatchCommand("m1", "finish")

    expect(res).toEqual({ status: "failed", error: "http_400" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("сетевая ошибка ретраится (офлайн-клик не теряется), после 3 попыток — failed", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network down")
    })
    vi.stubGlobal("fetch", fetchMock)

    const res = await sendMatchCommand("m1", "point", { team: "teamA" })

    expect(res).toEqual({ status: "failed", error: "network" })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("5xx ретраится, успех на второй попытке", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(502, { error: "bad gateway" }))
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok", revision: 8 }))
    vi.stubGlobal("fetch", fetchMock as any)

    const res = await sendMatchCommand("m1", "point", { team: "teamB" })

    expect(res).toEqual({ status: "ok", revision: 8 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
