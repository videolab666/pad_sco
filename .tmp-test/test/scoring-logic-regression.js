"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const match_format_rules_1 = require("../lib/match-format-rules");
const scoring_logic_1 = require("../lib/scoring-logic");
const match_rule_change_1 = require("../lib/match-rule-change");
const match_metadata_1 = require("../lib/match-metadata");
strict_1.default.equal((0, match_format_rules_1.getDefaultFinalSetTiebreakForSelection)("2"), true);
strict_1.default.equal((0, match_format_rules_1.getDefaultFinalSetTiebreakForSelection)("4"), true);
strict_1.default.equal((0, match_format_rules_1.getDefaultFinalSetTiebreakForSelection)("3"), false);
strict_1.default.equal((0, match_format_rules_1.getDefaultFinalSetTiebreakForSelection)("super"), false);
strict_1.default.equal((0, match_format_rules_1.getDefaultGoldenPointForScoringSystem)("no-ad"), "first-deuce");
strict_1.default.equal((0, match_format_rules_1.getDefaultGoldenPointForScoringSystem)("classic"), "none");
strict_1.default.equal((0, match_format_rules_1.getDefaultGoldenPointForScoringSystem)("fast4"), "none");
function createMatch(settingsOverrides = {}) {
    const match = {
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
            team: "teamA",
            playerIndex: 0,
        },
        courtSides: {
            teamA: "left",
            teamB: "right",
        },
        shouldChangeSides: false,
        history: [],
    };
    return match;
}
function createTwoSetsPlusTiebreakMatch() {
    return createMatch();
}
function winCurrentGame(match, team) {
    const otherTeam = team === "teamA" ? "teamB" : "teamA";
    match.score.currentSet.currentGame[team] = 40;
    match.score.currentSet.currentGame[otherTeam] = 0;
    return (0, scoring_logic_1.applyScoreIncrement)(match, team);
}
let match = createTwoSetsPlusTiebreakMatch();
match.score.currentSet.teamA = 5;
match.score.currentSet.teamB = 4;
match = winCurrentGame(match, "teamA");
strict_1.default.equal(match.score.teamA, 1);
strict_1.default.equal(match.score.teamB, 0);
strict_1.default.equal(match.score.sets.length, 1);
strict_1.default.equal(match.score.currentSet.isTiebreak, false, "2 + tiebreak must not start match tiebreak after only one set");
strict_1.default.equal(match.isCompleted, false);
match.score.currentSet.teamA = 3;
match.score.currentSet.teamB = 5;
match = winCurrentGame(match, "teamB");
strict_1.default.equal(match.score.teamA, 1);
strict_1.default.equal(match.score.teamB, 1);
strict_1.default.equal(match.score.sets.length, 2);
strict_1.default.equal(match.score.currentSet.isTiebreak, true, "2 + tiebreak must start match tiebreak only after split sets");
strict_1.default.equal(match.score.currentSet.isSuperTiebreak, true);
strict_1.default.equal(match.isCompleted, false);
match.score.currentSet.currentGame.teamA = 0;
match.score.currentSet.currentGame.teamB = 9;
match = (0, scoring_logic_1.applyScoreIncrement)(match, "teamB");
strict_1.default.equal(match.isCompleted, true);
strict_1.default.equal(match.winner, "teamB");
strict_1.default.equal(match.score.teamA, 1);
strict_1.default.equal(match.score.teamB, 2);
let goldenPointMatch = createMatch({
    sets: 3,
    finalSetTiebreak: false,
    finalSetFinish: "standard-7",
    goldenPointFormat: "first-deuce",
});
goldenPointMatch.score.currentSet.currentGame = { teamA: 40, teamB: 40 };
goldenPointMatch = (0, scoring_logic_1.applyScoreIncrement)(goldenPointMatch, "teamA");
strict_1.default.equal(goldenPointMatch.score.currentSet.teamA, 1, "first-deuce Golden Point should win the game at 40-40");
strict_1.default.deepEqual(goldenPointMatch.score.currentSet.currentGame, { teamA: 0, teamB: 0 });
let secondDeuceMatch = createMatch({
    sets: 3,
    finalSetTiebreak: false,
    finalSetFinish: "standard-7",
    goldenPointFormat: "second-deuce",
});
secondDeuceMatch.score.currentSet.currentGame = { teamA: 40, teamB: 40 };
secondDeuceMatch = (0, scoring_logic_1.applyScoreIncrement)(secondDeuceMatch, "teamA");
strict_1.default.equal(secondDeuceMatch.score.currentSet.currentGame.teamA, "Ad");
secondDeuceMatch = (0, scoring_logic_1.applyScoreIncrement)(secondDeuceMatch, "teamB");
strict_1.default.equal(secondDeuceMatch.score.currentSet.currentGame.teamA, 40);
strict_1.default.equal(secondDeuceMatch.score.currentSet.currentGame.teamB, 40);
strict_1.default.equal(secondDeuceMatch.score.currentSet.currentGame.deuceCount, 1);
secondDeuceMatch = (0, scoring_logic_1.applyScoreIncrement)(secondDeuceMatch, "teamA");
strict_1.default.equal(secondDeuceMatch.score.currentSet.teamA, 1, "second-deuce Golden Point should win the game on the second deuce");
let suddenDeathMatch = createMatch({
    sets: 3,
    finalSetTiebreak: false,
    finalSetFinish: "standard-7",
    tiebreakFormat: "sudden-death",
});
suddenDeathMatch.score.currentSet.isTiebreak = true;
suddenDeathMatch.score.currentSet.currentGame = { teamA: 6, teamB: 6 };
suddenDeathMatch = (0, scoring_logic_1.applyScoreIncrement)(suddenDeathMatch, "teamA");
strict_1.default.equal(suddenDeathMatch.score.teamA, 1, "sudden-death tiebreak should finish at 7-6");
let twoClearMatch = createMatch({
    sets: 3,
    finalSetTiebreak: false,
    finalSetFinish: "standard-7",
    tiebreakFormat: "two-clear",
});
twoClearMatch.score.currentSet.isTiebreak = true;
twoClearMatch.score.currentSet.currentGame = { teamA: 6, teamB: 6 };
twoClearMatch = (0, scoring_logic_1.applyScoreIncrement)(twoClearMatch, "teamA");
strict_1.default.equal(twoClearMatch.score.teamA, 0, "two-clear tiebreak should not finish at 7-6");
strict_1.default.equal(twoClearMatch.score.currentSet.isTiebreak, true);
let noTiebreakFinalSetMatch = createMatch({
    sets: 3,
    finalSetTiebreak: true,
    finalSetFinish: "no-tiebreak",
});
noTiebreakFinalSetMatch.score.sets = [
    { teamA: 6, teamB: 4, winner: "teamA" },
    { teamA: 4, teamB: 6, winner: "teamB" },
];
noTiebreakFinalSetMatch.score.teamA = 1;
noTiebreakFinalSetMatch.score.teamB = 1;
noTiebreakFinalSetMatch.score.currentSet.teamA = 5;
noTiebreakFinalSetMatch.score.currentSet.teamB = 6;
noTiebreakFinalSetMatch = winCurrentGame(noTiebreakFinalSetMatch, "teamA");
strict_1.default.equal(noTiebreakFinalSetMatch.score.currentSet.teamA, 6);
strict_1.default.equal(noTiebreakFinalSetMatch.score.currentSet.teamB, 6);
strict_1.default.equal(noTiebreakFinalSetMatch.score.currentSet.isTiebreak, false, "no-tiebreak final set must keep playing at 6-6");
noTiebreakFinalSetMatch.score.currentSet.teamA = 7;
noTiebreakFinalSetMatch.score.currentSet.teamB = 6;
noTiebreakFinalSetMatch = winCurrentGame(noTiebreakFinalSetMatch, "teamA");
strict_1.default.equal(noTiebreakFinalSetMatch.isCompleted, true);
strict_1.default.equal(noTiebreakFinalSetMatch.score.currentSet.teamA, 8);
let gamesTo12Match = createMatch({
    sets: 3,
    finalSetTiebreak: true,
    finalSetFinish: "games-to-12-10",
});
gamesTo12Match.score.sets = [
    { teamA: 6, teamB: 4, winner: "teamA" },
    { teamA: 4, teamB: 6, winner: "teamB" },
];
gamesTo12Match.score.teamA = 1;
gamesTo12Match.score.teamB = 1;
gamesTo12Match.score.currentSet.teamA = 11;
gamesTo12Match.score.currentSet.teamB = 11;
gamesTo12Match = winCurrentGame(gamesTo12Match, "teamA");
strict_1.default.equal(gamesTo12Match.score.currentSet.teamA, 12);
strict_1.default.equal(gamesTo12Match.score.currentSet.teamB, 11);
strict_1.default.equal(gamesTo12Match.score.currentSet.isTiebreak, false);
gamesTo12Match = winCurrentGame(gamesTo12Match, "teamB");
strict_1.default.equal(gamesTo12Match.score.currentSet.teamA, 12);
strict_1.default.equal(gamesTo12Match.score.currentSet.teamB, 12);
strict_1.default.equal(gamesTo12Match.score.currentSet.isTiebreak, true, "games-to-12 final set should start tiebreak at 12-12");
strict_1.default.equal(gamesTo12Match.score.currentSet.isSuperTiebreak, true);
// ─── Task 1: rule-change model regressions ────────────────────────────────────
// 1. no-ad -> classic clears the `first-deuce` Golden Point.
const noAdToClassic = (0, match_rule_change_1.reconcileSettingsForScoringSystem)({ scoringSystem: "no-ad", goldenPointFormat: "first-deuce" }, { scoringSystem: "classic", goldenPointFormat: "first-deuce" });
strict_1.default.equal(noAdToClassic.goldenPointFormat, "none", "no-ad -> classic must reset first-deuce to none");
// classic -> no-ad defaults Golden Point to first-deuce.
const classicToNoAd = (0, match_rule_change_1.reconcileSettingsForScoringSystem)({ scoringSystem: "classic", goldenPointFormat: "none" }, { scoringSystem: "no-ad", goldenPointFormat: "none" });
strict_1.default.equal(classicToNoAd.goldenPointFormat, "first-deuce", "classic -> no-ad must default Golden Point");
// 2. classic -> no-ad must not leave a live `Ad` behind.
let adMatch = createMatch({ scoringSystem: "classic" });
adMatch.score.currentSet.currentGame = { teamA: "Ad", teamB: 40, deuceCount: 1 };
adMatch.settings.scoringSystem = "no-ad";
const normalizedAd = (0, match_rule_change_1.normalizeMatchAfterRuleChange)(adMatch);
strict_1.default.notEqual(normalizedAd.score.currentSet.currentGame.teamA, "Ad", "no-ad must clear a live Ad");
strict_1.default.notEqual(normalizedAd.score.currentSet.currentGame.teamB, "Ad");
strict_1.default.equal(normalizedAd.score.currentSet.currentGame.teamA, 40);
strict_1.default.equal(normalizedAd.score.currentSet.currentGame.teamB, 40);
strict_1.default.equal(normalizedAd.score.currentSet.currentGame.deuceCount, undefined, "no-ad drops the deuce counter");
strict_1.default.equal(normalizedAd.ruleRevision, 1, "rule change bumps ruleRevision");
// 3. Changing the final-set mode while a tiebreak is live is restart-required.
let tiebreakMatch = createMatch({ sets: 3, finalSetFinish: "standard-7" });
tiebreakMatch.score.currentSet.isTiebreak = true;
tiebreakMatch.score.currentSet.currentGame = { teamA: 3, teamB: 2 };
const finalSetClass = (0, match_rule_change_1.classifyRuleChange)({ ...tiebreakMatch.settings }, { ...tiebreakMatch.settings, finalSetFinish: "match-tiebreak-10" }, tiebreakMatch.score);
strict_1.default.equal(finalSetClass.scope, "restart-required", "final-set change during a live tiebreak needs a restart");
// 4. Editing `sets` while the deciding set is underway is not safe.
let decidingMatch = createMatch({ sets: 3 });
decidingMatch.score.sets = [
    { teamA: 6, teamB: 4, winner: "teamA" },
    { teamA: 4, teamB: 6, winner: "teamB" },
];
decidingMatch.score.currentSet.teamA = 3;
decidingMatch.score.currentSet.teamB = 2;
const increaseSets = (0, match_rule_change_1.classifyRuleChange)({ ...decidingMatch.settings, sets: 3 }, { ...decidingMatch.settings, sets: 5 }, decidingMatch.score);
strict_1.default.equal(increaseSets.scope, "current-set", "increasing sets during the deciding set affects current play");
const reduceSets = (0, match_rule_change_1.classifyRuleChange)({ ...decidingMatch.settings, sets: 3 }, { ...decidingMatch.settings, sets: 1 }, decidingMatch.score);
strict_1.default.equal(reduceSets.scope, "restart-required", "cutting sets below played sets cannot be lossless");
console.log("rule-change model checks passed");
// ─── Task 4: deterministic scoring after rule edits ───────────────────────────
// no-ad collapses a live Ad and drops the deuce counter.
let noAdNorm = createMatch({ scoringSystem: "no-ad" });
noAdNorm.score.currentSet.currentGame = { teamA: "Ad", teamB: 40, deuceCount: 2 };
noAdNorm = (0, scoring_logic_1.normalizeMatchState)(noAdNorm);
strict_1.default.equal(noAdNorm.score.currentSet.currentGame.teamA, 40, "no-ad must collapse a live Ad to 40-40");
strict_1.default.equal(noAdNorm.score.currentSet.currentGame.teamB, 40);
strict_1.default.equal(noAdNorm.score.currentSet.currentGame.deuceCount, undefined, "no-ad drops deuceCount");
// classic: a dangling Ad (opponent not at 40) is repaired to 40.
let danglingAd = createMatch({ scoringSystem: "classic" });
danglingAd.score.currentSet.currentGame = { teamA: "Ad", teamB: 30 };
danglingAd = (0, scoring_logic_1.normalizeMatchState)(danglingAd);
strict_1.default.equal(danglingAd.score.currentSet.currentGame.teamA, 40, "classic dangling Ad must be repaired to 40");
// a stale deuce counter outside 40-40 is cleared.
let staleDeuce = createMatch({ scoringSystem: "classic" });
staleDeuce.score.currentSet.currentGame = { teamA: 15, teamB: 0, deuceCount: 3 };
staleDeuce = (0, scoring_logic_1.normalizeMatchState)(staleDeuce);
strict_1.default.equal(staleDeuce.score.currentSet.currentGame.deuceCount, 0, "deuceCount is meaningless outside 40-40");
// live tiebreak points are coerced to non-negative integers.
let tbNorm = createMatch();
tbNorm.score.currentSet.isTiebreak = true;
tbNorm.score.currentSet.currentGame = { teamA: -2, teamB: 3 };
tbNorm = (0, scoring_logic_1.normalizeMatchState)(tbNorm);
strict_1.default.equal(tbNorm.score.currentSet.currentGame.teamA, 0, "negative tiebreak points are clamped");
strict_1.default.equal(tbNorm.score.currentSet.currentGame.teamB, 3);
// a super tiebreak that lost its tiebreak flag is repaired.
let superTb = createMatch();
superTb.score.currentSet.isTiebreak = false;
superTb.score.currentSet.isSuperTiebreak = true;
superTb = (0, scoring_logic_1.normalizeMatchState)(superTb);
strict_1.default.equal(superTb.score.currentSet.isTiebreak, true, "a super tiebreak is always a tiebreak");
console.log("post-rule-change normalization checks passed");
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
        currentServer: { team: "teamA", playerIndex: 1 },
        courtSides: { teamA: "left", teamB: "right" },
        isCompleted: false,
        winner: null,
        history: [{ marker: 1 }],
    };
}
// A roster / court / round edit must leave the score branch byte-identical.
const scoreBefore = JSON.stringify(metaMatch().score);
const edited = (0, match_metadata_1.applyMetadataEdit)(metaMatch(), {
    teamA: { players: [{ id: "a1", name: "Renamed" }, { id: "a2", name: "A2" }] },
    courtNumber: 5,
    round: "Final",
});
strict_1.default.equal(JSON.stringify(edited.score), scoreBefore, "metadata edit must not touch the score");
strict_1.default.equal(edited.teamA.players[0].name, "Renamed", "roster edit applies");
strict_1.default.equal(edited.courtNumber, 5, "court edit applies");
strict_1.default.equal(edited.round, "Final", "round edit applies");
strict_1.default.equal(edited.isCompleted, false, "metadata edit must not touch completion");
// The server pointer clamps to a valid player when the serving team shrinks.
const shrunk = (0, match_metadata_1.applyMetadataEdit)(metaMatch(), { teamA: { players: [{ id: "a1", name: "Solo" }] } });
strict_1.default.equal(shrunk.currentServer.team, "teamA");
strict_1.default.equal(shrunk.currentServer.playerIndex, 0, "server pointer clamps to a valid player");
// The pointer moves to the other team when the serving team is emptied.
const moved = (0, match_metadata_1.applyMetadataEdit)(metaMatch(), { teamA: { players: [] } });
strict_1.default.equal(moved.currentServer.team, "teamB", "server moves to a team that still has players");
// isMetadataOnlyChange correctly separates metadata from score changes.
strict_1.default.equal((0, match_metadata_1.isMetadataOnlyChange)(metaMatch(), (0, match_metadata_1.applyMetadataEdit)(metaMatch(), { courtNumber: 9 })), true, "a court change is metadata-only");
const scoreChanged = metaMatch();
scoreChanged.score.currentSet.currentGame.teamA = "Ad";
strict_1.default.equal((0, match_metadata_1.isMetadataOnlyChange)(metaMatch(), scoreChanged), false, "a score change is not metadata-only");
console.log("metadata-only edit checks passed");
// ─── Task 6: match tiebreak <-> full set conversion ───────────────────────────
// A live match tiebreak switched to a full set — points are dropped, not
// reinterpreted as game counts; completed sets are preserved.
let mtbToFull = createMatch({ sets: 3, finalSetFinish: "standard-7" });
mtbToFull.score.sets = [
    { teamA: 6, teamB: 4, winner: "teamA" },
    { teamA: 4, teamB: 6, winner: "teamB" },
];
mtbToFull.score.currentSet = {
    teamA: 0,
    teamB: 0,
    games: [],
    currentGame: { teamA: 5, teamB: 3 },
    isTiebreak: true,
    isSuperTiebreak: true,
};
const asFull = (0, scoring_logic_1.restartCurrentSetAsNormalSet)(mtbToFull);
strict_1.default.equal(asFull.score.currentSet.isTiebreak, false, "match tiebreak -> full set clears the tiebreak flag");
strict_1.default.equal(asFull.score.currentSet.currentGame.teamA, 0, "match-tiebreak points are dropped, never converted");
strict_1.default.equal(asFull.score.sets.length, 2, "completed sets preserved on conversion");
// A live full set switched to a match tiebreak — game scores are dropped.
let fullToMtb = createMatch({ sets: 3 });
fullToMtb.score.sets = [
    { teamA: 6, teamB: 4, winner: "teamA" },
    { teamA: 4, teamB: 6, winner: "teamB" },
];
fullToMtb.score.currentSet.teamA = 3;
fullToMtb.score.currentSet.teamB = 2;
const asMtb = (0, scoring_logic_1.restartCurrentSetAsMatchTiebreak)(fullToMtb);
strict_1.default.equal(asMtb.score.currentSet.isTiebreak, true, "full set -> match tiebreak sets the tiebreak flag");
strict_1.default.equal(asMtb.score.currentSet.isSuperTiebreak, true);
strict_1.default.equal(asMtb.score.currentSet.teamA, 0, "game scores are dropped on conversion");
strict_1.default.equal(asMtb.score.sets.length, 2, "completed sets preserved on conversion");
// restartCurrentSet auto-detects the format of the deciding set.
let autoMtb = createMatch(); // sets: 2, finalSetFinish: match-tiebreak-10
autoMtb.score.sets = [{ teamA: 6, teamB: 4, winner: "teamA" }];
const auto1 = (0, scoring_logic_1.restartCurrentSet)(autoMtb);
strict_1.default.equal(auto1.score.currentSet.isTiebreak, true, "deciding set of a match-tiebreak format restarts as a tiebreak");
let autoNormal = createMatch({ sets: 3, finalSetFinish: "standard-7" });
autoNormal.score.sets = [{ teamA: 6, teamB: 4, winner: "teamA" }];
const auto2 = (0, scoring_logic_1.restartCurrentSet)(autoNormal);
strict_1.default.equal(auto2.score.currentSet.isTiebreak, false, "a non-deciding set restarts as a normal set");
console.log("tiebreak <-> full set conversion checks passed");
// ─── Task 7: backfill old matches ─────────────────────────────────────────────
// An old match missing rule metadata gets safe defaults.
const oldMatch = { settings: { scoringSystem: "no-ad", sets: 3 }, score: { sets: [], currentSet: {} } };
(0, match_rule_change_1.backfillRuleMetadata)(oldMatch);
strict_1.default.equal(oldMatch.ruleRevision, 0, "ruleRevision is backfilled");
strict_1.default.equal(oldMatch.revision, 0, "revision is backfilled");
strict_1.default.equal(oldMatch.settings.goldenPointFormat, "first-deuce", "no-ad backfills first-deuce golden point");
strict_1.default.equal(oldMatch.settings.finalSetFinish, "standard-7", "finalSetFinish is backfilled");
strict_1.default.equal(oldMatch.settings.tiebreakAt, "6-6", "tiebreakAt is backfilled");
// Existing values are never overwritten.
const customMatch = {
    ruleRevision: 5,
    settings: { scoringSystem: "classic", goldenPointFormat: "third-deuce", finalSetFinish: "match-tiebreak-10" },
};
(0, match_rule_change_1.backfillRuleMetadata)(customMatch);
strict_1.default.equal(customMatch.ruleRevision, 5, "existing ruleRevision is preserved");
strict_1.default.equal(customMatch.settings.goldenPointFormat, "third-deuce", "existing goldenPointFormat is preserved");
strict_1.default.equal(customMatch.settings.finalSetFinish, "match-tiebreak-10", "existing finalSetFinish is preserved");
// Backfill is idempotent.
const snapshotBefore = JSON.stringify(oldMatch);
(0, match_rule_change_1.backfillRuleMetadata)(oldMatch);
strict_1.default.equal(JSON.stringify(oldMatch), snapshotBefore, "backfill is idempotent");
console.log("old-match backfill checks passed");
console.log("scoring-logic regression checks passed");
