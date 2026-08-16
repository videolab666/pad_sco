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

import { AdjustScoreDialog } from "../../components/adjust-score-dialog"
import { backfillExtendedMatchState } from "../../lib/match-extended-state"

function makeMatch() {
  return backfillExtendedMatchState({
    id: "m",
    isCompleted: false,
    teamA: { players: [{ name: "Alice" }] },
    teamB: { players: [{ name: "Bob" }] },
    currentServer: { team: "teamA", playerIndex: 0 },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
  })
}

beforeEach(() => cleanup())

describe("AdjustScoreDialog", () => {
  it("opens, edits 30-15 + sets 3-2 and commits both via a single updateMatch", () => {
    const updateMatch = vi.fn()
    render(<AdjustScoreDialog match={makeMatch()} updateMatch={updateMatch} />)

    fireEvent.click(screen.getByRole("button", { name: /^extras\.adjust$/ }))

    // Game points: 30 for A, 15 for B.
    // We pick the `30` button under "Team A" — there are two pickers but the
    // first cluster is A. Use getAllByRole and take indices.
    const buttons30 = screen.getAllByRole("button", { name: "30" })
    fireEvent.click(buttons30[0]) // Team A → 30
    const buttons15 = screen.getAllByRole("button", { name: "15" })
    fireEvent.click(buttons15[1]) // Team B → 15

    // Set games: +3 for A, +2 for B
    const plus = screen.getAllByRole("button", { name: "+" })
    fireEvent.click(plus[0]); fireEvent.click(plus[0]); fireEvent.click(plus[0]) // A → 3
    fireEvent.click(plus[1]); fireEvent.click(plus[1]) // B → 2

    fireEvent.click(screen.getByRole("button", { name: /extras\.apply/ }))

    expect(updateMatch).toHaveBeenCalledTimes(1)
    const next = updateMatch.mock.calls[0][0]
    expect(next.score.currentSet.currentGame).toEqual({ teamA: 30, teamB: 15 })
    expect(next.score.currentSet.teamA).toBe(3)
    expect(next.score.currentSet.teamB).toBe(2)
  })

  it("changes the serving team immediately on click", () => {
    const updateMatch = vi.fn()
    render(<AdjustScoreDialog match={makeMatch()} updateMatch={updateMatch} />)
    fireEvent.click(screen.getByRole("button", { name: /^extras\.adjust$/ }))
    // First "extras.teamB" button is for the "Serving team" row.
    const teamBBtns = screen.getAllByRole("button", { name: "extras.teamB" })
    fireEvent.click(teamBBtns[teamBBtns.length - 1]) // serving-team row sits last
    expect(updateMatch).toHaveBeenCalled()
    const next = updateMatch.mock.calls[0][0]
    expect(next.currentServer.team).toBe("teamB")
  })
})
