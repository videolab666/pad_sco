// Task 13 — End-match reasons.
//
// APK EndMatchManuallyBecause: RetiredBecauseOfInjury / ConductMatch / TimeIsUp.
// We model them as a flat enum on the match plus a single helper that flips
// the match to completed + records the end event + closes the timing window.

import { appendMatchEvent, appendStateOverrideEvent } from "./match-events"
import { finalizeMatchTiming } from "./match-timing"
import type { EndMatchReason, TeamKey } from "./types"

/**
 * Mark the match as ended for a non-default reason (retirement, conduct
 * disqualification, time limit). The caller picks the winnerTeam.
 */
export function endMatchManually(
  match: any,
  reason: Exclude<EndMatchReason, "completed">,
  winnerTeam: TeamKey,
  now: Date = new Date(),
): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  next.isCompleted = true
  next.winner = winnerTeam
  next.endMatchReason = reason
  const finalized = finalizeMatchTiming(next, now)
  const audited = appendMatchEvent(finalized, {
    type: "end-match-manual",
    setIndex: finalized.score?.sets?.length ?? 0,
    gameIndex: finalized.score?.currentSet?.games?.length ?? 0,
    actor: winnerTeam,
    payload: { reason, winnerTeam },
    at: now.toISOString(),
  })
  // State override keeps the replay journal in sync (isCompleted / winner).
  return appendStateOverrideEvent(audited, "end-match-manual", { reason, winnerTeam }, { now })
}
