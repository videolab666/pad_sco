// Task 10 — Rich undo via replay.
//
// Instead of storing a full match snapshot in every event's payload (which
// blows up localStorage on long matches), we keep ONE seed snapshot taken at
// match creation and replay the events log up to the desired point.
//
// Supported undo operations:
//   - undoLastScoringEvent : undo the most recent point / manual-edit / toss
//   - undoBackOneGame      : undo every point in the current game (or the
//                            previous game if we are at the start of a new one)
//   - undoBackOneSet       : undo back to the start of the previous set
//
// The undo event itself is appended to the events log with a `undoneEventId`
// payload so a "redo" feature could be added later without changing the
// schema.

import { appendMatchEvent } from "./match-events"
import { applyScoreIncrement } from "./scoring-logic"
import { commitToss } from "./toss"
import type { MatchEvent, MatchEventType, TeamKey } from "./types"

/** Take a seed snapshot at match creation time. Idempotent. */
export function ensureSeedSnapshot(match: any): any {
  if (!match) return match
  if (match.seedSnapshot) return match
  const next = JSON.parse(JSON.stringify(match))
  const eventCount = Array.isArray(next.events) ? next.events.length : 0
  // The seed is the match WITHOUT the event log itself — replay will rebuild it.
  const { seedSnapshot: _seed, events: _events, ...rest } = next
  // Seeded lazily mid-journal (e.g. on the first point of a legacy match):
  // the seed already CONTAINS the effect of the first `applyFromIndex`
  // events, so replay must skip them. They stay in the log for audit.
  next.seedSnapshot = { ...JSON.parse(JSON.stringify(rest)), events: [], applyFromIndex: eventCount }
  return next
}

const UNDOABLE_TYPES = new Set<MatchEventType>([
  "point",
  "manual-score-edit",
  "toss",
])

/** Index of the last undoable event in `events`. -1 if none. */
function findLastUndoableIndex(events: MatchEvent[]): number {
  for (let i = events.length - 1; i >= 0; i--) {
    if (UNDOABLE_TYPES.has(events[i].type)) return i
  }
  return -1
}

/**
 * Apply a manual-score-edit event to the replayed match. New-style events
 * (appendStateOverrideEvent) carry the full post-change state and are applied
 * wholesale; legacy adjust-* events carry a partial `after` handled per action.
 */
function applyManualEdit(m: any, ev: MatchEvent): void {
  const p: any = ev.payload || {}
  const after = p.after
  // New-style state-override events carry the full post-change state.
  if (after && typeof after === "object" && after.score) {
    m.score = JSON.parse(JSON.stringify(after.score))
    if (typeof after.isCompleted === "boolean") m.isCompleted = after.isCompleted
    if ("winner" in after) m.winner = after.winner ?? null
    if (after.currentServer) m.currentServer = JSON.parse(JSON.stringify(after.currentServer))
    if (after.settings) m.settings = JSON.parse(JSON.stringify(after.settings))
    return
  }
  // Legacy partial payloads (adjustCurrentGame / Set / Server in match-adjust).
  if (after && typeof after === "object") {
    if (p.action === "adjust-current-game" && m.score?.currentSet) {
      m.score.currentSet.currentGame = { teamA: after.teamA, teamB: after.teamB }
    } else if (p.action === "adjust-current-set" && m.score?.currentSet) {
      m.score.currentSet.teamA = after.teamA
      m.score.currentSet.teamB = after.teamB
    } else if (p.action === "adjust-current-server") {
      m.currentServer = { ...after }
    }
  }
}

/**
 * Replay every event in `events` (up to but NOT including `skipIndex`) onto
 * the seed snapshot. Non-scoring events (timeouts, calls, timer ops, rally
 * stats) are kept as audit entries; they do not change the score. Events
 * below the seed's applyFromIndex are audit-only — the seed already contains
 * their effect.
 */
function replayEvents(seed: any, events: MatchEvent[], skipIndex: number): any {
  let m = JSON.parse(JSON.stringify(seed))
  m.events = []
  const startIdx = typeof seed?.applyFromIndex === "number" ? seed.applyFromIndex : 0
  for (let i = 0; i < events.length; i++) {
    if (i === skipIndex) continue
    const ev = events[i]
    if (i >= startIdx) {
      if (ev.type === "point" && (ev.actor === "teamA" || ev.actor === "teamB")) {
        m = applyScoreIncrement(m, ev.actor as TeamKey)
      } else if (ev.type === "toss") {
        const p: any = ev.payload || {}
        if (p.winner && p.choice && p.teamOnLeft) {
          m = commitToss(m, { winner: p.winner, choice: p.choice, teamOnLeft: p.teamOnLeft })
          // commitToss pushes its own toss event — drop the duplicate.
          if (Array.isArray(m.events)) m.events.pop()
        }
      } else if (ev.type === "manual-score-edit") {
        applyManualEdit(m, ev)
      }
    }
    if (ev.type === "undo") {
      // Replaying undo events is a no-op — they refer to the historical log.
      continue
    }
    // Re-attach the original event id / metadata to the rebuilt log so external
    // references (e.g. rallyStats.pointEventId) stay valid.
    if (!Array.isArray(m.events)) m.events = []
    m.events.push({ ...ev })
  }
  return m
}

