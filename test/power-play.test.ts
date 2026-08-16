import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import {
  consumePowerPlayAfterPoint,
  powerPlayBudgetLeft,
  toggleNextRallyPowerPlay,
} from "../lib/power-play"

const baseMatch = (overrides: any = {}) =>
  backfillExtendedMatchState({
    id: "m",
    settings: { scoringSystem: "classic", goldenPointFormat: "none", ...(overrides.settings ?? {}) },
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
  })

describe("Task 12 — toggleNextRallyPowerPlay", () => {
  it("activates a team when budget is available and not at game ball", () => {
    const { match, refused } = toggleNextRallyPowerPlay(baseMatch(), "teamA")
    expect(refused).toBeUndefined()
    expect(match.powerPlay.activeFor).toEqual(["teamA"])
    expect(match.events.at(-1)).toMatchObject({ type: "power-play", actor: "teamA", payload: { action: "activate" } })
  })

  it("toggling twice deactivates", () => {
    let r = toggleNextRallyPowerPlay(baseMatch(), "teamA")
    r = toggleNextRallyPowerPlay(r.match, "teamA")
    expect(r.match.powerPlay.activeFor).toEqual([])
  })

  it("refuses on game ball (40-0 for the activating team)", () => {
    const m = baseMatch({ currentSet: { currentGame: { teamA: 40, teamB: 0 } } })
    const r = toggleNextRallyPowerPlay(m, "teamA")
    expect(r.refused).toBe("game-ball")
    expect(r.match).toBe(m)
  })

  it("refuses on golden point (gp = both)", () => {
    const m = baseMatch({
      settings: { goldenPointFormat: "first-deuce" },
      currentSet: { currentGame: { teamA: 40, teamB: 40 } },
    })
    const r = toggleNextRallyPowerPlay(m, "teamA")
    expect(r.refused).toBe("game-ball")
  })

  it("refuses when team is over budget", () => {
    let m: any = baseMatch()
    m.powerPlay = { maxPerTeam: 2, used: { teamA: 2, teamB: 0 }, activeFor: [] }
    const r = toggleNextRallyPowerPlay(m, "teamA")
    expect(r.refused).toBe("no-budget")
  })

  it("allows deactivation even when over budget (team already activated earlier)", () => {
    let m: any = baseMatch()
    m.powerPlay = { maxPerTeam: 2, used: { teamA: 2, teamB: 0 }, activeFor: ["teamA"] }
    const r = toggleNextRallyPowerPlay(m, "teamA")
    expect(r.refused).toBeUndefined()
    expect(r.match.powerPlay.activeFor).toEqual([])
  })
})

describe("Task 12 — consumePowerPlayAfterPoint", () => {
  it("increments used and clears activeFor", () => {
    let m = toggleNextRallyPowerPlay(baseMatch(), "teamA").match
    m = consumePowerPlayAfterPoint(m, "teamA")
    expect(m.powerPlay.activeFor).toEqual([])
    expect(m.powerPlay.used.teamA).toBe(1)
  })

  it("records cash-in vs waste in the event payload", () => {
    let m = toggleNextRallyPowerPlay(baseMatch(), "teamA").match
    m = consumePowerPlayAfterPoint(m, "teamA")
    const last = m.events.at(-1)
    expect(last.payload).toMatchObject({ action: "consume", outcome: "cash-in" })

    let m2 = toggleNextRallyPowerPlay(baseMatch(), "teamA").match
    m2 = consumePowerPlayAfterPoint(m2, "teamB")
    expect(m2.events.at(-1).payload.outcome).toBe("waste")
  })

  it("is a no-op when nothing is active", () => {
    const m = baseMatch()
    expect(consumePowerPlayAfterPoint(m, "teamA")).toBe(m)
  })
})

describe("Task 12 — powerPlayBudgetLeft", () => {
  it("returns max - used, clamped to >=0", () => {
    const m: any = baseMatch()
    m.powerPlay = { maxPerTeam: 2, used: { teamA: 1, teamB: 0 }, activeFor: [] }
    expect(powerPlayBudgetLeft(m, "teamA")).toBe(1)
    expect(powerPlayBudgetLeft(m, "teamB")).toBe(2)
  })

  it("defaults max to 2 if missing", () => {
    expect(powerPlayBudgetLeft({}, "teamA")).toBe(2)
  })
})
