// Match projection (Stage 2) — the single source of truth for turning a match
// object into display- and JSON-friendly values.
//
// Pure functions only: no React, no I/O, no mutation. Every scoreboard view
// (ScoreBoard, FullScreenScoreboard, vMix pages) and every JSON endpoint
// (/api/vmix/[id], /api/court/[number]) derives what it shows from this module,
// so the projections can never drift out of sync.

import { getTennisPointName } from "./tennis-utils"
import { getImportantPoint, isGamePoint, isSetPoint, isMatchPoint } from "./scoring-logic"
import { getSetsToWin as getConfiguredSetsToWin } from "./match-format-rules"
import {
  formatDurationMs,
  getCurrentGameDurationMs,
  getMatchDurationMs,
} from "./match-timing"
import { newBallsInXGames } from "./new-balls"

type TeamKey = "teamA" | "teamB"

/** Total sets configured for the match, with a safe default of 3. */
export function getSetCount(match: any): number {
  const n = Number(match?.settings?.sets)
  return Number.isFinite(n) && n > 0 ? n : 3
}

/**
 * Total sets in a match — defensive multi-path lookup for the JSON endpoints
 * (older matches store the count under `match.format`, newer under
 * `match.settings`). Falls back to 3.
 */
export function getMatchTotalSets(match: any): number {
  if (match?.format && typeof match.format === "object") {
    if (typeof match.format.totalSets === "number") return match.format.totalSets
    if (typeof match.format.sets === "number") return match.format.sets
    if (typeof match.format.bestOf === "number") return match.format.bestOf
  }
  if (match?.settings && typeof match.settings === "object") {
    if (typeof match.settings.totalSets === "number") return match.settings.totalSets
    if (typeof match.settings.sets === "number") return match.settings.sets
    if (typeof match.settings.bestOf === "number") return match.settings.bestOf
  }
  return 3
}

/** Sets required to win the match — explicit override if present, else derived. */
export function getMatchSetsToWin(match: any): number {
  if (match?.format && typeof match.format === "object" && typeof match.format.setsToWin === "number") {
    return match.format.setsToWin
  }
  if (match?.settings && typeof match.settings === "object" && typeof match.settings.setsToWin === "number") {
    return match.settings.setsToWin
  }
  return getConfiguredSetsToWin({ ...match?.settings, sets: getMatchTotalSets(match) })
}

/** 1-based number of the set in play (or the last played set if completed). */
export function getCurrentSetNumber(match: any): number {
  if (!match || !match.score) return 1
  if (match.isCompleted) return match.score.sets ? match.score.sets.length : 1
  if (match.score.sets && Array.isArray(match.score.sets)) return match.score.sets.length + 1
  return 1
}

/**
 * Game score as shown to a human: "0" / "15" / "30" / "40" / "Ad" in a normal
 * game, or the raw point count during a tiebreak.
 */
export function getGameScoreDisplay(match: any, team: TeamKey): string | number {
  const currentSet = match?.score?.currentSet
  if (!currentSet || !currentSet.currentGame) return "0"
  const value = currentSet.currentGame[team]
  return currentSet.isTiebreak ? value : getTennisPointName(value)
}

/** Player names of a team joined for display ("Имя1 / Имя2"). */
export function getTeamDisplayName(match: any, team: TeamKey): string {
  const players = match?.[team]?.players
  if (!Array.isArray(players)) return ""
  return players.map((p: any) => p?.name || "").join(" / ")
}

/** True when the given team currently holds serve. */
export function isTeamServing(match: any, team: TeamKey): boolean {
  return Boolean(match?.currentServer && match.currentServer.team === team)
}

/** True when a specific player (team + 0-based index) currently holds serve. */
export function isPlayerServing(match: any, team: TeamKey, playerIndex: number): boolean {
  const server = match?.currentServer
  return Boolean(server && server.team === team && server.playerIndex === playerIndex)
}

/**
 * Label for a scoreboard's "important event" banner:
 *  - finished match → the provided match-over label;
 *  - otherwise the current important point (MATCH/SET/GAME POINT, TIEBREAK) or null.
 * The match-over label is passed in because each scoreboard translates it
 * through its own i18n namespace.
 */
export function getImportantEventType(match: any, matchOverLabel: string): string | null {
  if (!match?.score) return null
  if (match.isCompleted) return matchOverLabel
  return getImportantPoint(match).type
}

/**
 * Per-team set-score columns: every completed set plus the live current set
 * (appended only while the match is still in progress). Used by both the
 * scoreboard and the JSON endpoints so the set list never disagrees.
 */
export function getSetScoreColumns(match: any): { teamA: any[]; teamB: any[] } {
  const sets = match?.score?.sets ?? []
  const teamA: any[] = sets.map((s: any) => s.teamA)
  const teamB: any[] = sets.map((s: any) => s.teamB)
  const currentSet = match?.score?.currentSet
  if (!match?.isCompleted && currentSet) {
    teamA.push(currentSet.teamA)
    teamB.push(currentSet.teamB)
  }
  return { teamA, teamB }
}

