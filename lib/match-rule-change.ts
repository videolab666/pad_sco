// Rule-change classification and normalization (Task 1).
//
// A rule edit must never silently corrupt the live score. This module decides
// how a settings change relates to the current point/set, reconciles dependent
// settings, and normalizes already-started game/set state so the scoring engine
// can be re-run safely afterwards.
import {
  getDefaultGoldenPointForScoringSystem,
  getGoldenPointDeuceThreshold,
  getSetsToWin,
  isMatchTiebreakFormat,
} from "./match-format-rules"
import type { RuleChangeScope } from "./types"

/** Loose shape of the match settings this module reasons about. */
export interface RuleSettings {
  sets?: number
  scoringSystem?: "classic" | "no-ad" | "fast4"
  gamesPerSet?: number
  gamesPerSetOverrides?: Record<number, number>
  tiebreakEnabled?: boolean
  tiebreakFormat?: string
  tiebreakLength?: number
  tiebreakAt?: string
  finalSetTiebreak?: boolean
  finalSetFinish?: string
  finalSetTiebreakLength?: number
  goldenPointFormat?: "none" | "first-deuce" | "second-deuce" | "third-deuce"
  goldenGame?: boolean
  windbreak?: boolean
  isSuperSet?: boolean
  [key: string]: unknown
}

export interface RuleChangeClassification {
  scope: RuleChangeScope
  reason: string
  /** Settings keys that actually changed. */
  changedKeys: string[]
}

/** Severity ordering — a classification takes the most severe changed key. */
const SCOPE_RANK: Record<RuleChangeScope, number> = {
  safe: 0,
  "future-only": 1,
  "current-set": 2,
  "restart-required": 3,
}

/** Settings keys that can affect the live score and are worth classifying. */
const RULE_KEYS = [
  "sets",
  "scoringSystem",
  "gamesPerSet",
  "gamesPerSetOverrides",
  "tiebreakEnabled",
  "tiebreakFormat",
  "tiebreakLength",
  "tiebreakAt",
  "finalSetTiebreak",
  "finalSetFinish",
  "finalSetTiebreakLength",
  "goldenPointFormat",
  "goldenGame",
  "windbreak",
  "isSuperSet",
] as const

// ─── Live-state probes ─────────────────────────────────────────────────────────

const pointsOf = (v: unknown): number => (typeof v === "number" ? v : 0)

/** True when any point has been played in the match. */
export function matchHasStarted(score: any): boolean {
  if (!score) return false
  const cs = score.currentSet
  const cg = cs?.currentGame
  return (
    (score.sets?.length ?? 0) > 0 ||
    (cs?.teamA ?? 0) > 0 ||
    (cs?.teamB ?? 0) > 0 ||
    pointsOf(cg?.teamA) > 0 ||
    pointsOf(cg?.teamB) > 0 ||
    cg?.teamA === "Ad" ||
    cg?.teamB === "Ad"
  )
}

/** True when the current game is sitting at deuce / advantage. */
export function isCurrentGameAtDeuce(currentGame: any): boolean {
  if (!currentGame) return false
  return (
    currentGame.teamA === "Ad" ||
    currentGame.teamB === "Ad" ||
    (currentGame.teamA === 40 && currentGame.teamB === 40)
  )
}

/** True when the current set is at / past the tiebreak threshold. */
export function isCurrentSetNearTiebreak(settings: RuleSettings, currentSet: any): boolean {
  if (!currentSet) return false
  if (currentSet.isTiebreak) return true
  const threshold = Number.parseInt(String(settings.tiebreakAt ?? "6-6").split("-")[0] || "6", 10)
  const a = currentSet.teamA ?? 0
  const b = currentSet.teamB ?? 0
  return a >= threshold - 1 && b >= threshold - 1
}

/** True when the (possibly deciding) current set is already underway. */
export function isCurrentSetUnderway(currentSet: any): boolean {
  if (!currentSet) return false
  const cg = currentSet.currentGame
  return (
    (currentSet.teamA ?? 0) > 0 ||
    (currentSet.teamB ?? 0) > 0 ||
    pointsOf(cg?.teamA) > 0 ||
    pointsOf(cg?.teamB) > 0 ||
    Boolean(currentSet.isTiebreak)
  )
}

/** True when the current set is (or has become) the deciding set. */
export function isDecidingSetUnderway(settings: RuleSettings, score: any): boolean {
  if (!score) return false
  const completed = score.sets?.length ?? 0
  const totalSets = Number(settings.sets) || 3
  const onLastSet = completed + 1 >= totalSets
  const setsToWin = getSetsToWin(settings)
  const aSets = (score.sets ?? []).filter((s: any) => s.winner === "teamA").length
  const bSets = (score.sets ?? []).filter((s: any) => s.winner === "teamB").length
  const matchPointSet = aSets === setsToWin - 1 && bSets === setsToWin - 1
  return (onLastSet || matchPointSet) && isCurrentSetUnderway(score.currentSet)
}

