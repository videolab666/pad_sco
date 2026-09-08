// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ rows: [] as any[], reads: 0, removed: vi.fn(), status: null as any }))
vi.mock("../lib/error-logger", () => ({ logEvent: vi.fn() }))
vi.mock("../lib/match-sync", () => ({ syncMatchToServer: vi.fn(), initSyncRecovery: vi.fn(), reconcileServerSnapshot: vi.fn(), getMatchDisplaySnapshot: (m: any) => m }))
vi.mock("../lib/supabase", () => ({ createClientSupabaseClient: () => ({
  from: () => {
    const q: any = { select: () => q, order: () => q, limit: () => q, abortSignal: () => q,
      then: (resolve: any) => { state.reads++; return Promise.resolve({ data: structuredClone(state.rows), error: null }).then(resolve) } }
    return q
  },
  channel: () => { const c: any = { on: () => c, subscribe: (fn: any) => { state.status = fn; return c } }; return c },
  removeChannel: state.removed,
}), checkAndEnableRealtime: vi.fn() }))
import { getMatches, subscribeToMatchesListUpdates } from "../lib/match-storage"

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); state.rows = []; state.reads = 0; state.removed.mockClear() })
afterEach(() => vi.useRealTimers())

describe("match list recovery", () => {
  it("does not resurrect local matches when the authoritative list is empty", async () => {
    localStorage.setItem("tennis_padel_matches", JSON.stringify([{ id: "old-local", isCompleted: false }]))
    expect(await getMatches({ probe: false })).toEqual([])
  })
  it("polls without realtime events and stops on unsubscribe", async () => {
    const callback = vi.fn()
    const stop = subscribeToMatchesListUpdates(callback)
    await vi.advanceTimersByTimeAsync(5500)
    expect(callback).toHaveBeenCalled()
    callback.mockClear()
    state.rows = [{ id: "closed", is_completed: true, team_a: { players: [] }, team_b: { players: [] } }]
    window.dispatchEvent(new Event("online"))
    await vi.advanceTimersByTimeAsync(600)
    expect(callback.mock.lastCall?.[0][0].isCompleted).toBe(true)
    stop()
    callback.mockClear()
    await vi.advanceTimersByTimeAsync(11000)
    expect(callback).not.toHaveBeenCalled()
    expect(state.removed).toHaveBeenCalledTimes(1)
  })
})