/** Undo the most recent point / manual-score / toss event. */
export function undoLastScoringEvent(match: any, now: Date = new Date()): any {
  const events: MatchEvent[] = match?.events ?? []
  if (events.length === 0) return match
  const seed = match?.seedSnapshot
  if (!seed) return match // no seed → cannot replay; caller should ensureSeedSnapshot first
  const idx = findLastUndoableIndex(events)
  if (idx < 0) return match

  const replayed = replayEvents(seed, events, idx)
  replayed.seedSnapshot = seed
  // Preserve non-scoring extras that the engine doesn't touch.
  replayed.rallyStats = (match.rallyStats ?? []).slice()
  replayed.officialCalls = (match.officialCalls ?? []).slice()
  replayed.timeouts = JSON.parse(JSON.stringify(match.timeouts ?? { teamA: [], teamB: [] }))
  replayed.timing = JSON.parse(JSON.stringify(match.timing ?? { games: [] }))
  return appendMatchEvent(replayed, {
    type: "undo",
    setIndex: replayed.score?.sets?.length ?? 0,
    gameIndex: replayed.score?.currentSet?.games?.length ?? 0,
    payload: { undoneEventId: events[idx].id, undoneEventType: events[idx].type },
    at: now.toISOString(),
  })
}

/**
 * Undo every point that has been played in the current game. If the current
 * game is at 0-0 (we just finished the previous game), undo that whole game.
 */
export function undoBackOneGame(match: any, now: Date = new Date()): any {
  if (!match) return match
  const startedGames = match?.score?.currentSet?.games?.length ?? 0
  const startedPoints = countPointsInCurrentGame(match)
  let cur = match
  // If there are points in the current game, peel them off first.
  if (startedPoints > 0) {
    for (let safety = 0; safety < 100; safety++) {
      const next = undoLastScoringEvent(cur, now)
      if (next === cur) return cur
      cur = next
      if (countPointsInCurrentGame(cur) === 0 && (cur.score?.currentSet?.games?.length ?? 0) === startedGames) break
    }
    return cur
  }
  // Otherwise undo points until games count decreases.
  for (let safety = 0; safety < 200; safety++) {
    const next = undoLastScoringEvent(cur, now)
    if (next === cur) return cur
    cur = next
    if ((cur.score?.currentSet?.games?.length ?? 0) < startedGames) break
  }
  return cur
}

/** Undo back to the start of the previous set. */
export function undoBackOneSet(match: any, now: Date = new Date()): any {
  if (!match) return match
  const startedSets = match?.score?.sets?.length ?? 0
  let cur = match
  for (let safety = 0; safety < 500; safety++) {
    const next = undoLastScoringEvent(cur, now)
    if (next === cur) return cur
    cur = next
    if ((cur.score?.sets?.length ?? 0) < startedSets) break
  }
  return cur
}

function countPointsInCurrentGame(match: any): number {
  const cg = match?.score?.currentSet?.currentGame
  if (!cg) return 0
  let n = 0
  if (typeof cg.teamA === "number" && cg.teamA > 0) n += cg.teamA / 15 | 0
  if (typeof cg.teamB === "number" && cg.teamB > 0) n += cg.teamB / 15 | 0
  if (cg.teamA === "Ad" || cg.teamB === "Ad") n += 1
  // Tiebreaks count raw points.
  if (match?.score?.currentSet?.isTiebreak) {
    n = (typeof cg.teamA === "number" ? cg.teamA : 0) + (typeof cg.teamB === "number" ? cg.teamB : 0)
  }
  return n
}

// ─── Journal integrity verification ───────────────────────────────────────────

/** Only settings fields that change how points replay — stable across
 *  metadata backfills that add harmless defaults. */
const SCORING_SETTINGS_KEYS = [
  "sets", "gamesPerSet", "gamesPerSetOverrides", "tiebreakEnabled", "tiebreakFormat",
  "tiebreakLength", "tiebreakAt", "finalSetTiebreak", "finalSetFinish",
  "finalSetTiebreakLength", "scoringSystem", "goldenPointFormat", "goldenGame",
  "isSuperSet", "superSetTarget", "superSetTiebreakAt", "windbreak",
]

function stateFingerprint(m: any): string {
  const cs = m?.score?.currentSet
  const cg = cs?.currentGame
  const s = m?.settings
  return JSON.stringify([
    (m?.score?.sets ?? []).map((x: any) => [x.teamA, x.teamB, x.winner ?? null]),
    m?.score?.teamA ?? 0,
    m?.score?.teamB ?? 0,
    cs ? [cs.teamA, cs.teamB, cs.isTiebreak ? 1 : 0, cs.isSuperTiebreak ? 1 : 0] : null,
    cg ? [String(cg.teamA), String(cg.teamB)] : null,
    m?.isCompleted ? 1 : 0,
    m?.winner ?? null,
    m?.currentServer ? [m.currentServer.team, m.currentServer.playerIndex] : null,
    s ? SCORING_SETTINGS_KEYS.map((k) => [k, (s as any)[k] ?? null]) : null,
  ])
}

/**
 * Integrity check before trusting replay-based undo: rebuild the state from
 * the seed + journal and compare it with the live match. Any divergence
 * (e.g. a legacy mutation that never journaled) disables replay undo — the
 * caller falls back to the in-memory stack or the surgical "reopen set"
 * instead of silently producing a wrong state. `ok` = journal is consistent,
 * `canUndo` = consistent AND there is an undoable event to undo.
 */
export function verifyJournal(match: any): { ok: boolean; canUndo: boolean } {
  const events: MatchEvent[] = match?.events ?? []
  const seed = match?.seedSnapshot
  if (!seed || !Array.isArray(events)) return { ok: false, canUndo: false }
  const replayed = replayEvents(seed, events, -1)
  const ok = stateFingerprint(replayed) === stateFingerprint(match)
  return { ok, canUndo: ok && findLastUndoableIndex(events) >= 0 }
}
