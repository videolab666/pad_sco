// Task 6 — Extended tiebreak formats.
//
// APK supports five tiebreak win-conditions:
//   - TwoClearPoints              : the standard rule (margin 2)
//   - SuddenDeath                 : margin 1
//   - SelectOneOrTwo              : the receiver picks +1 or +2 at base target
//   - SelectOneTwoOrThree         : picks +1, +2 or +3
//   - SelectOneOrThree            : picks +1 or +3
//
// The current engine already handles "two-clear" and "sudden-death". This
// module adds the three "select" variants by raising a pendingTiebreakChoice
// when the base target is one point away, then completing the tiebreak once
// the operator picks an offset.

import type { PendingTiebreakChoice, TeamKey, TiebreakFormatExt } from "./types"
import { appendMatchEvent, appendStateOverrideEvent } from "./match-events"

/** Receiver-select options per format, or null for plain margin formats. */
export function getTiebreakAddOptions(format: string | undefined): number[] | null {
  switch (format) {
    case "receiver-select-1-or-2":
      return [1, 2]
    case "receiver-select-1-2-or-3":
      return [1, 2, 3]
    case "receiver-select-1-or-3":
      return [1, 3]
    default:
      return null
  }
}

/** Numeric margin used by the regular tiebreak win check. */
export function getTiebreakWinMarginExt(format: string | undefined): number {
  if (format === "sudden-death") return 1
  return 2
}

/** Base tiebreak target (length) for the current set. */
function baseTarget(match: any): number {
  const cs = match?.score?.currentSet
  if (cs?.isSuperTiebreak) {
    return Number(match?.settings?.finalSetTiebreakLength) || 10
  }
  return Number(match?.settings?.tiebreakLength) || 7
}

/**
 * Returns true when the current tiebreak score has reached `baseTarget - 1`
 * AND the configured format requires a receiver choice. Used by the engine to
 * stage a pendingTiebreakChoice instead of silently completing the tiebreak.
 */
export function shouldAskTiebreakTargetChoice(match: any): boolean {
  const cs = match?.score?.currentSet
  if (!cs?.isTiebreak) return false
  const options = getTiebreakAddOptions(match?.settings?.tiebreakFormat)
  if (!options) return false
  const target = baseTarget(match)
  const cg = cs.currentGame ?? { teamA: 0, teamB: 0 }
  const a = typeof cg.teamA === "number" ? cg.teamA : 0
  const b = typeof cg.teamB === "number" ? cg.teamB : 0
  return Math.max(a, b) >= target - 1
}

/** Build the pending-choice object that the scoreboard dialog will render. */
export function buildPendingTiebreakChoice(match: any, receiver: TeamKey): PendingTiebreakChoice {
  const options = getTiebreakAddOptions(match?.settings?.tiebreakFormat) ?? [2]
  return {
    baseTarget: baseTarget(match),
    options,
    receiverTeam: receiver,
  }
}

/** Stage the pending choice on the match snapshot — does NOT change the score. */
export function stageTiebreakChoice(match: any, receiver: TeamKey, now: Date = new Date()): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  next.pendingTiebreakChoice = buildPendingTiebreakChoice(next, receiver)
  return appendMatchEvent(next, {
    type: "manual-score-edit",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    payload: { action: "stage-tiebreak-choice", receiver, options: next.pendingTiebreakChoice.options },
    at: now.toISOString(),
  })
}

/**
 * Apply the receiver's chosen offset. The new effective target is
 * `baseTarget + offset` (sudden-death = +1, two-clear = +2, etc.). Returns a
 * new match with `settings.tiebreakLength` (or `finalSetTiebreakLength` when in
 * a super tiebreak) raised so the engine wins the tiebreak at the right score.
 */
export function applyTiebreakChoice(match: any, offset: number, now: Date = new Date()): any {
  if (!match?.pendingTiebreakChoice) return match
  const choice = match.pendingTiebreakChoice as PendingTiebreakChoice
  if (!choice.options.includes(offset)) return match

  const next = JSON.parse(JSON.stringify(match))
  const cs = next.score?.currentSet
  const isSuper = Boolean(cs?.isSuperTiebreak)
  const newTarget = choice.baseTarget + offset
  if (isSuper) {
    next.settings = { ...next.settings, finalSetTiebreakLength: newTarget }
  } else {
    next.settings = { ...next.settings, tiebreakLength: newTarget }
  }
  delete next.pendingTiebreakChoice
  // Journaled as a full state override (with settings) so replay-based undo
  // stays in sync — the choice changes how later tiebreak points replay.
  return appendStateOverrideEvent(next, "apply-tiebreak-choice", { offset, newTarget, isSuper }, {
    includeSettings: true,
    now,
  })
}

/** True when the format does not require any operator choice (two-clear / sudden-death). */
export function isPlainTiebreakFormat(format: string | undefined): boolean {
  if (!format) return true
  return format === "two-clear" || format === "sudden-death"
}
