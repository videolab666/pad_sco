// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

// vi.hoisted: the mock factory is hoisted above imports, so the spies it
// references must be created in a hoisted block too.
const { getMatch, subscribeToMatchUpdates, persistMatch } = vi.hoisted(() => ({
  getMatch: vi.fn(),
  subscribeToMatchUpdates: vi.fn(() => () => {}),
  persistMatch: vi.fn(),
}))

vi.mock("@/lib/match-storage", () => ({
  getMatch,
  subscribeToMatchUpdates,
  updateMatch: persistMatch,
}))

import { useMatch } from "../hooks/use-match"

function sampleMatch(overrides: Record<string, any> = {}) {
  return {
    id: "m1",
    revision: 1,
    isCompleted: false,
    settings: { sets: 3 },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
    ...overrides,
  }
}

beforeEach(() => {
  getMatch.mockReset()
  subscribeToMatchUpdates.mockReset().mockReturnValue(() => {})
  persistMatch.mockReset()
})

describe("useMatch hook", () => {
  it("loads the match and clears the loading flag", async () => {
    getMatch.mockResolvedValue(sampleMatch())
    const { result } = renderHook(() => useMatch("m1"))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.match?.id).toBe("m1")
    expect(result.current.error).toBe("")
  })

  it("reports an error when the match is not found", async () => {
    getMatch.mockResolvedValue(null)
    const { result } = renderHook(() => useMatch("missing"))

    await waitFor(() => expect(result.current.error).not.toBe(""))
    expect(result.current.match).toBeNull()
  })

  it("applies updateMatch optimistically and persists it", async () => {
    getMatch.mockResolvedValue(sampleMatch())
    persistMatch.mockResolvedValue(undefined)
    const { result } = renderHook(() => useMatch("m1"))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateMatch(sampleMatch({ revision: 2 }))
    })

    // Local optimistic apply bumps revision so a stale realtime echo with the
    // server's old number is filtered out by the revision guard (slow-network
    // flicker fix). The caller's revision is the floor, not the final value.
    expect(result.current.match.revision).toBeGreaterThanOrEqual(3)
    expect(persistMatch).toHaveBeenCalledTimes(1)
  })

  it("bumps revision locally on optimistic update so stale realtime echoes are ignored", async () => {
    getMatch.mockResolvedValue(sampleMatch({ revision: 5 }))
    persistMatch.mockResolvedValue(undefined)
    const { result } = renderHook(() => useMatch("m1"))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // The scoring engine does not touch revision — caller passes the previous
    // revision through. The hook must bump it locally.
    await act(async () => {
      await result.current.updateMatch(sampleMatch({ revision: 5 }))
    })

    expect(result.current.match.revision).toBeGreaterThan(5)
  })

  it("subscribes to realtime updates for the match id", async () => {
    getMatch.mockResolvedValue(sampleMatch())
    renderHook(() => useMatch("m1"))
    await waitFor(() => expect(subscribeToMatchUpdates).toHaveBeenCalled())
    expect((subscribeToMatchUpdates.mock.calls[0] as any[])[0]).toBe("m1")
  })
})
