import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import {
  applyTiebreakChoice,
  buildPendingTiebreakChoice,
  getTiebreakAddOptions,
  getTiebreakWinMarginExt,
  isPlainTiebreakFormat,
  shouldAskTiebreakTargetChoice,
  stageTiebreakChoice,
} from "../lib/tiebreak-format"

const matchInTiebreak = (overrides: any = {}) =>
  backfillExtendedMatchState({
    id: "m",
    settings: { tiebreakLength: 7, tiebreakFormat: "two-clear", ...(overrides.settings ?? {}) },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: {
        teamA: 6,
        teamB: 6,
        games: [],
        currentGame: { teamA: 5, teamB: 6 },
        isTiebreak: true,
        ...(overrides.currentSet ?? {}),
      },
    },
  })

describe("Task 6 — option/margin tables", () => {
  it("getTiebreakAddOptions per format", () => {
    expect(getTiebreakAddOptions("two-clear")).toBeNull()
    expect(getTiebreakAddOptions("sudden-death")).toBeNull()
    expect(getTiebreakAddOptions("receiver-select-1-or-2")).toEqual([1, 2])
    expect(getTiebreakAddOptions("receiver-select-1-2-or-3")).toEqual([1, 2, 3])
    expect(getTiebreakAddOptions("receiver-select-1-or-3")).toEqual([1, 3])
  })

  it("getTiebreakWinMarginExt: sudden-death=1, everything else=2", () => {
    expect(getTiebreakWinMarginExt("sudden-death")).toBe(1)
    expect(getTiebreakWinMarginExt("two-clear")).toBe(2)
    expect(getTiebreakWinMarginExt("receiver-select-1-or-2")).toBe(2)
  })

  it("isPlainTiebreakFormat", () => {
    expect(isPlainTiebreakFormat("two-clear")).toBe(true)
    expect(isPlainTiebreakFormat("sudden-death")).toBe(true)
    expect(isPlainTiebreakFormat("receiver-select-1-or-2")).toBe(false)
    expect(isPlainTiebreakFormat(undefined)).toBe(true)
  })
})

describe("Task 6 — shouldAskTiebreakTargetChoice", () => {
  it("returns false for plain formats", () => {
    expect(shouldAskTiebreakTargetChoice(matchInTiebreak({ settings: { tiebreakFormat: "two-clear" } }))).toBe(false)
    expect(shouldAskTiebreakTargetChoice(matchInTiebreak({ settings: { tiebreakFormat: "sudden-death" } }))).toBe(false)
  })

  it("returns true when select-format is reaching target", () => {
    const m = matchInTiebreak({
      settings: { tiebreakFormat: "receiver-select-1-or-2", tiebreakLength: 7 },
      currentSet: { currentGame: { teamA: 6, teamB: 5 } },
    })
    expect(shouldAskTiebreakTargetChoice(m)).toBe(true)
  })

  it("returns false if not in tiebreak", () => {
    const m = matchInTiebreak({
      settings: { tiebreakFormat: "receiver-select-1-or-2" },
      currentSet: { isTiebreak: false, currentGame: { teamA: 0, teamB: 0 } },
    })
    expect(shouldAskTiebreakTargetChoice(m)).toBe(false)
  })

  it("returns false when scores are too low", () => {
    const m = matchInTiebreak({
      settings: { tiebreakFormat: "receiver-select-1-or-2" },
      currentSet: { currentGame: { teamA: 3, teamB: 2 } },
    })
    expect(shouldAskTiebreakTargetChoice(m)).toBe(false)
  })
})

describe("Task 6 — stage and apply choice", () => {
  it("stage attaches pendingTiebreakChoice and an event", () => {
    const m = stageTiebreakChoice(
      matchInTiebreak({ settings: { tiebreakFormat: "receiver-select-1-or-2" } }),
      "teamA",
    )
    expect(m.pendingTiebreakChoice).toMatchObject({
      baseTarget: 7,
      options: [1, 2],
      receiverTeam: "teamA",
    })
    expect(m.events[m.events.length - 1].type).toBe("manual-score-edit")
  })

  it("apply raises tiebreakLength by the chosen offset and clears the pending choice", () => {
    let m = stageTiebreakChoice(
      matchInTiebreak({ settings: { tiebreakFormat: "receiver-select-1-or-2" } }),
      "teamA",
    )
    m = applyTiebreakChoice(m, 2)
    expect(m.settings.tiebreakLength).toBe(9)
    expect(m.pendingTiebreakChoice).toBeUndefined()
  })

  it("apply rejects offsets that are not in the option list", () => {
    let m = stageTiebreakChoice(
      matchInTiebreak({ settings: { tiebreakFormat: "receiver-select-1-or-2" } }),
      "teamA",
    )
    const same = applyTiebreakChoice(m, 3)
    expect(same).toBe(m) // unchanged reference
  })

  it("super-tiebreak chooses finalSetTiebreakLength instead", () => {
    let m = matchInTiebreak({
      settings: { tiebreakFormat: "receiver-select-1-or-3", finalSetTiebreakLength: 10 },
      currentSet: { isSuperTiebreak: true, currentGame: { teamA: 9, teamB: 8 } },
    })
    m = stageTiebreakChoice(m, "teamB")
    m = applyTiebreakChoice(m, 3)
    expect(m.settings.finalSetTiebreakLength).toBe(13)
  })

  it("buildPendingTiebreakChoice reflects current target and options", () => {
    const m = matchInTiebreak({ settings: { tiebreakFormat: "receiver-select-1-2-or-3" } })
    const p = buildPendingTiebreakChoice(m, "teamB")
    expect(p).toEqual({ baseTarget: 7, options: [1, 2, 3], receiverTeam: "teamB" })
  })
})
