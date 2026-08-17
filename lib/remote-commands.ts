// Remote-control command registry.
//
// The external API (POST /api/match/[id]/command) drives matches through the
// SAME pure engine functions the UI uses — every mutation goes through the
// scoring engine / adjust helpers, so invariants (tiebreak flags, serve
// rotation, completion, the undo journal) hold exactly as they do for an
// operator clicking the scoreboard. Raw state patches bypass those invariants
// and are deliberately not offered.
//
// This module is pure and UI-free: given a match snapshot and a command it
// returns the next snapshot (or throws RemoteCommandError). The HTTP route is
// a thin wrapper — all behaviour is unit-testable here.

import { applyPointWithExtras } from "./apply-point"
import {
  adjustCurrentGame,
  adjustCurrentServer,
  adjustCurrentSet,
  applyScoreEditRows,
  buildScoreEditRows,
  reopenSetAt,
  unlockMatchForPlay,
  type AdjustCurrentGameInput,
  type ScoreEditRow,
} from "./match-adjust"
import { undoBackOneGame, undoBackOneSet, undoLastScoringEvent, verifyJournal } from "./match-undo"
import { endMatchManually } from "./match-end-reason"
import { commitToss } from "./toss"
import { normalizeMatchState, recomputeMatchCompletion } from "./scoring-logic"
import { appendStateOverrideEvent, scoreStateOf } from "./match-events"
import { safeUuid } from "./utils/safe-uuid"
import { v5 as uuidv5 } from "uuid"
import type { EndMatchReason, Player, Team, TeamKey, TossChoice } from "./types"

// Stable namespace for turning free-form operation ids into DB uuids.
const OPERATION_NAMESPACE = "9c8f3a10-6d52-4c1e-9f7a-2b8e4d6c5a01"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * match_operations.operation_id is a uuid column, but drivers like human-
 * readable operation ids ("point-17"). Map any non-uuid id deterministically
 * (UUIDv5) so a retry with the same string finds its recorded operation.
 */
export function stableOperationUuid(operationId: string): string {
  const trimmed = operationId.trim()
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase()
  return uuidv5(trimmed, OPERATION_NAMESPACE)
}

/** Machine-readable error + HTTP status for invalid commands / state. */
export class RemoteCommandError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export const REMOTE_COMMANDS = [
  "point",
  "undo-point",
  "undo-game",
  "undo-set",
  "adjust-game",
  "adjust-set",
  "set-server",
  "set-set-scores",
  "reopen-set",
  "end-match",
  "unlock-match",
  "set-players",
  "set-rules",
  "toss",
  "assign-court",
] as const

export type RemoteCommandName = (typeof REMOTE_COMMANDS)[number]

const TEAMS: TeamKey[] = ["teamA", "teamB"]
const isTeam = (v: unknown): v is TeamKey => v === "teamA" || v === "teamB"
const isGamePoint = (v: unknown): v is 0 | 1 | 2 | 3 | "Ad" =>
  v === 0 || v === 1 || v === 2 || v === 3 || v === "Ad"
const isNonNegativeInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0

function assertTeam(v: unknown, field = "args.team"): TeamKey {
  if (!isTeam(v)) throw new RemoteCommandError("invalid_args", `${field} must be "teamA" or "teamB"`)
  return v
}

function requireCurrentSet(match: any): any {
  const cs = match?.score?.currentSet
  if (!cs) throw new RemoteCommandError("no_current_set", "The match has no current set to adjust")
  return cs
}

/** Player ids are stable per name within a match so re-setting a lineup keeps ids. */
function buildTeam(existing: Team | undefined, input: { name?: string; players: string[] }): Team {
  const byName = new Map<string, string>()
  for (const p of [...(existing?.players ?? []), ]) {
    if (p?.id && p?.name) byName.set(p.name, p.id)
  }
  const players: Player[] = input.players.map((name) => {
    const id = byName.get(name) ?? safeUuid()
    byName.set(name, id)
    return { id, name } as Player
  })
  return { name: input.name ?? existing?.name, players }
}

/**
 * Apply one remote command to a match snapshot. Returns the next snapshot —
 * the input is never mutated. Throws RemoteCommandError on invalid arguments
 * or impossible state (e.g. scoring a point on a finished match).
 */
