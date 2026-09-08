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

import {
  __resetSyncTestState,
  __setSyncTestHooks,
  getMatchSyncState,
  drainMatch,
  syncMatchCommand,
  syncMatchToServer,
} from "../lib/match-sync"

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
  it("keeps offline commands beyond the old retry limit and recovers in order", async () => {
    let online = false
    const calls: any[] = []
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body)
      calls.push(body)
      if (!online) throw new Error("connection lost")
      return jsonResponse(200, { revision: calls.length, match: { ...makeMatch("m-offline"), revision: calls.length } })
    }))
    syncMatchCommand(makeMatch("m-offline"), "point", { team: "teamA" })
    await vi.waitFor(() => expect(getMatchSyncState("m-offline").syncStatus).toBe("error"))
    for (let i = 0; i < 8; i++) await drainMatch("m-offline")
    expect(getMatchSyncState("m-offline").pendingCount).toBe(1)
    expect(getMatchSyncState("m-offline").deadLetterCount).toBe(0)
    online = true
    await drainMatch("m-offline")
    expect(getMatchSyncState("m-offline").pendingCount).toBe(0)
    expect(new Set(calls.map(c => c.operationId)).size).toBe(1)
  })

  it("rejects a late point, restores completion, and drains the following metadata command", async () => {
    const { loadSyncRecord } = await import("../lib/match-operation-log")
    const completed = { ...makeMatch("m-reject", true), revision: 12 }
    const bodies: any[] = []
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body)
      bodies.push(body)
      return body.command === "point"
        ? jsonResponse(400, { code: "match_completed", match: completed })
        : jsonResponse(200, { revision: 13, match: { ...completed, revision: 13 } })
    }))
    syncMatchCommand(makeMatch("m-reject"), "point", { team: "teamA" })
    syncMatchCommand(makeMatch("m-reject"), "set-players", { teamA: { name: "Updated" } })
    await vi.waitFor(() => expect(getMatchSyncState("m-reject").pendingCount).toBe(0))
    expect(bodies.map(b => b.command)).toEqual(["point", "set-players"])
    expect(getMatchSyncState("m-reject").deadLetterCount).toBe(1)
    expect(loadSyncRecord("m-reject").snapshot.isCompleted).toBe(true)
  })
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

  it("delivers semantic commands in order through the durable queue", async () => {
    const bodies: any[] = []
    const fetchMock = vi.fn(async (url: any, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      bodies.push({ url: String(url), body })
      const revision = bodies.length
      return jsonResponse(200, {
        status: "ok",
        revision,
        match: { ...makeMatch("m-cmd"), revision },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    syncMatchCommand(makeMatch("m-cmd"), "point", { team: "teamA" }, "judge-a")
    syncMatchCommand(makeMatch("m-cmd"), "point", { team: "teamB" }, "judge-a")

    await vi.waitFor(() => expect(getMatchSyncState("m-cmd").pendingCount).toBe(0))
    expect(bodies.map((x) => x.url)).toEqual([
      "/api/match/m-cmd/command",
      "/api/match/m-cmd/command",
    ])
    expect(bodies.map((x) => x.body.args.team)).toEqual(["teamA", "teamB"])
    expect(bodies[0].body.operationId).not.toBe(bodies[1].body.operationId)
  })

  it("retries a command after a concurrent referee advances the server", async () => {
    const bodies: any[] = []
    const fetchMock = vi.fn(async (_url: any, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      if (bodies.length === 1) {
        return jsonResponse(409, {
          status: "conflict",
          reason: "server_ahead (server=7)",
          revision: 7,
          match: { ...makeMatch("m-race"), revision: 7 },
        })
      }
      return jsonResponse(200, {
        status: "ok",
        revision: 8,
        match: { ...makeMatch("m-race"), revision: 8 },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    syncMatchCommand(makeMatch("m-race"), "point", { team: "teamB" }, "judge-b")

    await vi.waitFor(() => expect(getMatchSyncState("m-race").pendingCount).toBe(0), { timeout: 4000 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(bodies[0].operationId).toBe(bodies[1].operationId)
  })

  it("409 server_ahead discards a stale active snapshot and keeps the completed server match", async () => {
    const authoritative = { ...makeMatch("m-put-2", true), revision: 6, winner: "teamA" }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(409, {
          status: "conflict",
          reason: "server_ahead (server=6)",
          revision: 6,
          match: authoritative,
        }),
      )
    vi.stubGlobal("fetch", fetchMock as any)

    // A second referee still has an active revision-5 copy after referee A
    // completed revision 6. It must never be rebased and PUT over the result.
    syncMatchToServer({ ...makeMatch("m-put-2"), revision: 5 }, "snapshot")
    await vi.waitFor(() => {
      expect(getMatchSyncState("m-put-2").pendingCount).toBe(0)
    })

    const { drainMatch } = await import("../lib/match-sync")
    await drainMatch("m-put-2")

    expect(fetchMock).toHaveBeenCalledTimes(1)
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
