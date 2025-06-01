"use client"

import { useLanguage } from "@/contexts/language-context"

export function CourtVisualization({ match, fixedSides }) {
  const { t } = useLanguage()

  // Ensure t.match exists to prevent errors
  const tMatch = t?.match || {}

  if (!match) return null

  // Get current server information
  const serverTeam = match.currentServer.team
  const serverPlayerIndex = match.currentServer.playerIndex

  // Get current game number
  const currentGameNumber = match.score.currentSet.games.length + 1

  // Get player names based on the current server and positions
  const getPlayerName = (team, index) => {
    try {
      return match[team].players[index]?.name || `${tMatch.player || "Player"} ${index + 1}`
    } catch (e) {
      return `${tMatch.player || "Player"} ${index + 1}`
    }
  }

  // Determine which player is serving
  const isServing = (team, playerIndex) => {
    return match.currentServer.team === team && match.currentServer.playerIndex === playerIndex
  }

  // Get team names for display
  const getTeamName = (team) => {
    return team === "teamA" ? tMatch.teamA || "Team A" : tMatch.teamB || "Team B"
  }

  // Get serving information text
  const getServingText = () => {
    const serverTeamName = getTeamName(serverTeam)
    const serverPlayerName = getPlayerName(serverTeam, serverPlayerIndex)
    const receiverTeam = serverTeam === "teamA" ? "teamB" : "teamA"
    const receiverPlayerIndex = serverPlayerIndex === 0 ? 0 : 1
    const receiverPlayerName = getPlayerName(receiverTeam, receiverPlayerIndex)

    return `${serverTeamName} ${tMatch.toServe || "to serve"}, ${serverPlayerName} ${tMatch.to || "to"} ${receiverPlayerName}, ${
      match.score.currentSet.currentGame.teamA === 0 && match.score.currentSet.currentGame.teamB === 0
        ? tMatch.loveAll || "love all"
        : tMatch.play || "play"
    }`
  }

  // Determine player positions based on court sides and fixed sides setting
  const getPlayerPositions = () => {
    const positions = {
      topLeft: { team: null, playerIndex: null },
      topRight: { team: null, playerIndex: null },
      bottomLeft: { team: null, playerIndex: null },
      bottomRight: { team: null, playerIndex: null },
    }

    if (fixedSides) {
      // Fixed sides mode - players are positioned based on physical court position
      const leftTeam = match.courtSides.teamA === "left" ? "teamA" : "teamB"
      const rightTeam = leftTeam === "teamA" ? "teamB" : "teamA"

      positions.topLeft = { team: leftTeam, playerIndex: 0 }
      positions.bottomLeft = { team: leftTeam, playerIndex: 1 }
      positions.topRight = { team: rightTeam, playerIndex: 0 }
      positions.bottomRight = { team: rightTeam, playerIndex: 1 }
    } else {
      // Fixed players mode - teams A and B are always on the same side of the display
      positions.topLeft = { team: "teamA", playerIndex: 0 }
      positions.bottomLeft = { team: "teamA", playerIndex: 1 }
      positions.topRight = { team: "teamB", playerIndex: 0 }
      positions.bottomRight = { team: "teamB", playerIndex: 1 }
    }

    return positions
  }

  const positions = getPlayerPositions()

  return null
}