export function applyRemoteCommand(match: any, command: string, args: any = {}): any {
  if (!match?.id || !match?.score) {
    throw new RemoteCommandError("invalid_match", "Match snapshot is missing required fields")
  }

  switch (command) {
    case "point": {
      if (match.isCompleted) {
        throw new RemoteCommandError("match_completed", "Cannot score a point on a completed match")
      }
      return applyPointWithExtras(match, assertTeam(args?.team))
    }

    case "undo-point":
    case "undo-game":
    case "undo-set": {
      const check = verifyJournal(match)
      if (!check.ok) {
        throw new RemoteCommandError(
          "journal_diverged",
          "The event journal diverges from the score — replay-based undo is unavailable",
        )
      }
      if (!check.canUndo) {
        throw new RemoteCommandError("nothing_to_undo", "No undoable events in the journal")
      }
      if (command === "undo-point") return undoLastScoringEvent(match)
      if (command === "undo-game") return undoBackOneGame(match)
      return undoBackOneSet(match)
    }

    case "adjust-game": {
      requireCurrentSet(match)
      if (!isGamePoint(args?.teamA) || !isGamePoint(args?.teamB)) {
        throw new RemoteCommandError(
          "invalid_args",
          'args.teamA / args.teamB must each be 0 | 1 | 2 | 3 | "Ad"',
        )
      }
      const input: AdjustCurrentGameInput = { teamA: args.teamA, teamB: args.teamB }
      return adjustCurrentGame(match, input)
    }

    case "adjust-set": {
      requireCurrentSet(match)
      if (!isNonNegativeInt(args?.teamA) || !isNonNegativeInt(args?.teamB)) {
        throw new RemoteCommandError("invalid_args", "args.teamA / args.teamB must be non-negative integers")
      }
      return adjustCurrentSet(match, { teamA: args.teamA, teamB: args.teamB })
    }

    case "set-server": {
      const team = assertTeam(args?.team)
      const playerIndex = args?.playerIndex ?? 0
      if (playerIndex !== 0 && playerIndex !== 1) {
        throw new RemoteCommandError("invalid_args", "args.playerIndex must be 0 or 1")
      }
      return adjustCurrentServer(match, team, playerIndex)
    }

    case "set-set-scores": {
      const rows = args?.rows
      if (!Array.isArray(rows) || rows.length === 0 || !rows.every(isScoreRow)) {
        throw new RemoteCommandError(
          "invalid_args",
          "args.rows must be an array of { teamA: int>=0, teamB: int>=0 }",
        )
      }
      const expected = buildScoreEditRows(match).length
      if (rows.length !== expected) {
        throw new RemoteCommandError(
          "invalid_args",
          `args.rows length ${rows.length} does not match the match structure (${expected} rows: completed sets${match.isCompleted ? "" : " + the live current set"})`,
        )
      }
      return applyScoreEditRows(match, rows)
    }

    case "reopen-set": {
      const sets = match.score.sets ?? []
      if (!isNonNegativeInt(args?.setIndex) || args.setIndex >= sets.length) {
        throw new RemoteCommandError(
          "invalid_args",
          `args.setIndex must be an index of a completed set (0..${sets.length - 1})`,
        )
      }
      if (args?.score !== undefined && !isScoreRow(args.score)) {
        throw new RemoteCommandError("invalid_args", "args.score must be { teamA: int>=0, teamB: int>=0 }")
      }
      return reopenSetAt(match, args.setIndex, args.score)
    }

    case "end-match": {
      if (match.isCompleted) {
        throw new RemoteCommandError("match_completed", "The match is already completed")
      }
      const reason = args?.reason
      if (reason !== "retired-injury" && reason !== "conduct" && reason !== "time-up") {
        throw new RemoteCommandError(
          "invalid_args",
          'args.reason must be "retired-injury" | "conduct" | "time-up"',
        )
      }
      const winner = assertTeam(args?.winner, "args.winner")
      return endMatchManually(match, reason as Exclude<EndMatchReason, "completed">, winner)
    }

    case "unlock-match": {
      if (!match.isCompleted) {
        throw new RemoteCommandError("not_completed", "The match is not completed — nothing to unlock")
      }
      return unlockMatchForPlay(match)
    }

    case "set-players": {
      const input = args ?? {}
      const next = JSON.parse(JSON.stringify(match))
      for (const team of TEAMS) {
        const spec = input[team]
        if (spec === undefined) continue
        if (
          typeof spec !== "object" ||
          !Array.isArray(spec.players) ||
          spec.players.length === 0 ||
          !spec.players.every((p: unknown) => typeof p === "string" && p.trim().length > 0)
        ) {
          throw new RemoteCommandError(
            "invalid_args",
            `args.${team} must be { name?: string, players: string[] } with at least one non-empty name`,
          )
        }
        if (spec.name !== undefined && typeof spec.name !== "string") {
          throw new RemoteCommandError("invalid_args", `args.${team}.name must be a string`)
        }
        next[team] = buildTeam(match[team], {
          name: spec.name,
          players: spec.players.map((p: string) => p.trim()),
        })
      }
      if (input.teamA === undefined && input.teamB === undefined) {
        throw new RemoteCommandError("invalid_args", "Provide at least args.teamA or args.teamB")
      }
      return next
    }

    case "set-rules": {
      const patch = args?.rules ?? args?.settings ?? args
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        throw new RemoteCommandError(
          "invalid_args",
          "args.rules must be an object with rule keys to patch (e.g. { gamesPerSet: 4 })",
        )
      }
      const unknown = Object.keys(patch).filter((k) => !(REMOTE_RULES_KEYS as readonly string[]).includes(k))
      if (unknown.length > 0) {
        throw new RemoteCommandError(
          "invalid_args",
          `Unknown rule keys: ${unknown.join(", ")}. Allowed: ${REMOTE_RULES_KEYS.join(", ")}`,
        )
      }
      // Same commit path as the UI rules card: shallow-merge, normalize the
      // live score for the new rules, recompute completion, bump the rule
      // revision, journal with settings (replay depends on them).
      const next = JSON.parse(JSON.stringify(match))
      next.settings = { ...next.settings, ...patch }
      next.history = []
      let result = normalizeMatchState(next)
      result = recomputeMatchCompletion(result)
      result.ruleRevision = (typeof match.ruleRevision === "number" ? match.ruleRevision : 0) + 1
      result.lastRuleChangeAt = new Date().toISOString()
      return appendStateOverrideEvent(result, "rule-change", scoreStateOf(match), { includeSettings: true })
    }

    case "toss": {
      const winner = assertTeam(args?.winner, "args.winner")
      const choice = args?.choice
      if (choice !== "serve" && choice !== "receive") {
        throw new RemoteCommandError("invalid_args", 'args.choice must be "serve" or "receive"')
      }
      const teamOnLeft = assertTeam(args?.teamOnLeft, "args.teamOnLeft")
      return commitToss(match, { winner, choice: choice as TossChoice, teamOnLeft })
    }

    case "assign-court": {
      const court = args?.court ?? null
      if (court !== null && !(isNonNegativeInt(court) && court >= 1 && court <= 50)) {
        throw new RemoteCommandError("invalid_args", "args.court must be a court number (1..50) or null")
      }
      // Шаг 2 (§246): нечисловые корты привязываются через courtId (UUID из
      // реестра /api/courts). courtId=null в явном виде отвязывает корт;
      // отсутствие поля сохраняет прежнюю привязку (совместимость).
      const hasCourtIdArg = args?.courtId !== undefined
      const courtId = args?.courtId ?? null
      if (courtId !== null && typeof courtId !== "string") {
        throw new RemoteCommandError("invalid_args", "args.courtId must be a court UUID string or null")
      }
      // Court assignment affects display only — no journal event needed.
      return {
        ...JSON.parse(JSON.stringify(match)),
        courtNumber: court,
        ...(hasCourtIdArg ? { courtId } : {}),
        history: [],
      }
    }

    default:
      throw new RemoteCommandError(
        "unknown_command",
        `Unknown command "${command}". Supported: ${REMOTE_COMMANDS.join(", ")}`,
      )
  }
}

