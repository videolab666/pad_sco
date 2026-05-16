// Import players from a feed into local player storage (dedup by dyId / name).

import { v4 as uuidv4 } from "uuid"
import { getPlayers, addPlayer } from "@/lib/player-storage"
import type { Player } from "@/lib/types"

export interface ImportedPlayer {
  id: string
  name: string
}

export interface FeedPlayer {
  name: string
  dyId?: string
}

/**
 * Ensures a player exists in the local pool.
 * Dedup: first by dyId, then by name (case-insensitive). Returns the local id.
 */
export async function ensureLocalPlayer(feedPlayer: FeedPlayer): Promise<ImportedPlayer> {
  const players = await getPlayers()
  const byDyId = feedPlayer.dyId
    ? players.find((p: Player) => p.dyId && String(p.dyId) === String(feedPlayer.dyId))
    : undefined
  const byName = players.find(
    (p: Player) => p.name.trim().toLowerCase() === feedPlayer.name.trim().toLowerCase(),
  )
  const existing = byDyId ?? byName
  if (existing) return { id: existing.id, name: existing.name }

  const newPlayer: Player = {
    id: uuidv4(),
    name: feedPlayer.name.trim(),
    dyId: feedPlayer.dyId,
  }
  const res = await addPlayer(newPlayer) // writes to localStorage + Supabase
  if (!res.success) {
    // addPlayer rejected (a player with this name already exists) —
    // resolve to the existing record instead of returning an orphan id.
    const refreshed = await getPlayers()
    const found = refreshed.find(
      (p: Player) => p.name.trim().toLowerCase() === feedPlayer.name.trim().toLowerCase(),
    )
    if (found) return { id: found.id, name: found.name }
  }
  return { id: newPlayer.id, name: newPlayer.name }
}

/** Bulk import (for the "select players from tournament" step). */
export async function importPlayers(list: FeedPlayer[]): Promise<ImportedPlayer[]> {
  const result: ImportedPlayer[] = []
  for (const p of list) result.push(await ensureLocalPlayer(p))
  return result
}
