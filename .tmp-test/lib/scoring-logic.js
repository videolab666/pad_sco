"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyScoreIncrement = applyScoreIncrement;
exports.getPointIndex = getPointIndex;
exports.getTiebreakPointsToWin = getTiebreakPointsToWin;
exports.isGamePoint = isGamePoint;
exports.isSetPoint = isSetPoint;
exports.isMatchPoint = isMatchPoint;
exports.normalizeCurrentGame = normalizeCurrentGame;
exports.normalizeCurrentSet = normalizeCurrentSet;
exports.normalizeMatchState = normalizeMatchState;
exports.restartCurrentSetAsNormalSet = restartCurrentSetAsNormalSet;
exports.restartCurrentSetAsMatchTiebreak = restartCurrentSetAsMatchTiebreak;
exports.restartCurrentSet = restartCurrentSet;
exports.getImportantPoint = getImportantPoint;
const match_format_rules_1 = require("./match-format-rules");
const match_rule_change_1 = require("./match-rule-change");
/**
 * Applies a score increment for the specified team, respecting all match settings and rules.
 * Creates a deep copy and returns a new match object with updated state.
 *
 * @param match - The match object
 * @param team - 'teamA' or 'teamB'
 * @returns Updated match object
 */
function applyScoreIncrement(match, team) {
    if (!match || match.isCompleted)
        return match;
    const updatedMatch = JSON.parse(JSON.stringify(match));
    const otherTeam = team === "teamA" ? "teamB" : "teamA";
    const currentSet = updatedMatch.score.currentSet;
    if (!currentSet)
        return updatedMatch;
    // --- Tiebreak logic ---
    if (currentSet.isTiebreak) {
        if (typeof currentSet.currentGame[team] !== "number")
            currentSet.currentGame[team] = 0;
        currentSet.currentGame[team]++;
        let pointsToWin = 7;
        if (currentSet.isSuperTiebreak) {
            pointsToWin = (0, match_format_rules_1.getFinalSetTiebreakLength)(updatedMatch.settings);
        }
        else {
            pointsToWin = updatedMatch.settings.tiebreakLength || 7;
        }
        // Check for tiebreak win
        if (currentSet.currentGame[team] >= pointsToWin &&
            currentSet.currentGame[team] - currentSet.currentGame[otherTeam] >=
                getTiebreakWinMargin(updatedMatch.settings)) {
            currentSet.tiebreak = {
                teamA: currentSet.currentGame.teamA,
                teamB: currentSet.currentGame.teamB,
            };
            currentSet[team]++;
            return winSet(team, updatedMatch);
        }
        // Switch server every 2 points (except first)
        const totalPoints = currentSet.currentGame.teamA + currentSet.currentGame.teamB;
        if (totalPoints % 2 === 1) {
            switchServer(updatedMatch);
        }
        // Change sides every 6 points
        if (totalPoints > 0 && totalPoints % 6 === 0) {
            updatedMatch.shouldChangeSides = true;
        }
        return updatedMatch;
    }
    // --- Regular game logic ---
    const currentGame = currentSet.currentGame;
    const scoringSystem = updatedMatch.settings.scoringSystem || "classic";
    if (scoringSystem === "classic") {
        if (currentGame[team] === 0) {
            currentGame[team] = 15;
        }
        else if (currentGame[team] === 15) {
            currentGame[team] = 30;
        }
        else if (currentGame[team] === 30) {
            currentGame[team] = 40;
        }
        else if (currentGame[team] === 40) {
            if (typeof currentGame[otherTeam] === "number" && currentGame[otherTeam] < 40) {
                return winGame(team, updatedMatch);
            }
            else if (currentGame[otherTeam] === 40) {
                if (isGoldenPointActive(updatedMatch.settings, currentGame.deuceCount || 0)) {
                    return winGame(team, updatedMatch);
                }
                currentGame[team] = "Ad";
            }
            else if (currentGame[otherTeam] === "Ad") {
                currentGame[team] = 40;
                currentGame[otherTeam] = 40;
                currentGame.deuceCount = (currentGame.deuceCount || 0) + 1;
            }
        }
        else if (currentGame[team] === "Ad") {
            return winGame(team, updatedMatch);
        }
    }
    else if (scoringSystem === "no-ad" || scoringSystem === "fast4") {
        if (currentGame[team] === 0) {
            currentGame[team] = 15;
        }
        else if (currentGame[team] === 15) {
            currentGame[team] = 30;
        }
        else if (currentGame[team] === 30) {
            currentGame[team] = 40;
        }
        else if (currentGame[team] === 40) {
            return winGame(team, updatedMatch);
        }
    }
    return updatedMatch;
}
function winGame(team, updatedMatch) {
    const otherTeam = team === "teamA" ? "teamB" : "teamA";
    const currentSet = updatedMatch.score.currentSet;
    currentSet[team]++;
    currentSet.games.push({ winner: team });
    currentSet.currentGame = { teamA: 0, teamB: 0 };
    // Switch server
    if (!updatedMatch.settings.windbreak) {
        switchServer(updatedMatch);
    }
    else {
        const totalGamesAfterReset = currentSet.teamA + currentSet.teamB;
        if (totalGamesAfterReset % 2 === 1) {
            switchServer(updatedMatch);
        }
    }
    // Change sides after odd number of games
    const totalGames = currentSet.teamA + currentSet.teamB;
    if (totalGames % 2 === 1) {
        updatedMatch.shouldChangeSides = true;
    }
    // Handle Super Set rules
    if (updatedMatch.settings.isSuperSet) {
        const teamAScore = currentSet.teamA;
        const teamBScore = currentSet.teamB;
        if (teamAScore === 8 && teamBScore === 8) {
            currentSet.isTiebreak = true;
            return updatedMatch;
        }
        if ((teamAScore >= 8 && teamAScore - teamBScore >= 2) ||
            (teamBScore >= 8 && teamBScore - teamAScore >= 2) ||
            (teamAScore === 9 && teamBScore <= 7) ||
            (teamBScore === 9 && teamAScore <= 7)) {
            return winSet(team, updatedMatch);
        }
        return updatedMatch;
    }
    // Fast4 / classic
    const scoringSystem = updatedMatch.settings.scoringSystem || "classic";
    const defaultGames = updatedMatch.settings.gamesPerSet || (scoringSystem === "fast4" ? 4 : 6);
    const currentSetIndex = updatedMatch.score.sets.length;
    const isDecidingSet = updatedMatch.score.sets.length + 1 === updatedMatch.settings.sets;
    const finalSetGoesTo12 = isDecidingSet && (0, match_format_rules_1.isFinalSetGamesTo12)(updatedMatch.settings);
    const gamesNeededToWin = finalSetGoesTo12
        ? 12
        : updatedMatch.settings.gamesPerSetOverrides?.[currentSetIndex] || defaultGames;
    const regularTiebreakAt = Number.parseInt(updatedMatch.settings.tiebreakAt?.split("-")[0] || "6");
    const tiebreakAt = finalSetGoesTo12 ? 12 : regularTiebreakAt;
    const useFinalSetGameTiebreak = isDecidingSet && (0, match_format_rules_1.usesFinalSetGameTiebreak)(updatedMatch.settings);
    if (useFinalSetGameTiebreak) {
        if (currentSet.teamA === tiebreakAt && currentSet.teamB === tiebreakAt) {
            currentSet.isTiebreak = true;
            currentSet.isSuperTiebreak = true;
            return updatedMatch;
        }
    }
    else if (updatedMatch.settings.tiebreakEnabled &&
        !(isDecidingSet && (0, match_format_rules_1.isFinalSetNoTiebreak)(updatedMatch.settings)) &&
        currentSet.teamA === tiebreakAt &&
        currentSet.teamB === tiebreakAt) {
        currentSet.isTiebreak = true;
        return updatedMatch;
    }
    // Golden game — works with any gamesNeededToWin
    if (updatedMatch.settings.goldenGame) {
        const goldenAt = gamesNeededToWin - 1;
        if ((currentSet.teamA === goldenAt + 1 && currentSet.teamB === goldenAt) ||
            (currentSet.teamA === goldenAt && currentSet.teamB === goldenAt + 1)) {
            const setWinner = currentSet.teamA > currentSet.teamB ? "teamA" : "teamB";
            return winSet(setWinner, updatedMatch);
        }
    }
    // Set win
    if (currentSet.teamA >= gamesNeededToWin && currentSet.teamA - currentSet.teamB >= 2) {
        return winSet("teamA", updatedMatch);
    }
    else if (currentSet.teamB >= gamesNeededToWin && currentSet.teamB - currentSet.teamA >= 2) {
        return winSet("teamB", updatedMatch);
    }
    // Fast4 set win (with 1 game difference)
    if (scoringSystem === "fast4") {
        if (currentSet.teamA >= gamesNeededToWin && currentSet.teamA - currentSet.teamB >= 1) {
            return winSet("teamA", updatedMatch);
        }
        else if (currentSet.teamB >= gamesNeededToWin && currentSet.teamB - currentSet.teamA >= 1) {
            return winSet("teamB", updatedMatch);
        }
    }
    return updatedMatch;
}
function winSet(team, updatedMatch) {
    updatedMatch.score[team]++;
    const setToSave = {
        teamA: updatedMatch.score.currentSet.teamA,
        teamB: updatedMatch.score.currentSet.teamB,
        winner: team,
    };
    if (updatedMatch.score.currentSet.isTiebreak) {
        setToSave.tiebreak = {
            teamA: updatedMatch.score.currentSet.currentGame.teamA,
            teamB: updatedMatch.score.currentSet.currentGame.teamB,
        };
    }
    updatedMatch.score.sets.push(setToSave);
    const setsToWin = (0, match_format_rules_1.getSetsToWin)(updatedMatch.settings);
    if (updatedMatch.score[team] >= setsToWin) {
        updatedMatch.isCompleted = true;
        updatedMatch.winner = team;
        return updatedMatch;
    }
    if ((0, match_format_rules_1.shouldStartMatchTiebreakAfterSet)(updatedMatch.settings, updatedMatch.score)) {
        updatedMatch.score.currentSet = {
            teamA: 0,
            teamB: 0,
            games: [],
            currentGame: { teamA: 0, teamB: 0 },
            isTiebreak: true,
            isSuperTiebreak: true,
        };
    }
    else {
        updatedMatch.score.currentSet = {
            teamA: 0,
            teamB: 0,
            games: [],
            currentGame: { teamA: 0, teamB: 0 },
            isTiebreak: false,
        };
    }
    if (updatedMatch.score.sets.length % 2 === 1) {
        updatedMatch.courtSides = {
            teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
            teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
        };
    }
    return updatedMatch;
}
function getTiebreakWinMargin(settings) {
    return settings.tiebreakFormat === "sudden-death" ? 1 : 2;
}
function isGoldenPointActive(settings, deuceCount) {
    const format = settings.goldenPointFormat || (settings.scoringSystem === "no-ad" ? "first-deuce" : "none");
    const requiredDeuce = format === "first-deuce" ? 0 : format === "second-deuce" ? 1 : format === "third-deuce" ? 2 : Number.POSITIVE_INFINITY;
    return deuceCount >= requiredDeuce;
}
function switchServer(updatedMatch) {
    if (!updatedMatch.currentServer)
        return;
    const currentTeam = updatedMatch.currentServer.team;
    const otherTeam = currentTeam === "teamA" ? "teamB" : "teamA";
    if (updatedMatch.format === "singles") {
        updatedMatch.currentServer.team = otherTeam;
        updatedMatch.currentServer.playerIndex = 0;
    }
    else {
        if (currentTeam === "teamA") {
            updatedMatch.currentServer.team = "teamB";
        }
        else {
            updatedMatch.currentServer.team = "teamA";
            updatedMatch.currentServer.playerIndex = updatedMatch.currentServer.playerIndex === 0 ? 1 : 0;
        }
    }
}
// ─── Exported indicator helpers ───────────────────────────────────────────────
function getPointIndex(point) {
    if (point === "Ad")
        return 4;
    if (point === 0)
        return 0;
    if (point === 15)
        return 1;
    if (point === 30)
        return 2;
    if (point === 40)
        return 3;
    if (typeof point === "number" && point > 40)
        return 4;
    return point;
}
function getTiebreakPointsToWin(match) {
    const currentSet = match?.score?.currentSet;
    if (currentSet?.isSuperTiebreak) {
        return (0, match_format_rules_1.getFinalSetTiebreakLength)(match.settings);
    }
    if (match.settings?.tiebreakLength)
        return match.settings.tiebreakLength;
    return 7;
}
function getTiebreakPointMargin(settings) {
    return settings?.tiebreakFormat === "sudden-death" ? 1 : 2;
}
function isGamePoint(match) {
    const currentSet = match?.score?.currentSet;
    const currentGame = currentSet?.currentGame;
    if (!currentGame)
        return false;
    const scoringSystem = match.settings?.scoringSystem || "classic";
    if (currentSet.isTiebreak) {
        const ptw = getTiebreakPointsToWin(match);
        const margin = getTiebreakPointMargin(match.settings);
        const a = typeof currentGame.teamA === "number" ? currentGame.teamA : 0;
        const b = typeof currentGame.teamB === "number" ? currentGame.teamB : 0;
        const aWins = a + 1 >= ptw && (a + 1) - b >= margin;
        const bWins = b + 1 >= ptw && (b + 1) - a >= margin;
        if (aWins && bWins)
            return "both";
        if (aWins)
            return "teamA";
        if (bWins)
            return "teamB";
        return false;
    }
    const ai = getPointIndex(currentGame.teamA);
    const bi = getPointIndex(currentGame.teamB);
    const deuceCount = currentGame.deuceCount || 0;
    const goldenFormat = match.settings?.goldenPointFormat || (scoringSystem === "no-ad" ? "first-deuce" : "none");
    const goldenDeuce = goldenFormat === "first-deuce" ||
        (goldenFormat === "second-deuce" && deuceCount >= 1) ||
        (goldenFormat === "third-deuce" && deuceCount >= 2);
    if (ai === 3 && bi === 3 && goldenDeuce)
        return "both";
    if (scoringSystem === "no-ad" || scoringSystem === "fast4") {
        if (ai === 3 && bi === 3)
            return "both";
        if (ai === 3)
            return "teamA";
        if (bi === 3)
            return "teamB";
        return false;
    }
    if (ai === 4)
        return "teamA";
    if (bi === 4)
        return "teamB";
    if (ai === 3 && bi <= 2)
        return "teamA";
    if (bi === 3 && ai <= 2)
        return "teamB";
    return false;
}
function isSetPoint(match) {
    const currentSet = match?.score?.currentSet;
    if (!currentSet)
        return false;
    const gp = isGamePoint(match);
    if (!gp)
        return false;
    if (currentSet.isTiebreak)
        return gp;
    const teamAGames = currentSet.teamA;
    const teamBGames = currentSet.teamB;
    const scoringSystem = match.settings?.scoringSystem || "classic";
    const settings = match.settings || {};
    const wouldWinSet = (a, b) => {
        const currentSetNumber = (match.score?.sets?.length ?? 0) + 1;
        const isDecidingSet = currentSetNumber === settings.sets;
        const target = isDecidingSet && (0, match_format_rules_1.isFinalSetGamesTo12)(settings) ? 12 : settings.gamesPerSet || 6;
        if (scoringSystem === "fast4") {
            return a >= 4 && a - b >= 1;
        }
        if (settings.isSuperSet) {
            return (a >= 8 && a - b >= 2) || (a === 9 && b <= 7);
        }
        return a >= target && a - b >= 2;
    };
    if (gp === "both") {
        const aWins = wouldWinSet(teamAGames + 1, teamBGames);
        const bWins = wouldWinSet(teamBGames + 1, teamAGames);
        if (aWins && bWins)
            return "both";
        if (aWins)
            return "teamA";
        if (bWins)
            return "teamB";
        return false;
    }
    if (gp === "teamA" && wouldWinSet(teamAGames + 1, teamBGames))
        return "teamA";
    if (gp === "teamB" && wouldWinSet(teamBGames + 1, teamAGames))
        return "teamB";
    return false;
}
function isMatchPoint(match) {
    const sp = isSetPoint(match);
    if (!sp)
        return false;
    const setsToWin = (0, match_format_rules_1.getSetsToWin)(match.settings);
    const completedSets = match.score?.sets ?? [];
    const teamASets = completedSets.filter((s) => s.winner === "teamA").length;
    const teamBSets = completedSets.filter((s) => s.winner === "teamB").length;
    if (sp === "both") {
        const aMP = teamASets === setsToWin - 1;
        const bMP = teamBSets === setsToWin - 1;
        if (aMP && bMP)
            return "both";
        if (aMP)
            return "teamA";
        if (bMP)
            return "teamB";
        return false;
    }
    if (sp === "teamA" && teamASets === setsToWin - 1)
        return "teamA";
    if (sp === "teamB" && teamBSets === setsToWin - 1)
        return "teamB";
    return false;
}
// ─── Post-rule-change normalization (Task 4) ───────────────────────────────────
//
// The scoring engine is split into point application (applyScoreIncrement) and
// the normalization passes below. After a rule edit or a queued-operation
// replay, the engine cannot assume the in-progress game/set is still valid for
// the new rules — these passes repair it so scoring can continue deterministically.
/** Coerces a tiebreak point cell to a non-negative integer. */
function coerceTiebreakPoint(value) {
    const n = typeof value === "number" ? value : 0;
    return n < 0 ? 0 : Math.floor(n);
}
/**
 * Game normalization — makes the current game valid for the active rules.
 * Handles the `40-40`, `Ad`, `deuceCount` and live tiebreak-point edge cases.
 * Mutates the match in place.
 */
