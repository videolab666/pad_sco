// Карточка корта для дашборда (lib/dashboard-summary, plan-4 §46).

import { describe, expect, it } from "vitest"
import { buildDashboardCourtCard } from "../lib/dashboard-summary"

const court = { id: "c-1", name: "Центральный", shortCode: "Ab3xK9Q", legacyNumber: 3 }

const liveMatch = {
  id: "m-1",
  isCompleted: false,
  winner: null,
  teamA: { players: [{ name: "Ivan Petrov" }, { name: "Max Syd" }] },
  teamB: { players: [{ name: "Den Kot" }, { name: "Oleg Kim" }] },
  score: {
    teamA: 1,
    teamB: 0,
    sets: [
      { teamA: 6, teamB: 4, winner: "teamA" },
    ],
    currentSet: {
      teamA: 3,
      teamB: 2,
      games: [],
      currentGame: { teamA: 40, teamB: 30 },
      isTiebreak: false,
    },
  },
}

describe("buildDashboardCourtCard (§46)", () => {
  it("свободный корт без матча и сессии", () => {
    const card = buildDashboardCourtCard(court, null, null)
    expect(card.state).toBe("available")
    expect(card.match).toBeNull()
    expect(card.session).toBeNull()
    expect(card.scoreboardUrl).toBe("/c/Ab3xK9Q")
    expect(card.number).toBe(3)
  })

  it("живой матч: имена из проекции, сеты, текущий гейм", () => {
    const card = buildDashboardCourtCard(court, liveMatch, null)
    expect(card.state).toBe("live")
    expect(card.match?.teamAName).toBe("Ivan Petrov / Max Syd")
    expect(card.match?.teamBName).toBe("Den Kot / Oleg Kim")
    expect(card.match?.setsSummary).toBe("6-4")
    expect(card.match?.setsWonA).toBe(1)
    expect(card.match?.currentSet).toBe("3-2")
    expect(card.match?.currentGame).toBe("40-30")
    expect(card.match?.isTiebreak).toBe(false)
    expect(typeof card.match?.duration).toBe("string")
  })

  it("тайбрейк: очки как числа", () => {
    const tb = JSON.parse(JSON.stringify(liveMatch))
    tb.score.currentSet.isTiebreak = true
    tb.score.currentSet.currentGame = { teamA: 5, teamB: 4 }
    const card = buildDashboardCourtCard(court, tb, null)
    expect(card.match?.currentGame).toBe("5-4")
    expect(card.match?.isTiebreak).toBe(true)
  })

  it("гейм с Ad", () => {
    const ad = JSON.parse(JSON.stringify(liveMatch))
    ad.score.currentSet.currentGame = { teamA: "Ad", teamB: 40 }
    const card = buildDashboardCourtCard(court, ad, null)
    expect(card.match?.currentGame).toBe("Ad-40")
  })

  it("сессия без матча → session_only с типом", () => {
    const card = buildDashboardCourtCard(court, null, {
      type: "americano",
      status: "active",
      startedAt: "2026-08-17T18:00:00Z",
    })
    expect(card.state).toBe("session_only")
    expect(card.session?.type).toBe("americano")
  })

  it("завершённый матч не считается live", () => {
    const done = JSON.parse(JSON.stringify(liveMatch))
    done.isCompleted = true
    done.winner = "teamA"
    const card = buildDashboardCourtCard(court, done, null)
    expect(card.state).toBe("session_only")
    expect(card.match?.isCompleted).toBe(true)
    expect(card.match?.winner).toBe("teamA")
  })
})
