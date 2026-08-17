/** Canonical team identifier used across the scoring engine and the UI. */
export type TeamKey = "teamA" | "teamB";

export interface Player {
  id: string;
  name: string;
  number?: number;
  color?: string;
  local_expire_at?: number; // ms since epoch, for temporary local-only players
  dyId?: string; // external id from a double-yellow.be feed, for import dedup
  // ─── Extended fields (Task 0, sourced from APK player metadata) ──────────────
  country?: string;
  club?: string;
  avatar?: string;
  seed?: string;
  abbreviation?: string;
  teamId?: string;
}

export interface AddPlayerOptions {
  localOnly?: boolean;
  expireMs?: number;
}

export interface UpdatePlayerOptions {
  name?: string;
  number?: number;
  color?: string;
  country?: string;
  avatar?: string;
  club?: string;
  seed?: string;
  abbreviation?: string;
}

export interface Team {
  players: Player[];
  name?: string;
}

// ─── Score shape (unified with the live scoring engine) ───────────────────────
//
// The runtime engine (lib/scoring-logic.ts) operates on `score.sets`,
// `score.currentSet` — these types make that shape part of the canonical
// contract instead of leaving it as `any[]`.

export interface SavedSet {
  teamA: number;
  teamB: number;
  winner: TeamKey;
  tiebreak?: { teamA: number; teamB: number };
}

export interface CurrentGame {
  teamA: number | string;
  teamB: number | string;
  deuceCount?: number;
}

export interface CurrentSet {
  teamA: number;
  teamB: number;
  games: { winner: TeamKey }[];
  currentGame: CurrentGame;
  isTiebreak: boolean;
  isSuperTiebreak?: boolean;
  tiebreak?: { teamA: number; teamB: number };
}

export interface MatchScore {
  teamA: number;
  teamB: number;
  sets: SavedSet[];
  currentSet: CurrentSet;
}

export interface Match {
  created_via_court_link?: boolean;
  id: string;
  isCompleted: boolean;
  createdAt: string;
  type: string;
  format?: string;
  code?: string;
  courtNumber: number;
  teamA: Team;
  teamB: Team;
  score: MatchScore;
  settings: Record<string, any>;
  currentServer: {
    team: TeamKey;
    playerIndex: number;
  };
  courtSides?: { teamA: string; teamB: string };
  shouldChangeSides?: boolean;
  winner?: TeamKey | null;
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
  // ─── Task 1 extended state (all optional, populated by backfill) ─────────────
  events?: MatchEvent[];
  timing?: MatchTiming;
  rallyStats?: RallyStat[];
  newBalls?: NewBallsState;
  handicap?: HandicapState;
  toss?: TossState;
  powerPlay?: PowerPlayState;
  timeouts?: Record<TeamKey, TimeoutRecord[]>;
  officialCalls?: OfficialCall[];
  endMatchReason?: EndMatchReason;
  shareUrl?: string;
  matchMetadata?: MatchMetadata;
  pendingTiebreakChoice?: PendingTiebreakChoice;
  /** Original snapshot used as the replay seed for richer undo. */
  seedSnapshot?: any;
}

// ─── Extended state (Task 1) ──────────────────────────────────────────────────

export type NewBallsMode =
  | "off"
  | "after-first-7-then-each-9"
  | "after-first-9-then-each-11"
  | "after-first-11-then-each-13"
  | "before-set-3";

export interface NewBallsState {
  mode: NewBallsMode;
  lastChangeAtStartOfGame: number;
  pendingInGames: number | null;
}

export type HandicapFormat = "none" | "same-for-all-games" | "different-for-all-games";

export interface HandicapState {
  format: HandicapFormat;
  sameForAllGames?: { teamA: number; teamB: number };
  perGame?: Record<string, { teamA: number; teamB: number }>;
}

export type TiebreakFormatExt =
  | "two-clear"
  | "sudden-death"
  | "receiver-select-1-or-2"
  | "receiver-select-1-2-or-3"
  | "receiver-select-1-or-3";

export interface PendingTiebreakChoice {
  baseTarget: number;
  options: number[];
  receiverTeam: TeamKey;
}

export type DoublesServeSequence =
  | "A1B1A2B2"
  | "A1A2B1B2"
  | "A1B1A1B1"
  | "A2B1B2_then_A1A2B1B2"
  | "A1B1B2_then_A1A2B1B2";

