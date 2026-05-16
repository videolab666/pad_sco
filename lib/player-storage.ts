// This is a simplified version of the player storage module
// It provides functions to manage players in local storage and Supabase

import { createClient } from "@supabase/supabase-js"
import { logEvent } from "./error-logger"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create a singleton instance of the Supabase client
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Player, AddPlayerOptions, UpdatePlayerOptions } from "./types"

let supabaseInstance: SupabaseClient | null = null

const getSupabase = (): SupabaseClient | null => {
  if (!supabaseInstance && supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return supabaseInstance
}

// Local storage key for players
const PLAYERS_STORAGE_KEY = "padel-tennis-players"

// Custom event for player updates
const PLAYERS_UPDATED_EVENT = "players-updated"

// Get players from local storage
export const getPlayers = async (): Promise<Player[]> => {
  try {
    // Try to get from local storage first
    const playersJson = localStorage.getItem(PLAYERS_STORAGE_KEY)
    const players = playersJson ? JSON.parse(playersJson) : []

    // If Supabase is available, try to get from there as well
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.from("players").select("*").order("name")
      if (error) {
        console.error("Error fetching players from Supabase:", error)
        logEvent("error", "Error fetching players from Supabase", "player-storage", error)
      } else if (data && data.length > 0) {
        // Merge players from Supabase with local players
        const supabasePlayers: Player[] = data
        const localPlayerIds: Set<string> = new Set(players.map((p: Player) => p.id))

        // Add Supabase players that don't exist locally
        for (const player of supabasePlayers) {
          if (!localPlayerIds.has(player.id)) {
            players.push(player)
          }
        }

        // Update local storage with merged players
        localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players))
      }
    }

    return players
  } catch (error) {
    console.error("Error getting players:", error)
    logEvent("error", "Error getting players", "player-storage", error)
    return []
  }
}

// Add a new player
export const addPlayer = async (player: Player, options: AddPlayerOptions = {}): Promise<{ success: boolean; message: string }> => {
  try {
    // Check if player with same name already exists
    const players: Player[] = await getPlayers()
    const existingPlayer: Player | undefined = players.find((p: Player) => p.name.toLowerCase() === player.name.toLowerCase())

    if (existingPlayer) {
      return {
        success: false,
        message: "Игрок с таким именем уже существует",
      }
    }

    // If localOnly, add a local_expire_at field and do NOT save to Supabase
    let playerToSave: Player & { local_expire_at?: number } = { ...player }
    if (options.localOnly) {
      const expireMs: number = options.expireMs || 6 * 60 * 60 * 1000 // default 6 hours
      playerToSave.local_expire_at = Date.now() + expireMs
    }

    // Add to local storage
    players.push(playerToSave)
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players))

    // Only add to Supabase if not localOnly
    if (!options.localOnly) {
      const supabase: SupabaseClient | null = getSupabase()
      if (supabase) {
        const { error } = await supabase.from("players").insert(player)
        if (error) {
          console.error("Error adding player to Supabase:", error)
          logEvent("error", "Error adding player to Supabase", "player-storage", error)
        }
      }
    }

    // Dispatch event to notify about player update
    dispatchPlayersUpdatedEvent(players)

    return {
      success: true,
      message: "Игрок успешно добавлен",
    }
  } catch (error) {
    console.error("Error adding player:", error)
    logEvent("error", "Error adding player", "player-storage", error)

    return {
      success: false,
      message: "Произошла ошибка при добавлении игрока",
    }
  }
}

