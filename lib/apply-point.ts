// Orchestrator over the canonical engine.
//
// `applyPointWithExtras` is the SINGLE place UI calls to score a point. It
// runs the engine, then dispatches every extension hook in the right order
// so each feature module from the SOPRT plan stays additive (no edits to
// `scoring-logic.ts` itself):
//
//   1. capture set/game/point indices BEFORE the point
//   2. engine: applyScoreIncrement(match, team)
//   3. append a `point` event with the captured indices
//   4. consumePowerPlayAfterPoint(scoringTeam)
//   5. if a game just finished — close current-game timing and start the next
//      game's timing window AND apply the configured handicap to the new
//      currentGame
//   6. if we are in tiebreak and the format requires a receiver choice — stage
//      pendingTiebreakChoice (UI auto-opens the dialog)
//
// Returns the orchestrated match snapshot. Caller still owns updateMatch().

import { appendPointEvent } from "./match-events"
import { backfillExtendedMatchState } from "./match-extended-state"
import { ensureSeedSnapshot } from "./match-undo"
import { getGameHandicap, pointIndexToTennisScore } from "./handicap"
import { ensureCurrentGameTiming, finalizeMatchTiming } from "./match-timing"
import { consumePowerPlayAfterPoint } from "./power-play"
import { applyScoreIncrement, applyPendingCourtSideChange } from "./scoring-logic"
import {
  isPlainTiebreakFormat,
  shouldAskTiebreakTargetChoice,
  stageTiebreakChoice,
} from "./tiebreak-format"
import type { TeamKey } from "./types"

function pointCountInGame(cg: any): number {
  if (!cg) return 0
  // Tiebreak: raw point counts; regular: 0/15/30/40 → 0/1/2/3, "Ad" → 4.
  const fromTennis = (v: unknown): number => {
    if (v === "Ad") return 4
    if (v === 40) return 3
    if (v === 30) return 2
    if (v === 15) return 1
    if (typeof v === "number") return v
    return 0
  }
  return fromTennis(cg.teamA) + fromTennis(cg.teamB)
}

export function applyPointWithExtras(match: any, team: TeamKey, now: Date = new Date()): any {
  if (!match) return match

  // Make sure extended state slots exist so downstream helpers don't crash on
  // legacy snapshots loaded straight from storage.
  let seeded = backfillExtendedMatchState(JSON.parse(JSON.stringify(match)))
  // Replay-undo base: seed lazily here if the match does not have one yet
  // (matches created before the journal system, or restored from legacy
  // storage). Idempotent; mid-journal seeds carry applyFromIndex.
  seeded = ensureSeedSnapshot(seeded)
  // Make sure the current-game timing window is open BEFORE the engine step,
  // so the very first point also gets a valid window for downstream stats.
  if (!seeded.timing?.currentGame) {
    seeded = ensureCurrentGameTiming(seeded, now)
  }

  const beforeSetIndex = seeded.score?.sets?.length ?? 0
  const beforeGameIndex = seeded.score?.currentSet?.games?.length ?? 0
  const beforePointIndex = pointCountInGame(seeded.score?.currentSet?.currentGame)
  const beforeIsTiebreak = Boolean(seeded.score?.currentSet?.isTiebreak)

  // Engine step.
  let next = applyPendingCourtSideChange(applyScoreIncrement(seeded as any, team)) as any
  // A side change is part of the point's atomic state transition. If every
  // referee's React effect sent a swap, two connected referees would cancel it.

  // Audit: record the point event with BEFORE indices (so the journal lines
  // up with the score state when the point was committed).
  next = appendPointEvent(next, {
    team,
    setIndex: beforeSetIndex,
    gameIndex: beforeGameIndex,
    pointIndex: beforePointIndex,
  })

  // Power Play consumption — silent no-op if nothing is active.
  next = consumePowerPlayAfterPoint(next, team)

  const afterSetIndex = next.score?.sets?.length ?? 0
  const afterGameIndex = next.score?.currentSet?.games?.length ?? 0

  const gameJustFinished = afterSetIndex > beforeSetIndex || afterGameIndex > beforeGameIndex

  if (gameJustFinished) {
    // Mark the just-completed game's timing entry as ended. We do this
    // by index (the BEFORE indices) because `endCurrentGameTiming` would
    // look at the AFTER indices and miss the row we want to close.
    if (Array.isArray(next.timing?.games)) {
      for (let i = next.timing.games.length - 1; i >= 0; i--) {
        const g = next.timing.games[i]
        if (g.setIndex === beforeSetIndex && g.gameIndex === beforeGameIndex && !g.endedAt) {
          g.endedAt = now.toISOString()
          break
        }
      }
    }
    if (!next.isCompleted) {
      next = ensureCurrentGameTiming(next, now)

      // Apply the configured handicap to the freshly-started currentGame.
      // buildNewCurrentGame computes the per-game starting score for the
      // CURRENT set/game index (which is now the NEW one after the engine
      // advanced).
      const handicap = getGameHandicap(next, next.score?.sets?.length ?? 0, next.score?.currentSet?.games?.length ?? 0)
      if (handicap.teamA !== 0 || handicap.teamB !== 0) {
        const cs = next.score.currentSet
        if (cs?.currentGame) {
          cs.currentGame = {
            ...cs.currentGame,
            teamA: pointIndexToTennisScore(handicap.teamA),
            teamB: pointIndexToTennisScore(handicap.teamB),
          }
        }
      }
    } else {
      // Match just finished — wrap up the global timing window.
      next = finalizeMatchTiming(next, now)
    }
  }

  // Tiebreak receiver choice. Only meaningful for select-formats AND only when
  // a tiebreak is in play (either was before the point or just became active).
  const afterIsTiebreak = Boolean(next.score?.currentSet?.isTiebreak)
  if (
    (afterIsTiebreak || beforeIsTiebreak) &&
    !next.pendingTiebreakChoice &&
    !next.isCompleted &&
    !isPlainTiebreakFormat(next.settings?.tiebreakFormat) &&
    shouldAskTiebreakTargetChoice(next)
  ) {
    const server = next.currentServer?.team as TeamKey | undefined
    const receiver: TeamKey = server === "teamA" ? "teamB" : "teamA"
    next = stageTiebreakChoice(next, receiver, now)
  }

  return next
}
