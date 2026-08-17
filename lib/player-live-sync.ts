// Live-sync of player-pool edits into ACTIVE matches.
//
// Matches store a COPY of each player taken at creation time, so editing the
// pool does not retroactively change running scoreboards. That is intentional
// for finished matches, but for a live match the operator expects the fix
// (typo in a name, missing flag, seed) to show up right away.
//
// Safety: only the display fields are merged — never the score, the server,
// the sides or the settings. Those fields are absent from the undo journal's
// state fingerprint (lib/match-undo stateFingerprint), so replay-based undo
// stays consistent across the sync.

import type { Player } from "./types"

/** Fields a pool edit may overwrite on a live match's copy of the player. */
const SYNC_FIELDS = [
  "name",
  "country",
  "club",
  "avatar",
  "seed",
  "abbreviation",
  "number",
  "color",
] as const

/**
 * Pure merge: apply the pool player onto a match's copy. Returns a NEW match
 * when something actually changed, otherwise the original reference (so
 * callers can skip no-op writes).
 */
export function applyPlayerToMatch(match: any, player: Player): any {
  if (!match || match.isCompleted) return match
  let changed = false
  const next = JSON.parse(JSON.stringify(match))
  for (const team of ["teamA", "teamB"] as const) {
    const players: any[] = next[team]?.players ?? []
    for (let i = 0; i < players.length; i++) {
      if (String(players[i]?.id) !== String(player.id)) continue
      for (const f of SYNC_FIELDS) {
        const value = (player as any)[f]
        if (value !== undefined && players[i][f] !== value) {
          players[i][f] = value
          changed = true
        }
      }
    }
  }
  return changed ? next : match
}

/** Display fields an edit may carry — the same whitelist as the merge above. */
export type PlayerDisplayFields = Partial<Record<(typeof SYNC_FIELDS)[number], unknown>>

/**
 * Push edited fields into every ACTIVE match that holds this player.
 * Skips `skipMatchId` (the match the edit originated from — the caller
 * already updated it) and finished matches. Returns the synced count.
 */
export async function syncPlayerFields(
  getPlayerMatches: () => Promise<any[]>,
  saveMatch: (m: any) => Promise<unknown>,
  playerId: string,
  fields: PlayerDisplayFields,
  skipMatchId?: string,
): Promise<number> {
  const player: any = { id: playerId, ...fields }
  const matches = await getPlayerMatches()
  let synced = 0
  for (const m of matches) {
    if (m?.isCompleted || m?.id === skipMatchId) continue
    const next = applyPlayerToMatch(m, player)
    if (next !== m) {
      next.revision = (typeof m.revision === "number" ? m.revision : 0) + 1
      await saveMatch(next)
      synced++
    }
  }
  return synced
}
