// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "ru",
    setLanguage: () => {},
    languages: {},
  }),
}))

import { PowerPlayControls } from "../../components/power-play-controls"
import { backfillExtendedMatchState } from "../../lib/match-extended-state"

function makeMatch(overrides: any = {}) {
  return backfillExtendedMatchState({
    id: "m",
    isCompleted: false,
    settings: { scoringSystem: "classic", goldenPointFormat: "none" },
    teamA: { players: [{ name: "Alice" }] },
    teamB: { players: [{ name: "Bob" }] },
    currentServer: { team: "teamA", playerIndex: 0 },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false, ...(overrides.currentSet ?? {}) },
    },
    ...overrides,
  })
}

beforeEach(() => cleanup())

describe("PowerPlayControls", () => {
  it("activates Power Play for Team A", () => {
    const updateMatch = vi.fn()
    render(<PowerPlayControls match={makeMatch()} updateMatch={updateMatch} />)
    fireEvent.click(screen.getByRole("button", { name: /Alice/ }))
    expect(updateMatch).toHaveBeenCalledTimes(1)
    expect(updateMatch.mock.calls[0][0].powerPlay.activeFor).toContain("teamA")
  })

  it("silently refuses activation on game ball", () => {
    const updateMatch = vi.fn()
    const m = makeMatch({ currentSet: { currentGame: { teamA: 40, teamB: 0 } } })
    render(<PowerPlayControls match={m} updateMatch={updateMatch} />)
    fireEvent.click(screen.getByRole("button", { name: /Alice/ }))
    expect(updateMatch).not.toHaveBeenCalled()
  })

  it("disables the button when budget is exhausted", () => {
    const m = makeMatch()
    m.powerPlay = { maxPerTeam: 2, used: { teamA: 2, teamB: 0 }, activeFor: [] }
    render(<PowerPlayControls match={m} updateMatch={() => {}} />)
    const aliceBtn = screen.getByRole("button", { name: /Alice/ })
    expect(aliceBtn.hasAttribute("disabled")).toBe(true)
  })
})
