import { describe, it, expect, vi } from "vitest"
import {
  buildResultPayload,
  postOnce,
  postResultIfConfigured,
  postWithRetry,
} from "../lib/result-poster"
import { backfillExtendedMatchState } from "../lib/match-extended-state"

const completedMatch = (overrides: any = {}) =>
  backfillExtendedMatchState({
    id: "m-1",
    code: "11122233344",
    type: "padel",
    format: "doubles",
    isCompleted: true,
    winner: "teamA",
    teamA: { players: [{ id: "a1", name: "Alice", country: "es" }, { id: "a2", name: "Anna" }] },
    teamB: { players: [{ id: "b1", name: "Bob", country: "us" }] },
    settings: {
      sets: 3,
      resultPoster: { url: "https://example.com/result", autoOnComplete: true, ...(overrides.poster ?? {}) },
    },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [{ teamA: 6, teamB: 4, winner: "teamA" }, { teamA: 7, teamB: 5, winner: "teamA" }],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
    timing: { games: [], matchStartedAt: "2026-05-27T10:00:00Z", matchEndedAt: "2026-05-27T11:30:00Z" },
    courtNumber: 3,
    ...overrides.match,
  })

describe("Task 16 — buildResultPayload", () => {
  it("includes id, code, sets, winner, completedAt and per-team players", () => {
    const p = buildResultPayload(completedMatch())
    expect(p).toMatchObject({
      id: "m-1",
      code: "11122233344",
      type: "padel",
      format: "doubles",
      winner: "teamA",
      endMatchReason: "completed",
      completedAt: "2026-05-27T11:30:00Z",
      courtNumber: 3,
    })
    expect((p as any).sets).toHaveLength(2)
    expect((p as any).teamA.players).toHaveLength(2)
    expect((p as any).teamA.players[0]).toEqual({ id: "a1", name: "Alice", country: "es" })
  })

  it("uses now() for completedAt when matchEndedAt is missing", () => {
    const m = completedMatch()
    m.timing.matchEndedAt = undefined
    const p = buildResultPayload(m)
    expect(typeof (p as any).completedAt).toBe("string")
    expect((p as any).completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe("Task 16 — postOnce", () => {
  it("returns ok=true on a 2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201 })
    const r = await postOnce({ url: "https://example.com/r" }, { hello: "world" }, fetchImpl as any)
    expect(r).toEqual({ ok: true, attempts: 1, status: 201 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe("https://example.com/r")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ hello: "world" })
  })

  it("attaches HTTP Basic Auth when configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    await postOnce(
      { url: "https://example.com/r", basicAuth: { username: "user", password: "pw" } },
      {},
      fetchImpl as any,
    )
    const init = fetchImpl.mock.calls[0][1]
    expect(init.headers.Authorization).toBe("Basic dXNlcjpwdw==")
  })

  it("returns ok=false on fetch throw", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"))
    const r = await postOnce({ url: "https://x" }, {}, fetchImpl as any)
    expect(r.ok).toBe(false)
    expect(r.error).toBe("network down")
  })

  it("returns ok=false / no-url when url is missing", async () => {
    const r = await postOnce({}, {})
    expect(r).toEqual({ ok: false, attempts: 0, error: "no-url" })
  })
})

describe("Task 16 — postWithRetry", () => {
  it("retries up to 3 times then gives up", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const sleep = vi.fn().mockResolvedValue(undefined)
    const r = await postWithRetry({ url: "https://x" }, {}, { fetchImpl: fetchImpl as any, sleep })
    expect(r.ok).toBe(false)
    expect(r.attempts).toBe(3)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledWith(1000)
    expect(sleep).toHaveBeenCalledWith(2000)
  })

  it("stops retrying on the first success", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    const sleep = vi.fn().mockResolvedValue(undefined)
    const r = await postWithRetry({ url: "https://x" }, {}, { fetchImpl: fetchImpl as any, sleep })
    expect(r.ok).toBe(true)
    expect(r.attempts).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

describe("Task 16 — postResultIfConfigured (auto-post)", () => {
  it("is a no-op when the match is not completed", async () => {
    const m = completedMatch()
    m.isCompleted = false
    const fetchImpl = vi.fn()
    const result = await postResultIfConfigured(m, { fetchImpl: fetchImpl as any })
    expect(result).toBe(m)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("is a no-op when autoOnComplete is false", async () => {
    const m = completedMatch({ poster: { autoOnComplete: false } })
    const fetchImpl = vi.fn()
    const result = await postResultIfConfigured(m, { fetchImpl: fetchImpl as any })
    expect(result).toBe(m)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("records a `result-poster` event with outcome=posted on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const sleep = vi.fn().mockResolvedValue(undefined)
    const next = await postResultIfConfigured(completedMatch(), { fetchImpl: fetchImpl as any, sleep })
    const ev = next.events.find((e: any) => e.type === "result-poster")
    expect(ev).toBeTruthy()
    expect(ev.payload.outcome).toBe("posted")
    expect(ev.payload.attempts).toBe(1)
  })

  it("records a dead-letter event after the retries are exhausted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 502 })
    const sleep = vi.fn().mockResolvedValue(undefined)
    const next = await postResultIfConfigured(completedMatch(), { fetchImpl: fetchImpl as any, sleep })
    const ev = next.events.find((e: any) => e.type === "result-poster")
    expect(ev.payload.outcome).toBe("dead-letter")
    expect(ev.payload.attempts).toBe(3)
  })
})
