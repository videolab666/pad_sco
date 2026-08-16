// Task 5 — New balls tracking.
//
// Mirrors the APK NewBalls enum and newBallsInXgames() helper:
//   - off                          : feature disabled
//   - after-first-7-then-each-9    : first change after 7 games, every 9 after
//   - after-first-9-then-each-11   : first after 9, every 11
//   - after-first-11-then-each-13  : first after 11, every 13
//   - before-set-3                 : single change at the start of set 3
//
// If a scheduled ball-change would fall on the first game of a tie-break,
// the APK postpones the change by 2 games. We mirror that behavior here.

import { appendMatchEvent } from "./match-events"
import type { NewBallsMode } from "./types"

interface RuleSpec {
  first: number | null
  each: number | null
  set: number | null
}

const NEW_BALLS_RULES: Record<Exclude<NewBallsMode, "off">, RuleSpec> = {
  "after-first-7-then-each-9": { first: 7, each: 9, set: null },
  "after-first-9-then-each-11": { first: 9, each: 11, set: null },
  "after-first-11-then-each-13": { first: 11, each: 13, set: null },
  "before-set-3": { first: null, each: null, set: 3 },
}

/** Sum of games completed across closed sets + the current set. */
export function totalGamesPlayed(match: any): number {
  const sets = match?.score?.sets ?? []
  const completed = sets.reduce(
    (sum: number, s: any) => sum + (s.teamA ?? 0) + (s.teamB ?? 0),
    0,
  )
  const cs = match?.score?.currentSet
  return completed + (cs?.teamA ?? 0) + (cs?.teamB ?? 0)
}

/** True when at least one point has been played in the current game. */
function isMidGame(match: any): boolean {
  const cg = match?.score?.currentSet?.currentGame
  if (!cg) return false
  if (typeof cg.teamA === "number" && cg.teamA > 0) return true
  if (typeof cg.teamB === "number" && cg.teamB > 0) return true
  if (cg.teamA === "Ad" || cg.teamB === "Ad") return true
  return false
}

/**
 * True when the next game to be played would itself be a tie-break.
 * - explicit isTiebreak flag on the current set, or
 * - both teams already at the tiebreak-at threshold (e.g. 6-6) with
 *   tiebreakEnabled.
 */
function wouldNextGameBeTiebreak(match: any): boolean {
  const cs = match?.score?.currentSet
  if (!cs) return false
  if (cs.isTiebreak) return true
  if (!match?.settings?.tiebreakEnabled) return false
  const tbAt = Number.parseInt(
    String(match?.settings?.tiebreakAt ?? "6-6").split("-")[0] || "6",
    10,
  )
  return cs.teamA === tbAt && cs.teamB === tbAt
}

/**
 * Games remaining until the next ball change.
 *  - null    → mode is "off", match completed, or we are mid-game / mid-tiebreak
 *  - 0       → change is due right now (start of the new game)
 *  - 1, 2, … → due in that many games
 *
 * Tiebreak rule: if a change would land on the start of a tie-break game,
 * postpone it by 2 games (APK newBallsInXgames behavior).
 */
export function newBallsInXGames(match: any): number | null {
  const mode = (match?.newBalls?.mode ?? "off") as NewBallsMode
  if (mode === "off" || match?.isCompleted) return null
  if (isMidGame(match)) return null

  const rule = NEW_BALLS_RULES[mode as Exclude<NewBallsMode, "off">]
  if (!rule) return null

  // "Before set 3" → 0 only at the start of set 3 (before any game played).
  if (rule.set !== null) {
    const currentSetNumber = (match?.score?.sets?.length ?? 0) + 1
    const cs = match?.score?.currentSet
    const gamesInCurrent = (cs?.teamA ?? 0) + (cs?.teamB ?? 0)
    if (currentSetNumber === rule.set && gamesInCurrent === 0) return 0
    return null
  }

  const total = totalGamesPlayed(match)
  const lastChange = match?.newBalls?.lastChangeAtStartOfGame || 0
  // The first change happens at `rule.first` games played; subsequent changes
  // happen `rule.each` games after the previous change. Treat lastChange===0
  // as "no change yet" so we still measure against `rule.first`.
  let nextAt = lastChange === 0 ? (rule.first ?? 0) : lastChange + (rule.each ?? 0)
  while (nextAt < total) nextAt += rule.each ?? Infinity

  const remaining = nextAt - total
  if (remaining === 0 && wouldNextGameBeTiebreak(match)) return 2
  return remaining
}

/** Convenience: should the operator's "new balls now" indicator light up? */
export function isNewBallsDueNow(match: any): boolean {
  return newBallsInXGames(match) === 0
}

/**
 * Mark balls as changed at the current game boundary. Records a MatchEvent so
 * vMix / history panels can display when the change happened.
 */
export function markNewBallsChanged(match: any, now: Date = new Date()): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  if (!next.newBalls) next.newBalls = { mode: "off", lastChangeAtStartOfGame: 0, pendingInGames: null }
  next.newBalls.lastChangeAtStartOfGame = totalGamesPlayed(next)
  next.newBalls.pendingInGames = null
  return appendMatchEvent(next, {
    type: "new-balls",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    payload: { atGame: next.newBalls.lastChangeAtStartOfGame, mode: next.newBalls.mode },
    at: now.toISOString(),
  })
}
