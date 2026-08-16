// Task 1 — Extended match state backfill.
//
// The APK ships a `Padel/Tennis` model with timing, statistics, toss, new-ball
// tracking, conduct/appeals, etc. — none of which existed in the current web
// schema. This module is the SINGLE place we backfill those fields onto every
// match snapshot (whether read from Supabase, localStorage or imported from
// JSON) so the rest of the codebase can read them without per-call guards.
//
// Idempotent: calling it twice is a no-op. The function mutates `match` in
// place AND returns it so it can be chained.

import type {
  HandicapState,
  Match,
  NewBallsState,
  OfficialCall,
  RallyStat,
  TimeoutRecord,
  MatchEvent,
  MatchTiming,
} from "./types";

/**
 * Default-populates every extended-state field on the given match. Used by:
 *  - getMatch (Supabase + localStorage paths)
 *  - matchFromRow (Supabase → in-app conversion)
 *  - importMatchFromJson
 *  - createMatch (so brand-new matches start with the same shape)
 *
 * Mutates `match` and returns it.
 */
export function backfillExtendedMatchState(match: any): any {
  if (!match || typeof match !== "object") return match;

  if (!Array.isArray(match.events)) match.events = [] as MatchEvent[];

  if (!match.timing || typeof match.timing !== "object") {
    match.timing = { games: [] } as MatchTiming;
  } else if (!Array.isArray(match.timing.games)) {
    match.timing.games = [];
  }

  if (!Array.isArray(match.rallyStats)) match.rallyStats = [] as RallyStat[];

  if (!match.newBalls || typeof match.newBalls !== "object") {
    match.newBalls = {
      mode: "off",
      lastChangeAtStartOfGame: 0,
      pendingInGames: null,
    } satisfies NewBallsState;
  }

  if (!match.handicap || typeof match.handicap !== "object") {
    match.handicap = { format: "none" } satisfies HandicapState;
  }

  if (!match.timeouts || typeof match.timeouts !== "object") {
    match.timeouts = { teamA: [] as TimeoutRecord[], teamB: [] as TimeoutRecord[] };
  } else {
    if (!Array.isArray(match.timeouts.teamA)) match.timeouts.teamA = [];
    if (!Array.isArray(match.timeouts.teamB)) match.timeouts.teamB = [];
  }

  if (!Array.isArray(match.officialCalls)) match.officialCalls = [] as OfficialCall[];

  if (!match.settings || typeof match.settings !== "object") match.settings = {};
  if (!match.settings.doublesServeSequence) match.settings.doublesServeSequence = "A1B1A2B2";

  return match;
}

/**
 * Field allow-list used by `match-supabase` row helpers when packing/unpacking
 * the extras jsonb column. Anything outside this set stays at the top level of
 * the match snapshot (id / score / settings / ...).
 */
export const EXTRAS_FIELDS = [
  "events",
  "timing",
  "rallyStats",
  "newBalls",
  "handicap",
  "toss",
  "powerPlay",
  "timeouts",
  "officialCalls",
  "endMatchReason",
  "shareUrl",
  "matchMetadata",
  "pendingTiebreakChoice",
  "seedSnapshot",
] as const;

export type ExtrasField = (typeof EXTRAS_FIELDS)[number];

/** Pack extras-only fields into a single object — used by `matchToRow`. */
export function pickExtras(match: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!match) return out;
  for (const f of EXTRAS_FIELDS) {
    if (match[f] !== undefined) out[f] = match[f];
  }
  return out;
}

/** Spread `extras` jsonb back onto a match — used by `matchFromRow`. */
export function spreadExtras(match: any, extras: any): any {
  if (!extras || typeof extras !== "object") return match;
  for (const f of EXTRAS_FIELDS) {
    if (extras[f] !== undefined && match[f] === undefined) {
      match[f] = extras[f];
    }
  }
  return match;
}
