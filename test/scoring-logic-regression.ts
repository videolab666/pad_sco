import assert from "node:assert/strict"
import {
  getDefaultFinalSetTiebreakForSelection,
  getDefaultGoldenPointForScoringSystem,
} from "../lib/match-format-rules"
import {
  applyScoreIncrement,
  getSetTargets,
  normalizeMatchState,
  recomputeMatchCompletion,
  restartCurrentSet,
  restartCurrentSetAsMatchTiebreak,
  restartCurrentSetAsNormalSet,
} from "../lib/scoring-logic"
import {
  backfillRuleMetadata,
  classifyRuleChange,
  normalizeMatchAfterRuleChange,
  reconcileSettingsForScoringSystem,
} from "../lib/match-rule-change"
import { applyMetadataEdit, isMetadataOnlyChange } from "../lib/match-metadata"

type TeamKey = "teamA" | "teamB"

assert.equal(getDefaultFinalSetTiebreakForSelection("2"), true)
assert.equal(getDefaultFinalSetTiebreakForSelection("4"), true)
assert.equal(getDefaultFinalSetTiebreakForSelection("3"), false)
assert.equal(getDefaultFinalSetTiebreakForSelection("super"), false)
assert.equal(getDefaultGoldenPointForScoringSystem("no-ad"), "first-deuce")
assert.equal(getDefaultGoldenPointForScoringSystem("classic"), "none")
assert.equal(getDefaultGoldenPointForScoringSystem("fast4"), "none")

function createMatch(settingsOverrides: Record<string, any> = {}) {
  const match: any = {
    isCompleted: false,
    winner: null,
    format: "doubles",
    settings: {
      sets: 2,
      scoringSystem: "classic",
      gamesPerSet: 6,
      gamesPerSetOverrides: {},
      tiebreakEnabled: true,
      tiebreakType: "points",
      tiebreakLength: 7,
      tiebreakAt: "6-6",
      finalSetTiebreak: true,
      finalSetTiebreakLength: 10,
      finalSetFinish: "match-tiebreak-10",
      tiebreakFormat: "two-clear",
      goldenPointFormat: "none",
      goldenGame: false,
      windbreak: false,
      ...settingsOverrides,
    },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: {
        teamA: 0,
        teamB: 0,
        games: [],
        currentGame: {
          teamA: 0,
          teamB: 0,
        },
        isTiebreak: false,
      },
    },
    currentServer: {
      team: "teamA" as TeamKey,
      playerIndex: 0,
    },
    courtSides: {
      teamA: "left",
      teamB: "right",
    },
    shouldChangeSides: false,
    history: [],
  }
  return match
}

function createTwoSetsPlusTiebreakMatch() {
  return createMatch()
}

function winCurrentGame(match: ReturnType<typeof createMatch>, team: TeamKey) {
  const otherTeam = team === "teamA" ? "teamB" : "teamA"
  match.score.currentSet.currentGame[team] = 40
  match.score.currentSet.currentGame[otherTeam] = 0
  return applyScoreIncrement(match, team) as any
}

let match = createTwoSetsPlusTiebreakMatch()

match.score.currentSet.teamA = 5
match.score.currentSet.teamB = 4
match = winCurrentGame(match, "teamA")

assert.equal(match.score.teamA, 1)
assert.equal(match.score.teamB, 0)
assert.equal(match.score.sets.length, 1)
assert.equal(match.score.currentSet.isTiebreak, false, "2 + tiebreak must not start match tiebreak after only one set")
assert.equal(match.isCompleted, false)

match.score.currentSet.teamA = 3
match.score.currentSet.teamB = 5
match = winCurrentGame(match, "teamB")

assert.equal(match.score.teamA, 1)
assert.equal(match.score.teamB, 1)
assert.equal(match.score.sets.length, 2)
assert.equal(match.score.currentSet.isTiebreak, true, "2 + tiebreak must start match tiebreak only after split sets")
assert.equal(match.score.currentSet.isSuperTiebreak, true)
assert.equal(match.isCompleted, false)