function normalizeCurrentGame(match) {
    const currentSet = match?.score?.currentSet;
    const currentGame = currentSet?.currentGame;
    if (!currentSet || !currentGame)
        return;
    if (currentSet.isTiebreak) {
        currentGame.teamA = coerceTiebreakPoint(currentGame.teamA);
        currentGame.teamB = coerceTiebreakPoint(currentGame.teamB);
        delete currentGame.deuceCount;
        return;
    }
    // Collapse advantage for no-ad / fast4 and clear the deuce counter there.
    (0, match_rule_change_1.normalizeCurrentGameForScoringSystem)(currentGame, match.settings);
    const system = match.settings?.scoringSystem || "classic";
    if (system === "classic") {
        // In classic scoring "Ad" is only valid when the opponent sits at 40.
        if (currentGame.teamA === "Ad" && currentGame.teamB !== 40)
            currentGame.teamA = 40;
        if (currentGame.teamB === "Ad" && currentGame.teamA !== 40)
            currentGame.teamB = 40;
    }
    // The deuce counter is only meaningful at 40-40 / advantage.
    const atDeuce = currentGame.teamA === "Ad" ||
        currentGame.teamB === "Ad" ||
        (currentGame.teamA === 40 && currentGame.teamB === 40);
    if (!atDeuce && currentGame.deuceCount)
        currentGame.deuceCount = 0;
}
/**
 * Set normalization — repairs current-set flags and counters (negative game
 * counts, a super tiebreak that lost its tiebreak flag, an empty tiebreak the
 * format no longer wants). Mutates the match in place.
 */
