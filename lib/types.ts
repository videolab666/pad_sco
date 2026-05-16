export interface Player {
  id: string;
  name: string;
  number?: number;
  color?: string;
  local_expire_at?: number; // ms since epoch, for temporary local-only players
  dyId?: string; // external id from a double-yellow.be feed, for import dedup
}

export interface AddPlayerOptions {
  localOnly?: boolean;
  expireMs?: number;
}

export interface UpdatePlayerOptions {
  name?: string;
  number?: number;
  color?: string;
}

export interface Team {
  players: Player[];
  name?: string;
}

export interface Match {
  created_via_court_link?: boolean;
  id: string;
  isCompleted: boolean;
  createdAt: string;
  type: string;
  code?: string;
  courtNumber: number;
  teamA: Team;
  teamB: Team;
  sets: {
    number: number;
    pointsA: number;
    pointsB: number;
  }[];
  currentSet: number;
  currentPoint: number;
  score: {
    teamA: number;
    teamB: number;
    sets?: any[]; // Use any[] as placeholder for set structure
    currentSet?: any; // Use any as placeholder for currentSet structure
  };
  settings: {
    theme: string;
    colors: {
      teamA: string;
      teamB: string;
      court: string;
    };
  };
  currentServer: {
    team: "teamA" | "teamB";
    playerIndex: number;
  };
  courtSides?: any;
  /** Tournament round / stage label (metadata only — never affects the score). */
  round?: string;
  /** Monotonic write counter used for optimistic-concurrency sync. */
  revision?: number;
  /** Monotonic counter of rule edits — bumps whenever match settings change. */
  ruleRevision?: number;
  /** ISO timestamp of the last rule change. */
  lastRuleChangeAt?: string;
  /** Scope applied to the last rule change. */
  ruleChangeScope?: RuleChangeScope;
  /** Human-readable classification / reason of the last rule change. */
  ruleChangeReason?: string;
}

/**
 * How a rule edit relates to the live score:
 *  - safe             — apply immediately, nothing to repair.
 *  - future-only      — apply from the next set / match, current play untouched.
 *  - current-set      — affects the current point/set; needs normalization or a
 *                       scope decision from the operator.
 *  - restart-required — cannot be mapped losslessly; the current set must be
 *                       rebuilt or the rules kept until the set ends.
 */
export type RuleChangeScope = "safe" | "future-only" | "current-set" | "restart-required";

// ─── Realtime sync model (Task 2: durable sync and replay) ─────────────────────

/**
 * Schema version of the persisted operation log. Bump when the shape of
 * MatchOperation / MatchSyncRecord changes so older payloads can be rejected
 * or migrated instead of corrupting the scoring state.
 */
export const SYNC_SCHEMA_VERSION = 1;

/** Classifies what a queued mutation represents. */
export type MatchOperationKind =
  | "snapshot" // full match snapshot write (current default path)
  | "score" // a single scored point
  | "rule-change" // a settings / rule edit
  | "metadata" // roster / court / round edit
  | "match-finish"; // terminal match completion

/**
 * A single durable, idempotent mutation. Persisted locally before any network
 * call so a click is never lost to network timing, a crash, or a reload.
 */
export interface MatchOperation {
  operationId: string;
  matchId: string;
  /** Revision the client believed the match was at when this op was created. */
  baseRevision: number;
  kind: MatchOperationKind;
  /** The resulting match snapshot (for snapshot-kind ops) or a granular patch. */
  payload: any;
  createdAt: string;
  clientId: string;
  retryCount: number;
  lastError?: string | null;
}

export type SyncStatusValue =
  | "idle" // queue empty, everything confirmed
  | "pending" // operations queued, not yet sent
  | "syncing" // a drain is in progress
  | "offline" // no connectivity, queue retained
  | "error" // transient failure, will retry with backoff
  | "conflict" // server diverged, needs a resolution decision
  | "dead-letter" // operation can never succeed, needs operator review
  | "limited"; // local storage unavailable, recovery is degraded

/** Observable sync state for a single match, surfaced in the UI and logs. */
export interface SyncState {
  matchId: string;
  syncStatus: SyncStatusValue;
  lastSuccessRevision: number;
  lastSyncedAt?: string | null;
  lastFailedOperationId?: string | null;
  retryCount: number;
  conflictReason?: string | null;
  pendingCount: number;
  deadLetterCount: number;
}

/**
 * The full per-match record kept in local storage: the canonical snapshot plus
 * the append-only pending operation queue and sync bookkeeping.
 */
export interface MatchSyncRecord {
  schemaVersion: number;
  matchId: string;
  clientId: string;
  /** Latest local revision (number of operations ever applied locally). */
  revision: number;
  /** Highest revision confirmed durable on the server. */
  lastSyncedRevision: number;
  /** Last known good match snapshot. */
  snapshot: any;
  /** Append-only queue of operations not yet confirmed by the server. */
  queue: MatchOperation[];
  /** Operations that permanently failed and were removed from the live queue. */
  deadLetter: MatchOperation[];
  syncStatus: SyncStatusValue;
  lastError?: string | null;
  conflictReason?: string | null;
  /** Server snapshot retained while a conflict awaits a resolution decision. */
  conflictSnapshot?: any;
  lastSyncedAt?: string | null;
  updatedAt: string;
}