match.score.currentSet.currentGame.teamA = 0
match.score.currentSet.currentGame.teamB = 9
match = applyScoreIncrement(match, "teamB") as any

assert.equal(match.isCompleted, true)
assert.equal(match.winner, "teamB")
assert.equal(match.score.teamA, 1)
assert.equal(match.score.teamB, 2)

let goldenPointMatch = createMatch({
  sets: 3,
  finalSetTiebreak: false,
  finalSetFinish: "standard-7",
  goldenPointFormat: "first-deuce",
})
goldenPointMatch.score.currentSet.currentGame = { teamA: 40, teamB: 40 }
goldenPointMatch = applyScoreIncrement(goldenPointMatch, "teamA") as any
assert.equal(goldenPointMatch.score.currentSet.teamA, 1, "first-deuce Golden Point should win the game at 40-40")
assert.deepEqual(goldenPointMatch.score.currentSet.currentGame, { teamA: 0, teamB: 0 })

let secondDeuceMatch = createMatch({
  sets: 3,
  finalSetTiebreak: false,
  finalSetFinish: "standard-7",
  goldenPointFormat: "second-deuce",
})
secondDeuceMatch.score.currentSet.currentGame = { teamA: 40, teamB: 40 }
secondDeuceMatch = applyScoreIncrement(secondDeuceMatch, "teamA") as any
assert.equal(secondDeuceMatch.score.currentSet.currentGame.teamA, "Ad")
secondDeuceMatch = applyScoreIncrement(secondDeuceMatch, "teamB") as any
assert.equal(secondDeuceMatch.score.currentSet.currentGame.teamA, 40)
assert.equal(secondDeuceMatch.score.currentSet.currentGame.teamB, 40)
assert.equal(secondDeuceMatch.score.currentSet.currentGame.deuceCount, 1)
secondDeuceMatch = applyScoreIncrement(secondDeuceMatch, "teamA") as any
assert.equal(secondDeuceMatch.score.currentSet.teamA, 1, "second-deuce Golden Point should win the game on the second deuce")

let suddenDeathMatch = createMatch({
  sets: 3,
  finalSetTiebreak: false,
  finalSetFinish: "standard-7",
  tiebreakFormat: "sudden-death",
})
suddenDeathMatch.score.currentSet.isTiebreak = true
suddenDeathMatch.score.currentSet.currentGame = { teamA: 6, teamB: 6 }
suddenDeathMatch = applyScoreIncrement(suddenDeathMatch, "teamA") as any
assert.equal(suddenDeathMatch.score.teamA, 1, "sudden-death tiebreak should finish at 7-6")

let twoClearMatch = createMatch({
  sets: 3,
  finalSetTiebreak: false,
  finalSetFinish: "standard-7",
  tiebreakFormat: "two-clear",
})
twoClearMatch.score.currentSet.isTiebreak = true
twoClearMatch.score.currentSet.currentGame = { teamA: 6, teamB: 6 }
twoClearMatch = applyScoreIncrement(twoClearMatch, "teamA") as any
assert.equal(twoClearMatch.score.teamA, 0, "two-clear tiebreak should not finish at 7-6")
assert.equal(twoClearMatch.score.currentSet.isTiebreak, true)

