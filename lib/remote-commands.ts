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
import { reseedJournal, undoBackOneGame, undoBackOneSet, undoLastScoringEvent, verifyJournal } from "./match-undo"
import { endMatchManually } from "./match-end-reason"
import { commitToss } from "./toss"
import { commitSetWin, normalizeMatchState, recomputeMatchCompletion, restartCurrentSet, swapCourtSides } from "./scoring-logic"
import { appendMatchEvent, appendStateOverrideEvent, scoreStateOf } from "./match-events"
import { clearHandicap, setSameHandicap } from "./handicap"
import { toggleNextRallyPowerPlay } from "./power-play"
import { markNewBallsChanged } from "./new-balls"
import { pauseMatchTimer, resumeMatchTimer, startMatchTimer, stopMatchTimer, DEFAULT_TIMER_SECONDS } from "./match-timers"
import { recordTimeout } from "./timeouts"
import { recordRallyStat } from "./rally-stats"
import { applyConductPenalty, recordOfficialCall } from "./match-official-calls"
import { applyTiebreakChoice } from "./tiebreak-format"
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
  "batch",
  "point",
  "decrease-point",
  "undo-point",
  "undo-game",
  "undo-set",
  "adjust-game",
  "adjust-tiebreak",
  "adjust-set",
  "set-server",
  "set-set-scores",
  "reopen-set",
  "end-match",
  "finish",
  "unlock-match",
  "set-players",
  "set-rosters",
  "set-rules",
  "toss",
  "assign-court",
  "switch-sides",
  "start-tiebreak",
  "end-tiebreak",
  "set-handicap",
  "clear-handicap",
  "toggle-power-play",
  "new-balls-changed",
  "start-timer",
  "pause-timer",
  "resume-timer",
  "stop-timer",
  "record-timeout",
  "record-rally-stat",
  "official-call",
  "tiebreak-choice",
  "repair-journal",
  "set-result-poster",
  "result-poster-audit",
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

  // Completion is a terminal state. A stale referee may still have controls
  // enabled locally, but no ordinary command is allowed to turn the match
  // active again. Reopening is always an explicit, auditable unlock command.
  const allowedAfterCompletion =
    command === "batch" ||
    command === "unlock-match" ||
    command === "finish" ||
    command === "set-players" ||
    command === "set-rosters" ||
    command === "assign-court" ||
    command === "set-result-poster" ||
    command === "result-poster-audit"
  if (match.isCompleted && !allowedAfterCompletion) {
    throw new RemoteCommandError("match_completed", "The match is already completed")
  }

  switch (command) {
    case "batch": {
      const commands = args?.commands
      if (!Array.isArray(commands) || !commands.length || commands.length > 100 ||
          commands.some(c => !c || typeof c.command !== "string" || c.command === "batch")) {
        throw new RemoteCommandError("invalid_args", "Expected 1..100 non-nested commands")
      }
      return applyRemoteBatch(match, commands)
    }
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

    case "decrease-point": {
      const team = assertTeam(args?.team)
      const next = JSON.parse(JSON.stringify(match))
      const cs = requireCurrentSet(next)
      const value = cs.currentGame[team]
      if (cs.isTiebreak) cs.currentGame[team] = Math.max(0, Number(value) - 1)
      else cs.currentGame[team] = value === "Ad" ? 40 : value === 40 ? 30 : value === 30 ? 15 : 0
      return appendStateOverrideEvent(next, "score-decrease", scoreStateOf(match))
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

    case "adjust-tiebreak": {
      const cs = requireCurrentSet(match)
      if (!cs.isTiebreak) throw new RemoteCommandError("not_in_tiebreak", "The current set is not a tiebreak")
      if (!isNonNegativeInt(args?.teamA) || !isNonNegativeInt(args?.teamB)) {
        throw new RemoteCommandError("invalid_args", "args.teamA / args.teamB must be non-negative integers")
      }
      const next = JSON.parse(JSON.stringify(match))
      next.score.currentSet.currentGame = { teamA: args.teamA, teamB: args.teamB }
      return appendStateOverrideEvent(next, "adjust-tiebreak", scoreStateOf(match))
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
      // Идемпотентен (фикс 2026-09-04): «Продолжить» после финального очка
      // гонится с point-командой, которая завершает матч на сервере. Если
      // unlock пришёл ПЕРВЫМ — раньше это было 400 not_completed, отмена
      // молча проваливалась, point следом завершал матч, и все дальнейшие
      // очки оператора отвергались 400-м. Теперь повторный unlock — no-op.
      if (!match.isCompleted) return match
      return unlockMatchForPlay(match)
    }

    // Фикс 2026-09-04 («Завершить» не сохранялся на сервере): обычное
    // завершение без причины/победителя — раньше UI писал снапшот напрямую
    // из браузера, но RLS (Шаг 3) закрыл anon-UPDATE на matches. Теперь
    // завершение — команда конвейера: сервер пишет сам (service-ключ).
    case "finish": {
      if (match.isCompleted) {
        return match
      }
      const next = JSON.parse(JSON.stringify(match))
      next.isCompleted = true
      next.winner = args?.winner === undefined ? null : assertTeam(args?.winner, "args.winner")
      return next
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

    case "set-rosters": {
      const next = JSON.parse(JSON.stringify(match))
      let changed = false
      for (const team of TEAMS) {
        const roster = args?.[team]
        if (roster === undefined) continue
        if (
          !roster ||
          typeof roster !== "object" ||
          !Array.isArray(roster.players) ||
          roster.players.length === 0 ||
          !roster.players.every((p: any) => p && typeof p.name === "string" && p.name.trim().length > 0)
        ) {
          throw new RemoteCommandError("invalid_args", `args.${team} must contain non-empty players`)
        }
        next[team] = JSON.parse(JSON.stringify(roster))
        changed = true
      }
      if (!changed) throw new RemoteCommandError("invalid_args", "Provide at least args.teamA or args.teamB")
      return appendMatchEvent(next, {
        type: "roster-edit", setIndex: next.score?.sets?.length ?? 0,
        gameIndex: next.score?.currentSet?.games?.length ?? 0, payload: {},
      })
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
      const changedUnknown = unknown.filter(
        (k) => JSON.stringify(patch[k]) !== JSON.stringify(match.settings?.[k]),
      )
      if (changedUnknown.length > 0) {
        throw new RemoteCommandError(
          "invalid_args",
          `Unknown rule keys: ${changedUnknown.join(", ")}. Allowed: ${REMOTE_RULES_KEYS.join(", ")}`,
        )
      }
      // Same commit path as the UI rules card: shallow-merge, normalize the
      // live score for the new rules, recompute completion, bump the rule
      // revision, journal with settings (replay depends on them).
      const next = JSON.parse(JSON.stringify(match))
      const allowedPatch = Object.fromEntries(
        Object.entries(patch).filter(([k]) => (REMOTE_RULES_KEYS as readonly string[]).includes(k)),
      )
      next.settings = { ...next.settings, ...allowedPatch }
      next.history = []
      let result = args?.restartCurrentSet ? restartCurrentSet(next) : next
      result = normalizeMatchState(result)
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

    case "switch-sides": {
      // Keep display-only swaps in replay without making them scoring undo targets.
      if (!match?.courtSides) {
        throw new RemoteCommandError("invalid_args", "The match has no courtSides to swap")
      }
      const next = {
        ...JSON.parse(JSON.stringify(match)),
        courtSides: swapCourtSides(match.courtSides),
        shouldChangeSides: false,
        history: [],
      }
      return appendMatchEvent(next, {
        type: "side-change", setIndex: next.score?.sets?.length ?? 0,
        gameIndex: next.score?.currentSet?.games?.length ?? 0,
        payload: { courtSides: next.courtSides },
      })
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
        ...(hasCourtIdArg ? { courtId } : { courtId: court === match.courtNumber ? match.courtId : null }),
        history: [],
      }
    }

    case "start-tiebreak": {
      const next = JSON.parse(JSON.stringify(match))
      const cs = requireCurrentSet(next)
      cs.isTiebreak = true
      cs.currentGame = { teamA: 0, teamB: 0 }
      return appendStateOverrideEvent(next, "tiebreak-start", scoreStateOf(match))
    }

    case "end-tiebreak": {
      const winner = assertTeam(args?.winner, "args.winner")
      const next = JSON.parse(JSON.stringify(match))
      const cs = requireCurrentSet(next)
      if (!cs.isTiebreak) throw new RemoteCommandError("not_in_tiebreak", "The current set is not a tiebreak")
      cs.tiebreak = { teamA: cs.currentGame.teamA, teamB: cs.currentGame.teamB }
      cs[winner]++
      cs.isTiebreak = false
      return appendStateOverrideEvent(commitSetWin(next, winner), "tiebreak-end", scoreStateOf(match))
    }

    case "set-handicap": {
      if (!isNonNegativeInt(args?.teamA) || !isNonNegativeInt(args?.teamB)) {
        throw new RemoteCommandError("invalid_args", "args.teamA / args.teamB must be non-negative integers")
      }
      return setSameHandicap(match, args.teamA, args.teamB)
    }

    case "clear-handicap":
      return clearHandicap(match)

    case "toggle-power-play": {
      const result = toggleNextRallyPowerPlay(match, assertTeam(args?.team))
      if (result.refused) throw new RemoteCommandError("command_refused", result.refused)
      return result.match
    }

    case "new-balls-changed":
      return markNewBallsChanged(match)

    case "start-timer": {
      const type = args?.type
      if (typeof type !== "string" || !(type in DEFAULT_TIMER_SECONDS)) {
        throw new RemoteCommandError("invalid_args", "args.type must be a supported timer type")
      }
      const team = args?.team === undefined ? undefined : assertTeam(args.team)
      return startMatchTimer(match, type as keyof typeof DEFAULT_TIMER_SECONDS, team)
    }

    case "pause-timer":
      return pauseMatchTimer(match)
    case "resume-timer":
      return resumeMatchTimer(match)
    case "stop-timer":
      return stopMatchTimer(match)
    case "record-timeout":
      return recordTimeout(match, assertTeam(args?.team))

    case "record-rally-stat": {
      const scoringTeam = assertTeam(args?.scoringTeam, "args.scoringTeam")
      const creditedTeam = assertTeam(args?.creditedTeam, "args.creditedTeam")
      if (args?.kind !== "winner" && args?.kind !== "error") {
        throw new RemoteCommandError("invalid_args", 'args.kind must be "winner" or "error"')
      }
      return recordRallyStat(match, { ...args, scoringTeam, creditedTeam })
    }

    case "official-call": {
      const team = assertTeam(args?.team)
      if (args?.type === "conduct") {
        return applyConductPenalty(match, team, args?.penalty)
      }
      if (args?.type !== "appeal" && args?.type !== "broken-equipment") {
        throw new RemoteCommandError("invalid_args", "args.type must be conduct, appeal or broken-equipment")
      }
      return recordOfficialCall(match, { ...args, team })
    }

    case "tiebreak-choice": {
      if (!isNonNegativeInt(args?.offset)) {
        throw new RemoteCommandError("invalid_args", "args.offset must be a non-negative integer")
      }
      return applyTiebreakChoice(match, args.offset)
    }

    case "repair-journal":
      return reseedJournal(match)

    case "set-result-poster": {
      if (!args?.config || typeof args.config !== "object" || Array.isArray(args.config)) {
        throw new RemoteCommandError("invalid_args", "args.config must be an object")
      }
      const next = JSON.parse(JSON.stringify(match))
      next.settings = next.settings ?? {}
      next.settings.resultPoster = args.config
      return next
    }

    case "result-poster-audit":
      return appendMatchEvent(match, {
        type: "result-poster",
        setIndex: match.score?.sets?.length ?? 0,
        gameIndex: match.score?.currentSet?.games?.length ?? 0,
        payload: { ...args },
      })

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