export type EndMatchReason = "completed" | "retired-injury" | "conduct" | "time-up";

export type MatchEventType =
  | "point"
  | "undo"
  | "manual-score-edit"
  | "timer"
  | "timeout"
  | "new-balls"
  | "toss"
  | "rally-stat"
  | "conduct"
  | "appeal"
  | "power-play"
  | "broken-equipment"
  | "end-match-manual"
  | "match-end"
  | "result-poster";

/**
 * Settings block for Task 16 ResultPoster. Lives under `match.settings.resultPoster`
 * so it is preserved across reloads / Supabase sync like every other setting.
 */
export interface ResultPosterConfig {
  url?: string;
  basicAuth?: {
    username: string;
    password?: string;
  };
  /**
   * When true, the orchestrator auto-posts the result the first time the
   * match transitions to `isCompleted = true`. When false the operator must
   * fire it manually.
   */
  autoOnComplete?: boolean;
}

export interface MatchEvent {
  id: string;
  type: MatchEventType;
  at: string;
  setIndex: number;
  gameIndex: number;
  pointIndex?: number;
  actor?: TeamKey;
  payload: Record<string, unknown>;
}

// ─── Timing ───────────────────────────────────────────────────────────────────

export interface GameTiming {
  setIndex: number;
  gameIndex: number;
  startedAt: string;
  endedAt?: string;
  scoreTimingsSec: number[];
  startTimeIsManual?: boolean;
}

export type MatchTimerType =
  | "warmup"
  | "pause-before-first-game"
  | "pause-between-games"
  | "self-inflicted-injury"
  | "self-inflicted-blood-injury"
  | "contributed-injury"
  | "opponent-inflicted-injury"
  | "toweling-down"
  | "timeout";

export interface MatchTimer {
  id: string;
  type: MatchTimerType;
  team?: TeamKey;
  startedAt: string;
  durationSec: number;
  pausedAt?: string;
  remainingSec?: number;
}

export interface MatchTiming {
  matchStartedAt?: string;
  matchEndedAt?: string;
  games: GameTiming[];
  activeTimer?: MatchTimer;
}

// ─── Toss ─────────────────────────────────────────────────────────────────────

export type TossChoice = "serve" | "receive";
export type TossSide = "left" | "right";

export interface TossState {
  winner?: TeamKey;
  winnerChoice?: TossChoice;
  receiverSide?: TossSide | null;
  completedAt?: string;
}

// ─── Power play ───────────────────────────────────────────────────────────────

export interface PowerPlayState {
  maxPerTeam: number;
  used: { teamA: number; teamB: number };
  activeFor: TeamKey[];
}

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export interface TimeoutRecord {
  at: string;
  setScore: { teamA: number; teamB: number };
  gameScore: { teamA: number | string; teamB: number | string };
}

// ─── Rally stats ──────────────────────────────────────────────────────────────

export type RallyEndKind = "winner" | "error";
export type RacketSide = "forehand" | "backhand" | "unknown";
export type StrikePosition = "front" | "middle" | "back" | "unknown";
export type BallDirection = "cross" | "down-line" | "middle" | "unknown";
export type BallTrajectory = "lob" | "drive" | "drop" | "volley" | "smash" | "unknown";

export interface RallyStat {
  id: string;
  pointEventId?: string;
  at: string;
  scoringTeam: TeamKey;
  creditedTeam: TeamKey;
  kind: RallyEndKind;
  racketSide?: RacketSide;
  position?: StrikePosition;
  direction?: BallDirection;
  trajectory?: BallTrajectory;
}

// ─── Official calls (conduct / appeal / broken-equipment) ─────────────────────

export type OfficialCallType = "appeal" | "conduct" | "broken-equipment";
export type AppealDecision = "let" | "no-let" | "stroke" | "yes-let";
export type ConductPenalty = "warning" | "stroke" | "game" | "match";

export interface OfficialCall {
  id: string;
  at: string;
  type: OfficialCallType;
  team: TeamKey;
  decision?: AppealDecision;
  penalty?: ConductPenalty;
  equipment?: "racket" | "string" | "ball" | "other";
  note?: string;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export interface MatchMetadata {
  eventName?: string;
  eventDivision?: string;
  eventRound?: string;
  eventLocation?: string;
  referee?: string;
  marker?: string;
  assessor?: string;
  source?: string;
  sourceId?: string;
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
