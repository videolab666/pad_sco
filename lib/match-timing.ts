// Task 3 — Match timing.
//
// APK GameTiming records:
//   - start  / end timestamps per game (ms)
//   - scoreTimings: seconds-from-start for every scored point within a game
//
// On the web we mirror this with ISO strings so the timing survives reloads,
// realtime sync and Supabase persistence. All functions are pure: they take a
// match snapshot, return a new one.

import type { GameTiming, Match, MatchTiming } from "./types"

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function getOrInitTiming(match: any): MatchTiming {
  if (!match.timing || typeof match.timing !== "object") {
    match.timing = { games: [] }
  } else if (!Array.isArray(match.timing.games)) {
    match.timing.games = []
  }
  return match.timing
}

function findCurrentGameTiming(match: any): GameTiming | undefined {
  const timing: MatchTiming | undefined = match?.timing
  if (!timing || !Array.isArray(timing.games)) return undefined
  const setIndex = match?.score?.sets?.length ?? 0
  const gameIndex = match?.score?.currentSet?.games?.length ?? 0
  // Walk from the end so an in-progress (unfinished) game wins over a
  // completed one with the same indices.
  for (let i = timing.games.length - 1; i >= 0; i--) {
    const g = timing.games[i]
    if (g.setIndex === setIndex && g.gameIndex === gameIndex && !g.endedAt) return g
  }
  for (let i = timing.games.length - 1; i >= 0; i--) {
    const g = timing.games[i]
    if (g.setIndex === setIndex && g.gameIndex === gameIndex) return g
  }
  return undefined
}

/**
 * Make sure the current game has a GameTiming row. Idempotent — calling it
 * before every point write is safe. Also seeds matchStartedAt the first time
 * the match records any timing.
 */
export function ensureCurrentGameTiming(match: any, now: Date = new Date()): any {
  if (!match) return match
  const next = clone(match)
  const timing = getOrInitTiming(next)

  const existing = findCurrentGameTiming(next)
  if (existing) return next

  const setIndex = next.score?.sets?.length ?? 0
  const gameIndex = next.score?.currentSet?.games?.length ?? 0
  timing.games.push({
    setIndex,
    gameIndex,
    startedAt: now.toISOString(),
    scoreTimingsSec: [],
  })
  if (!timing.matchStartedAt) timing.matchStartedAt = now.toISOString()
  return next
}

/**
 * Record a single point's elapsed time (seconds since the current game's
 * startedAt). If the current game has no timing yet, it is created first.
 */
export function addPointTiming(match: any, now: Date = new Date()): any {
  const next = ensureCurrentGameTiming(match, now)
  const cur = findCurrentGameTiming(next)
  if (!cur) return next
  const started = new Date(cur.startedAt).getTime()
  const elapsed = Math.max(0, Math.floor((now.getTime() - started) / 1000))
  cur.scoreTimingsSec.push(elapsed)
  return next
}

/**
 * Close the current game's timing window. Called when the game completes
 * (winGame in scoring-logic) — the next ensureCurrentGameTiming opens a fresh
 * entry for the next game.
 */
export function endCurrentGameTiming(match: any, now: Date = new Date()): any {
  if (!match?.timing?.games?.length) return match
  const next = clone(match)
  const cur = findCurrentGameTiming(next)
  if (cur && !cur.endedAt) cur.endedAt = now.toISOString()
  return next
}

/** Drop the most recent point timing — paired with undo of the last point. */
export function removeLastPointTiming(match: any): any {
  if (!match?.timing?.games?.length) return match
  const next = clone(match)
  const cur = findCurrentGameTiming(next)
  if (cur && cur.scoreTimingsSec.length > 0) cur.scoreTimingsSec.pop()
  return next
}

/** Mark the match as finished — sets matchEndedAt and closes the last game. */
export function finalizeMatchTiming(match: any, now: Date = new Date()): any {
  if (!match) return match
  const next = endCurrentGameTiming(match, now)
  if (!next.timing) next.timing = { games: [] }
  if (!next.timing.matchEndedAt) next.timing.matchEndedAt = now.toISOString()
  return next
}

// ─── Read-only helpers (used by match-view / vMix projection) ─────────────────

/** Total match duration in milliseconds (or 0 before the first point). */
export function getMatchDurationMs(match: any, now: Date = new Date()): number {
  const start = match?.timing?.matchStartedAt
  if (!start) return 0
  const end = match?.timing?.matchEndedAt ?? now.toISOString()
  return Math.max(0, new Date(end).getTime() - new Date(start).getTime())
}

/** Current game duration in milliseconds (or 0 if no game has started). */
export function getCurrentGameDurationMs(match: any, now: Date = new Date()): number {
  const cur = findCurrentGameTiming(match)
  if (!cur) return 0
  const end = cur.endedAt ?? now.toISOString()
  return Math.max(0, new Date(end).getTime() - new Date(cur.startedAt).getTime())
}

/** Current set duration in milliseconds — sum of all its games (incl. ongoing). */
export function getCurrentSetDurationMs(match: any, now: Date = new Date()): number {
  const timing: MatchTiming | undefined = match?.timing
  if (!timing || !Array.isArray(timing.games)) return 0
  const setIndex = match?.score?.sets?.length ?? 0
  let total = 0
  for (const g of timing.games) {
    if (g.setIndex !== setIndex) continue
    const end = g.endedAt ?? now.toISOString()
    total += Math.max(0, new Date(end).getTime() - new Date(g.startedAt).getTime())
  }
  return total
}

/** Format an mm:ss / hh:mm:ss string for the scoreboard duration display. */
export function formatDurationMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = m.toString().padStart(2, "0")
  const ss = s.toString().padStart(2, "0")
  if (h > 0) return `${h}:${mm}:${ss}`
  return `${mm}:${ss}`
}