// ─── Classification ────────────────────────────────────────────────────────────

function diffKeys(oldS: RuleSettings, newS: RuleSettings): string[] {
  return RULE_KEYS.filter((k) => {
    const a = (oldS as any)?.[k]
    const b = (newS as any)?.[k]
    if (k === "gamesPerSetOverrides") return JSON.stringify(a ?? {}) !== JSON.stringify(b ?? {})
    return a !== b
  })
}

/** Classifies a single changed key against the live state. */
function classifyKey(key: string, oldS: RuleSettings, newS: RuleSettings, score: any): RuleChangeScope {
  const currentSet = score?.currentSet
  const currentGame = currentSet?.currentGame

  switch (key) {
    case "windbreak":
      return "safe"

    case "goldenGame":
      // Safe unless the current set is one game from finishing.
      return isCurrentSetNearTiebreak(newS, currentSet) ? "current-set" : "safe"

    case "scoringSystem":
      // A simple game can switch freely; deuce/advantage needs normalization.
      return isCurrentGameAtDeuce(currentGame) ? "current-set" : "safe"

    case "goldenPointFormat":
      return isCurrentGameAtDeuce(currentGame) ? "current-set" : "safe"

    case "gamesPerSet":
    case "gamesPerSetOverrides":
      return isCurrentSetNearTiebreak(newS, currentSet) ? "current-set" : "safe"

    case "tiebreakEnabled":
    case "tiebreakAt":
    case "tiebreakLength":
    case "tiebreakFormat":
      return isCurrentSetNearTiebreak(newS, currentSet) ? "current-set" : "safe"

    case "finalSetTiebreak":
    case "finalSetFinish":
    case "finalSetTiebreakLength": {
      if (currentSet?.isTiebreak) return "restart-required"
      return isDecidingSetUnderway(newS, score) ? "current-set" : "future-only"
    }

    case "sets": {
      const oldSets = Number(oldS.sets) || 0
      const newSets = Number(newS.sets) || 0
      const played = score?.sets?.length ?? 0
      // Cutting the match shorter than what has already been played, or editing
      // the length while the deciding set is live, cannot be done losslessly.
      if (newSets < played) return "restart-required"
      if (isDecidingSetUnderway(oldS, score) || isDecidingSetUnderway(newS, score)) return "current-set"
      return matchHasStarted(score) ? "future-only" : "safe"
    }

    case "isSuperSet":
      return matchHasStarted(score) ? "restart-required" : "safe"

    default:
      return "current-set"
  }
}

/**
 * Classifies a rule edit. The result scope is the most severe of every changed
 * key; the UI uses it to decide whether to apply silently, ask for a scope, or
 * offer a restart.
 */
export function classifyRuleChange(
  oldSettings: RuleSettings,
  newSettings: RuleSettings,
  score: any,
): RuleChangeClassification {
  const changedKeys = diffKeys(oldSettings ?? {}, newSettings ?? {})
  if (changedKeys.length === 0) {
    return { scope: "safe", reason: "no rule keys changed", changedKeys }
  }

  let worst: RuleChangeScope = "safe"
  let worstKey = changedKeys[0]
  for (const key of changedKeys) {
    const scope = classifyKey(key, oldSettings, newSettings, score)
    if (SCOPE_RANK[scope] > SCOPE_RANK[worst]) {
      worst = scope
      worstKey = key
    }
  }

  const reasons: Record<RuleChangeScope, string> = {
    safe: `changing ${changedKeys.join(", ")} is safe to apply now`,
    "future-only": `${worstKey} should apply from the next set / match`,
    "current-set": `${worstKey} affects the current point or set — confirm scope`,
    "restart-required": `${worstKey} cannot be mapped losslessly — restart or defer`,
  }
  return { scope: worst, reason: reasons[worst], changedKeys }
}

// ─── Settings reconciliation ───────────────────────────────────────────────────

/**
 * Reconciles dependent settings after a scoring-system change.
 *  - no-ad → classic: a `first-deuce` Golden Point (the no-ad default) is reset
 *    to `none` so the game falls back to normal deuce/advantage.
 *  - classic/* → no-ad: an absent Golden Point is defaulted to `first-deuce`.
 * Returns a new settings object; the input is not mutated.
 */
export function reconcileSettingsForScoringSystem(
  oldSettings: RuleSettings,
  newSettings: RuleSettings,
): RuleSettings {
  const next: RuleSettings = { ...newSettings }
  const wasNoAd = oldSettings?.scoringSystem === "no-ad"
  const isNoAd = next.scoringSystem === "no-ad"
  const isClassic = next.scoringSystem === "classic"

  if (wasNoAd && isClassic && next.goldenPointFormat === "first-deuce") {
    next.goldenPointFormat = "none"
  }
  if (isNoAd && (!next.goldenPointFormat || next.goldenPointFormat === "none")) {
    next.goldenPointFormat = "first-deuce"
  }
  return next
}

