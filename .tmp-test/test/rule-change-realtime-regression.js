"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Dedicated rule-change regression suite (Task 8).
//
// Deterministic coverage for live rule edits: scoring-system switches, golden
// point, tiebreak thresholds, final-set mode, set-count changes mid-match and
// match-tiebreak <-> full-set conversion. The realtime sync side is covered by
// test/match-sync-regression.ts.
const strict_1 = __importDefault(require("node:assert/strict"));
const match_rule_change_1 = require("../lib/match-rule-change");
const scoring_logic_1 = require("../lib/scoring-logic");
function mkMatch(settings = {}, current = {}) {
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
            sets: [],
            currentSet: {
                teamA: 0,
                teamB: 0,
                games: [],
                currentGame: { teamA: 0, teamB: 0 },
                isTiebreak: false,
                ...current,
            },
        },
        currentServer: { team: "teamA", playerIndex: 0 },
        courtSides: { teamA: "left", teamB: "right" },
    };
}
const scopeOf = (m, patch) => (0, match_rule_change_1.classifyRuleChange)(m.settings, { ...m.settings, ...patch }, m.score).scope;
// 1. no-ad -> classic clears the first-deuce Golden Point.
strict_1.default.equal((0, match_rule_change_1.reconcileSettingsForScoringSystem)({ scoringSystem: "no-ad", goldenPointFormat: "first-deuce" }, { scoringSystem: "classic", goldenPointFormat: "first-deuce" }).goldenPointFormat, "none");
// 2. classic -> no-ad: defaults Golden Point and collapses a live Ad.
strict_1.default.equal((0, match_rule_change_1.reconcileSettingsForScoringSystem)({ scoringSystem: "classic", goldenPointFormat: "none" }, { scoringSystem: "no-ad", goldenPointFormat: "none" }).goldenPointFormat, "first-deuce");
const adGame = (0, scoring_logic_1.normalizeMatchState)(mkMatch({ scoringSystem: "no-ad" }, { currentGame: { teamA: "Ad", teamB: 40 } }));
strict_1.default.notEqual(adGame.score.currentSet.currentGame.teamA, "Ad", "no-ad collapses a live Ad");
// 3. fast4 -> classic: safe in a simple game, gated at 40-40.
strict_1.default.equal(scopeOf(mkMatch({ scoringSystem: "fast4" }, { currentGame: { teamA: 15, teamB: 0 } }), { scoringSystem: "classic" }), "safe");
strict_1.default.equal(scopeOf(mkMatch({ scoringSystem: "fast4" }, { currentGame: { teamA: 40, teamB: 40 } }), { scoringSystem: "classic" }), "current-set");
// 4. goldenPointFormat: gated at deuce, safe otherwise.
strict_1.default.equal(scopeOf(mkMatch({}, { currentGame: { teamA: 40, teamB: 40 } }), { goldenPointFormat: "first-deuce" }), "current-set");
strict_1.default.equal(scopeOf(mkMatch({}, { currentGame: { teamA: 15, teamB: 0 } }), { goldenPointFormat: "first-deuce" }), "safe");
// 5. tiebreak threshold: gated near the threshold, safe far from it.
strict_1.default.equal(scopeOf(mkMatch({}, { teamA: 5, teamB: 5 }), { tiebreakAt: "4-4" }), "current-set");
strict_1.default.equal(scopeOf(mkMatch({}, { teamA: 1, teamB: 0 }), { tiebreakAt: "4-4" }), "safe");
// 6. finalSetFinish change while the deciding set is underway.
const decidingMatch = mkMatch({ sets: 3 }, { teamA: 3, teamB: 2 });
decidingMatch.score.sets = [{ winner: "teamA" }, { winner: "teamB" }];
strict_1.default.equal(scopeOf(decidingMatch, { finalSetFinish: "match-tiebreak-10" }), "current-set");
// 7. sets count: future-only before the decider, restart-required below played sets.
const earlyMatch = mkMatch({ sets: 3 }, { teamA: 1, teamB: 0 });
earlyMatch.score.sets = [{ winner: "teamA" }];
strict_1.default.equal(scopeOf(earlyMatch, { sets: 5 }), "future-only");
const playedMatch = mkMatch({ sets: 3 });
playedMatch.score.sets = [{ winner: "teamA" }, { winner: "teamB" }];
strict_1.default.equal(scopeOf(playedMatch, { sets: 1 }), "restart-required");
// 8. match-tiebreak <-> full-set conversion preserves completed sets.
const tbMatch = mkMatch({}, { isTiebreak: true, isSuperTiebreak: true, currentGame: { teamA: 5, teamB: 3 } });
tbMatch.score.sets = [{ winner: "teamA" }];
const toFull = (0, scoring_logic_1.restartCurrentSetAsNormalSet)(tbMatch);
strict_1.default.equal(toFull.score.currentSet.isTiebreak, false);
strict_1.default.equal(toFull.score.currentSet.currentGame.teamA, 0, "tiebreak points are dropped, not converted");
strict_1.default.equal(toFull.score.sets.length, 1, "completed sets preserved");
const fullMatch = mkMatch({ sets: 3 }, { teamA: 3, teamB: 2 });
fullMatch.score.sets = [{ winner: "teamA" }, { winner: "teamB" }];
const toTb = (0, scoring_logic_1.restartCurrentSetAsMatchTiebreak)(fullMatch);
strict_1.default.equal(toTb.score.currentSet.isTiebreak, true);
strict_1.default.equal(toTb.score.currentSet.isSuperTiebreak, true);
strict_1.default.equal(toTb.score.currentSet.teamA, 0, "game scores are dropped");
strict_1.default.equal(toTb.score.sets.length, 2, "completed sets preserved");
// A normalized rule change stamps the rule-change metadata.
const stamped = (0, match_rule_change_1.normalizeMatchAfterRuleChange)(mkMatch(), {
    scope: "current-set",
    reason: "test",
    changedKeys: ["scoringSystem"],
});
strict_1.default.equal(stamped.ruleRevision, 1);
strict_1.default.equal(stamped.ruleChangeScope, "current-set");
console.log("rule-change realtime regression checks passed");