function normalizeCurrentSet(match) {
    const currentSet = match?.score?.currentSet;
    if (!currentSet)
        return;
    if (currentSet.teamA < 0)
        currentSet.teamA = 0;
    if (currentSet.teamB < 0)
        currentSet.teamB = 0;
    // A super tiebreak is always a tiebreak.
    if (currentSet.isSuperTiebreak)
        currentSet.isTiebreak = true;
    (0, match_rule_change_1.normalizeCurrentSetForFinalSet)(currentSet, match.settings);
}
/**
 * Post-change normalization — the entry point used after a rule edit or a
 * queued-operation replay. Deep-clones the match, repairs the current game and
 * set, and returns a match the scoring engine can safely continue from.
 */
function normalizeMatchState(match) {
    if (!match)
        return match;
    const next = JSON.parse(JSON.stringify(match));
    normalizeCurrentGame(next);
    normalizeCurrentSet(next);
    return next;
}
// ─── Match tiebreak <-> full set conversion (Task 6) ───────────────────────────
//
// Conversion policy:
//  - already completed sets are always preserved,
//  - only the current deciding set is rebuilt, and only on an explicit request,
//  - match-tiebreak points are never reinterpreted as game counts — the set is
//    restarted from 0-0 instead.
// The server and court-side state survive the rebuild (deep-cloned); a pending
// side change is cleared because the set begins fresh.
function buildFreshCurrentSet(asMatchTiebreak) {
    const set = {
        teamA: 0,
        teamB: 0,
        games: [],
        currentGame: { teamA: 0, teamB: 0 },
        isTiebreak: asMatchTiebreak,
    };
    if (asMatchTiebreak)
        set.isSuperTiebreak = true;
    return set;
}
/** Restarts the current set as a normal game-based set; completed sets kept. */
function restartCurrentSetAsNormalSet(match) {
    const next = JSON.parse(JSON.stringify(match));
    next.score.currentSet = buildFreshCurrentSet(false);
    next.shouldChangeSides = false;
    return next;
}
/** Restarts the current set as a match (super) tiebreak; completed sets kept. */
function restartCurrentSetAsMatchTiebreak(match) {
    const next = JSON.parse(JSON.stringify(match));
    next.score.currentSet = buildFreshCurrentSet(true);
    next.shouldChangeSides = false;
    return next;
}
/**
 * Rebuilds the current set from 0-0, preserving every completed set and
 * auto-choosing a match tiebreak vs a normal set from the active format. Used
 * by the "restart current set" scope option. Deep-clones — input not mutated.
 */
function restartCurrentSet(match) {
    if (!match)
        return match;
    const completedSets = match.score?.sets?.length ?? 0;
    const totalSets = Number(match.settings?.sets) || 3;
    const isDecidingSet = completedSets + 1 === totalSets;
    const asMatchTiebreak = isDecidingSet && (0, match_format_rules_1.isMatchTiebreakFormat)(match.settings);
    return asMatchTiebreak ? restartCurrentSetAsMatchTiebreak(match) : restartCurrentSetAsNormalSet(match);
}
function getImportantPoint(match) {
    if (!match?.score?.currentSet)
        return { type: null, team: null };
    const isTiebreak = match.score.currentSet.isTiebreak || false;
    const mp = isMatchPoint(match);
    if (mp)
        return { type: "MATCH POINT", team: mp };
    const sp = isSetPoint(match);
    if (sp)
        return { type: "SET POINT", team: sp };
    const gp = isGamePoint(match);
    if (gp)
        return { type: isTiebreak ? "TIEBREAK POINT" : "GAME POINT", team: gp };
    return { type: isTiebreak ? "TIEBREAK" : null, team: null };
}
