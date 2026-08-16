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

import { TiebreakChoiceDialog } from "../../components/tiebreak-choice-dialog"
import { backfillExtendedMatchState } from "../../lib/match-extended-state"

function makeMatch(withPending: boolean) {
  const m = backfillExtendedMatchState({
    id: "m",
    isCompleted: false,
    settings: { tiebreakFormat: "receiver-select-1-or-2", tiebreakLength: 7 },
    teamA: { players: [{ name: "Alice" }] },
    teamB: { players: [{ name: "Bob" }] },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 6, teamB: 6, games: [], currentGame: { teamA: 6, teamB: 5 }, isTiebreak: true },
    },
  })
  if (withPending) {
    m.pendingTiebreakChoice = { baseTarget: 7, options: [1, 2], receiverTeam: "teamB" }
  }
  return m
}

beforeEach(() => cleanup())

describe("TiebreakChoiceDialog", () => {
  it("renders nothing when no pending choice is staged", () => {
    const { container } = render(<TiebreakChoiceDialog match={makeMatch(false)} updateMatch={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it("commits the +2 offset and clears the pending choice", () => {
    const updateMatch = vi.fn()
    render(<TiebreakChoiceDialog match={makeMatch(true)} updateMatch={updateMatch} />)
    // Two options were staged: +1 and +2. Pick +2.
    const buttons = screen.getAllByRole("button")
    const plus2 = buttons.find((b) => b.textContent?.includes('"offset":2'))
    expect(plus2).toBeTruthy()
    fireEvent.click(plus2!)
    expect(updateMatch).toHaveBeenCalledTimes(1)
    const next = updateMatch.mock.calls[0][0]
    expect(next.pendingTiebreakChoice).toBeUndefined()
    expect(next.settings.tiebreakLength).toBe(9)
  })
})
