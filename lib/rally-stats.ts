// Task 9 — Rally-end statistics.
//
// APK RallyEndStats records, for each scored point, who finished the rally
// (Winner / Error) and a set of detail flags (racket side, position, ball
// direction, trajectory). We keep the same data model but the operator can
// opt out via match.settings.recordRallyStats — for fast-tap scoring the
// dialog is suppressed.

import { appendMatchEvent } from "./match-events"
import type { BallDirection, BallTrajectory, RacketSide, RallyEndKind, RallyStat, StrikePosition, TeamKey } from "./types"
import { safeUuid } from "./utils/safe-uuid"

export interface RallyStatInput {
  /** Team that won the point. */
  scoringTeam: TeamKey
  /** Team whose action produced the result — winner=scoringTeam, error=losingTeam. */
  creditedTeam: TeamKey
  kind: RallyEndKind
  /** Optional MatchEvent id this stat is attached to (the "point" event). */
  pointEventId?: string
  racketSide?: RacketSide
  position?: StrikePosition
  direction?: BallDirection
  trajectory?: BallTrajectory
}

/** Append a rally stat to the match. Returns a new match snapshot. */
export function recordRallyStat(match: any, input: RallyStatInput, now: Date = new Date()): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  if (!Array.isArray(next.rallyStats)) next.rallyStats = []
  const stat: RallyStat = {
    id: safeUuid(),
    at: now.toISOString(),
    ...input,
  }
  next.rallyStats.push(stat)
  return appendMatchEvent(next, {
    type: "rally-stat",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    actor: input.creditedTeam,
    payload: { ...stat },
    at: stat.at,
  })
}

/** Drop the most recent rally stat — paired with an "undo last point" flow. */
export function removeLastRallyStat(match: any): any {
  if (!Array.isArray(match?.rallyStats) || match.rallyStats.length === 0) return match
  const next = JSON.parse(JSON.stringify(match))
  next.rallyStats.pop()
  return next
}

/** Aggregate counts by team for vMix / stats panel projection. */
export function aggregateRallyStats(match: any): {
  teamA: { winners: number; errors: number; forehand: number; backhand: number }
  teamB: { winners: number; errors: number; forehand: number; backhand: number }
} {
  const empty = { winners: 0, errors: 0, forehand: 0, backhand: 0 }
  const acc = { teamA: { ...empty }, teamB: { ...empty } }
  const stats: RallyStat[] = match?.rallyStats ?? []
  for (const s of stats) {
    const bucket = acc[s.creditedTeam]
    if (!bucket) continue
    if (s.kind === "winner") bucket.winners++
    if (s.kind === "error") bucket.errors++
    if (s.racketSide === "forehand") bucket.forehand++
    if (s.racketSide === "backhand") bucket.backhand++
  }
  return acc
}

/** True when the operator enabled per-point dialogs in settings. */
export function isRallyStatsEnabled(match: any): boolean {
  return Boolean(match?.settings?.recordRallyStats)
}
