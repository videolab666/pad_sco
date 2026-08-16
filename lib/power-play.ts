// Task 12 — Power Play.
//
// APK rule: a team gets `maxNrOfPowerPlays` activations per match (default 2),
// activates one before the NEXT rally, and CANNOT activate on a game ball
// (`isPossibleGameBallFor` returns true). Consumption happens after the rally
// completes — whether the team won the rally or not.
//
// We piggyback on the existing `isGamePoint` from scoring-logic for the
// game-ball check.

import { appendMatchEvent } from "./match-events"
import { isGamePoint } from "./scoring-logic"
import type { PowerPlayState, TeamKey } from "./types"

const DEFAULT_MAX_PER_TEAM = 2

function ensurePowerPlay(match: any): void {
  if (!match.powerPlay || typeof match.powerPlay !== "object") {
    match.powerPlay = {
      maxPerTeam: DEFAULT_MAX_PER_TEAM,
      used: { teamA: 0, teamB: 0 },
      activeFor: [],
    } satisfies PowerPlayState
  } else {
    if (typeof match.powerPlay.maxPerTeam !== "number") match.powerPlay.maxPerTeam = DEFAULT_MAX_PER_TEAM
    if (!match.powerPlay.used) match.powerPlay.used = { teamA: 0, teamB: 0 }
    if (!Array.isArray(match.powerPlay.activeFor)) match.powerPlay.activeFor = []
  }
}

export type PowerPlayRefusalReason = "game-ball" | "no-budget"

export interface PowerPlayToggleResult {
  match: any
  refused?: PowerPlayRefusalReason
}

/**
 * Toggle a Power Play activation for the next rally. Refuses when the team
 * has run out of budget OR when the upcoming rally is a game-ball for that
 * team (or "both" — i.e. golden point), to match the APK constraint.
 */
export function toggleNextRallyPowerPlay(match: any, team: TeamKey): PowerPlayToggleResult {
  if (!match) return { match }
  const gp = isGamePoint(match as any)
  if (gp === team || gp === "both") {
    return { match, refused: "game-ball" }
  }
  const next = JSON.parse(JSON.stringify(match))
  ensurePowerPlay(next)
  const pp = next.powerPlay as PowerPlayState
  const isActive = pp.activeFor.includes(team)
  if (!isActive && pp.used[team] >= pp.maxPerTeam) {
    return { match, refused: "no-budget" }
  }
  if (isActive) {
    pp.activeFor = pp.activeFor.filter((t) => t !== team)
  } else {
    pp.activeFor = [...pp.activeFor, team]
  }
  return {
    match: appendMatchEvent(next, {
      type: "power-play",
      setIndex: next.score?.sets?.length ?? 0,
      gameIndex: next.score?.currentSet?.games?.length ?? 0,
      actor: team,
      payload: { action: isActive ? "deactivate" : "activate" },
    }),
  }
}

/**
 * After a rally completes, increment `used` for every team that had Power
 * Play active and clear the `activeFor` list.
 */
export function consumePowerPlayAfterPoint(match: any, scoringTeam: TeamKey): any {
  const pp: PowerPlayState | undefined = match?.powerPlay
  if (!pp?.activeFor?.length) return match
  const next = JSON.parse(JSON.stringify(match))
  for (const team of next.powerPlay.activeFor as TeamKey[]) {
    next.powerPlay.used[team] = (next.powerPlay.used[team] ?? 0) + 1
    // Record outcome (CashIn / Waste) per APK semantics for downstream stats.
    next.events = next.events ?? []
    next.events.push({
      id: cryptoIdFallback(),
      at: new Date().toISOString(),
      type: "power-play",
      setIndex: next.score?.sets?.length ?? 0,
      gameIndex: next.score?.currentSet?.games?.length ?? 0,
      actor: team,
      payload: {
        action: "consume",
        outcome: team === scoringTeam ? "cash-in" : "waste",
      },
    })
  }
  next.powerPlay.activeFor = []
  return next
}

/** Remaining activations a team can still spend. */
export function powerPlayBudgetLeft(match: any, team: TeamKey): number {
  const pp = match?.powerPlay
  const used = pp?.used?.[team] ?? 0
  const max = typeof pp?.maxPerTeam === "number" ? pp.maxPerTeam : DEFAULT_MAX_PER_TEAM
  return Math.max(0, max - used)
}

// Cheap fallback ID generator used only inside this file. We avoid pulling in
// safe-uuid for the consume path so the function stays pure / synchronous.
function cryptoIdFallback(): string {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36)
}
