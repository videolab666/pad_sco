// Task 2 — Match event journal.
//
// `match.events` is an append-only log of every notable action in a match: a
// scored point, a manual edit, a toss, a timer, a timeout, an official call.
// It is a UI/audit layer that sits on TOP of the durable operation log
// (lib/match-operation-log.ts) — the operation log handles sync correctness,
// this one handles "what should the operator see in the history panel and
// what should rich undo replay?".
//
// Everything in here is pure: clone the match, push, return.

import type { MatchEvent, MatchEventType, TeamKey } from "./types"
import { safeUuid } from "./utils/safe-uuid"

/**
 * Append a single event to match.events. Returns a new match — never mutates.
 * `id` and `at` are auto-filled; the caller supplies type / actor / payload.
 */
export function appendMatchEvent(
  match: any,
  event: Omit<MatchEvent, "id" | "at"> & { id?: string; at?: string },
): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  if (!Array.isArray(next.events)) next.events = []
  const id = event.id ?? safeUuid()
  const at = event.at ?? new Date().toISOString()
  next.events.push({ id, at, ...event })
  return next
}

/**
 * Trim the event log so old events keep their type/actor but lose their
 * (potentially heavy) payload. Default keeps the last 50 events rich.
 *
 * Snapshot-style undo (lib/match-undo) requires the seed snapshot — not the
 * event payloads — so this compaction is safe for the replay path.
 */
export function trimEventHistory(match: any, keepRich = 50): any {
  if (!match?.events || match.events.length <= keepRich) return match
  const next = JSON.parse(JSON.stringify(match))
  const cutoff = next.events.length - keepRich
  for (let i = 0; i < cutoff; i++) {
    const ev = next.events[i]
    if (!ev || ev.payload?.compacted) continue
    ev.payload = { compacted: true, type: ev.type, actor: ev.actor }
  }
  return next
}

/**
 * Convenience helper: record a single scored point as a MatchEvent. The
 * scoring engine still computes the resulting Match via applyScoreIncrement;
 * this function only writes the audit-trail entry.
 */
export function appendPointEvent(
  match: any,
  args: {
    team: TeamKey
    /** Score / set / game indices BEFORE the point was applied. */
    setIndex: number
    gameIndex: number
    pointIndex?: number
    /** Optional extra payload (e.g. serve side). */
    extra?: Record<string, unknown>
  },
): any {
  return appendMatchEvent(match, {
    type: "point",
    actor: args.team,
    setIndex: args.setIndex,
    gameIndex: args.gameIndex,
    pointIndex: args.pointIndex,
    payload: { ...(args.extra ?? {}) },
  })
}

/**
 * Pick the most recent event of one of the given types — or undefined.
 */
export function findLastEventOfTypes(
  match: any,
  types: ReadonlyArray<MatchEventType>,
): MatchEvent | undefined {
  const events: MatchEvent[] = match?.events ?? []
  for (let i = events.length - 1; i >= 0; i--) {
    if (types.includes(events[i].type)) return events[i]
  }
  return undefined
}

/**
 * Merge events from a remote snapshot into the local match by event id. Keeps
 * the local order, appends remote-only events, never removes a local-only
 * event (sync engine resolves true conflicts elsewhere). Used by match-sync
 * when reconciling a server snapshot that may carry a longer events[] tail
 * than the local copy.
 */
export function mergeEventArrays(local: MatchEvent[] | undefined, remote: MatchEvent[] | undefined): MatchEvent[] {
  const l = local ?? []
  const r = remote ?? []
  if (l.length === 0) return r.slice()
  if (r.length === 0) return l.slice()
  const seen = new Set<string>(l.map((e) => e.id))
  const out = l.slice()
  for (const ev of r) {
    if (!seen.has(ev.id)) {
      out.push(ev)
      seen.add(ev.id)
    }
  }
  return out
}

/**
 * The slice of match state that journal replay reproduces: the full score
 * object, completion, winner and server. State-override events carry this in
 * their `after` payload so replay can fast-forward manual mutations instead
 * of desyncing from the live match.
 */
export function scoreStateOf(match: any): {
  score: any
  isCompleted: boolean
  winner: any
  currentServer: any
  settings?: any
} {
  return {
    score: match?.score ?? null,
    isCompleted: !!match?.isCompleted,
    winner: match?.winner ?? null,
    currentServer: match?.currentServer ?? null,
  }
}

/**
 * Append a `manual-score-edit` event whose `after` payload carries the full
 * post-change state (see scoreStateOf). Replay applies it wholesale, keeping
 * manual mutations — score edits, tiebreak toggles, unlocks, rule changes —
 * consistent with the journal and therefore undoable. `includeSettings` also
 * snapshots settings (rule changes alter how later points replay).
 */
export function appendStateOverrideEvent(
  match: any,
  action: string,
  before: any,
  opts?: { includeSettings?: boolean; now?: Date },
): any {
  const after = scoreStateOf(match)
  if (opts?.includeSettings) after.settings = match?.settings ?? null
  return appendMatchEvent(match, {
    type: "manual-score-edit",
    setIndex: match?.score?.sets?.length ?? 0,
    gameIndex: match?.score?.currentSet?.games?.length ?? 0,
    payload: { action, before, after },
    at: (opts?.now ?? new Date()).toISOString(),
  })
}
