import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import { appendPointEvent, appendStateOverrideEvent, scoreStateOf } from "../lib/match-events"
import { adjustCurrentSet } from "../lib/match-adjust"
import { applyScoreIncrement } from "../lib/scoring-logic"
import {
  ensureSeedSnapshot,
  undoBackOneGame,
  undoBackOneSet,
  undoLastScoringEvent,
  verifyJournal,
} from "../lib/match-undo"

const freshMatch = () =>
  ensureSeedSnapshot(
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
      },
      score: {
        teamA: 0,
        teamB: 0,
        sets: [] as any[],
        currentSet: {
          teamA: 0,
          teamB: 0,
          games: [],
          currentGame: { teamA: 0, teamB: 0 },
          isTiebreak: false,
        },
      },
      currentServer: { team: "teamA", playerIndex: 0 },
      courtSides: { teamA: "left", teamB: "right" },
    }),
  )

/** Apply a point through the engine AND append the point event (mirrors UI flow). */
function scorePoint(match: any, team: "teamA" | "teamB") {
  const before = JSON.parse(JSON.stringify(match))
  const after = applyScoreIncrement(match, team)
  return appendPointEvent(after, {
    team,
    setIndex: before.score.sets.length,
    gameIndex: before.score.currentSet.games.length,
    pointIndex:
      (typeof before.score.currentSet.currentGame.teamA === "number" ? before.score.currentSet.currentGame.teamA : 0) +
      (typeof before.score.currentSet.currentGame.teamB === "number" ? before.score.currentSet.currentGame.teamB : 0),
  })
}

describe("Task 10 — ensureSeedSnapshot", () => {
  it("seeds the snapshot once and is idempotent", () => {
    const m1 = ensureSeedSnapshot({ id: "m", events: [{ id: "x" }] })
    expect(m1.seedSnapshot).toBeDefined()
    expect(m1.seedSnapshot.events).toEqual([])
    const m2 = ensureSeedSnapshot(m1)
    expect(m2).toBe(m1) // unchanged when seed already present
  })
})

describe("Task 10 — undoLastScoringEvent", () => {
  it("reverts the most recent point via replay", () => {
    let m = freshMatch()
    m = scorePoint(m, "teamA") // 15-0
    m = scorePoint(m, "teamA") // 30-0
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 30, teamB: 0 })
    m = undoLastScoringEvent(m)
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 15, teamB: 0 })
    expect(m.events.at(-1)).toMatchObject({ type: "undo" })
  })

  it("returns the match unchanged when there are no undoable events", () => {
    const m = freshMatch()
    expect(undoLastScoringEvent(m)).toBe(m)
  })
})

describe("Task 10 — undoBackOneGame", () => {
  it("rolls back every point inside the current (in-progress) game", () => {
    let m = freshMatch()
    m = scorePoint(m, "teamA") // 15-0
    m = scorePoint(m, "teamA") // 30-0
    m = scorePoint(m, "teamA") // 40-0
    m = undoBackOneGame(m)
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 0, teamB: 0 })
    expect(m.score.currentSet.games).toEqual([])
  })

  it("when at 0-0 in the next game, undoes the whole previous game", () => {
    let m = freshMatch()
    // Win the first game (4 points for teamA).
    m = scorePoint(m, "teamA")
    m = scorePoint(m, "teamA")
    m = scorePoint(m, "teamA")
    m = scorePoint(m, "teamA")
    expect(m.score.currentSet.games).toHaveLength(1)
    expect(m.score.currentSet.teamA).toBe(1)
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 0, teamB: 0 })
    // Undo back one game.
    m = undoBackOneGame(m)
    expect(m.score.currentSet.games).toHaveLength(0)
    expect(m.score.currentSet.teamA).toBe(0)
  })
})

describe("Task 10 — undoBackOneSet", () => {
  it("rolls the match back into the previous set", () => {
    let m = freshMatch()
    // Win first set 6-0 → 24 points scored by teamA.
    for (let g = 0; g < 6; g++) {
      m = scorePoint(m, "teamA")
      m = scorePoint(m, "teamA")
      m = scorePoint(m, "teamA")
      m = scorePoint(m, "teamA")
    }
    expect(m.score.sets).toHaveLength(1)
    // Score one point in the new set.
    m = scorePoint(m, "teamB")
    m = undoBackOneSet(m)
    expect(m.score.sets).toHaveLength(0)
    expect(m.score.currentSet.teamA).toBeLessThanOrEqual(6)
  })
})

// ─── Lazy mid-journal seeding + replay of manual edits + integrity check ──────

describe("lazy seed with applyFromIndex", () => {
  it("does not double-apply events that predate the seed", () => {
    // A legacy match: one point already played and journaled, no seed yet.
    let m = backfillExtendedMatchState({
      id: "m",
      settings: { sets: 3, scoringSystem: "classic", gamesPerSet: 6, tiebreakEnabled: true, tiebreakAt: "6-6" },
      score: {
        teamA: 0, teamB: 0, sets: [],
        currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
      currentServer: { team: "teamA", playerIndex: 0 },
    })
    m = scorePoint(m, "teamA") // 15-0
    expect(m.events).toHaveLength(1)

    // First point AFTER the system arrived seeds lazily (mirrors apply-point.ts).
    m = ensureSeedSnapshot(m)
    expect(m.seedSnapshot.applyFromIndex).toBe(1)
    m = scorePoint(m, "teamA") // 30-0

    const check = verifyJournal(m)
    expect(check.ok).toBe(true) // replay did not re-apply the pre-seed point
    expect(check.canUndo).toBe(true)
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 30, teamB: 0 })
  })

  it("keeps pre-seed events in the audit log after an undo", () => {
    let m = backfillExtendedMatchState({
      id: "m",
      settings: { sets: 3, scoringSystem: "classic", gamesPerSet: 6, tiebreakEnabled: true, tiebreakAt: "6-6" },
      score: {
        teamA: 0, teamB: 0, sets: [],
        currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
      currentServer: { team: "teamA", playerIndex: 0 },
    })
    m = scorePoint(m, "teamA")
    m = ensureSeedSnapshot(m)
    m = scorePoint(m, "teamB")

    const undone = undoLastScoringEvent(m)
    expect(undone.score.currentSet.currentGame).toEqual({ teamA: 15, teamB: 0 }) // pre-seed point survives
    expect(undone.events.some((e: any) => e.id === m.events[0].id)).toBe(true)
  })
})