/**
 * The set rows a scoreboard renders: completed sets (raw objects, kept with
 * their `winner`/`tiebreak` fields), then the current set flagged `isCurrent`
 * while the match runs, then placeholder future sets flagged `isFuture`.
 */
export function getDisplaySets(match: any): any[] {
  const result: any[] = []
  const sets = match?.score?.sets ?? []
  for (let i = 0; i < sets.length; i++) result.push(sets[i])

  const currentSet = match?.score?.currentSet
  if (!match?.isCompleted && currentSet) {
    result.push({ teamA: currentSet.teamA, teamB: currentSet.teamB, isCurrent: true })
  }

  const totalSets = getSetCount(match)
  while (result.length < totalSets) {
    result.push({ teamA: "-", teamB: "-", isFuture: true })
  }
  return result
}

/**
 * Which side ("L" / "R") the next point is served from.
 *  - normal game: even total points → right, odd → left;
 *  - tiebreak: first point from the right, then alternating every point.
 */
export function getServeSide(match: any): "L" | "R" {
  if (!match || !match.score || !match.score.currentSet) return "R"

  const currentGame = match.score.currentSet.currentGame || { teamA: 0, teamB: 0 }

  const pointValue = (v: unknown): number => {
    if (v === "Ad") return 4
    if (typeof v !== "number") return 0
    if (v === 0) return 0
    if (v === 15) return 1
    if (v === 30) return 2
    return 3
  }

  const totalPoints = pointValue(currentGame.teamA) + pointValue(currentGame.teamB)

  if (match.score.currentSet.isTiebreak) {
    if (totalPoints === 0) return "R"
    return totalPoints % 2 === 1 ? "L" : "R"
  }

  return totalPoints % 2 === 0 ? "R" : "L"
}

/** True for a deciding-set match tiebreak recorded as a 0-1 "set". */
function isSuperTiebreakSet(set: any): boolean {
  return Boolean(set?.tiebreak) && (Number(set.teamA) || 0) + (Number(set.teamB) || 0) <= 1
}

/**
 * How one team's score in a completed set should be displayed on a scoreboard:
 *  - match super-tiebreak set → the tiebreak points are the result (e.g. 10-5);
 *    the 0/1 "games" are an artifact, so show the points with no superscript;
 *  - normal tiebreak set → games as the main number, with the tiebreak
 *    superscript on the set LOSER only (standard tennis notation, e.g. 7 / 6⁴);
 *  - plain set → just the games.
 *
 * Returns data, not JSX, so any view can render `sup` as it likes.
 */
export function getSetCellDisplay(
  set: any,
  team: TeamKey,
): { main: string | number; sup: number | null } {
  if (!set) return { main: "", sup: null }

  if (isSuperTiebreakSet(set)) {
    return { main: set.tiebreak?.[team] ?? 0, sup: null }
  }

  if (set.tiebreak) {
    const winner: TeamKey = set.winner ?? (set.teamA > set.teamB ? "teamA" : "teamB")
    const isLoser = team !== winner
    return { main: set[team], sup: isLoser ? set.tiebreak[team] ?? null : null }
  }

  return { main: set[team], sup: null }
}

/**
 * The flat, vMix-friendly object shared by /api/vmix/[id] and (as a base for)
 * /api/court/[number]. Set columns are emitted dynamically — at least 5 for
 * vMix template compatibility, more for longer matches.
 */
export function buildVmixFlatData(match: any): Record<string, any> {
  const currentSet = match?.score?.currentSet
  const { teamA: setsA, teamB: setsB } = getSetScoreColumns(match)

  const data: Record<string, any> = {
    match_id: match?.id,
    court_number: match?.courtNumber ?? "",

    teamA_name: getTeamDisplayName(match, "teamA"),
    teamA_score: match?.score?.teamA,
    teamA_game_score: getGameScoreDisplay(match, "teamA"),
    teamA_current_set: currentSet ? currentSet.teamA : 0,
    teamA_serving: isTeamServing(match, "teamA") ? "True" : "False",

    teamB_name: getTeamDisplayName(match, "teamB"),
    teamB_score: match?.score?.teamB,
    teamB_game_score: getGameScoreDisplay(match, "teamB"),
    teamB_current_set: currentSet ? currentSet.teamB : 0,
    teamB_serving: isTeamServing(match, "teamB") ? "True" : "False",

    is_tiebreak: currentSet ? (currentSet.isTiebreak ? "True" : "False") : "False",
    is_completed: match?.isCompleted ? "True" : "False",
    winner: match?.winner || "",

    // ─── Task 14 extras (always emitted, safely 0 / "" for old matches) ─────
    match_duration: formatDurationMs(getMatchDurationMs(match)),
    match_duration_ms: getMatchDurationMs(match),
    current_game_duration: formatDurationMs(getCurrentGameDurationMs(match)),
    current_game_duration_ms: getCurrentGameDurationMs(match),
    active_timer_type: match?.timing?.activeTimer?.type ?? "",
    active_timer_remaining: deriveTimerRemainingSec(match?.timing?.activeTimer),
    new_balls_in_games: newBallsInXGames(match) ?? -1,
    new_balls_now: newBallsInXGames(match) === 0 ? "True" : "False",
    last_event_type: lastEventType(match),
    teamA_winners: countRallyStats(match, "teamA", "winner"),
    teamB_winners: countRallyStats(match, "teamB", "winner"),
    teamA_errors: countRallyStats(match, "teamA", "error"),
    teamB_errors: countRallyStats(match, "teamB", "error"),
    teamA_timeouts: (match?.timeouts?.teamA?.length ?? 0),
    teamB_timeouts: (match?.timeouts?.teamB?.length ?? 0),
    toss_winner: match?.toss?.winner ?? "",
    toss_choice: match?.toss?.winnerChoice ?? "",
    power_play_active_for: (match?.powerPlay?.activeFor ?? []).join(",") || "",
    end_match_reason: match?.endMatchReason ?? "",

    timestamp: new Date().toISOString(),
    update_time: new Date().toLocaleTimeString(),
  }

  const maxSets = Math.max(5, getSetCount(match))
  for (let i = 0; i < maxSets; i++) {
    data[`teamA_set${i + 1}`] = setsA[i] !== undefined ? setsA[i] : ""
    data[`teamB_set${i + 1}`] = setsB[i] !== undefined ? setsB[i] : ""
  }
  return data
}

