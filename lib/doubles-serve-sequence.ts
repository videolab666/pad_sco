// Task 11 — Doubles serve sequences.
//
// APK supports five sequences. Two of them are intro+cycle: a short fixed
// run of games at the start of the match, then a repeating body. Implementing
// them as a single big cycle (v1 of this plan) is WRONG — the modulo wraps
// back into the intro on the 8th game. This module models intro/cycle
// explicitly so the math stays right at any game number.

import type { DoublesServeSequence, TeamKey } from "./types"

export interface ServerSpec {
  team: TeamKey
  playerIndex: 0 | 1
}

const SIMPLE_CYCLES: Record<string, ServerSpec[]> = {
  A1B1A2B2: [
    { team: "teamA", playerIndex: 0 },
    { team: "teamB", playerIndex: 0 },
    { team: "teamA", playerIndex: 1 },
    { team: "teamB", playerIndex: 1 },
  ],
  A1A2B1B2: [
    { team: "teamA", playerIndex: 0 },
    { team: "teamA", playerIndex: 1 },
    { team: "teamB", playerIndex: 0 },
    { team: "teamB", playerIndex: 1 },
  ],
  // Squash doubles — same two players keep serving.
  A1B1A1B1: [
    { team: "teamA", playerIndex: 0 },
    { team: "teamB", playerIndex: 0 },
  ],
}

interface IntroPlusCycle {
  intro: ServerSpec[]
  body: ServerSpec[]
}

const INTRO_PLUS_CYCLE: Record<string, IntroPlusCycle> = {
  A2B1B2_then_A1A2B1B2: {
    intro: [
      { team: "teamA", playerIndex: 1 },
      { team: "teamB", playerIndex: 0 },
      { team: "teamB", playerIndex: 1 },
    ],
    body: [
      { team: "teamA", playerIndex: 0 },
      { team: "teamA", playerIndex: 1 },
      { team: "teamB", playerIndex: 0 },
      { team: "teamB", playerIndex: 1 },
    ],
  },
  A1B1B2_then_A1A2B1B2: {
    intro: [
      { team: "teamA", playerIndex: 0 },
      { team: "teamB", playerIndex: 0 },
      { team: "teamB", playerIndex: 1 },
    ],
    body: [
      { team: "teamA", playerIndex: 0 },
      { team: "teamA", playerIndex: 1 },
      { team: "teamB", playerIndex: 0 },
      { team: "teamB", playerIndex: 1 },
    ],
  },
}

/**
 * Resolve the canonical server for a 0-based game index. Game 0 is the very
 * first game of the match. Negative indices are clamped to 0.
 */
export function getServerForGameNumber(
  seq: DoublesServeSequence,
  gameNumber: number,
): ServerSpec {
  if (gameNumber < 0) gameNumber = 0
  const simple = SIMPLE_CYCLES[seq]
  if (simple) return simple[gameNumber % simple.length]
  const compound = INTRO_PLUS_CYCLE[seq]
  if (compound) {
    if (gameNumber < compound.intro.length) return compound.intro[gameNumber]
    const inBody = (gameNumber - compound.intro.length) % compound.body.length
    return compound.body[inBody]
  }
  // Unknown sequence — fall back to the standard padel/tennis pattern.
  return SIMPLE_CYCLES.A1B1A2B2[gameNumber % 4]
}

/**
 * For an in-flight match, derive the server for the NEXT game given the
 * sequence and the current set's completed-games count. The scoring engine
 * calls this after winGame to override the default A1B1A2B2 rotation.
 */
export function deriveServerForNextGame(match: any): ServerSpec | null {
  const seq = (match?.settings?.doublesServeSequence ?? "A1B1A2B2") as DoublesServeSequence
  if (seq === "A1B1A2B2") return null // engine default behaviour is correct
  const completedSets = match?.score?.sets ?? []
  const closedGameTotal = completedSets.reduce(
    (sum: number, s: any) => sum + (s.teamA ?? 0) + (s.teamB ?? 0),
    0,
  )
  const cs = match?.score?.currentSet
  const currentSetGames = (cs?.teamA ?? 0) + (cs?.teamB ?? 0)
  const gameNumber = closedGameTotal + currentSetGames
  return getServerForGameNumber(seq, gameNumber)
}
