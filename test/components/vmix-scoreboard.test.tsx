// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

import { VmixScoreboard } from "../../components/vmix-scoreboard"
import { parseScoreboardSettings } from "../../lib/scoreboard-settings"

afterEach(cleanup)

const SETTINGS = parseScoreboardSettings(new URLSearchParams(""))

/** A doubles match in a neutral state (30-15, no important point). */
function makeMatch(overrides: Record<string, any> = {}) {
  return {
    id: "m-vmix",
    isCompleted: false,
    winner: null,
    format: "doubles",
    settings: { sets: 3, scoringSystem: "classic", gamesPerSet: 6, tiebreakEnabled: true },
    teamA: { players: [{ name: "Иванов", country: "RU" }, { name: "Петров", country: "RU" }] },
    teamB: { players: [{ name: "Smith", country: "US" }, { name: "Jones", country: "US" }] },
    currentServer: { team: "teamA", playerIndex: 0 },
    score: {
      teamA: 1,
      teamB: 0,
      sets: [{ teamA: 6, teamB: 4, winner: "teamA" }],
      currentSet: { teamA: 3, teamB: 2, games: [], currentGame: { teamA: 30, teamB: 15 }, isTiebreak: false },
    },
    ...overrides,
  }
}

describe("VmixScoreboard", () => {
  it("renders team names and game score (overlay variant)", () => {
    render(<VmixScoreboard match={makeMatch()} settings={SETTINGS} variant="overlay" />)
    expect(screen.getByText("Иванов")).toBeDefined()
    expect(screen.getByText("Smith")).toBeDefined()
    expect(screen.getByText("30")).toBeDefined() // teamA game score
  })

  it("shows the break-point indicator when the receiver holds a game point", () => {
    // teamB on game point while teamA serves → break point for teamB.
    const match = makeMatch({
      score: {
        teamA: 0,
        teamB: 0,
        sets: [],
        currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 40 }, isTiebreak: false },
      },
    })
    render(<VmixScoreboard match={match} settings={SETTINGS} variant="overlay" />)
    expect(screen.getByText(/BREAK POINT/)).toBeDefined()
  })

  it("hides the break-point indicator when showBreakPoint is off", () => {
    const match = makeMatch({
      score: {
        teamA: 0,
        teamB: 0,
        sets: [],
        currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 40 }, isTiebreak: false },
      },
    })
    render(
      <VmixScoreboard match={match} settings={{ ...SETTINGS, showBreakPoint: false }} variant="overlay" />,
    )
    expect(screen.queryByText(/BREAK POINT/)).toBeNull()
  })

  it("renders a trophy on the winner of a completed match (overlay variant)", () => {
    const match = makeMatch({ isCompleted: true, winner: "teamA" })
    const { container } = render(<VmixScoreboard match={match} settings={SETTINGS} variant="overlay" />)
    expect(container.querySelector(".lucide-trophy")).not.toBeNull()
  })

  it("renders the fullscreen variant with names and score", () => {
    render(
      <VmixScoreboard match={makeMatch()} settings={SETTINGS} variant="fullscreen" matchOverLabel="ОВЕР" />,
    )
    expect(screen.getByText("Иванов")).toBeDefined()
    expect(screen.getByText("30")).toBeDefined()
  })
})