// ─── Live-state normalization ──────────────────────────────────────────────────

/**
 * Normalizes the current game after a scoring-system / golden-point change so
 * it is valid for the new rules:
 *  - no-ad / fast4 have no advantage: a live `Ad` collapses back to 40-40 and
 *    the deuce counter is dropped.
 * Mutates the passed game object.
 */
export function normalizeCurrentGameForScoringSystem(currentGame: any, settings: RuleSettings): void {
  if (!currentGame) return
  const system = settings.scoringSystem ?? "classic"

  if (system === "no-ad" || system === "fast4") {
    if (currentGame.teamA === "Ad") {
      currentGame.teamA = 40
      currentGame.teamB = 40
    }
    if (currentGame.teamB === "Ad") {
      currentGame.teamB = 40
      currentGame.teamA = 40
    }
    delete currentGame.deuceCount
  }
}

/**
 * Normalizes the current set after a tiebreak / final-set change. Only the
 * lossless case is touched automatically: an empty tiebreak (0-0) that the new
 * format no longer wants is reverted to a normal game. A tiebreak with points
 * already played is left intact — that needs an explicit restart decision.
 * Mutates the passed set object. Returns true when a change was made.
 */
export function normalizeCurrentSetForFinalSet(currentSet: any, settings: RuleSettings): boolean {
  if (!currentSet?.isTiebreak) return false
  const cg = currentSet.currentGame ?? { teamA: 0, teamB: 0 }
  const tiebreakEmpty = pointsOf(cg.teamA) === 0 && pointsOf(cg.teamB) === 0
  if (!tiebreakEmpty) return false

  // A match-tiebreak super set that is no longer a match-tiebreak format.
  if (currentSet.isSuperTiebreak && !isMatchTiebreakFormat(settings)) {
    currentSet.isTiebreak = false
    currentSet.isSuperTiebreak = false
    currentSet.currentGame = { teamA: 0, teamB: 0 }
    return true
  }
  // A regular tiebreak that the format no longer enables.
  if (!currentSet.isSuperTiebreak && settings.tiebreakEnabled === false) {
    currentSet.isTiebreak = false
    currentSet.currentGame = { teamA: 0, teamB: 0 }
    return true
  }
  return false
}

/**
 * Applies every safe normalization after a rule edit and stamps the rule-change
 * metadata. Deep-clones the match — the input is not mutated.
 */
export function normalizeMatchAfterRuleChange(
  match: any,
  classification?: RuleChangeClassification,
): any {
  const next = JSON.parse(JSON.stringify(match))
  const settings: RuleSettings = next.settings ?? {}
  const currentSet = next.score?.currentSet

  if (currentSet) {
    normalizeCurrentGameForScoringSystem(currentSet.currentGame, settings)
    normalizeCurrentSetForFinalSet(currentSet, settings)
  }

  next.ruleRevision = (typeof next.ruleRevision === "number" ? next.ruleRevision : 0) + 1
  next.lastRuleChangeAt = new Date().toISOString()
  if (classification) {
    next.ruleChangeScope = classification.scope
    next.ruleChangeReason = classification.reason
  }
  return next
}

// ─── Backfill for older matches (Task 7) ───────────────────────────────────────

/**
 * Fills rule metadata that older matches were saved without, so the scoring and
 * sync layers can rely on it. Only *missing* fields are defaulted — existing
 * values are never overwritten — and the match is mutated in place but not
 * persisted: the defaults are written back only when the app next saves a real
 * edit, keeping old JSON exports loadable. Idempotent.
 */
export function backfillRuleMetadata(match: any): any {
  if (!match || typeof match !== "object") return match

  if (typeof match.ruleRevision !== "number") match.ruleRevision = 0
  if (typeof match.revision !== "number") match.revision = 0

  const settings = match.settings || (match.settings = {})
  if (settings.scoringSystem === undefined) settings.scoringSystem = "classic"
  if (settings.goldenPointFormat === undefined) {
    settings.goldenPointFormat = getDefaultGoldenPointForScoringSystem(settings.scoringSystem)
  }
  if (settings.finalSetFinish === undefined) settings.finalSetFinish = "standard-7"
  if (settings.finalSetTiebreakLength === undefined) settings.finalSetTiebreakLength = 10
  if (settings.tiebreakEnabled === undefined) settings.tiebreakEnabled = true
  if (settings.tiebreakAt === undefined) settings.tiebreakAt = "6-6"
  if (settings.tiebreakLength === undefined) settings.tiebreakLength = 7

  return match
}
