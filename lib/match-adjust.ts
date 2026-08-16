// Task 15 — Manual score adjustment + share URL persistence.
//
// AdjustScore (APK): the operator can directly edit the current game / current
// set numbers (e.g. when the scorer mis-clicked and needs to set 30-15). This
// is distinct from undo — undo replays history, adjust writes a NEW state
// directly. We record the change as a `manual-score-edit` event with both
// the before and after values so audit and undo can roll it back later.
//
// Share URL: persisted on the match snapshot so vMix / scoreboard / external
// boards always read it from one place rather than recomputing per request.

import { appendMatchEvent, appendStateOverrideEvent, scoreStateOf } from "./match-events"
import {
  getSetsToWin,
  isFinalSetNoTiebreak,
  isMatchTiebreakFormat,
  usesFinalSetGameTiebreak,
} from "./match-format-rules"
import { getSetTargets, recomputeMatchCompletion } from "./scoring-logic"
import type { CurrentGame, CurrentSet, TeamKey } from "./types"

const POINT_VALUES = [0, 15, 30, 40] as const

function asPoint(v: number): 0 | 15 | 30 | 40 {
  if (v <= 0) return 0
  if (v >= 3) return 40
  return POINT_VALUES[v] as 0 | 15 | 30 | 40
}

export interface AdjustCurrentGameInput {
  /** 0..3 → 0/15/30/40, or the literal "Ad". */
  teamA: 0 | 1 | 2 | 3 | "Ad"
  teamB: 0 | 1 | 2 | 3 | "Ad"
}

/** Write the current game's tennis score directly (manual correction). */
export function adjustCurrentGame(match: any, input: AdjustCurrentGameInput, now: Date = new Date()): any {
  if (!match?.score?.currentSet) return match
  const next = JSON.parse(JSON.stringify(match))
  const cs: CurrentSet = next.score.currentSet
  const before: CurrentGame = { ...cs.currentGame }
  cs.currentGame = {
    ...cs.currentGame,
    teamA: input.teamA === "Ad" ? "Ad" : asPoint(input.teamA),
    teamB: input.teamB === "Ad" ? "Ad" : asPoint(input.teamB),
  }
  return appendMatchEvent(next, {
    type: "manual-score-edit",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    payload: { action: "adjust-current-game", before, after: { ...cs.currentGame } },
    at: now.toISOString(),
  })
}

export interface AdjustCurrentSetInput {
  teamA: number
  teamB: number
}

/** Write the current set's game counts directly. */
export function adjustCurrentSet(match: any, input: AdjustCurrentSetInput, now: Date = new Date()): any {
  if (!match?.score?.currentSet) return match
  const next = JSON.parse(JSON.stringify(match))
  const cs: CurrentSet = next.score.currentSet
  const before = { teamA: cs.teamA, teamB: cs.teamB }
  cs.teamA = Math.max(0, Math.floor(input.teamA))
  cs.teamB = Math.max(0, Math.floor(input.teamB))
  return appendMatchEvent(next, {
    type: "manual-score-edit",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    payload: { action: "adjust-current-set", before, after: { teamA: cs.teamA, teamB: cs.teamB } },
    at: now.toISOString(),
  })
}

/** Update which team currently holds serve. */
export function adjustCurrentServer(match: any, team: TeamKey, playerIndex: 0 | 1 = 0, now: Date = new Date()): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  const before = next.currentServer
  next.currentServer = { team, playerIndex }
  return appendMatchEvent(next, {
    type: "manual-score-edit",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    payload: { action: "adjust-current-server", before, after: next.currentServer },
    at: now.toISOString(),
  })
}

/** Persist a public share URL onto the match snapshot. */
export function setShareUrl(match: any, url: string): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  next.shareUrl = url
  return next
}

/** Read the share URL — empty string when unset (handy for projection). */
export function getShareUrl(match: any): string {
  return typeof match?.shareUrl === "string" ? match.shareUrl : ""
}

// ─── Set-by-set score editing (the "edit score" card) ────────────────────────
//
// The card edits one row per set. While the match is live, the last row maps
// to the in-progress set (score.currentSet). A finished match keeps the final
// set's score in currentSet purely for the scoreboard display — appending it
// to the rows would show a ghost extra set duplicating the last one.

export interface ScoreEditRow {
  teamA: number
  teamB: number
}

/** Rows for the score-editing card: completed sets, plus the live current set. */
export function buildScoreEditRows(match: any): ScoreEditRow[] {
  if (!match?.score) return []
  const rows: ScoreEditRow[] = (match.score.sets || []).map((s: any) => ({
    teamA: s.teamA,
    teamB: s.teamB,
  }))
  if (!match.isCompleted && match.score.currentSet) {
    rows.push({ teamA: match.score.currentSet.teamA, teamB: match.score.currentSet.teamB })
  }
  return rows
}

/** Fresh 0-0 set used when play resumes and a stale display copy must go. */
function freshCurrentSet(): CurrentSet {
  return { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false }
}

/**
 * True when currentSet merely mirrors the last recorded set — the display copy
 * an engine-finished match keeps after its final set was pushed to score.sets.
 */
function isStaleFinalSet(match: any): boolean {
  const sets = match?.score?.sets ?? []
  const cs = match?.score?.currentSet
  const last = sets[sets.length - 1]
  return !!cs && !!last && cs.teamA === last.teamA && cs.teamB === last.teamB
}

/**
 * Unlock a finished match for further play. An engine-finished match keeps
 * the final set's score in currentSet for display; that copy must not turn
 * into a live "next set" — it is dropped. A genuinely abandoned set (manual
 * end) differs from the last recorded set and is kept for resuming.
 */
