// Task 13 — Timeouts.
//
// APK recordTimeout writes a timestamped entry per timeout and starts a 60s
// timer (lib/match-timers). We mirror that with a per-team list on the match
// snapshot.

import { startMatchTimer } from "./match-timers"
import { appendMatchEvent } from "./match-events"
import type { TeamKey, TimeoutRecord } from "./types"

/**
 * Record a timeout for `team` at the current set/game score and start the
 * configured timeout timer.
 */
export function recordTimeout(match: any, team: TeamKey, now: Date = new Date()): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  if (!next.timeouts || typeof next.timeouts !== "object") {
    next.timeouts = { teamA: [], teamB: [] }
  }
  if (!Array.isArray(next.timeouts[team])) next.timeouts[team] = []
  const record: TimeoutRecord = {
    at: now.toISOString(),
    setScore: {
      teamA: next.score?.currentSet?.teamA ?? 0,
      teamB: next.score?.currentSet?.teamB ?? 0,
    },
    gameScore: {
      teamA: next.score?.currentSet?.currentGame?.teamA ?? 0,
      teamB: next.score?.currentSet?.currentGame?.teamB ?? 0,
    },
  }
  next.timeouts[team].push(record)
  const withEvent = appendMatchEvent(next, {
    type: "timeout",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    actor: team,
    payload: { ...record },
    at: record.at,
  })
  return startMatchTimer(withEvent, "timeout", team, now)
}

/** Count of timeouts taken by a team so far. */
export function getTimeoutCount(match: any, team: TeamKey): number {
  return Array.isArray(match?.timeouts?.[team]) ? match.timeouts[team].length : 0
}
