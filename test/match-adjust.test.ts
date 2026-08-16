import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import {
  adjustCurrentGame,
  adjustCurrentServer,
  adjustCurrentSet,
  applyScoreEditRows,
  buildScoreEditRows,
  getShareUrl,
  reopenSetAt,
  setShareUrl,
  unlockMatchForPlay,
} from "../lib/match-adjust"

const baseMatch = () =>
  backfillExtendedMatchState({
    id: "m",
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 2, teamB: 1, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
    currentServer: { team: "teamA", playerIndex: 0 },
  })

describe("Task 15 — adjustCurrentGame", () => {
  it("writes the tennis score and emits a manual-score-edit event", () => {
    const m = adjustCurrentGame(baseMatch(), { teamA: 2, teamB: 1 }) // 30-15
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 30, teamB: 15 })
    expect(m.events.at(-1)).toMatchObject({
      type: "manual-score-edit",
      payload: { action: "adjust-current-game", after: { teamA: 30, teamB: 15 } },
    })
  })

  it("supports Ad on either side", () => {
    const m = adjustCurrentGame(baseMatch(), { teamA: "Ad", teamB: 3 })
    expect(m.score.currentSet.currentGame).toEqual({ teamA: "Ad", teamB: 40 })
  })
})

describe("Task 15 — adjustCurrentSet", () => {
  it("writes the set games and clamps negatives", () => {
    const m = adjustCurrentSet(baseMatch(), { teamA: 5, teamB: -1 })
    expect(m.score.currentSet.teamA).toBe(5)
    expect(m.score.currentSet.teamB).toBe(0)
  })
})

describe("Task 15 — adjustCurrentServer", () => {
  it("changes the current server with an event trail", () => {
    const m = adjustCurrentServer(baseMatch(), "teamB", 1)
    expect(m.currentServer).toEqual({ team: "teamB", playerIndex: 1 })
    expect(m.events.at(-1).payload.action).toBe("adjust-current-server")
  })
})

describe("Task 15 — share URL persistence", () => {
  it("set / get round-trip", () => {
    const m = setShareUrl(baseMatch(), "https://example.com/match/abc")
    expect(getShareUrl(m)).toBe("https://example.com/match/abc")
  })

  it("getShareUrl returns empty string when unset", () => {
    expect(getShareUrl({})).toBe("")
  })
})

// ─── Set-by-set score editing (the "edit score" card) ─────────────────────────