let noTiebreakFinalSetMatch = createMatch({
  sets: 3,
  finalSetTiebreak: true,
  finalSetFinish: "no-tiebreak",
})
noTiebreakFinalSetMatch.score.sets = [
  { teamA: 6, teamB: 4, winner: "teamA" },
  { teamA: 4, teamB: 6, winner: "teamB" },
]
noTiebreakFinalSetMatch.score.teamA = 1
noTiebreakFinalSetMatch.score.teamB = 1
noTiebreakFinalSetMatch.score.currentSet.teamA = 5
noTiebreakFinalSetMatch.score.currentSet.teamB = 6
noTiebreakFinalSetMatch = winCurrentGame(noTiebreakFinalSetMatch, "teamA")
assert.equal(noTiebreakFinalSetMatch.score.currentSet.teamA, 6)
assert.equal(noTiebreakFinalSetMatch.score.currentSet.teamB, 6)
assert.equal(noTiebreakFinalSetMatch.score.currentSet.isTiebreak, false, "no-tiebreak final set must keep playing at 6-6")
noTiebreakFinalSetMatch.score.currentSet.teamA = 7
noTiebreakFinalSetMatch.score.currentSet.teamB = 6
noTiebreakFinalSetMatch = winCurrentGame(noTiebreakFinalSetMatch, "teamA")
assert.equal(noTiebreakFinalSetMatch.isCompleted, true)
assert.equal(noTiebreakFinalSetMatch.score.currentSet.teamA, 8)

let gamesTo12Match = createMatch({
  sets: 3,
  finalSetTiebreak: true,
  finalSetFinish: "games-to-12-10",
})
gamesTo12Match.score.sets = [
  { teamA: 6, teamB: 4, winner: "teamA" },
  { teamA: 4, teamB: 6, winner: "teamB" },
]
gamesTo12Match.score.teamA = 1
gamesTo12Match.score.teamB = 1
gamesTo12Match.score.currentSet.teamA = 11
gamesTo12Match.score.currentSet.teamB = 11
gamesTo12Match = winCurrentGame(gamesTo12Match, "teamA")
assert.equal(gamesTo12Match.score.currentSet.teamA, 12)
assert.equal(gamesTo12Match.score.currentSet.teamB, 11)
assert.equal(gamesTo12Match.score.currentSet.isTiebreak, false)
gamesTo12Match = winCurrentGame(gamesTo12Match, "teamB")
assert.equal(gamesTo12Match.score.currentSet.teamA, 12)
assert.equal(gamesTo12Match.score.currentSet.teamB, 12)
assert.equal(gamesTo12Match.score.currentSet.isTiebreak, true, "games-to-12 final set should start tiebreak at 12-12")
assert.equal(gamesTo12Match.score.currentSet.isSuperTiebreak, true)

// ─── Task 1: rule-change model regressions ────────────────────────────────────

// 1. no-ad -> classic clears the `first-deuce` Golden Point.
const noAdToClassic = reconcileSettingsForScoringSystem(
  { scoringSystem: "no-ad", goldenPointFormat: "first-deuce" },
  { scoringSystem: "classic", goldenPointFormat: "first-deuce" },
)
assert.equal(noAdToClassic.goldenPointFormat, "none", "no-ad -> classic must reset first-deuce to none")

// classic -> no-ad defaults Golden Point to first-deuce.
const classicToNoAd = reconcileSettingsForScoringSystem(
  { scoringSystem: "classic", goldenPointFormat: "none" },
  { scoringSystem: "no-ad", goldenPointFormat: "none" },
)
assert.equal(classicToNoAd.goldenPointFormat, "first-deuce", "classic -> no-ad must default Golden Point")

// 2. classic -> no-ad must not leave a live `Ad` behind.
let adMatch = createMatch({ scoringSystem: "classic" })
adMatch.score.currentSet.currentGame = { teamA: "Ad", teamB: 40, deuceCount: 1 }
adMatch.settings.scoringSystem = "no-ad"
const normalizedAd = normalizeMatchAfterRuleChange(adMatch)
assert.notEqual(normalizedAd.score.currentSet.currentGame.teamA, "Ad", "no-ad must clear a live Ad")
assert.notEqual(normalizedAd.score.currentSet.currentGame.teamB, "Ad")
assert.equal(normalizedAd.score.currentSet.currentGame.teamA, 40)
assert.equal(normalizedAd.score.currentSet.currentGame.teamB, 40)
assert.equal(normalizedAd.score.currentSet.currentGame.deuceCount, undefined, "no-ad drops the deuce counter")
assert.equal(normalizedAd.ruleRevision, 1, "rule change bumps ruleRevision")

