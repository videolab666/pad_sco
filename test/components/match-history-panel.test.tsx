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

import { MatchHistoryPanel } from "../../components/match-history-panel"
import { backfillExtendedMatchState } from "../../lib/match-extended-state"

function makeMatch() {
  const m = backfillExtendedMatchState({
    id: "m",
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
  })
  m.events = [
    { id: "e1", type: "point", at: "2026-05-27T10:00:00Z", setIndex: 0, gameIndex: 0, actor: "teamA", payload: {} },
    { id: "e2", type: "manual-score-edit", at: "2026-05-27T10:01:00Z", setIndex: 0, gameIndex: 0, payload: { action: "adjust-current-game" } },
    { id: "e3", type: "timer", at: "2026-05-27T10:02:00Z", setIndex: 0, gameIndex: 0, payload: { action: "start", timerType: "warmup" } },
  ] as any
  return m
}

beforeEach(() => cleanup())

describe("MatchHistoryPanel", () => {
  it("renders all events under the All filter (newest first)", () => {
    render(<MatchHistoryPanel match={makeMatch()} />)
    // 3 event rows with .type badges.
    expect(screen.getByText("point")).toBeTruthy()
    expect(screen.getByText("manual-score-edit")).toBeTruthy()
    expect(screen.getByText("timer")).toBeTruthy()
  })

  it("filters to just points when the Points filter is clicked", () => {
    render(<MatchHistoryPanel match={makeMatch()} />)
    fireEvent.click(screen.getByRole("button", { name: /extras\.historyPoints/ }))
    expect(screen.getByText("point")).toBeTruthy()
    expect(screen.queryByText("manual-score-edit")).toBeNull()
    expect(screen.queryByText("timer")).toBeNull()
  })

  it("renders an empty-state hint when there are no events", () => {
    const m = makeMatch()
    m.events = []
    render(<MatchHistoryPanel match={m} />)
    expect(screen.getByText(/extras\.historyEmpty/)).toBeTruthy()
  })
})
