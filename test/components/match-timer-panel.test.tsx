// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "ru",
    setLanguage: () => {},
    languages: {},
  }),
}))

import { MatchTimerPanel } from "../../components/match-timer-panel"
import { DEFAULT_TIMER_SECONDS } from "../../lib/match-timers"
import type { MatchTimerType } from "../../lib/types"

// jsdom has no WebAudio — the panel's expiry beep must degrade silently.
beforeEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

function makeMatch(overrides: Record<string, any> = {}) {
  return {
    isCompleted: false,
    teamA: { players: [{ name: "Anna" }, { name: "Alex" }] },
    teamB: { players: [{ name: "Boris" }, { name: "Ben" }] },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 } },
    },
    timing: { games: [] },
    ...overrides,
  }
}

describe("MatchTimerPanel", () => {
  it("renders the three durations: match / set / game", () => {
    render(<MatchTimerPanel match={makeMatch()} updateMatch={() => {}} />)
    expect(screen.getByText(/extras.matchDuration/)).toBeTruthy()
    expect(screen.getByText(/extras.setDuration/)).toBeTruthy()
    expect(screen.getByText(/extras.gameDuration/)).toBeTruthy()
  })

  it("exposes the four quick timer types when no timer is active", () => {
    render(<MatchTimerPanel match={makeMatch()} updateMatch={() => {}} />)
    expect(screen.getByRole("button", { name: /extras.timerWarmup/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /extras.timerPauseFirst/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /extras.timerPause(?!First)/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /extras.timerTowel/ })).toBeTruthy()
  })

  it("starts a quick timer with the APK default duration", () => {
    const updateMatch = vi.fn()
    render(<MatchTimerPanel match={makeMatch()} updateMatch={updateMatch} />)

    fireEvent.click(screen.getByRole("button", { name: /extras.timerWarmup/ }))

    expect(updateMatch).toHaveBeenCalledTimes(1)
    const next = updateMatch.mock.calls[0][0]
    expect(next.timing.activeTimer.type).toBe("warmup")
    expect(next.timing.activeTimer.durationSec).toBe(DEFAULT_TIMER_SECONDS.warmup)
  })

  it("injury submenu lists all 4 injury variants with correct durations", () => {
    const updateMatch = vi.fn()
    render(<MatchTimerPanel match={makeMatch()} updateMatch={updateMatch} />)

    fireEvent.click(screen.getByRole("button", { name: /extras.timerInjury/ }))

    const injuryTypes: MatchTimerType[] = [
      "self-inflicted-injury",
      "self-inflicted-blood-injury",
      "contributed-injury",
      "opponent-inflicted-injury",
    ]
    for (const type of injuryTypes) {
      const labels: Record<string, string> = {
        "self-inflicted-injury": "timerInjurySelf",
        "self-inflicted-blood-injury": "timerInjuryBlood",
        "contributed-injury": "timerInjuryContributed",
        "opponent-inflicted-injury": "timerInjuryOpponent",
      }
      const labelKey = labels[type]
      const btn = screen.getByRole("button", { name: new RegExp(`extras.${labelKey}`) })
      fireEvent.click(btn)
      expect(updateMatch).toHaveBeenCalledTimes(1)
      const next = updateMatch.mock.calls[0][0]
      expect(next.timing.activeTimer.type).toBe(type)
      expect(next.timing.activeTimer.durationSec).toBe(DEFAULT_TIMER_SECONDS[type])
      updateMatch.mockClear()
      // submenu closes after start — reopen for the next variant
      fireEvent.click(screen.getByRole("button", { name: /extras.timerInjury/ }))
    }
  })

  it("timeout submenu records the timeout for the chosen team", () => {
    const updateMatch = vi.fn()
    render(<MatchTimerPanel match={makeMatch()} updateMatch={updateMatch} />)

    fireEvent.click(screen.getByRole("button", { name: /extras.timerTimeout/ }))
    // Team choice shows real player names
    expect(screen.getByRole("button", { name: "Anna" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Boris" }))

    expect(updateMatch).toHaveBeenCalledTimes(1)
    const next = updateMatch.mock.calls[0][0]
    expect(next.timeouts.teamB).toHaveLength(1)
    expect(next.timing.activeTimer.type).toBe("timeout")
    expect(next.timing.activeTimer.team).toBe("teamB")
  })

  it("shows translated label + team for the active timer", () => {
    const match = makeMatch({
      timing: {
        games: [],
        activeTimer: {
          id: "t1",
          type: "timeout",
          team: "teamA",
          startedAt: new Date().toISOString(),
          durationSec: 60,
        },
      },
    })
    render(<MatchTimerPanel match={match} updateMatch={() => {}} />)
    expect(screen.getByText(/extras.timerTimeout — Anna/)).toBeTruthy()
  })

  it("flags an expired running timer with the expired alert", () => {
    const match = makeMatch({
      timing: {
        games: [],
        activeTimer: {
          id: "t2",
          type: "warmup",
          startedAt: new Date(Date.now() - 300_000).toISOString(), // 5 min ago
          durationSec: 240,
        },
      },
    })
    render(<MatchTimerPanel match={match} updateMatch={() => {}} />)
    expect(screen.getByText("extras.timerExpired")).toBeTruthy()
    expect(screen.getByText("00:00")).toBeTruthy()
  })

  it("does not flag a paused timer as expired-alerting", () => {
    const match = makeMatch({
      timing: {
        games: [],
        activeTimer: {
          id: "t3",
          type: "warmup",
          startedAt: new Date(Date.now() - 300_000).toISOString(),
          durationSec: 240,
          pausedAt: new Date().toISOString(),
          remainingSec: 120,
        },
      },
    })
    render(<MatchTimerPanel match={match} updateMatch={() => {}} />)
    expect(screen.queryByText("extras.timerExpired")).toBeNull()
    expect(screen.getByText("02:00")).toBeTruthy()
  })

  it("stops the active timer via the stop button", () => {
    const updateMatch = vi.fn()
    const match = makeMatch({
      timing: {
        games: [],
        activeTimer: { id: "t4", type: "warmup", startedAt: new Date().toISOString(), durationSec: 240 },
      },
    })
    render(<MatchTimerPanel match={match} updateMatch={updateMatch} />)

    fireEvent.click(screen.getByRole("button", { name: "Stop timer" }))
    expect(updateMatch).toHaveBeenCalledTimes(1)
    expect(updateMatch.mock.calls[0][0].timing.activeTimer).toBeUndefined()
  })

  it("disables all timer buttons when the match is completed", () => {
    render(<MatchTimerPanel match={makeMatch({ isCompleted: true })} updateMatch={() => {}} />)
    const buttons = screen.getAllByRole("button")
    for (const b of buttons) {
      if (b.getAttribute("aria-label")) continue // pause/stop controls
      expect((b as HTMLButtonElement).disabled).toBe(true)
    }
  })
})

afterEach(() => cleanup())