export function unlockMatchForPlay(match: any, now: Date = new Date()): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  next.isCompleted = false
  next.winner = null
  next.history = []
  if (isStaleFinalSet(next)) next.score.currentSet = freshCurrentSet()
  // Journaled here (not at the UI layer) so every caller — scoreboard UI,
  // remote API — keeps the replay journal in sync identically.
  return appendStateOverrideEvent(next, "unlock-match", scoreStateOf(match), { now })
}

/**
 * Write the edited rows back. While live, the last row updates the in-progress
 * set; for a finished match rows map 1:1 onto the completed sets, and if the
 * edit un-finishes the match, play resumes from a fresh 0-0 set instead of
 * the stale display copy. Set winners, set totals and completion are
 * recomputed. Returns a new match — the input is not mutated.
 */
export function applyScoreEditRows(match: any, rows: ScoreEditRow[]): any {
  if (!match?.score) return match
  const next = JSON.parse(JSON.stringify(match))
  const hasCurrentRow = !match.isCompleted
  const lastSetIdx = hasCurrentRow ? rows.length - 2 : rows.length - 1
  for (let i = 0; i <= lastSetIdx; i++) {
    const row = rows[i]
    if (!next.score.sets[i]) continue
    next.score.sets[i].teamA = row.teamA
    next.score.sets[i].teamB = row.teamB
    if (row.teamA > row.teamB) next.score.sets[i].winner = "teamA"
    else if (row.teamB > row.teamA) next.score.sets[i].winner = "teamB"
    else next.score.sets[i].winner = null
  }
  if (hasCurrentRow && next.score.currentSet && rows.length > 0) {
    next.score.currentSet.teamA = rows[rows.length - 1].teamA
    next.score.currentSet.teamB = rows[rows.length - 1].teamB
  }
  next.score.teamA = next.score.sets.filter((s: any) => s.winner === "teamA").length
  next.score.teamB = next.score.sets.filter((s: any) => s.winner === "teamB").length
  const setsToWin = getSetsToWin(next.settings)
  if (next.score.teamA >= setsToWin) {
    next.isCompleted = true
    next.winner = "teamA"
  } else if (next.score.teamB >= setsToWin) {
    next.isCompleted = true
    next.winner = "teamB"
  } else {
    next.isCompleted = false
    next.winner = null
    // The edit un-finished the match: resume with a clean current set.
    if (!hasCurrentRow) next.score.currentSet = freshCurrentSet()
  }
  // Journaled here (not at the UI layer) so every caller — scoreboard UI,
  // remote API — keeps the replay journal in sync identically.
  return appendStateOverrideEvent(next, "score-edit", scoreStateOf(match))
}

/**
 * The engine flips `isTiebreak` only when a game is WON at the trigger score
 * — nothing derives the flag from the score itself — so a reopened set must
 * set the tiebreak flags itself, per the format that applies AFTER the
 * truncation (getSetTargets indexes by sets.length).
 */
function applyReopenTiebreakFlags(match: any, cs: CurrentSet): void {
  const s = match.settings || {}
  if (s.isSuperSet) {
    // ПРО сет plays its own tiebreak at 8-8 (hardcoded in the engine).
    if (cs.teamA === 8 && cs.teamB === 8) cs.isTiebreak = true
    return
  }
  const { tiebreakAt, isDecidingSet } = getSetTargets(match)
  if (isDecidingSet && isMatchTiebreakFormat(s)) {
    // The deciding set IS a match tiebreak — reopen it as one, points 0-0
    // (tiebreak points are not editable in the score card).
    cs.isTiebreak = true
    cs.isSuperTiebreak = true
    return
  }
  const tiebreakAllowed = s.tiebreakEnabled && !(isDecidingSet && isFinalSetNoTiebreak(s))
  if (tiebreakAllowed && cs.teamA === tiebreakAt && cs.teamB === tiebreakAt) {
    cs.isTiebreak = true
    if (isDecidingSet && usesFinalSetGameTiebreak(s)) cs.isSuperTiebreak = true
  }
}

/**
 * Reopen a completed set: drop it (and everything recorded after it) from
 * score.sets and put its score back as the live current set, so play can
 * resume — e.g. a set recorded 5-7 can be reopened at a corrected 6-6 to
 * play the tiebreak. `score` overrides the recorded games with the value
 * from the score-edit draft row. Serving side and court sides are kept
 * (restartCurrentSet precedent); per-game detail of the reopened set is not
 * reconstructible and starts empty. Journaled as a `reopen-set` event.
 */
export function reopenSetAt(
  match: any,
  setIndex: number,
  score?: ScoreEditRow,
  now: Date = new Date(),
): any {
  const sets = match?.score?.sets
  if (!sets || setIndex < 0 || setIndex >= sets.length) return match
  const next = JSON.parse(JSON.stringify(match))
  const saved = next.score.sets[setIndex]
  const teamA = Math.max(0, Math.floor(score?.teamA ?? saved.teamA))
  const teamB = Math.max(0, Math.floor(score?.teamB ?? saved.teamB))

  next.score.sets = next.score.sets.slice(0, setIndex)
  const cs: CurrentSet = {
    teamA,
    teamB,
    games: [],
    currentGame: { teamA: 0, teamB: 0 },
    isTiebreak: false,
  }
  applyReopenTiebreakFlags(next, cs)
  next.score.currentSet = cs
  next.shouldChangeSides = false
  next.history = []

  const result = recomputeMatchCompletion(next)
  return appendStateOverrideEvent(result, "reopen-set", {
    setsBefore: match.score.sets.length,
    setScoreBefore: { teamA: saved.teamA, teamB: saved.teamB },
  }, { now })
}
