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

import { NewBallsIndicator } from "../../components/new-balls-indicator"
import { backfillExtendedMatchState } from "../../lib/match-extended-state"

function makeMatch(opts: {
  mode?: "off" | "after-first-7-then-each-9" | "after-first-9-then-each-11"
  lastChangeAt?: number
  games?: number
} = {}) {
  const games = opts.games ?? 0
  const match = backfillExtendedMatchState({
    id: "m",
    isCompleted: false,
    settings: { sets: 3, tiebreakEnabled: true, tiebreakAt: "6-6" },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: {
        teamA: games,
        teamB: 0,
        games: Array(games).fill({}),
        currentGame: { teamA: 0, teamB: 0 },
        isTiebreak: false,
      },
    },
  })
  match.newBalls = {
    mode: opts.mode ?? "off",
    lastChangeAtStartOfGame: opts.lastChangeAt ?? 0,
    pendingInGames: null,
  }
  return match
}

beforeEach(() => cleanup())

describe("NewBallsIndicator", () => {
  it("renders nothing when mode is 'off'", () => {
    const { container } = render(<NewBallsIndicator match={makeMatch()} updateMatch={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders 'Balls in N' badge when next change is in the future", () => {
    // 7-then-9 mode, 1 game played → next change in 6 games.
    const match = makeMatch({ mode: "after-first-7-then-each-9", lastChangeAt: 0, games: 1 })
    render(<NewBallsIndicator match={match} updateMatch={() => {}} />)
    expect(screen.getByText(/extras\.newBallsIn/i)).toBeTruthy()
  })

  it("calls updateMatch when the operator marks new balls as changed", () => {
    // 7-then-9 mode at game 7 → due now (newBallsInXGames === 0).
    const match = makeMatch({ mode: "after-first-7-then-each-9", lastChangeAt: 0, games: 7 })
    const updateMatch = vi.fn()
    render(<NewBallsIndicator match={match} updateMatch={updateMatch} />)
    const btn = screen.getByRole("button", { name: /extras\.newBalls/i })
    fireEvent.click(btn)
    expect(updateMatch).toHaveBeenCalledTimes(1)
    expect(updateMatch.mock.calls[0][0].newBalls.lastChangeAtStartOfGame).toBe(7)
  })
})
