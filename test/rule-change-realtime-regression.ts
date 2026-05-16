// Dedicated rule-change regression suite (Task 8).
//
// Deterministic coverage for live rule edits: scoring-system switches, golden
// point, tiebreak thresholds, final-set mode, set-count changes mid-match and
// match-tiebreak <-> full-set conversion. The realtime sync side is covered by
// test/match-sync-regression.ts.
import assert from "node:assert/strict"
import {
  classifyRuleChange,
  normalizeMatchAfterRuleChange,
  reconcileSettingsForScoringSystem,
} from "../lib/match-rule-change"
import {
  normalizeMatchState,
  restartCurrentSetAsMatchTiebreak,
  restartCurrentSetAsNormalSet,
} from "../lib/scoring-logic"

function mkMatch(settings: Record<string, any> = {}, current: Record<string, any> = {}) {
  return {
    isCompleted: false,
    winner: null,
    format: "doubles",
    settings: {
      sets: 3,
      scoringSystem: "classic",
      gamesPerSet: 6,
      tiebreakEnabled: true,
      tiebreakAt: "6-6",
      tiebreakLength: 7,
      tiebreakFormat: "two-clear",
      finalSetTiebreak: false,
      finalSetFinish: "standard-7",
      goldenPointFormat: "none",
      goldenGame: false,
      windbreak: false,
      ...settings,
    },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [] as any[],
      currentSet: {
        teamA: 0,
        teamB: 0,
        games: [] as any[],
        currentGame: { teamA: 0 as any, teamB: 0 as any },
        isTiebreak: false,
        ...current,
      },
    },
    currentServer: { team: "teamA", playerIndex: 0 },
    courtSides: { teamA: "left", teamB: "right" },
  }
}

const scopeOf = (m: any, patch: Record<string, any>) =>
  classifyRuleChange(m.settings, { ...m.settings, ...patch }, m.score).scope

// 1. no-ad -> classic clears the first-deuce Golden Point.
assert.equal(
  reconcileSettingsForScoringSystem(
    { scoringSystem: "no-ad", goldenPointFormat: "first-deuce" },
    { scoringSystem: "classic", goldenPointFormat: "first-deuce" },
  ).goldenPointFormat,
  "none",
)

// 2. classic -> no-ad: defaults Golden Point and collapses a live Ad.
assert.equal(
  reconcileSettingsForScoringSystem(
    { scoringSystem: "classic", goldenPointFormat: "none" },
    { scoringSystem: "no-ad", goldenPointFormat: "none" },
  ).goldenPointFormat,
  "first-deuce",
)
const adGame = normalizeMatchState(mkMatch({ scoringSystem: "no-ad" }, { currentGame: { teamA: "Ad", teamB: 40 } }) as any)
assert.notEqual(adGame.score.currentSet.currentGame.teamA, "Ad", "no-ad collapses a live Ad")

// 3. fast4 -> classic: safe in a simple game, gated at 40-40.
assert.equal(scopeOf(mkMatch({ scoringSystem: "fast4" }, { currentGame: { teamA: 15, teamB: 0 } }), { scoringSystem: "classic" }), "safe")
assert.equal(
  scopeOf(mkMatch({ scoringSystem: "fast4" }, { currentGame: { teamA: 40, teamB: 40 } }), { scoringSystem: "classic" }),
  "current-set",
)

// 4. goldenPointFormat: gated at deuce, safe otherwise.
assert.equal(scopeOf(mkMatch({}, { currentGame: { teamA: 40, teamB: 40 } }), { goldenPointFormat: "first-deuce" }), "current-set")
assert.equal(scopeOf(mkMatch({}, { currentGame: { teamA: 15, teamB: 0 } }), { goldenPointFormat: "first-deuce" }), "safe")

// 5. tiebreak threshold: gated near the threshold, safe far from it.
assert.equal(scopeOf(mkMatch({}, { teamA: 5, teamB: 5 }), { tiebreakAt: "4-4" }), "current-set")
assert.equal(scopeOf(mkMatch({}, { teamA: 1, teamB: 0 }), { tiebreakAt: "4-4" }), "safe")

// 6. finalSetFinish change while the deciding set is underway.
const decidingMatch = mkMatch({ sets: 3 }, { teamA: 3, teamB: 2 })
decidingMatch.score.sets = [{ winner: "teamA" }, { winner: "teamB" }]
assert.equal(scopeOf(decidingMatch, { finalSetFinish: "match-tiebreak-10" }), "current-set")

// 7. sets count: future-only before the decider, restart-required below played sets.
const earlyMatch = mkMatch({ sets: 3 }, { teamA: 1, teamB: 0 })
earlyMatch.score.sets = [{ winner: "teamA" }]
assert.equal(scopeOf(earlyMatch, { sets: 5 }), "future-only")
const playedMatch = mkMatch({ sets: 3 })
playedMatch.score.sets = [{ winner: "teamA" }, { winner: "teamB" }]
assert.equal(scopeOf(playedMatch, { sets: 1 }), "restart-required")

// 8. match-tiebreak <-> full-set conversion preserves completed sets.
const tbMatch = mkMatch({}, { isTiebreak: true, isSuperTiebreak: true, currentGame: { teamA: 5, teamB: 3 } })
tbMatch.score.sets = [{ winner: "teamA" }]
const toFull = restartCurrentSetAsNormalSet(tbMatch as any)
assert.equal(toFull.score.currentSet.isTiebreak, false)
assert.equal(toFull.score.currentSet.currentGame.teamA, 0, "tiebreak points are dropped, not converted")
assert.equal(toFull.score.sets.length, 1, "completed sets preserved")

const fullMatch = mkMatch({ sets: 3 }, { teamA: 3, teamB: 2 })
fullMatch.score.sets = [{ winner: "teamA" }, { winner: "teamB" }]
const toTb = restartCurrentSetAsMatchTiebreak(fullMatch as any)
assert.equal(toTb.score.currentSet.isTiebreak, true)
assert.equal(toTb.score.currentSet.isSuperTiebreak, true)
assert.equal(toTb.score.currentSet.teamA, 0, "game scores are dropped")
assert.equal(toTb.score.sets.length, 2, "completed sets preserved")

// A normalized rule change stamps the rule-change metadata.
const stamped = normalizeMatchAfterRuleChange(mkMatch() as any, {
  scope: "current-set",
  reason: "test",
  changedKeys: ["scoringSystem"],
})
assert.equal(stamped.ruleRevision, 1)
assert.equal(stamped.ruleChangeScope, "current-set")

console.log("rule-change realtime regression checks passed")
