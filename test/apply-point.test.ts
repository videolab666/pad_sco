import { describe, it, expect } from "vitest"
import { applyPointWithExtras } from "../lib/apply-point"
import { setSameHandicap } from "../lib/handicap"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import { toggleNextRallyPowerPlay } from "../lib/power-play"

const baseMatch = (overrides: any = {}) =>
  backfillExtendedMatchState({
    id: "m",
    type: "padel",
    format: "doubles",
    isCompleted: false,
    settings: {
      sets: 3,
      scoringSystem: "classic",
      goldenPointFormat: "none",
      gamesPerSet: 6,
      tiebreakEnabled: true,
      tiebreakAt: "6-6",
      tiebreakLength: 7,
      tiebreakFormat: "two-clear",
      ...(overrides.settings ?? {}),
    },
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
        ...(overrides.currentSet ?? {}),
      },
    },
    currentServer: { team: "teamA", playerIndex: 0 },
    courtSides: { teamA: "left", teamB: "right" },
  })

describe("applyPointWithExtras — event journal", () => {
  it("appends a point event for every scored point with the BEFORE indices", () => {
    let m = baseMatch()
    m = applyPointWithExtras(m, "teamA") // 0-0 → 15-0
    m = applyPointWithExtras(m, "teamB") // 15-0 → 15-15
    const points = m.events.filter((e: any) => e.type === "point")
    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ type: "point", actor: "teamA", setIndex: 0, gameIndex: 0, pointIndex: 0 })
    expect(points[1]).toMatchObject({ type: "point", actor: "teamB", setIndex: 0, gameIndex: 0, pointIndex: 1 })
  })

  it("does not mutate the input match", () => {
    const m = baseMatch()
    const snapshot = JSON.stringify(m)
    applyPointWithExtras(m, "teamA")
    expect(JSON.stringify(m)).toBe(snapshot)
  })
})

describe("applyPointWithExtras — Power Play consumption", () => {
  it("consumes Power Play after the point for the activating team and records cash-in", () => {
    let m = baseMatch()
    const r = toggleNextRallyPowerPlay(m, "teamA")
    m = r.match
    expect(m.powerPlay.activeFor).toEqual(["teamA"])

    m = applyPointWithExtras(m, "teamA") // teamA scores → cash-in
    expect(m.powerPlay.activeFor).toEqual([])
    expect(m.powerPlay.used.teamA).toBe(1)
    expect(m.events.find((e: any) => e.type === "power-play" && e.payload?.action === "consume")?.payload?.outcome).toBe("cash-in")
  })

  it("waste when the activating team loses the rally", () => {
    let m = baseMatch()
    m = toggleNextRallyPowerPlay(m, "teamA").match
    m = applyPointWithExtras(m, "teamB") // opponent scores → waste
    expect(m.powerPlay.used.teamA).toBe(1)
    expect(m.events.find((e: any) => e.type === "power-play" && e.payload?.action === "consume")?.payload?.outcome).toBe("waste")
  })
})

describe("applyPointWithExtras — handicap on new game", () => {
  it("applies same-for-all-games handicap to the freshly-started game", () => {
    let m = setSameHandicap(baseMatch(), 2, 0) // 30-0 every game
    // Win the first game (4 points from 0-0 since handicap only fires AFTER a game ends).
    m = applyPointWithExtras(m, "teamA") // 0 → 15
    m = applyPointWithExtras(m, "teamA") // 15 → 30
    m = applyPointWithExtras(m, "teamA") // 30 → 40
    m = applyPointWithExtras(m, "teamA") // 40 → game
    expect(m.score.currentSet.games).toHaveLength(1)
    // The next game must open at 30-0 because of the configured handicap.
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 30, teamB: 0 })
  })

  it("does NOT apply handicap when format is 'none'", () => {
    let m = baseMatch()
    // Win a game 4-0
    m = applyPointWithExtras(m, "teamA")
    m = applyPointWithExtras(m, "teamA")
    m = applyPointWithExtras(m, "teamA")
    m = applyPointWithExtras(m, "teamA")
    expect(m.score.currentSet.games).toHaveLength(1)
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 0, teamB: 0 })
  })
})

describe("applyPointWithExtras — game timing windows", () => {
  it("opens a game-timing window, closes it on game end and opens the next", () => {
    let m = baseMatch()
    const t0 = new Date("2026-05-27T10:00:00Z")
    m = applyPointWithExtras(m, "teamA", t0)
    expect(m.timing.games).toHaveLength(1)
    expect(m.timing.games[0].startedAt).toBe(t0.toISOString())
    expect(m.timing.games[0].endedAt).toBeUndefined()
    expect(m.timing.matchStartedAt).toBe(t0.toISOString())

    const t1 = new Date("2026-05-27T10:00:30Z")
    m = applyPointWithExtras(m, "teamA", t1)
    const t2 = new Date("2026-05-27T10:01:00Z")
    m = applyPointWithExtras(m, "teamA", t2)
    const t3 = new Date("2026-05-27T10:01:30Z")
    m = applyPointWithExtras(m, "teamA", t3) // 4th point closes the game

    // First game's timing entry is now closed.
    expect(m.timing.games[0].endedAt).toBe(t3.toISOString())
    // Next game's timing window opened.
    expect(m.timing.games).toHaveLength(2)
    expect(m.timing.games[1].startedAt).toBe(t3.toISOString())
    expect(m.timing.games[1].endedAt).toBeUndefined()
  })
})

describe("applyPointWithExtras — tiebreak target choice", () => {
  it("plain two-clear format does NOT stage pendingTiebreakChoice", () => {
    let m = baseMatch({
      currentSet: { teamA: 6, teamB: 6, currentGame: { teamA: 0, teamB: 0 }, isTiebreak: true },
    })
    m = applyPointWithExtras(m, "teamA") // 1-0 in tiebreak
    expect(m.pendingTiebreakChoice).toBeUndefined()
  })

  it("receiver-select format stages a pending choice when one team is one point from the target", () => {
    let m = baseMatch({
      settings: { tiebreakFormat: "receiver-select-1-or-2", tiebreakLength: 7 },
      currentSet: {
        teamA: 6,
        teamB: 6,
        currentGame: { teamA: 5, teamB: 4 },
        isTiebreak: true,
      },
    })
    m = applyPointWithExtras(m, "teamA") // teamA goes 6 → at target − 1
    expect(m.pendingTiebreakChoice).toBeDefined()
    expect(m.pendingTiebreakChoice.options).toEqual([1, 2])
    // Receiver is the non-serving team.
    expect(m.pendingTiebreakChoice.receiverTeam).toBe(m.currentServer.team === "teamA" ? "teamB" : "teamA")
  })
})