/** Rule keys a remote `set-rules` patch may touch. */
export const REMOTE_RULES_KEYS = [
  "sets",
  "gamesPerSet",
  "gamesPerSetOverrides",
  "tiebreakEnabled",
  "tiebreakFormat",
  "tiebreakLength",
  "tiebreakAt",
  "finalSetTiebreak",
  "finalSetFinish",
  "finalSetTiebreakLength",
  "scoringSystem",
  "goldenPointFormat",
  "goldenGame",
  "windbreak",
  "isSuperSet",
  "superSetTarget",
  "superSetTiebreakAt",
  "doublesServeSequence",
] as const

export interface RemoteBatchCommand {
  command: string
  args?: Record<string, unknown>
}

/**
 * Apply a sequence of commands atomically: either every command applies to
 * the snapshot (result returned, one revision bump at the HTTP layer), or
 * nothing is applied. On failure throws RemoteCommandError with the failing
 * command index in `batchIndex`.
 */
export function applyRemoteBatch(match: any, commands: RemoteBatchCommand[]): any {
  let cur = match
  for (let i = 0; i < commands.length; i++) {
    const c = commands[i]
    try {
      cur = applyRemoteCommand(cur, c.command, c.args ?? {})
    } catch (e: any) {
      if (e instanceof RemoteCommandError) {
        throw new RemoteCommandError(
          e.code,
          `batch[${i}] (${c.command}): ${e.message}`,
          e.status,
        )
      }
      throw e
    }
  }
  return cur
}

function isScoreRow(v: unknown): v is ScoreEditRow {
  return (
    !!v &&
    typeof v === "object" &&
    isNonNegativeInt((v as any).teamA) &&
    isNonNegativeInt((v as any).teamB)
  )
}