// 3. Changing the final-set mode while a tiebreak is live is restart-required.
let tiebreakMatch = createMatch({ sets: 3, finalSetFinish: "standard-7" })
tiebreakMatch.score.currentSet.isTiebreak = true
tiebreakMatch.score.currentSet.currentGame = { teamA: 3, teamB: 2 }
const finalSetClass = classifyRuleChange(
  { ...tiebreakMatch.settings },
  { ...tiebreakMatch.settings, finalSetFinish: "match-tiebreak-10" },
  tiebreakMatch.score,
)
assert.equal(finalSetClass.scope, "restart-required", "final-set change during a live tiebreak needs a restart")

// 4. Editing `sets` while the deciding set is underway is not safe.
let decidingMatch = createMatch({ sets: 3 })
decidingMatch.score.sets = [
  { teamA: 6, teamB: 4, winner: "teamA" },
  { teamA: 4, teamB: 6, winner: "teamB" },
]
decidingMatch.score.currentSet.teamA = 3
decidingMatch.score.currentSet.teamB = 2
const increaseSets = classifyRuleChange(
  { ...decidingMatch.settings, sets: 3 },
  { ...decidingMatch.settings, sets: 5 },
  decidingMatch.score,
)
assert.equal(increaseSets.scope, "current-set", "increasing sets during the deciding set affects current play")
const reduceSets = classifyRuleChange(
  { ...decidingMatch.settings, sets: 3 },
  { ...decidingMatch.settings, sets: 1 },
  decidingMatch.score,
)
assert.equal(reduceSets.scope, "restart-required", "cutting sets below played sets cannot be lossless")

console.log("rule-change model checks passed")

// ─── Task 4: deterministic scoring after rule edits ───────────────────────────

// no-ad collapses a live Ad and drops the deuce counter.
let noAdNorm = createMatch({ scoringSystem: "no-ad" })
noAdNorm.score.currentSet.currentGame = { teamA: "Ad", teamB: 40, deuceCount: 2 }
noAdNorm = normalizeMatchState(noAdNorm)
assert.equal(noAdNorm.score.currentSet.currentGame.teamA, 40, "no-ad must collapse a live Ad to 40-40")
assert.equal(noAdNorm.score.currentSet.currentGame.teamB, 40)
assert.equal(noAdNorm.score.currentSet.currentGame.deuceCount, undefined, "no-ad drops deuceCount")

// classic: a dangling Ad (opponent not at 40) is repaired to 40.
let danglingAd = createMatch({ scoringSystem: "classic" })
danglingAd.score.currentSet.currentGame = { teamA: "Ad", teamB: 30 }
danglingAd = normalizeMatchState(danglingAd)
assert.equal(danglingAd.score.currentSet.currentGame.teamA, 40, "classic dangling Ad must be repaired to 40")

// a stale deuce counter outside 40-40 is cleared.
let staleDeuce = createMatch({ scoringSystem: "classic" })
staleDeuce.score.currentSet.currentGame = { teamA: 15, teamB: 0, deuceCount: 3 }
staleDeuce = normalizeMatchState(staleDeuce)
assert.equal(staleDeuce.score.currentSet.currentGame.deuceCount, 0, "deuceCount is meaningless outside 40-40")

// live tiebreak points are coerced to non-negative integers.
let tbNorm = createMatch()
tbNorm.score.currentSet.isTiebreak = true
tbNorm.score.currentSet.currentGame = { teamA: -2, teamB: 3 }
tbNorm = normalizeMatchState(tbNorm)
assert.equal(tbNorm.score.currentSet.currentGame.teamA, 0, "negative tiebreak points are clamped")
assert.equal(tbNorm.score.currentSet.currentGame.teamB, 3)

