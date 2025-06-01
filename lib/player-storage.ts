// This is a simplified version of the player storage module
// It provides functions to manage players in local storage and Supabase

import { createClient } from "@supabase/supabase-js"
import { logEvent } from "./error-logger"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create a singleton instance of the Supabase client
let supabaseInstance = null

const getSupabase = () => {
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
export const getPlayers = async () => {
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
        const supabasePlayers = data
        const localPlayerIds = new Set(players.map((p) => p.id))

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
export const addPlayer = async (player) => {
  try {
    // Check if player with same name already exists
    const players = await getPlayers()
    const existingPlayer = players.find((p) => p.name.toLowerCase() === player.name.toLowerCase())

    if (existingPlayer) {
      return {
        success: false,
        message: "Игрок с таким именем уже существует",
      }
    }

    // Add to local storage
    players.push(player)
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players))

    // Add to Supabase if available
    const supabase = getSupabase()
    if (supabase) {
      const { error } = await supabase.from("players").insert(player)
      if (error) {
        console.error("Error adding player to Supabase:", error)
        logEvent("error", "Error adding player to Supabase", "player-storage", error)
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
export const updatePlayer = async (playerId, updatedPlayer) => {
  try {
    const players = await getPlayers()
    const playerIndex = players.findIndex((p) => p.id === playerId)

    if (playerIndex === -1) {
      return {
        success: false,
        message: "Игрок не найден",
      }
    }

    // Check if updated name conflicts with existing player
    if (updatedPlayer.name) {
      const nameExists = players.some(
        (p) => p.id !== playerId && p.name.toLowerCase() === updatedPlayer.name.toLowerCase(),
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
    const supabase = getSupabase()
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
export const deletePlayer = async (playerId) => {
  try {
    const players = await getPlayers()
    const filteredPlayers = players.filter((p) => p.id !== playerId)

    // Update local storage
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(filteredPlayers))

    // Delete from Supabase if available
    const supabase = getSupabase()
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
    const players = await getPlayers()
    const filteredPlayers = players.filter((p) => !playerIds.includes(p.id))

    // Update local storage
    localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(filteredPlayers))

    // Delete from Supabase if available
    const supabase = getSupabase()
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
const dispatchPlayersUpdatedEvent = (players) => {
  if (typeof window !== "undefined") {
    const event = new CustomEvent(PLAYERS_UPDATED_EVENT, { detail: players })
    window.dispatchEvent(event)
  }
}

// Subscribe to player updates
export const subscribeToPlayersUpdates = (callback) => {
  if (typeof window === "undefined") return null

  const handlePlayersUpdated = (event) => {
    callback(event.detail)
  }

  window.addEventListener(PLAYERS_UPDATED_EVENT, handlePlayersUpdated)

  return () => {
    window.removeEventListener(PLAYERS_UPDATED_EVENT, handlePlayersUpdated)
  }
}
