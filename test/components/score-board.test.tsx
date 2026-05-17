// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"

// The language context pulls in Supabase on mount; tests assert on scores, not
// on translated labels, so stub it with an identity translator.
vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "ru",
    setLanguage: () => {},
    languages: {},
  }),
}))

import { ScoreBoard } from "../../components/score-board"

function makeMatch(overrides: Record<string, any> = {}) {
  return {
    id: "m-ui",
    isCompleted: false,
    winner: null,
    format: "doubles",
    settings: {
      sets: 3,
      scoringSystem: "classic",
      gamesPerSet: 6,
      tiebreakEnabled: true,
      tiebreakAt: "6-6",
      tiebreakLength: 7,
    },
    teamA: { players: [{ name: "A1" }, { name: "A2" }] },
    teamB: { players: [{ name: "B1" }, { name: "B2" }] },
    currentServer: { team: "teamA", playerIndex: 0 },
    courtSides: { teamA: "left", teamB: "right" },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: {
        teamA: 0,
        teamB: 0,
        games: [],
        currentGame: { teamA: 0, teamB: 0 },
        isTiebreak: false,
      },
    },
    ...overrides,
  }
}

beforeEach(() => cleanup())

describe("ScoreBoard component", () => {
  it("renders both teams' game scores", () => {
    render(<ScoreBoard match={makeMatch()} updateMatch={() => {}} />)
    // Two big score buttons, both showing "0" at the start of a game.
    const zeros = screen.getAllByRole("button", { name: "0" })
    expect(zeros.length).toBeGreaterThanOrEqual(2)
  })

  it("applies a point to teamA when its score button is clicked", () => {
    const updateMatch = vi.fn()
    render(<ScoreBoard match={makeMatch()} updateMatch={updateMatch} />)

    // Left button = teamA in the default fixed-players mode.
    const zeros = screen.getAllByRole("button", { name: "0" })
    fireEvent.click(zeros[0])

    expect(updateMatch).toHaveBeenCalledTimes(1)
    const updated = updateMatch.mock.calls[0][0]
    expect(updated.score.currentSet.currentGame.teamA).toBe(15)
    expect(updated.score.currentSet.currentGame.teamB).toBe(0)
  })

  it("does not apply a point when the match is already completed", () => {
    const updateMatch = vi.fn()
    render(<ScoreBoard match={makeMatch({ isCompleted: true, winner: "teamA" })} updateMatch={updateMatch} />)

    const zeros = screen.getAllByRole("button", { name: "0" })
    fireEvent.click(zeros[0])
    expect(updateMatch).not.toHaveBeenCalled()
  })

  it("the -1 button decrements only that team's current game score (not Undo)", () => {
    const updateMatch = vi.fn()
    const m = makeMatch()
    m.score.currentSet.currentGame = { teamA: 30, teamB: 15 }
    render(<ScoreBoard match={m} updateMatch={updateMatch} />)

    // Two "-1" buttons; index 0 = teamA in the default fixed-players mode.
    const minus = screen.getAllByRole("button", { name: "-1" })
    fireEvent.click(minus[0])

    expect(updateMatch).toHaveBeenCalledTimes(1)
    const updated = updateMatch.mock.calls[0][0]
    expect(updated.score.currentSet.currentGame.teamA).toBe(15) // 30 → 15
    expect(updated.score.currentSet.currentGame.teamB).toBe(15) // teamB untouched
  })
})