describe("replay of manual-score-edit events", () => {
  it("applies legacy adjust-current-set overrides", () => {
    let m = freshMatch()
    m = scorePoint(m, "teamA") // 15-0
    m = adjustCurrentSet(m, { teamA: 3, teamB: 1 }) // legacy partial payload
    expect(verifyJournal(m).ok).toBe(true)
    expect(m.score.currentSet.teamA).toBe(3)
  })

  it("applies state-override events wholesale and stays verifiable", () => {
    let m = freshMatch()
    m = scorePoint(m, "teamA")
    m = scorePoint(m, "teamA")
    // A manual mutation (e.g. the -1 button) journaled via appendStateOverrideEvent.
    m.score.currentSet.currentGame = { teamA: 15, teamB: 0 }
    m = appendStateOverrideEvent(m, "score-decrease", scoreStateOf(m))
    expect(verifyJournal(m).ok).toBe(true)
    expect(verifyJournal(m).canUndo).toBe(true)

    // Undo removes the manual correction first.
    const undone = undoLastScoringEvent(m)
    expect(undone.score.currentSet.currentGame).toEqual({ teamA: 30, teamB: 0 })
  })

  it("applyScoreEditRows-style score edits stay verifiable when journaled", () => {
    let m = freshMatch()
    m = scorePoint(m, "teamA")
    m = appendStateOverrideEvent(
      { ...m, isCompleted: true, winner: "teamA" },
      "end-match",
      scoreStateOf(m),
      { includeSettings: false },
    )
    expect(verifyJournal(m).ok).toBe(true)
  })
})

describe("verifyJournal integrity gate", () => {
  it("reports not ok when the live state drifted from the journal", () => {
    let m = freshMatch()
    m = scorePoint(m, "teamA")
    m = scorePoint(m, "teamB")
    // Silent mutation — nothing journaled (the legacy -1 button bug class).
    m.score.currentSet.teamA = 4
    const check = verifyJournal(m)
    expect(check.ok).toBe(false)
    expect(check.canUndo).toBe(false)
  })

  it("reports no seed / no undoable events conservatively", () => {
    const noSeed = backfillExtendedMatchState({ id: "m", events: [] })
    expect(verifyJournal(noSeed).canUndo).toBe(false)

    let m = freshMatch()
    m = appendStateOverrideEvent(m, "noop", null)
    // Only a manual event exists — it IS undoable, so canUndo depends on ok.
    const check = verifyJournal(m)
    expect(check.ok).toBe(true)
    expect(check.canUndo).toBe(true)
  })

  it("undoBackOneSet works across a simulated reload (seed + events persisted)", () => {
    // Play a full set 6-0 plus one point of set 2 — then "reload": the match
    // round-trips through JSON exactly as storage would persist it.
    let m = freshMatch()
    for (let g = 0; g < 6; g++) {
      for (let p = 0; p < 4; p++) m = scorePoint(m, "teamA")
    }
    m = scorePoint(m, "teamB") // 15-0 in set 2
    expect(m.score.sets).toHaveLength(1)

    const reloaded = JSON.parse(JSON.stringify(m)) // storage round-trip
    const check = verifyJournal(reloaded)
    expect(check.ok).toBe(true)

    const undone = undoBackOneSet(reloaded)
    expect(undone.score.sets).toHaveLength(0)
    // Semantics: the set-winning points are peeled, so set 1 is in progress
    // again at 5-0 (its sixth game was at 40-0 when the set completed).
    expect(undone.score.currentSet.teamA).toBe(5)
    expect(undone.score.currentSet.teamB).toBe(0)
  })
})

describe("journaling of format-affecting mutations", () => {
  it("stays verifiable after a tiebreak choice changes tiebreakLength", async () => {
    const { applyTiebreakChoice, stageTiebreakChoice } = await import("../lib/tiebreak-format")
    let m = freshMatch()
    m.settings = { ...m.settings, tiebreakFormat: "choose" }
    // Reach 40-40-like conditions are not needed — stage/apply directly.
    m = stageTiebreakChoice(m, "teamB")
    m = applyTiebreakChoice(m, 2)
    expect(m.settings.tiebreakLength).toBeGreaterThan(0)
    expect(verifyJournal(m).ok).toBe(true)
  })

  it("stays verifiable after a manual end (retirement / conduct)", async () => {
    const { endMatchManually } = await import("../lib/match-end-reason")
    let m = freshMatch()
    m = scorePoint(m, "teamA")
    m = endMatchManually(m, "retired-injury", "teamA")
    expect(m.isCompleted).toBe(true)
    expect(verifyJournal(m).ok).toBe(true)
    // And undo takes the match back to live play.
    const undone = undoLastScoringEvent(m)
    expect(undone.isCompleted).toBe(false)
  })
})
