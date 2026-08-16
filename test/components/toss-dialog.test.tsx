// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react"

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, any>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    language: "ru",
    setLanguage: () => {},
    languages: {},
  }),
}))

import { TossDialog } from "../../components/toss-dialog"
import { backfillExtendedMatchState } from "../../lib/match-extended-state"

function makeMatch() {
  return backfillExtendedMatchState({
    id: "m",
    isCompleted: false,
    settings: { sets: 3 },
    teamA: { players: [{ name: "Alice" }, { name: "Anna" }] },
    teamB: { players: [{ name: "Bob" }, { name: "Bart" }] },
    courtSides: { teamA: "left", teamB: "right" },
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

describe("TossDialog", () => {
  it("renders the trigger button", () => {
    render(<TossDialog match={makeMatch()} updateMatch={() => {}} />)
    expect(screen.getByRole("button", { name: /extras\.toss(?!T)/ })).toBeTruthy()
  })

  it("opens the dialog and walks through winner → choice → side, committing once", () => {
    const updateMatch = vi.fn()
    render(<TossDialog match={makeMatch()} updateMatch={updateMatch} />)

    // Step 1: open dialog
    fireEvent.click(screen.getByRole("button", { name: /^extras\.toss$/ }))

    // Step 2: pick winner — choose Alice's team
    const winnerBtn = screen.getByRole("button", { name: /extras\.tossWins.*Alice/ })
    fireEvent.click(winnerBtn)

    // Step 3: choose Serve
    fireEvent.click(screen.getByRole("button", { name: /extras\.tossServe/ }))

    // Step 4: pick the left side
    fireEvent.click(screen.getByRole("button", { name: /extras\.tossOnLeft.*Alice/ }))

    // The atomic commit should have happened exactly once.
    expect(updateMatch).toHaveBeenCalledTimes(1)
    const next = updateMatch.mock.calls[0][0]
    expect(next.toss).toMatchObject({ winner: "teamA", winnerChoice: "serve" })
    expect(next.currentServer.team).toBe("teamA")
    expect(next.courtSides).toEqual({ teamA: "left", teamB: "right" })
  })

  it("does not commit until the side is picked", () => {
    const updateMatch = vi.fn()
    render(<TossDialog match={makeMatch()} updateMatch={updateMatch} />)
    fireEvent.click(screen.getByRole("button", { name: /^extras\.toss$/ }))
    fireEvent.click(screen.getByRole("button", { name: /extras\.tossWins.*Bob/ }))
    fireEvent.click(screen.getByRole("button", { name: /extras\.tossReceive/ }))
    expect(updateMatch).not.toHaveBeenCalled()
  })
})
