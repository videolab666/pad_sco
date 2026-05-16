"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultFinalSetTiebreakForSelection = getDefaultFinalSetTiebreakForSelection;
exports.getDefaultFinalSetFinishForSelection = getDefaultFinalSetFinishForSelection;
exports.getDefaultGoldenPointForScoringSystem = getDefaultGoldenPointForScoringSystem;
exports.getGoldenPointDeuceThreshold = getGoldenPointDeuceThreshold;
exports.getFinalSetTiebreakLength = getFinalSetTiebreakLength;
exports.isMatchTiebreakFormat = isMatchTiebreakFormat;
exports.isFinalSetNoTiebreak = isFinalSetNoTiebreak;
exports.isFinalSetGamesTo12 = isFinalSetGamesTo12;
exports.usesFinalSetGameTiebreak = usesFinalSetGameTiebreak;
exports.getSetsToWin = getSetsToWin;
exports.shouldStartMatchTiebreakAfterSet = shouldStartMatchTiebreakAfterSet;
function getDefaultFinalSetTiebreakForSelection(value) {
    if (value === "super")
        return false;
    const sets = Number.parseInt(value, 10);
    return Number.isFinite(sets) && sets > 0 && sets % 2 === 0;
}
function getDefaultFinalSetFinishForSelection(value) {
    if (value === "super")
        return "standard-7";
    const sets = Number.parseInt(value, 10);
    return Number.isFinite(sets) && sets > 0 && sets % 2 === 0 ? "match-tiebreak-10" : "standard-7";
}
function getDefaultGoldenPointForScoringSystem(scoringSystem) {
    return scoringSystem === "no-ad" ? "first-deuce" : "none";
}
/**
 * The deuce count at which a Golden Point becomes decisive for a given format.
 * `first-deuce` → 0 (the very first 40-40), `second-deuce` → 1, `third-deuce` → 2.
 * Returns +Infinity when Golden Point is off (classic deuce/advantage forever).
 */
function getGoldenPointDeuceThreshold(goldenPointFormat) {
    switch (goldenPointFormat) {
        case "first-deuce":
            return 0;
        case "second-deuce":
            return 1;
        case "third-deuce":
            return 2;
        default:
            return Number.POSITIVE_INFINITY;
    }
}
function getFinalSetTiebreakLength(settings = {}) {
    switch (settings.finalSetFinish) {
        case "standard-10":
        case "match-tiebreak-10":
        case "games-to-12-10":
            return 10;
        case "standard-7":
        case "match-tiebreak-7":
        case "games-to-12-7":
            return 7;
        default:
            return settings.finalSetTiebreakLength || 10;
    }
}
function isMatchTiebreakFormat(settings = {}) {
    const sets = Number(settings.sets);
    const explicitMatchTiebreak = settings.finalSetFinish === "match-tiebreak-7" || settings.finalSetFinish === "match-tiebreak-10";
    return Boolean(!settings.isSuperSet &&
        Number.isFinite(sets) &&
        sets > 0 &&
        (explicitMatchTiebreak || (settings.finalSetTiebreak && sets % 2 === 0)));
}
function isFinalSetNoTiebreak(settings = {}) {
    return settings.finalSetFinish === "no-tiebreak";
}
function isFinalSetGamesTo12(settings = {}) {
    return settings.finalSetFinish === "games-to-12-7" || settings.finalSetFinish === "games-to-12-10";
}
function usesFinalSetGameTiebreak(settings = {}) {
    if (isMatchTiebreakFormat(settings) || isFinalSetNoTiebreak(settings))
        return false;
    return (settings.finalSetFinish === "standard-7" ||
        settings.finalSetFinish === "standard-10" ||
        isFinalSetGamesTo12(settings) ||
        Boolean(settings.finalSetTiebreak));
}
function getSetsToWin(settings = {}) {
    const sets = Number(settings.sets);
    const totalSets = Number.isFinite(sets) && sets > 0 ? sets : 3;
    if (isMatchTiebreakFormat(settings)) {
        return totalSets / 2 + 1;
    }
    return Math.ceil(totalSets / 2);
}
function shouldStartMatchTiebreakAfterSet(settings = {}, score) {
    const sets = Number(settings.sets);
    return (isMatchTiebreakFormat(settings) &&
        Number.isFinite(sets) &&
        (score.sets?.length ?? 0) === sets &&
        score.teamA === score.teamB);
}