// Update an existing player
export const updatePlayer = async (playerId: string, updatedPlayer: UpdatePlayerOptions): Promise<{ success: boolean; message: string }> => {
  try {
    const players: Player[] = await getPlayers()
    const playerIndex: number = players.findIndex((p: Player) => p.id === playerId)

    if (playerIndex === -1) {
      return {
        success: false,
        message: "Игрок не найден",
      }
    }

    // Check if updated name conflicts with existing player
    if (updatedPlayer.name) {
      const nameExists: boolean = players.some(
        (p: Player) => p.id !== playerId && p.name.toLowerCase() === updatedPlayer.name?.toLowerCase(),
      )

      if (nameExists) {
        return {
          success: false,
          message: "Игрок с таким именем уже существует",
        }
      }
    }

    // Update player in local array
    players[playerIndex] = { ...players[playerIndex], ...updatedPlayer }

    // Update local storage
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players))

    // Update in Supabase if available
    const supabase: SupabaseClient | null = getSupabase()
    if (supabase) {
      const { error } = await supabase.from("players").update(updatedPlayer).eq("id", playerId)

      if (error) {
        console.error("Error updating player in Supabase:", error)
        logEvent("error", "Error updating player in Supabase", "player-storage", error)
      }
    }

    // Dispatch event to notify about player update
    dispatchPlayersUpdatedEvent(players)

    return {
      success: true,
      message: "Игрок успешно обновлен",
    }
  } catch (error) {
    console.error("Error updating player:", error)
    logEvent("error", "Error updating player", "player-storage", error)

    return {
      success: false,
      message: "Произошла ошибка при обновлении игрока",
    }
  }
}

// Delete a player
export const deletePlayer = async (playerId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const players: Player[] = await getPlayers()
    const filteredPlayers: Player[] = players.filter((p: Player) => p.id !== playerId)

    // Update local storage
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(filteredPlayers))

    // Delete from Supabase if available
    const supabase: SupabaseClient | null = getSupabase()
    if (supabase) {
      const { error } = await supabase.from("players").delete().eq("id", playerId)

      if (error) {
        console.error("Error deleting player from Supabase:", error)
        logEvent("error", "Error deleting player from Supabase", "player-storage", error)
      }
    }

    // Dispatch event to notify about player update
    dispatchPlayersUpdatedEvent(filteredPlayers)

    return {
      success: true,
      message: "Игрок успешно удален",
    }
  } catch (error) {
    console.error("Error deleting player:", error)
    logEvent("error", "Error deleting player", "player-storage", error)

    return {
      success: false,
      message: "Произошла ошибка при удалении игрока",
    }
  }
}

// Delete multiple players
export const deletePlayers = async (playerIds: string[]): Promise<boolean> => {
  try {
    const players: Player[] = await getPlayers()
    const filteredPlayers: Player[] = players.filter((p: Player) => !playerIds.includes(p.id))

    // Update local storage
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(filteredPlayers))

    // Delete from Supabase if available
    const supabase: SupabaseClient | null = getSupabase()
    if (supabase) {
      const { error } = await supabase.from("players").delete().in("id", playerIds)

      if (error) {
        console.error("Error deleting players from Supabase:", error)
        logEvent("error", "Error deleting players from Supabase", "player-storage", error)
        return false
      }
    }

    // Dispatch event to notify about player update
    dispatchPlayersUpdatedEvent(filteredPlayers)

    return true
  } catch (error) {
    console.error("Error deleting players:", error)
    logEvent("error", "Error deleting players", "player-storage", error)
    return false
  }
}

// Helper function to dispatch custom event for player updates
const dispatchPlayersUpdatedEvent = (players: Player[]): void => {
  if (typeof window !== "undefined") {
    const event = new CustomEvent(PLAYERS_UPDATED_EVENT, { detail: players })
    window.dispatchEvent(event)
  }
}

// Subscribe to player updates
export const subscribeToPlayersUpdates = (callback: (players: Player[]) => void): (() => void) | null => {
  if (typeof window === "undefined") return null

  const handlePlayersUpdated = (event: CustomEvent) => {
    callback(event.detail)
  }

  window.addEventListener(PLAYERS_UPDATED_EVENT, handlePlayersUpdated as EventListener)

  return () => {
    window.removeEventListener(PLAYERS_UPDATED_EVENT, handlePlayersUpdated as EventListener)
  }
}
