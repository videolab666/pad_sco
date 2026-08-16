// Task 7 — Handicap.
//
// APK supports three HandicapFormat values:
//   - None
//   - SameForAllGames        : every new game starts at the same handicap
//   - DifferentForAllGames   : per-game start score map
//
// In the web schema we store these on the match itself (see HandicapState in
// lib/types.ts) and apply them when a new game begins. Handicap point counts
// are 0..3 → 0/15/30/40; values outside that range are clamped.

import type { CurrentGame, HandicapState, TeamKey } from "./types"

const TENNIS_POINT_VALUES = [0, 15, 30, 40] as const

/** Map a 0..3 point index to the tennis-points value (0/15/30/40). */
export function pointIndexToTennisScore(index: number): 0 | 15 | 30 | 40 {
  if (index <= 0) return 0
  if (index >= 3) return 40
  return TENNIS_POINT_VALUES[index] as 0 | 15 | 30 | 40
}

/** Lookup the handicap pair to apply for a specific (setIndex, gameIndex). */
export function getGameHandicap(
  match: any,
  setIndex: number,
  gameIndex: number,
): { teamA: number; teamB: number } {
  const h: HandicapState | undefined = match?.handicap
  if (!h || h.format === "none") return { teamA: 0, teamB: 0 }
  if (h.format === "same-for-all-games") {
    return h.sameForAllGames ?? { teamA: 0, teamB: 0 }
  }
  if (h.format === "different-for-all-games") {
    return h.perGame?.[`${setIndex}:${gameIndex}`] ?? { teamA: 0, teamB: 0 }
  }
  return { teamA: 0, teamB: 0 }
}

/** True when any handicap will be applied at the current game. */
export function hasActiveHandicap(match: any): boolean {
  const setIndex = match?.score?.sets?.length ?? 0
  const gameIndex = match?.score?.currentSet?.games?.length ?? 0
  const h = getGameHandicap(match, setIndex, gameIndex)
  return h.teamA !== 0 || h.teamB !== 0
}

/** Build the starting CurrentGame for the current set/game pair. */
export function buildNewCurrentGame(match: any): CurrentGame {
  const setIndex = match?.score?.sets?.length ?? 0
  const gameIndex = match?.score?.currentSet?.games?.length ?? 0
  const h = getGameHandicap(match, setIndex, gameIndex)
  return {
    teamA: pointIndexToTennisScore(h.teamA),
    teamB: pointIndexToTennisScore(h.teamB),
  }
}

/** Persist a same-for-all-games handicap configuration on the match. */
export function setSameHandicap(match: any, teamA: number, teamB: number): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  next.handicap = {
    format: "same-for-all-games",
    sameForAllGames: { teamA: clamp03(teamA), teamB: clamp03(teamB) },
    perGame: next.handicap?.perGame,
  } as HandicapState
  return next
}

/** Persist a per-game handicap entry for (setIndex, gameIndex). */
export function setPerGameHandicap(
  match: any,
  setIndex: number,
  gameIndex: number,
  teamA: number,
  teamB: number,
): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  const map = { ...(next.handicap?.perGame ?? {}) }
  map[`${setIndex}:${gameIndex}`] = { teamA: clamp03(teamA), teamB: clamp03(teamB) }
  next.handicap = {
    format: "different-for-all-games",
    sameForAllGames: next.handicap?.sameForAllGames,
    perGame: map,
  } as HandicapState
  return next
}

/** Reset to no handicap. */
export function clearHandicap(match: any): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  next.handicap = { format: "none" }
  return next
}

function clamp03(n: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 3) return 3
  return Math.floor(n)
}