// A finished match keeps the final set's score in currentSet (display copy) —
// exactly what winSet leaves behind when it completes the match.
const finishedMatch = () =>
  backfillExtendedMatchState({
    id: "m",
    isCompleted: true,
    winner: "teamA",
    settings: { sets: 3, tiebreakEnabled: true },
    score: {
      teamA: 2,
      teamB: 0,
      sets: [
        { teamA: 6, teamB: 4, winner: "teamA" },
        { teamA: 6, teamB: 3, winner: "teamA" },
      ],
      currentSet: { teamA: 6, teamB: 3, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
    currentServer: { team: "teamA", playerIndex: 0 },
  })

describe("buildScoreEditRows", () => {
  it("appends the current-set row only while the match is live", () => {
    const live = baseMatch() // 0 completed sets + current set 2-1
    expect(buildScoreEditRows(live)).toEqual([{ teamA: 2, teamB: 1 }])
  })

  it("does NOT append the stale display copy of a finished match", () => {
    // Regression: a 2-set finished match must show 2 rows, not a ghost
    // 3rd set duplicating the second set's score.
    expect(buildScoreEditRows(finishedMatch())).toEqual([
      { teamA: 6, teamB: 4 },
      { teamA: 6, teamB: 3 },
    ])
  })
})

describe("unlockMatchForPlay", () => {
  it("drops the stale final-set copy so it cannot become a live next set", () => {
    const m = unlockMatchForPlay(finishedMatch())
    expect(m.isCompleted).toBe(false)
    expect(m.winner).toBe(null)
    expect(m.score.currentSet).toMatchObject({ teamA: 0, teamB: 0 })
    expect(m.score.sets).toHaveLength(2) // recorded sets stand
  })

  it("keeps a genuinely abandoned set for resuming after a manual end", () => {
    const m = backfillExtendedMatchState({
      id: "m",
      isCompleted: true,
      winner: "teamA",
      settings: { sets: 3 },
      score: {
        teamA: 1,
        teamB: 0,
        sets: [{ teamA: 6, teamB: 4, winner: "teamA" }],
        currentSet: { teamA: 2, teamB: 3, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
    })
    const unlocked = unlockMatchForPlay(m)
    expect(unlocked.isCompleted).toBe(false)
    expect(unlocked.score.currentSet).toMatchObject({ teamA: 2, teamB: 3 })
  })
})

describe("applyScoreEditRows", () => {
  it("edits a finished match without inventing a current set", () => {
    const rows = buildScoreEditRows(finishedMatch())
    rows[0].teamA = 3 // 6-4 -> 3-4: set 1 now goes to teamB
    const m = applyScoreEditRows(finishedMatch(), rows)
    expect(m.score.sets[0]).toMatchObject({ teamA: 3, teamB: 4, winner: "teamB" })
    expect(m.score.sets[1]).toMatchObject({ teamA: 6, teamB: 3, winner: "teamA" })
    expect(m.isCompleted).toBe(false) // 1-1 — the match continues
    expect(m.score.currentSet).toMatchObject({ teamA: 0, teamB: 0 }) // fresh set 3
    expect(m.winner).toBe(null)
  })

  it("writes the last row into the live current set", () => {
    const m = applyScoreEditRows(baseMatch(), [{ teamA: 4, teamB: 2 }])
    expect(m.score.currentSet.teamA).toBe(4)
    expect(m.score.currentSet.teamB).toBe(2)
    expect(m.isCompleted).toBe(false)
  })
})

// ─── reopenSetAt (↩ "Переиграть сет") ─────────────────────────────────────────

describe("reopenSetAt", () => {
  it("reopens the last set with a corrected 6-6 score and starts the tiebreak", () => {
    // Scenario: set 1 was mis-entered as 5-7 instead of reaching 6-6.
    const m = reopenSetAt(finishedMatch(), 1, { teamA: 6, teamB: 6 })
    expect(m.score.sets).toHaveLength(1) // set 2 dropped
    expect(m.score.sets[0]).toMatchObject({ teamA: 6, teamB: 4, winner: "teamA" })
    expect(m.score.currentSet).toMatchObject({ teamA: 6, teamB: 6, isTiebreak: true })
    expect(m.score.currentSet.isSuperTiebreak).toBeFalsy()
    expect(m.isCompleted).toBe(false)
    expect(m.winner).toBe(null)
  })

  it("drops all sets after the reopened one", () => {
    const m3 = backfillExtendedMatchState({
      id: "m",
      settings: { sets: 3, tiebreakEnabled: true },
      score: {
        teamA: 1, teamB: 2,
        sets: [
          { teamA: 6, teamB: 4, winner: "teamA" },
          { teamA: 3, teamB: 6, winner: "teamB" },
          { teamA: 2, teamB: 6, winner: "teamB" },
        ],
        currentSet: { teamA: 0, teamB: 1, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
    })
    const m = reopenSetAt(m3, 0) // reopen set 1 as recorded (6-4)
    expect(m.score.sets).toHaveLength(0)
    expect(m.score.currentSet).toMatchObject({ teamA: 6, teamB: 4, isTiebreak: false })
    expect(m.score.teamA).toBe(0)
    expect(m.score.teamB).toBe(0)
  })

  it("does not flip the tiebreak flag when the score is below the trigger", () => {
    const m = reopenSetAt(finishedMatch(), 1, { teamA: 5, teamB: 5 })
    expect(m.score.currentSet).toMatchObject({ teamA: 5, teamB: 5, isTiebreak: false })
  })

  it("un-finishes a completed match and keeps the server", () => {
    const before = finishedMatch()
    const m = reopenSetAt(before, 0, { teamA: 6, teamB: 4 })
    expect(m.isCompleted).toBe(false)
    expect(m.winner).toBe(null)
    expect(m.currentServer).toEqual(before.currentServer)
    expect(m.shouldChangeSides).toBe(false)
  })

  it("marks 8-8 as tiebreak for a ПРО set", () => {
    const superMatch = backfillExtendedMatchState({
      id: "m",
      settings: { sets: 1, isSuperSet: true, tiebreakEnabled: true },
      score: {
        teamA: 1, teamB: 0,
        sets: [{ teamA: 9, teamB: 7, winner: "teamA" }],
        currentSet: { teamA: 9, teamB: 7, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
    })
    const m = reopenSetAt(superMatch, 0, { teamA: 8, teamB: 8 })
    expect(m.score.currentSet).toMatchObject({ teamA: 8, teamB: 8, isTiebreak: true })
    expect(m.isCompleted).toBe(false)
  })

  it("reopens the deciding match-tiebreak set as a super tiebreak", () => {
    const mt = backfillExtendedMatchState({
      id: "m",
      settings: { sets: 3, tiebreakEnabled: true, finalSetTiebreak: true, finalSetFinish: "match-tiebreak-10" },
      score: {
        teamA: 1, teamB: 2,
        sets: [
          { teamA: 6, teamB: 4, winner: "teamA" },
          { teamA: 3, teamB: 6, winner: "teamB" },
          { teamA: 0, teamB: 1, winner: "teamB", tiebreak: { teamA: 8, teamB: 10 } },
        ],
        currentSet: { teamA: 0, teamB: 1, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: true, isSuperTiebreak: true },
      },
    })
    const m = reopenSetAt(mt, 2)
    expect(m.score.sets).toHaveLength(2)
    expect(m.score.currentSet).toMatchObject({ isTiebreak: true, isSuperTiebreak: true })
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 0, teamB: 0 }) // points restart
    expect(m.isCompleted).toBe(false)
  })

  it("journals a reopen-set event", () => {
    const m = reopenSetAt(finishedMatch(), 1, { teamA: 6, teamB: 6 })
    const ev = m.events.at(-1)
    expect(ev).toMatchObject({ type: "manual-score-edit" })
    expect(ev.payload).toMatchObject({ action: "reopen-set" })
    expect(ev.payload.after.score.sets).toHaveLength(1)
  })

  it("returns the match unchanged for an out-of-range index", () => {
    const m = finishedMatch()
    expect(reopenSetAt(m, 5)).toBe(m)
    expect(reopenSetAt(m, -1)).toBe(m)
  })
})

describe("journaling inside lib functions (shared with the remote API)", () => {
  it("applyScoreEditRows journals a score-edit state override", () => {
    const live = backfillExtendedMatchState({
      id: "m",
      settings: { sets: 3, tiebreakEnabled: true },
      score: {
        teamA: 0, teamB: 0,
        sets: [],
        currentSet: { teamA: 2, teamB: 1, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
      },
    })
    const m = applyScoreEditRows(live, [{ teamA: 4, teamB: 2 }])
    expect(m.events.at(-1)).toMatchObject({ type: "manual-score-edit" })
    expect(m.events.at(-1).payload.action).toBe("score-edit")
    expect(m.events.at(-1).payload.after.score.currentSet.teamA).toBe(4)
  })

  it("unlockMatchForPlay journals an unlock-match state override", () => {
    const m = unlockMatchForPlay(finishedMatch())
    expect(m.events.at(-1)).toMatchObject({ type: "manual-score-edit" })
    expect(m.events.at(-1).payload.action).toBe("unlock-match")
    expect(m.events.at(-1).payload.after.isCompleted).toBe(false)
  })
})