// a super tiebreak that lost its tiebreak flag is repaired.
let superTb = createMatch()
superTb.score.currentSet.isTiebreak = false
superTb.score.currentSet.isSuperTiebreak = true
superTb = normalizeMatchState(superTb)
assert.equal(superTb.score.currentSet.isTiebreak, true, "a super tiebreak is always a tiebreak")

console.log("post-rule-change normalization checks passed")

// ─── Task 3: metadata-only match edits ────────────────────────────────────────

function metaMatch() {
  return {
    id: "meta-1",
    courtNumber: 1,
    round: "1/4",
    teamA: { players: [{ id: "a1", name: "A1" }, { id: "a2", name: "A2" }] },
    teamB: { players: [{ id: "b1", name: "B1" }, { id: "b2", name: "B2" }] },
    settings: { sets: 3, scoringSystem: "classic" },
    score: {
      teamA: 1,
      teamB: 0,
      sets: [{ teamA: 6, teamB: 4, winner: "teamA" }],
      currentSet: { teamA: 3, teamB: 2, games: [], currentGame: { teamA: 40, teamB: 30 }, isTiebreak: false },
    },
    currentServer: { team: "teamA" as const, playerIndex: 1 },
    courtSides: { teamA: "left", teamB: "right" },
    isCompleted: false,
    winner: null,
    history: [{ marker: 1 }],
  }
}

// A roster / court / round edit must leave the score branch byte-identical.
const scoreBefore = JSON.stringify(metaMatch().score)
const edited = applyMetadataEdit(metaMatch(), {
  teamA: { players: [{ id: "a1", name: "Renamed" }, { id: "a2", name: "A2" }] },
  courtNumber: 5,
  round: "Final",
})
assert.equal(JSON.stringify(edited.score), scoreBefore, "metadata edit must not touch the score")
assert.equal(edited.teamA.players[0].name, "Renamed", "roster edit applies")
assert.equal(edited.courtNumber, 5, "court edit applies")
assert.equal(edited.round, "Final", "round edit applies")
assert.equal(edited.isCompleted, false, "metadata edit must not touch completion")

// The server pointer clamps to a valid player when the serving team shrinks.
const shrunk = applyMetadataEdit(metaMatch(), { teamA: { players: [{ id: "a1", name: "Solo" }] } })
assert.equal(shrunk.currentServer.team, "teamA")
assert.equal(shrunk.currentServer.playerIndex, 0, "server pointer clamps to a valid player")

// The pointer moves to the other team when the serving team is emptied.
const moved = applyMetadataEdit(metaMatch(), { teamA: { players: [] } })
assert.equal(moved.currentServer.team, "teamB", "server moves to a team that still has players")

// isMetadataOnlyChange correctly separates metadata from score changes.
assert.equal(
  isMetadataOnlyChange(metaMatch(), applyMetadataEdit(metaMatch(), { courtNumber: 9 })),
  true,
  "a court change is metadata-only",
)
const scoreChanged = metaMatch()
scoreChanged.score.currentSet.currentGame.teamA = "Ad" as any
assert.equal(isMetadataOnlyChange(metaMatch(), scoreChanged), false, "a score change is not metadata-only")

console.log("metadata-only edit checks passed")

// ─── Task 6: match tiebreak <-> full set conversion ───────────────────────────

