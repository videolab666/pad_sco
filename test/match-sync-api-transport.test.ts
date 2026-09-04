// Прод-транспорт sync-engine (фикс 2026-09-04): drain обязан писать снапшот
// через PUT /api/match/[id] (service-роль сервера), а не прямым anon-клиентом
// (мёртв под RLS — тихий no-op). Инжект createClient НЕ ставим: проверяем
// именно HTTP-путь, эмулируя только доступность окружения и fetch.

import { afterEach, describe, expect, it, vi } from "vitest"

// ─── Минимальные браузерные полифиллы (до импорта движка) ──────────────────────
const _ls = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (_ls.has(k) ? _ls.get(k)! : null),
  setItem: (k: string, v: string) => void _ls.set(k, String(v)),
  removeItem: (k: string) => void _ls.delete(k),
  clear: () => void _ls.clear(),
  key: (i: number) => Array.from(_ls.keys())[i] ?? null,
  get length() {
    return _ls.size
  },
}
;(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
}

import { __resetSyncTestState, __setSyncTestHooks, getMatchSyncState, syncMatchToServer } from "../lib/match-sync"

// Только окружение — БЕЗ createClient, чтобы транспорт остался HTTP.
__setSyncTestHooks({
  isAvailable: async () => true,
  checkTables: async () => ({ exists: true }),
})

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const makeMatch = (id: string, isCompleted = false) => ({
  id,
  type: "padel",
  format: "doubles",
  createdAt: new Date().toISOString(),
  settings: { sets: 3 },
  teamA: { players: [] },
  teamB: { players: [] },
  score: { teamA: 1, teamB: 0, sets: [], currentSet: { teamA: 0, teamB: 0, currentGame: { teamA: 0, teamB: 0 } } },
  currentServer: { team: "teamA", playerIndex: 0 },
  courtSides: { teamA: "left", teamB: "right" },
  shouldChangeSides: false,
  isCompleted,
  winner: null,
  courtNumber: 1,
})

afterEach(() => {
  vi.unstubAllGlobals()
  __resetSyncTestState()
})

describe("drain через PUT /api/match/[id] (RLS-фикс)", () => {
  it("снапшот уходит HTTP PUT с operationId и baseRevision, очередь очищается", async () => {
    const putBodies: any[] = []
    const fetchMock = vi.fn(async (url: any, init?: RequestInit) => {
      putBodies.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return jsonResponse(200, {
        status: "ok",
        revision: 4,
        match: { ...makeMatch("m-put-1", true), revision: 4 },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    syncMatchToServer({ ...makeMatch("m-put-1", true), revision: 4 }, "snapshot")
    // drain запускается внутри syncMatchToServer fire-and-forget — ждём очереди.
    await vi.waitFor(() => {
      expect(getMatchSyncState("m-put-1").pendingCount).toBe(0)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(putBodies[0].url).toBe("/api/match/m-put-1")
    expect(putBodies[0].body.operation.baseRevision).toBe(0)
    expect(putBodies[0].body.operation.operationId).toEqual(expect.any(String))
    expect(putBodies[0].body.match.id).toBe("m-put-1")
    expect(getMatchSyncState("m-put-1").syncStatus).toBe("idle")
  })

  it("409 server_ahead → конфликт, повторный drain ребейзится и доезжает", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(409, {
          status: "conflict",
          reason: "server_ahead (server=6)",
          revision: 6,
          match: { ...makeMatch("m-put-2"), revision: 6 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { status: "ok", revision: 7, match: { ...makeMatch("m-put-2"), revision: 7 } }))
    vi.stubGlobal("fetch", fetchMock as any)

    syncMatchToServer({ ...makeMatch("m-put-2"), revision: 5 }, "snapshot")
    await vi.waitFor(() => {
      expect(getMatchSyncState("m-put-2").syncStatus).toBe("conflict")
    })

    // Повторный drain (онлайн/focus/ручной retry): авто-ребейс на серверную
    // ревизию и повторная отправка — иначе снапшот висел бы вечно.
    const { drainMatch } = await import("../lib/match-sync")
    await drainMatch("m-put-2")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse(String((fetchMock as any).mock.calls[1][1]?.body))
    expect(secondBody.operation.baseRevision).toBe(6)
    expect(getMatchSyncState("m-put-2").syncStatus).toBe("idle")
    expect(getMatchSyncState("m-put-2").pendingCount).toBe(0)
  })

  it("401 помечается перманентной ошибкой (без бесконечных ретраев)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(401, { error: "Unauthorized" }))
    vi.stubGlobal("fetch", fetchMock)

    syncMatchToServer({ ...makeMatch("m-put-3"), revision: 1 }, "snapshot")
    // Перманентная ошибка уводит операцию в dead-letter, не в бесконечный retry.
    await vi.waitFor(() => {
      const s = getMatchSyncState("m-put-3")
      expect(["dead-letter", "error"]).toContain(s.syncStatus)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
