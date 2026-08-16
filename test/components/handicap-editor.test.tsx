// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, any>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    language: "ru",
    setLanguage: () => {},
    languages: {},
  }),
}))

import { HandicapEditor } from "../../components/handicap-editor"
import { backfillExtendedMatchState } from "../../lib/match-extended-state"

function makeMatch() {
  return backfillExtendedMatchState({
    id: "m",
    isCompleted: false,
    teamA: { players: [{ name: "Alice" }] },
    teamB: { players: [{ name: "Bob" }] },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
  })
}

beforeEach(() => cleanup())

describe("HandicapEditor", () => {
  it("applies same-for-all-games 30-0 handicap", () => {
    const updateMatch = vi.fn()
    render(<HandicapEditor match={makeMatch()} updateMatch={updateMatch} />)

    // Pick 30 for Team A. There are 4 buttons per team (0/15/30/40).
    const buttons30 = screen.getAllByRole("button", { name: "30" })
    fireEvent.click(buttons30[0]) // Team A → 30
    // Team B stays at 0 — no click needed since it's already the default.

    fireEvent.click(screen.getByRole("button", { name: /extras\.handicapApplySame/ }))

    expect(updateMatch).toHaveBeenCalledTimes(1)
    const next = updateMatch.mock.calls[0][0]
    expect(next.handicap).toEqual({
      format: "same-for-all-games",
      sameForAllGames: { teamA: 2, teamB: 0 },
      perGame: undefined,
    })
  })

  it("clears the handicap", () => {
    const updateMatch = vi.fn()
    const match = makeMatch()
    match.handicap = { format: "same-for-all-games", sameForAllGames: { teamA: 1, teamB: 0 } }
    render(<HandicapEditor match={match} updateMatch={updateMatch} />)
    fireEvent.click(screen.getByRole("button", { name: /extras\.handicapClear/ }))
    expect(updateMatch).toHaveBeenCalledTimes(1)
    expect(updateMatch.mock.calls[0][0].handicap).toEqual({ format: "none" })
  })
})