// A live match tiebreak switched to a full set — points are dropped, not
// reinterpreted as game counts; completed sets are preserved.
let mtbToFull = createMatch({ sets: 3, finalSetFinish: "standard-7" })
mtbToFull.score.sets = [
  { teamA: 6, teamB: 4, winner: "teamA" },
  { teamA: 4, teamB: 6, winner: "teamB" },
]
mtbToFull.score.currentSet = {
  teamA: 0,
  teamB: 0,
  games: [],
  currentGame: { teamA: 5, teamB: 3 },
  isTiebreak: true,
  isSuperTiebreak: true,
}
const asFull = restartCurrentSetAsNormalSet(mtbToFull)
assert.equal(asFull.score.currentSet.isTiebreak, false, "match tiebreak -> full set clears the tiebreak flag")
assert.equal(asFull.score.currentSet.currentGame.teamA, 0, "match-tiebreak points are dropped, never converted")
assert.equal(asFull.score.sets.length, 2, "completed sets preserved on conversion")

// A live full set switched to a match tiebreak — game scores are dropped.
let fullToMtb = createMatch({ sets: 3 })
fullToMtb.score.sets = [
  { teamA: 6, teamB: 4, winner: "teamA" },
  { teamA: 4, teamB: 6, winner: "teamB" },
]
fullToMtb.score.currentSet.teamA = 3
fullToMtb.score.currentSet.teamB = 2
const asMtb = restartCurrentSetAsMatchTiebreak(fullToMtb)
assert.equal(asMtb.score.currentSet.isTiebreak, true, "full set -> match tiebreak sets the tiebreak flag")
assert.equal(asMtb.score.currentSet.isSuperTiebreak, true)
assert.equal(asMtb.score.currentSet.teamA, 0, "game scores are dropped on conversion")
assert.equal(asMtb.score.sets.length, 2, "completed sets preserved on conversion")

// restartCurrentSet auto-detects the format of the deciding set.
let autoMtb = createMatch() // sets: 2, finalSetFinish: match-tiebreak-10
autoMtb.score.sets = [{ teamA: 6, teamB: 4, winner: "teamA" }]
const auto1 = restartCurrentSet(autoMtb)
assert.equal(auto1.score.currentSet.isTiebreak, true, "deciding set of a match-tiebreak format restarts as a tiebreak")

let autoNormal = createMatch({ sets: 3, finalSetFinish: "standard-7" })
autoNormal.score.sets = [{ teamA: 6, teamB: 4, winner: "teamA" }]
const auto2 = restartCurrentSet(autoNormal)
assert.equal(auto2.score.currentSet.isTiebreak, false, "a non-deciding set restarts as a normal set")

console.log("tiebreak <-> full set conversion checks passed")

// ─── Task 7: backfill old matches ─────────────────────────────────────────────

// An old match missing rule metadata gets safe defaults.
const oldMatch: any = { settings: { scoringSystem: "no-ad", sets: 3 }, score: { sets: [], currentSet: {} } }
backfillRuleMetadata(oldMatch)
assert.equal(oldMatch.ruleRevision, 0, "ruleRevision is backfilled")
assert.equal(oldMatch.revision, 0, "revision is backfilled")
assert.equal(oldMatch.settings.goldenPointFormat, "first-deuce", "no-ad backfills first-deuce golden point")
assert.equal(oldMatch.settings.finalSetFinish, "standard-7", "finalSetFinish is backfilled")
assert.equal(oldMatch.settings.tiebreakAt, "6-6", "tiebreakAt is backfilled")

// Existing values are never overwritten.
const customMatch: any = {
  ruleRevision: 5,
  settings: { scoringSystem: "classic", goldenPointFormat: "third-deuce", finalSetFinish: "match-tiebreak-10" },
}
backfillRuleMetadata(customMatch)
assert.equal(customMatch.ruleRevision, 5, "existing ruleRevision is preserved")
assert.equal(customMatch.settings.goldenPointFormat, "third-deuce", "existing goldenPointFormat is preserved")
assert.equal(customMatch.settings.finalSetFinish, "match-tiebreak-10", "existing finalSetFinish is preserved")

// Backfill is idempotent.
const snapshotBefore = JSON.stringify(oldMatch)
backfillRuleMetadata(oldMatch)
assert.equal(JSON.stringify(oldMatch), snapshotBefore, "backfill is idempotent")

