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

import { EndMatchDialog } from "../../components/end-match-dialog"
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

describe("EndMatchDialog", () => {
  it("ends with retired-injury + winner = teamA", () => {
    const updateMatch = vi.fn()
    render(<EndMatchDialog match={makeMatch()} updateMatch={updateMatch} />)
    fireEvent.click(screen.getByRole("button", { name: /^extras\.endMatch$/ }))
    fireEvent.click(screen.getByRole("button", { name: /extras\.endMatchRetired/ }))
    fireEvent.click(screen.getByRole("button", { name: /extras\.tossWins.*Alice/ }))
    expect(updateMatch).toHaveBeenCalledTimes(1)
    const next = updateMatch.mock.calls[0][0]
    expect(next.isCompleted).toBe(true)
    expect(next.winner).toBe("teamA")
    expect(next.endMatchReason).toBe("retired-injury")
  })

  it("supports the time-up reason", () => {
    const updateMatch = vi.fn()
    render(<EndMatchDialog match={makeMatch()} updateMatch={updateMatch} />)
    fireEvent.click(screen.getByRole("button", { name: /^extras\.endMatch$/ }))
    fireEvent.click(screen.getByRole("button", { name: /extras\.endMatchTime/ }))
    fireEvent.click(screen.getByRole("button", { name: /extras\.tossWins.*Bob/ }))
    const next = updateMatch.mock.calls[0][0]
    expect(next.endMatchReason).toBe("time-up")
    expect(next.winner).toBe("teamB")
  })

  it("disables the trigger when the match is already completed", () => {
    const m = { ...makeMatch(), isCompleted: true }
    render(<EndMatchDialog match={m} updateMatch={() => {}} />)
    const btn = screen.getByRole("button", { name: /^extras\.endMatch$/ })
    expect(btn.hasAttribute("disabled")).toBe(true)
  })
})
