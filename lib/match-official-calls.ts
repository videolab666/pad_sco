// Task 13 — Official calls layer (conduct / appeals / broken equipment).
//
// v1 records the call only — no automatic score penalty except the explicit
// "conduct stroke" path, where the call awards a point to the opposite team
// via applyScoreIncrement (the engine's only legal way to add a point).

import { appendMatchEvent } from "./match-events"
import { applyScoreIncrement, applyPendingCourtSideChange } from "./scoring-logic"
import type {
  AppealDecision,
  ConductPenalty,
  OfficialCall,
  OfficialCallType,
  TeamKey,
} from "./types"
import { safeUuid } from "./utils/safe-uuid"

export interface OfficialCallInput {
  type: OfficialCallType
  team: TeamKey
  decision?: AppealDecision
  penalty?: ConductPenalty
  equipment?: "racket" | "string" | "ball" | "other"
  note?: string
}

/** Record an official call. Does NOT modify the score (use applyConductPenalty for that). */
export function recordOfficialCall(match: any, input: OfficialCallInput, now: Date = new Date()): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  if (!Array.isArray(next.officialCalls)) next.officialCalls = []
  const call: OfficialCall = {
    id: safeUuid(),
    at: now.toISOString(),
    ...input,
  }
  next.officialCalls.push(call)
  return appendMatchEvent(next, {
    type: input.type === "appeal" ? "appeal" : input.type === "broken-equipment" ? "broken-equipment" : "conduct",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    actor: input.team,
    payload: { ...call },
    at: call.at,
  })
}

/**
 * Apply a "conduct stroke" penalty: records the call AND awards a point to
 * the other team via the canonical scoring engine. Use this when the
 * operator wants the call to affect the score.
 */
export function applyConductPenalty(match: any, team: TeamKey, penalty: ConductPenalty, now: Date = new Date()): any {
  const recorded = recordOfficialCall(match, { type: "conduct", team, penalty }, now)
  if (penalty === "stroke") {
    const other: TeamKey = team === "teamA" ? "teamB" : "teamA"
    return applyPendingCourtSideChange(applyScoreIncrement(recorded as any, other))
  }
  return recorded
}

/** Listing helper for the calls panel UI. */
export function getOfficialCalls(match: any): OfficialCall[] {
  return Array.isArray(match?.officialCalls) ? match.officialCalls : []
}