/**
 * Full flat payload for the court / match JSON endpoints — the base vMix data
 * plus court-specific extras (player names, winner info, set metadata,
 * important-point flags) and the dynamic set columns. Single source for both
 * /api/court/[number] and /api/match/[id], so the two endpoints cannot diverge.
 *
 * `courtNumber` overrides the value from the match when provided (the court
 * endpoint knows its court); pass null to fall back to `match.courtNumber`.
 */
export function buildCourtVmixPayload(match: any, courtNumber: number | null): Record<string, any> {
  const importantPoint = getImportantPoint(match)
  const totalSets = getMatchTotalSets(match)
  const { teamA: setsA, teamB: setsB } = getSetScoreColumns(match)

  let winnerTeamName = ""
  let winnerName1 = ""
  let winnerName2 = ""
  if (match?.isCompleted && (match.winner === "teamA" || match.winner === "teamB")) {
    winnerTeamName = getTeamDisplayName(match, match.winner)
    const players = match[match.winner]?.players ?? []
    winnerName1 = players[0]?.name || ""
    winnerName2 = players[1]?.name || ""
  }

  const data: Record<string, any> = {
    ...buildVmixFlatData(match),
    court_number: courtNumber ?? match?.courtNumber ?? 0,

    teamA_player1_name: match?.teamA?.players?.[0]?.name || "",
    teamA_player2_name: match?.teamA?.players?.[1]?.name || "",
    teamB_player1_name: match?.teamB?.players?.[0]?.name || "",
    teamB_player2_name: match?.teamB?.players?.[1]?.name || "",

    total_sets: totalSets,
    sets_to_win: getMatchSetsToWin(match),
    current_set_number: getCurrentSetNumber(match),

    winner_team_name: winnerTeamName,
    winner_name1: winnerName1,
    winner_name2: winnerName2,

    important_point_type: importantPoint.type || "",
    important_point_team: importantPoint.team || "",
    is_important_p: importantPoint.team ? "True" : "False",
    is_match_point: isMatchPoint(match) ? "True" : "False",
    is_set_point: isSetPoint(match) ? "True" : "False",
    is_game_point: isGamePoint(match) ? "True" : "False",
  }

  const maxSets = Math.max(5, totalSets)
  for (let i = 0; i < maxSets; i++) {
    data[`teamA_set${i + 1}`] = setsA[i] !== undefined ? setsA[i] : ""
    data[`teamB_set${i + 1}`] = setsB[i] !== undefined ? setsB[i] : ""
  }
  return data
}

// ─── Task 14 helpers (private to match-view) ──────────────────────────────────

function deriveTimerRemainingSec(timer: any): number {
  if (!timer?.startedAt) return 0
  const duration = Number(timer.durationSec) || 0
  // When paused, the engine writes a `remainingSec` snapshot — honour it.
  if (typeof timer.remainingSec === "number") return Math.max(0, Math.floor(timer.remainingSec))
  const startedMs = new Date(timer.startedAt).getTime()
  const elapsedSec = Math.floor((Date.now() - startedMs) / 1000)
  return Math.max(0, duration - elapsedSec)
}

function lastEventType(match: any): string {
  const events = match?.events
  if (!Array.isArray(events) || events.length === 0) return ""
  return String(events[events.length - 1]?.type ?? "")
}

function countRallyStats(match: any, team: TeamKey, kind: "winner" | "error"): number {
  const stats = match?.rallyStats
  if (!Array.isArray(stats)) return 0
  let n = 0
  for (const s of stats) {
    if (s?.creditedTeam === team && s?.kind === kind) n++
  }
  return n
}
