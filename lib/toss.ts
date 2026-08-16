// Task 8 — Server / side toss.
//
// APK runs the toss as two separate dialogs (ServerToss + SideToss). On the
// web a partially-applied toss after a reload is confusing — collapse the
// flow into a single atomic commit. The UI may still be multi-step, but the
// match snapshot only updates once both choices are made.

import { appendMatchEvent } from "./match-events"
import type { TeamKey, TossChoice, TossSide, TossState } from "./types"

export interface TossDecision {
  /** Team that won the coin toss. */
  winner: TeamKey
  /** What the toss winner chose. */
  choice: TossChoice
  /** Which team the operator placed on the left half of the court. */
  teamOnLeft: TeamKey
}

/**
 * Pure random toss helper — exposed so the UI can pick a winner with a
 * deterministic random function in tests.
 */
export function simulateToss(random: () => number = Math.random): TeamKey {
  return random() < 0.5 ? "teamA" : "teamB"
}

/**
 * Apply a full toss decision in one atomic write:
 *  - currentServer ← chosen-or-derived serving team
 *  - courtSides    ← derived from teamOnLeft
 *  - toss          ← canonical TossState (winner + choice + completedAt)
 *  - events[]      ← single "toss" event with the full decision payload
 */
export function commitToss(match: any, decision: TossDecision, now: Date = new Date()): any {
  if (!match) return match
  const { winner, choice, teamOnLeft } = decision
  const server: TeamKey = choice === "serve" ? winner : winner === "teamA" ? "teamB" : "teamA"
  const next = JSON.parse(JSON.stringify(match))
  next.currentServer = { team: server, playerIndex: 0 }
  next.courtSides = {
    teamA: teamOnLeft === "teamA" ? "left" : "right",
    teamB: teamOnLeft === "teamB" ? "left" : "right",
  } as { teamA: string; teamB: string }
  const receiver: TeamKey = winner === "teamA" ? "teamB" : "teamA"
  const tossState: TossState = {
    winner,
    winnerChoice: choice,
    receiverSide: next.courtSides[receiver] as TossSide,
    completedAt: now.toISOString(),
  }
  next.toss = tossState
  return appendMatchEvent(next, {
    type: "toss",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    payload: { winner, choice, teamOnLeft, server, receiver },
    at: now.toISOString(),
  })
}

/** True when the match already has a completed toss state. */
export function isTossCompleted(match: any): boolean {
  return Boolean(match?.toss?.completedAt)
}

/** Convenience: derive the team that received serve from a completed toss. */
export function getTossReceiver(match: any): TeamKey | null {
  const t: TossState | undefined = match?.toss
  if (!t?.winner || !t?.winnerChoice) return null
  if (t.winnerChoice === "serve") return t.winner === "teamA" ? "teamB" : "teamA"
  return t.winner
}
