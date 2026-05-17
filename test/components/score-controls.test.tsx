// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"

// Stub the contexts/hooks ScoreControls pulls in — the test targets its own
// side-switching logic, not translations, sound or the court SVG.
vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "ru",
    setLanguage: () => {},
    languages: {},
  }),
}))
vi.mock("@/hooks/use-sound-effects", () => ({
  useSoundEffects: () => ({ soundsEnabled: false, playSound: () => {}, toggleSounds: () => {} }),
}))
vi.mock("@/components/court-svg-preview", () => ({ default: () => null }))

import { ScoreControls } from "../../components/score-controls"

function makeMatch(overrides: Record<string, any> = {}) {
  return {
    isCompleted: false,
    format: "doubles",
    settings: { sets: 3 },
    teamA: { players: [{ name: "A1" }, { name: "A2" }] },
    teamB: { players: [{ name: "B1" }, { name: "B2" }] },
    currentServer: { team: "teamA", playerIndex: 0 },
    courtSides: { teamA: "left", teamB: "right" },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
    ...overrides,
  }
}

beforeEach(() => cleanup())

describe("ScoreControls component", () => {
  it("renders the switch-server and switch-sides buttons", () => {
    render(<ScoreControls match={makeMatch()} updateMatch={() => {}} />)
    expect(screen.getByRole("button", { name: "match.switchServer" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "match.switchSides" })).toBeTruthy()
  })

  it("swaps court sides when 'switch sides' is clicked", () => {
    const updateMatch = vi.fn()
    render(<ScoreControls match={makeMatch()} updateMatch={updateMatch} />)

    fireEvent.click(screen.getByRole("button", { name: "match.switchSides" }))

    expect(updateMatch).toHaveBeenCalledTimes(1)
    const updated = updateMatch.mock.calls[0][0]
    expect(updated.courtSides).toEqual({ teamA: "right", teamB: "left" })
    expect(updated.shouldChangeSides).toBe(false)
  })

  it("does not auto-trigger updateMatch on mount when no side change is pending", () => {
    const updateMatch = vi.fn()
    render(<ScoreControls match={makeMatch()} updateMatch={updateMatch} />)
    expect(updateMatch).not.toHaveBeenCalled()
  })
})
