"use strict";
// Metadata-only match edits (Task 3).
//
// Roster, court and round/stage edits are metadata: they must never touch the
// score, set counts, point values, history or completed match results. The
// only thing allowed to change automatically is the current server pointer —
// and only when a roster edit makes the pointed-at player no longer exist.
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeServerPointer = normalizeServerPointer;
exports.applyMetadataEdit = applyMetadataEdit;
exports.isMetadataOnlyChange = isMetadataOnlyChange;
/** Keys a metadata edit is allowed to change — used to verify isolation. */
const METADATA_KEYS = ["teamA", "teamB", "courtNumber", "round"];
/**
 * Moves the current server pointer to a valid player when a roster edit made
 * the pointed-at player disappear. The team is preserved when it still has
 * players; otherwise the pointer moves to the nearest valid player on the other
 * team. The score and serve-side / court-side display are never altered.
 * Mutates the match in place.
 */
function normalizeServerPointer(match) {
    const server = match?.currentServer;
    if (!server)
        return;
    const teamPlayers = (team) => (match?.[team]?.players?.length ? match[team].players : null);
    let team = server.team === "teamB" ? "teamB" : "teamA";
    let players = teamPlayers(team);
    if (!players) {
        // The serving team has no players left — fall back to the other team.
        const otherTeam = team === "teamA" ? "teamB" : "teamA";
        if (teamPlayers(otherTeam)) {
            team = otherTeam;
            players = teamPlayers(team);
            server.team = team;
        }
        else {
            return; // no valid players anywhere — leave the pointer untouched
        }
    }
    server.team = team;
    const lastIndex = players.length - 1;
    if (typeof server.playerIndex !== "number" || server.playerIndex < 0) {
        server.playerIndex = 0;
    }
    else if (server.playerIndex > lastIndex) {
        server.playerIndex = lastIndex;
    }
}
/**
 * Applies a metadata edit and returns a new match. The score branch (`score`,
 * its `sets` / `currentSet` / `currentGame`), `history`, `isCompleted` and
 * `winner` are deep-cloned unchanged. Only the current server pointer is
 * normalized, and only if a roster edit invalidated it.
 */
function applyMetadataEdit(match, edit) {
    const next = JSON.parse(JSON.stringify(match));
    if (edit.teamA !== undefined)
        next.teamA = edit.teamA;
    if (edit.teamB !== undefined)
        next.teamB = edit.teamB;
    if (edit.courtNumber !== undefined)
        next.courtNumber = edit.courtNumber;
    if (edit.round !== undefined)
        next.round = edit.round;
    // The score is metadata-immutable — repair only the dependent display state.
    normalizeServerPointer(next);
    return next;
}
/**
 * True when `next` differs from `prev` only in metadata keys — score, settings
 * and serving game state are byte-identical. Lets a caller route a change down
 * the metadata path (no score conversion, no scope prompt).
 */
function isMetadataOnlyChange(prev, next) {
    if (!prev || !next)
        return false;
    // The score and rule settings must be untouched.
    if (JSON.stringify(prev.score) !== JSON.stringify(next.score))
        return false;
    if (JSON.stringify(prev.settings) !== JSON.stringify(next.settings))
        return false;
    if (Boolean(prev.isCompleted) !== Boolean(next.isCompleted))
        return false;
    if ((prev.winner ?? null) !== (next.winner ?? null))
        return false;
    // At least one metadata key must actually differ.
    return METADATA_KEYS.some((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
}