console.log("old-match backfill checks passed")

// ─── plan__1 fixes: B1 / A2 / A3 / B3 regressions ─────────────────────────────

// B1: a set won with an odd number of games flags a side change but never
// swaps courtSides directly (that double-swapped before the fix).
let oddSet = createMatch({ sets: 3, finalSetTiebreak: false, finalSetFinish: "standard-7" })
oddSet.score.currentSet.teamA = 5
oddSet.score.currentSet.teamB = 3
oddSet = winCurrentGame(oddSet, "teamA") // 6-3 → 9 games, odd
assert.equal(oddSet.score.sets.length, 1, "B1: the 6-3 set is recorded")
assert.equal(oddSet.shouldChangeSides, true, "B1: odd-game set flags a side change")
assert.deepEqual(
  oddSet.courtSides,
  { teamA: "left", teamB: "right" },
  "B1: winSet must not swap courtSides directly — only the flag drives the swap",
)

// B1: a set won with an even number of games does not flag a side change.
let evenSet = createMatch({ sets: 3, finalSetTiebreak: false, finalSetFinish: "standard-7" })
evenSet.score.currentSet.teamA = 5
evenSet.score.currentSet.teamB = 4
evenSet = winCurrentGame(evenSet, "teamA") // 6-4 → 10 games, even
assert.equal(evenSet.shouldChangeSides, false, "B1: even-game set does not flag a side change")
assert.deepEqual(evenSet.courtSides, { teamA: "left", teamB: "right" }, "B1: courtSides untouched")

// A2: recomputeMatchCompletion re-derives sets-won and the match outcome from
// the completed sets under the current setsToWin.
let recomp = createMatch({ sets: 5, finalSetTiebreak: false, finalSetFinish: "standard-7" })
recomp.score.sets = [
  { teamA: 6, teamB: 4, winner: "teamA" },
  { teamA: 6, teamB: 3, winner: "teamA" },
]
recomp.score.teamA = 99 // deliberately wrong — must be recomputed
recomp.score.teamB = 99
const recompBo5 = recomputeMatchCompletion(recomp)
assert.equal(recompBo5.score.teamA, 2, "A2: sets-won counters are recomputed from sets")
assert.equal(recompBo5.score.teamB, 0)
assert.equal(recompBo5.isCompleted, false, "A2: 2 sets is not enough for best-of-5")
recomp.settings.sets = 3
const recompBo3 = recomputeMatchCompletion(recomp)
assert.equal(recompBo3.isCompleted, true, "A2: 2 sets wins a best-of-3 after the rule change")
assert.equal(recompBo3.winner, "teamA")

// A3: a sets change that decides the match must not apply silently.
let a3Match = createMatch({ sets: 3, finalSetTiebreak: false, finalSetFinish: "standard-7" })
a3Match.score.sets = [
  { teamA: 6, teamB: 4, winner: "teamA" },
  { teamA: 6, teamB: 3, winner: "teamA" },
]
const decideClass = classifyRuleChange(
  { ...a3Match.settings },
  { ...a3Match.settings, sets: 2 },
  a3Match.score,
)
assert.equal(decideClass.scope, "current-set", "A3: a sets change that decides the match needs confirmation")

// B3: getSetTargets honours per-set game overrides.
const targetsMatch = createMatch({ sets: 3, gamesPerSet: 6, gamesPerSetOverrides: { 0: 4 } })
assert.equal(getSetTargets(targetsMatch).gamesNeededToWin, 4, "B3: per-set override applies to the current set")
const targetsDefault = createMatch({ sets: 3, gamesPerSet: 6, gamesPerSetOverrides: {} })
assert.equal(getSetTargets(targetsDefault).gamesNeededToWin, 6, "B3: default games used without an override")

console.log("plan__1 fixes (B1/A2/A3/B3) checks passed")

console.log("scoring-logic regression checks passed")
