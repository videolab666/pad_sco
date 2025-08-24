"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getTennisPointName } from "@/lib/tennis-utils"
import { useState, useEffect } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useLanguage } from "@/contexts/language-context"
import { Trophy } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CircleDot } from "lucide-react"

export function ScoreBoard({ match, updateMatch }) {
  const [showMatchEndDialog, setShowMatchEndDialog] = useState(false)
  const [pendingMatchUpdate, setPendingMatchUpdate] = useState(null)
  const [previousMatchState, setPreviousMatchState] = useState(null)
  const [fixedSides, setFixedSides] = useState(false)

  // Always force 'fixed players' as default on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("fixedSidesPreference")
      setFixedSides(false)
    }
  }, [])
  const [matchHistory, setMatchHistory] = useState([])
  const { t } = useLanguage()

  const [swappedTeamA, setSwappedTeamA] = useState(false)
  const [swappedTeamB, setSwappedTeamB] = useState(false)
  
  // Add state to track if a score button click is being processed
  const [isProcessingClick, setIsProcessingClick] = useState(false)
  
  // Track which team's score is being processed for visual feedback
  const [processingTeam, setProcessingTeam] = useState(null)
  
  // Add local state to keep track of our current scores during rapid clicks
  // This helps prevent flickering when receiving real-time updates
  const [localMatchState, setLocalMatchState] = useState(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fixedSidesPreference", fixedSides.toString())
    }
  }, [fixedSides])
  
  // Keep localMatchState in sync with match
  useEffect(() => {
    // Only update localMatchState if we're not currently processing a click
    // This prevents flickering when receiving updates during click processing
    if (!isProcessingClick && match) {
      setLocalMatchState(match)
    }
  }, [match, isProcessingClick])

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "fixedSidesPreference") {
        setFixedSides(e.newValue === "true")
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  useEffect(() => {
    const handleTeamSwapChange = (e) => {
      if (e.detail && e.detail.team === "teamA") {
        setSwappedTeamA(e.detail.swapped)
      } else if (e.detail && e.detail.team === "teamB") {
        setSwappedTeamB(e.detail.swapped)
      }
    }

    window.addEventListener("teamPlayersSwapped", handleTeamSwapChange)
    return () => window.removeEventListener("teamPlayersSwapped", handleTeamSwapChange)
  }, [])

  useEffect(() => {
    const handleCourtSidesSwapped = (e) => {
      if (!updateMatch || match.isCompleted) return

      // Save the current match state before any changes
      const previousState = JSON.parse(JSON.stringify(match))
      // Save to history
      setMatchHistory((prev) => [...prev, previousState])

      // Create a copy of the match
      const updatedMatch = { ...match }

      // Update court sides with the new sides from the event
      if (e.detail && e.detail.newSides) {
        // In fixed players mode, we still update the match data
        // but the display will continue to show Team A on left and Team B on right
        updatedMatch.courtSides = e.detail.newSides

        // Update match
        updateMatch(updatedMatch)
      }
    }

    window.addEventListener("courtSidesSwapped", handleCourtSidesSwapped)
    return () => window.removeEventListener("courtSidesSwapped", handleCourtSidesSwapped)
  }, [match, updateMatch])

  useEffect(() => {
    const handleSwitchServer = (e) => {
      if (!updateMatch || match.isCompleted) return

      // Save the current match state before any changes
      const previousState = JSON.parse(JSON.stringify(match))
      // Save to history
      setMatchHistory((prev) => [...prev, previousState])

      // Create a copy of the match
      const updatedMatch = { ...match }

      // Switch server
      switchServer(updatedMatch)

      // Update match
      updateMatch(updatedMatch)
    }

    window.addEventListener("switchServer", handleSwitchServer)
    return () => window.removeEventListener("switchServer", handleSwitchServer)
  }, [match, updateMatch])

  // Use localMatchState if available for more responsive UI
  const displayMatch = localMatchState || match
  
  // Extract values from match data
  const { teamA, teamB } = displayMatch
  const currentSet = displayMatch.score.currentSet

  if (!displayMatch) return null

  // Оптимизируем обработчик нажатия на счет для более быстрой работы
  const handleScoreClick = (team) => {
    if (!updateMatch || displayMatch.isCompleted) {
      console.log("Cannot update: updateMatch function missing or match completed")
      return
    }
    
    // Prevent multiple rapid clicks
    if (isProcessingClick) {
      return
    }
    
    // Set processing flag
    setIsProcessingClick(true)
    
    // Use a longer debounce time to ensure we don't process clicks too quickly
    // and to allow any database operations to complete
    setTimeout(() => {
      setIsProcessingClick(false)
      setProcessingTeam(null) // Clear the processing team indicator
    }, 500) // Increased to 500ms debounce for better protection
    
    // Set which team is being processed for visual feedback
    setProcessingTeam(team)

    // Use localMatchState if available, otherwise use the match prop
    const currentMatchState = localMatchState || match
    
    // Save the current match state before any changes
    const previousState = JSON.parse(JSON.stringify(currentMatchState))
    // Save to history
    setMatchHistory((prev) => [...prev, previousState])

    // Create a copy of the match
    const updatedMatch = { ...currentMatchState }
    
    // Update localMatchState immediately for optimistic UI update
    setLocalMatchState(updatedMatch)

    // Clear history to save space
    // updatedMatch.history = []

    const otherTeam = team === "teamA" ? "teamB" : "teamA"

    // Check if sides need to be changed
    if (updatedMatch.shouldChangeSides) {
      // Change sides
      updatedMatch.courtSides = {
        teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
        teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
      }

      // Reset the flag
      updatedMatch.shouldChangeSides = false
    }

    if (currentSet.isTiebreak) {
      // Tiebreak logic
      updatedMatch.score.currentSet.currentGame[team]++

      // Определяем количество очков для победы в тай-брейке в зависимости от типа
      let pointsToWin = 7 // Обычный тай-брейк по умолчанию

      // Если это супер-тай-брейк в решающем сете
      if (
        currentSet.isSuperTiebreak ||
        (updatedMatch.settings.finalSetTiebreak && updatedMatch.score.sets.length + 1 === updatedMatch.settings.sets)
      ) {
        // Используем длину тай-брейка из настроек финального сета
        pointsToWin = updatedMatch.settings.finalSetTiebreakLength || 10
        console.log("Using final set tiebreak length:", pointsToWin)
      }
      // Если это обычный тай-брейк, но выбран тип "championship"
      else if (updatedMatch.settings.tiebreakType === "championship") {
        pointsToWin = 10 // Чемпионский тай-брейк всегда до 10 очков
        console.log("Using championship tiebreak (10 points)")
      } else {
        console.log("Using regular tiebreak (7 points)")
      }

      console.log("Tiebreak settings:", {
        type: updatedMatch.settings.tiebreakType,
        finalSetTiebreak: updatedMatch.settings.finalSetTiebreak,
        finalSetTiebreakLength: updatedMatch.settings.finalSetTiebreakLength,
        pointsToWin: pointsToWin,
      })

      // Check for tiebreak win
      if (
        updatedMatch.score.currentSet.currentGame[team] >= pointsToWin &&
        updatedMatch.score.currentSet.currentGame[team] - updatedMatch.score.currentSet.currentGame[otherTeam] >= 2
      ) {
        // Сохраняем счет тай-брейка перед завершением
        const tiebreakScore = {
          teamA: updatedMatch.score.currentSet.currentGame.teamA,
          teamB: updatedMatch.score.currentSet.currentGame.teamB,
        }

        // Сохраняем информацию о тай-брейке в текущем сете
        updatedMatch.score.currentSet.tiebreak = tiebreakScore

        // Increase set score
        updatedMatch.score.currentSet[team]++

        // Win set
        return winSet(team, updatedMatch, previousState)
      }

      // Switch server in tiebreak (every 2 points, except first)
      const totalPoints =
        updatedMatch.score.currentSet.currentGame.teamA + updatedMatch.score.currentSet.currentGame.teamB
      if (totalPoints % 2 === 1) {
        switchServer(updatedMatch)
      }

      // Check if sides need to be changed in tiebreak (every 6 points)
      if (totalPoints > 0 && totalPoints % 6 === 0) {
        updatedMatch.shouldChangeSides = true
      }
    } else {
      // Regular game logic
      const currentGame = updatedMatch.score.currentSet.currentGame
      const scoringSystem = updatedMatch.settings.scoringSystem || "classic"

      if (scoringSystem === "classic") {
        // Классическая система счета (с преимуществом)
        if (currentGame[team] === 0) {
          currentGame[team] = 15
        } else if (currentGame[team] === 15) {
          currentGame[team] = 30
        } else if (currentGame[team] === 30) {
          currentGame[team] = 40
        } else if (currentGame[team] === 40) {
          if (currentGame[otherTeam] < 40) {
            // Win game
            return winGame(team, updatedMatch, previousState)
          } else if (currentGame[otherTeam] === 40) {
            // Проверяем, используется ли золотой мяч при ровно
            if (updatedMatch.settings.goldenPoint) {
              // Если золотой мяч, то сразу выигрываем гейм при счете 40-40
              return winGame(team, updatedMatch, previousState)
            } else {
              // Advantage
              currentGame[team] = "Ad"
            }
          } else if (currentGame[otherTeam] === "Ad") {
            // Deuce
            currentGame[team] = 40
            currentGame[otherTeam] = 40
          }
        } else if (currentGame[team] === "Ad") {
          // Win game after advantage
          return winGame(team, updatedMatch, previousState)
        }
      } else if (scoringSystem === "no-ad") {
        // No-Ad система (решающий мяч при ровно)
        if (currentGame[team] === 0) {
          currentGame[team] = 15
        } else if (currentGame[team] === 15) {
          currentGame[team] = 30
        } else if (currentGame[team] === 30) {
          currentGame[team] = 40
        } else if (currentGame[team] === 40) {
          // В No-Ad при счете 40-40 следующее очко решающее
          return winGame(team, updatedMatch, previousState)
        }
      } else if (scoringSystem === "fast4") {
        // Fast4 система (до 4 геймов)
        if (currentGame[team] === 0) {
          currentGame[team] = 15
        } else if (currentGame[team] === 15) {
          currentGame[team] = 30
        } else if (currentGame[team] === 30) {
          currentGame[team] = 40
        } else if (currentGame[team] === 40) {
          // В Fast4 при счете 40-40 следующее очко решающее (как в No-Ad)
          return winGame(team, updatedMatch, previousState)
        }
      }
    }

    // Оптимизация: обновляем UI немедленно, не дожидаясь завершения операции сохранения
    updateMatch(updatedMatch)
  }

  // Обработчик уменьшения счета
  const handleScoreDecrease = (team) => {
    if (!updateMatch || displayMatch.isCompleted) {
      console.log("Cannot update: updateMatch function missing or match completed")
      return
    }
    
    // Prevent multiple rapid clicks
    if (isProcessingClick) {
      return
    }
    
    // Set processing flag
    setIsProcessingClick(true)
    
    // Use a longer debounce time to match the handleScoreClick function
    setTimeout(() => {
      setIsProcessingClick(false)
      setProcessingTeam(null) // Clear the processing team indicator
    }, 500) // Increased to 500ms debounce for better protection
    
    // Set which team is being processed for visual feedback
    setProcessingTeam(team)

    // Use localMatchState if available, otherwise use the match prop
    const currentMatchState = localMatchState || match
    
    // Save the current match state before any changes
    const previousState = JSON.parse(JSON.stringify(currentMatchState))
    // Save to history
    setMatchHistory((prev) => [...prev, previousState])

    // Create a copy of the match
    const updatedMatch = { ...currentMatchState }
    
    // Update localMatchState immediately for optimistic UI update
    setLocalMatchState(updatedMatch)
    
    const otherTeam = team === "teamA" ? "teamB" : "teamA"

    if (currentSet.isTiebreak) {
      // Tiebreak logic - просто уменьшаем счет, если он больше 0
      if (updatedMatch.score.currentSet.currentGame[team] > 0) {
        updatedMatch.score.currentSet.currentGame[team]--
      }
    } else {
      // Regular game logic
      const currentGame = updatedMatch.score.currentSet.currentGame
      const scoringSystem = updatedMatch.settings.scoringSystem || "classic"

      if (scoringSystem === "classic") {
        // Классическая система счета (с преимуществом)
        if (currentGame[team] === "Ad") {
          currentGame[team] = 40
        } else if (currentGame[team] === 40) {
          if (currentGame[otherTeam] === "Ad") {
            // Если у противника было преимущество, то у обоих становится 40
            currentGame[otherTeam] = 40
          } else {
            currentGame[team] = 30
          }
        } else if (currentGame[team] === 30) {
          currentGame[team] = 15
        } else if (currentGame[team] === 15) {
          currentGame[team] = 0
        }
      } else if (scoringSystem === "no-ad" || scoringSystem === "fast4") {
        // No-Ad система (решающий мяч при ровно)
        if (currentGame[team] === 40) {
          currentGame[team] = 30
        } else if (currentGame[team] === 30) {
          currentGame[team] = 15
        } else if (currentGame[team] === 15) {
          currentGame[team] = 0
        }
      }
    }

    // Оптимизация: обновляем UI немедленно, не дожидаясь завершения операции сохранения
    updateMatch(updatedMatch)
  }

  // Helper functions from ScoreControls
  const winGame = (team, updatedMatch, previousState) => {
    const otherTeam = team === "teamA" ? "teamB" : "teamA"
    const currentSet = updatedMatch.score.currentSet

    // Increase set score
    currentSet[team]++

    // Save minimal game info
    currentSet.games.push({
      winner: team,
    })

    // Reset current game
    currentSet.currentGame = {
      teamA: 0,
      teamB: 0,
    }

    // Switch server
    if (!updatedMatch.settings.windbreak) {
      // Стандартное поведение - смена подающего после каждого гейма
      switchServer(updatedMatch)
    } else {
      // Виндрейк - подача через гейм (смена подающего через гейм)
      const totalGames = currentSet.teamA + currentSet.teamB
      if (totalGames % 2 === 1) {
        // Меняем подающего только после нечетного количества геймов
        switchServer(updatedMatch)
      }
    }

    // Check if sides need to be changed (after odd number of games)
    const totalGames = currentSet.teamA + currentSet.teamB
    if (totalGames % 2 === 1) {
      updatedMatch.shouldChangeSides = true
    }

    // Handle Super Set rules
    if (updatedMatch.settings.isSuperSet) {
      const teamAScore = currentSet.teamA
      const teamBScore = currentSet.teamB

      // Check if we've reached 8-8, start tiebreak
      if (teamAScore === 8 && teamBScore === 8) {
        currentSet.isTiebreak = true
        console.log("Starting tiebreak at 8-8 in Super Set")
        updateMatch(updatedMatch)
        return
      }

      // Check if we've reached 7-7, continue to 9
      if (teamAScore === 7 && teamBScore === 7) {
        // Continue playing to 9
        updateMatch(updatedMatch)
        return
      }

      // Check for win with 2 game difference
      if (
        (teamAScore >= 8 && teamAScore - teamBScore >= 2) ||
        (teamBScore >= 8 && teamBScore - teamAScore >= 2) ||
        (teamAScore === 9 && teamBScore < 8) ||
        (teamBScore === 9 && teamAScore < 8)
      ) {
        return winSet(team, updatedMatch, previousState)
      }

      // Check for win at 9-7 or 7-9
      if ((teamAScore === 9 && teamBScore === 7) || (teamBScore === 9 && teamAScore === 7)) {
        return winSet(team, updatedMatch, previousState)
      }

      // Continue normal play
      updateMatch(updatedMatch)
      return
    }

    // Проверяем, нужно ли использовать Fast4 правила
    const scoringSystem = updatedMatch.settings.scoringSystem || "classic"
    const gamesNeededToWin = scoringSystem === "fast4" ? 4 : 6
    const tiebreakAt = Number.parseInt(updatedMatch.settings.tiebreakAt.split("-")[0])

    // Проверка на финальный сет и тайбрейк в финальном сете
    const isDecidingSet = updatedMatch.score.sets.length + 1 === updatedMatch.settings.sets
    const isTwoSetsMatch =
      updatedMatch.settings.sets === 2 && updatedMatch.score.teamA === 1 && updatedMatch.score.teamB === 1

    // Проверяем, нужно ли начать тайбрейк в финальном сете
    if (updatedMatch.settings.finalSetTiebreak && (isDecidingSet || isTwoSetsMatch)) {
      // Если это финальный сет и включен тайбрейк в финальном сете
      if (currentSet.teamA === tiebreakAt && currentSet.teamB === tiebreakAt) {
        // Начинаем тайбрейк в финальном сете
        currentSet.isTiebreak = true
        currentSet.isSuperTiebreak = true // Отмечаем, что это супер-тайбрейк
        console.log("Starting final set tiebreak at", tiebreakAt, "all")
      }
    }
    // Обычный тайбрейк для нефинальных сетов
    else if (
      updatedMatch.settings.tiebreakEnabled &&
      currentSet.teamA === tiebreakAt &&
      currentSet.teamB === tiebreakAt
    ) {
      // Start tiebreak
      currentSet.isTiebreak = true
      console.log("Starting regular tiebreak at", tiebreakAt, "all")
    }

    // Проверяем на золотой гейм (падел)
    if (updatedMatch.settings.goldenGame) {
      // Если включен золотой гейм и один из игроков достиг 6 геймов, а другой имеет 5
      if ((currentSet.teamA === 6 && currentSet.teamB === 5) || (currentSet.teamA === 5 && currentSet.teamB === 6)) {
        // Определяем победителя сета
        const setWinner = currentSet.teamA > currentSet.teamB ? "teamA" : "teamB"
        return winSet(setWinner, updatedMatch, previousState)
      }
    }

    // Check for set win
    if (currentSet.teamA >= gamesNeededToWin && currentSet.teamA - currentSet.teamB >= 2) {
      return winSet("teamA", updatedMatch, previousState)
    } else if (currentSet.teamB >= gamesNeededToWin && currentSet.teamB - currentSet.teamA >= 2) {
      return winSet("teamB", updatedMatch, previousState)
    }

    // Проверка на победу в сете по правилам Fast4
    if (scoringSystem === "fast4") {
      if (currentSet.teamA >= gamesNeededToWin && currentSet.teamA - currentSet.teamB >= 1) {
        return winSet("teamA", updatedMatch, previousState)
      } else if (currentSet.teamB >= gamesNeededToWin && currentSet.teamB - currentSet.teamA >= 1) {
        return winSet("teamB", updatedMatch, previousState)
      }
    }

    // Update match
    updateMatch(updatedMatch)
  }

  const winSet = (team, updatedMatch, previousState) => {
    // Increase match score
    updatedMatch.score[team]++

    // Save current set to set history
    const setToSave = {
      teamA: updatedMatch.score.currentSet.teamA,
      teamB: updatedMatch.score.currentSet.teamB,
      winner: team,
    }

    // Если сет завершился тай-брейком, сохраняем счет тай-брейка
    if (updatedMatch.score.currentSet.isTiebreak) {
      setToSave.tiebreak = {
        teamA: updatedMatch.score.currentSet.currentGame.teamA,
        teamB: updatedMatch.score.currentSet.currentGame.teamB,
      }
      console.log("Сохраняем счет тай-брейка:", setToSave.tiebreak)
    }

    // Save current set to set history
    updatedMatch.score.sets.push(setToSave)

    // Check for match win
    const totalSets = updatedMatch.settings.sets

    // Special handling for 2-set matches
    if (totalSets === 2) {
      // If a team has won 2 sets, the match is over
      if (updatedMatch.score[team] === 2) {
        // Store the pending update and previous state
        setPendingMatchUpdate(updatedMatch)
        setPreviousMatchState(previousState)

        // Show the confirmation dialog
        setShowMatchEndDialog(true)

        // Don't update the match yet
        return
      }
      // If the score is 1-1, we continue to a deciding tiebreak
      // Do not end the match here
    } else {
      // For matches with 1, 3, or 5 sets, use the standard logic
      const setsToWin = Math.ceil(updatedMatch.settings.sets / 2)
      if (updatedMatch.score[team] >= setsToWin) {
        // Store the pending update and previous state
        setPendingMatchUpdate(updatedMatch)
        setPreviousMatchState(previousState)

        // Show the confirmation dialog
        setShowMatchEndDialog(true)

        // Don't update the match yet
        return
      }
    }

    // Проверяем, нужно ли использовать супер-тай-брейк вместо третьего сета
    const isDecidingSet = updatedMatch.score.sets.length + 1 === updatedMatch.settings.sets
    const isTwoSetsMatch = updatedMatch.settings.sets === 2
    const isThirdSetTiebreak =
      updatedMatch.settings.finalSetTiebreak &&
      (isDecidingSet || (isTwoSetsMatch && updatedMatch.score.teamA === 1 && updatedMatch.score.teamB === 1))

    // Start new set
    if (isThirdSetTiebreak) {
      // Если это решающий сет и включен тайбрейк в решающем сете
      // Сразу начинаем с тайбрейка вместо обычного сета
      updatedMatch.score.currentSet = {
        teamA: 0,
        teamB: 0,
        games: [],
        currentGame: {
          teamA: 0,
          teamB: 0,
        },
        isTiebreak: true,
        isSuperTiebreak: true,
      }
      console.log("Starting super tiebreak for deciding set instead of regular set")
    } else {
      // Обычный сет
      updatedMatch.score.currentSet = {
        teamA: 0,
        teamB: 0,
        games: [],
        currentGame: {
          teamA: 0,
          teamB: 0,
        },
        isTiebreak: false,
      }
    }

    // Change sides after odd number of sets
    if (updatedMatch.score.sets.length % 2 === 1) {
      // Change sides automatically when changing set
      updatedMatch.courtSides = {
        teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
        teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
      }
    }

    // Update match
    updateMatch(updatedMatch)
  }

  const handleCompleteMatch = () => {
    if (pendingMatchUpdate) {
      // Complete the match
      const finalMatch = { ...pendingMatchUpdate }
      finalMatch.isCompleted = true
      finalMatch.winner = finalMatch.score.teamA > finalMatch.score.teamB ? "teamA" : "teamB"

      // Update the match
      updateMatch(finalMatch)

      // Reset the pending state
      setPendingMatchUpdate(null)
      setPreviousMatchState(null)
    }

    // Close the dialog
    setShowMatchEndDialog(false)
  }

  const handleCancelMatchCompletion = () => {
    // Revert to the previous state if available
    if (previousMatchState) {
      updateMatch(previousMatchState)
    }

    // Reset the pending state
    setPendingMatchUpdate(null)
    setPreviousMatchState(null)

    // Close the dialog
    setShowMatchEndDialog(false)
  }

  const switchServer = (updatedMatch) => {
    const currentTeam = updatedMatch.currentServer.team
    const otherTeam = currentTeam === "teamA" ? "teamB" : "teamA"

    // For singles, just switch team
    if (updatedMatch.format === "singles") {
      updatedMatch.currentServer.team = otherTeam
      updatedMatch.currentServer.playerIndex = 0
    } else {
      // For doubles - after each game, service passes to the next player in order
      // Order: A1 -> B1 -> A2 -> B2 -> A1 etc.
      if (currentTeam === "teamA") {
        // If team A was serving, switch to team B
        updatedMatch.currentServer.team = "teamB"
        // Keep the same player index
      } else {
        // If team B was serving, switch to team A and change player
        updatedMatch.currentServer.team = "teamA"
        // Switch to next player in team A
        updatedMatch.currentServer.playerIndex = updatedMatch.currentServer.playerIndex === 0 ? 1 : 0
      }
    }

    return updatedMatch
  }

  // Добавить функции для определения важных событий после функции switchServer

  // Функция для преобразования числового значения очков в теннисе в индекс
  const getPointIndex = (point) => {
    // Обработка строкового значения "Ad" (преимущество)
    if (point === "Ad") return 4

    // Преобразуем числовые значения очков (0, 15, 30, 40) в индексы (0, 1, 2, 3)
    if (point === 0) return 0
    if (point === 15) return 1
    if (point === 30) return 2
    if (point === 40) return 3

    // Если значение больше 40, считаем это преимуществом (Ad)
    if (typeof point === "number" && point > 40) return 4

    // Если это числовое значение, но не стандартное, возвращаем его как есть
    // (это может быть счет в тай-брейке)
    return point
  }

  // Функция для определения game point
  const isGamePointIndicator = (match) => {
    if (!match || !match.score || !match.score.currentSet) {
      return false
    }

    const currentSet = match.score.currentSet
    const currentGame = currentSet.currentGame

    if (!currentGame) {
      return false
    }

    // Получаем индексы очков для правильного сравнения
    const teamAIndex = getPointIndex(currentGame.teamA)
    const teamBIndex = getPointIndex(currentGame.teamB)

    // Для тай-брейка
    if (currentSet.isTiebreak) {
      // В тай-брейке обычно нужно набрать 7 очков с разницей в 2 очка
      // Если команда A имеет 6 очков и ведет, это game point
      if (currentGame.teamA >= 6 && currentGame.teamA >= currentGame.teamB + 1) {
        return "teamA"
      }
      // Если команда B имеет 6 очков и ведет, это game point
      if (currentGame.teamB >= 6 && currentGame.teamB >= currentGame.teamA + 1) {
        return "teamB"
      }
      return false
    }

    // Для обычного гейма - исправленная логика с использованием индексов

    // Если у команды A преимущество (Ad)
    if (teamAIndex === 4 && teamBIndex <= 3) {
      return "teamA"
    }

    // Если команда A имеет 40 (индекс 3) и команда B имеет меньше или равно 30 (индекс <= 2)
    if (teamAIndex === 3 && teamBIndex <= 2) {
      return "teamA"
    }

    // Если у команды B преимущество (Ad)
    if (teamBIndex === 4 && teamAIndex <= 3) {
      return "teamB"
    }

    // Если команда B имеет 40 (индекс 3) и команда A имеет меньше или равно 30 (индекс <= 2)
    if (teamBIndex === 3 && teamAIndex <= 2) {
      return "teamB"
    }

    return false
  }

  // Функция для определения set point
  const isSetPointIndicator = (match) => {
    if (!match || !match.score || !match.score.currentSet) {
      return false
    }

    const currentSet = match.score.currentSet
    const teamAGames = currentSet.teamA
    const teamBGames = currentSet.teamB

    // Если идет тай-брейк, проверяем особым образом
    if (currentSet.isTiebreak) {
      // Получаем, кто имеет гейм-поинт в тай-брейке
      const gamePoint = isGamePointIndicator(match)

      // Если есть гейм-поинт в тай-брейке, то это также и сет-поинт
      if (gamePoint) {
        return gamePoint
      }

      return false
    }

    // Для обычного гейма
    // Получаем, кто имеет гейм-поинт
    const gamePoint = isGamePointIndicator(match)

    if (!gamePoint) {
      return false
    }

    // Для команды A
    if (gamePoint === "teamA") {
      // Если команда A ведет 5-x и выиграет этот гейм, то счет станет 6-x
      if (teamAGames === 5 && teamBGames <= 4) {
        return "teamA"
      }
      // Если команда A ведет 6-5 и выиграет этот гейм, то счет станет 7-5
      if (teamAGames === 6 && teamBGames === 5) {
        return "teamA"
      }
    }

    // Для команды B
    if (gamePoint === "teamB") {
      // Если команда B ведет 5-x и выиграет этот гейм, то счет станет 6-x
      if (teamBGames === 5 && teamAGames <= 4) {
        return "teamB"
      }
      // Если команда B ведет 6-5 и выиграет этот гейм, то счет станет 7-5
      if (teamBGames === 6 && teamAGames === 5) {
        return "teamB"
      }
    }

    return false
  }

  // Функция для определения match point
  const isMatchPointIndicator = (match) => {
    if (!match || !match.score || !match.score.currentSet) {
      return false
    }

    // Определяем, сколько сетов нужно для победы (обычно 2 из 3)
    const setsToWin = Math.ceil(match.settings.sets / 2)

    // Получаем текущий счет по сетам
    const teamASets = match.score.sets ? match.score.sets.filter((set) => set.teamA > set.teamB).length : 0
    const teamBSets = match.score.sets ? match.score.sets.filter((set) => set.teamB > set.teamA).length : 0

    // Проверяем, является ли текущий гейм сет-поинтом
    const setPoint = isSetPointIndicator(match)

    // Если нет сет-поинта, то не может быть и матч-поинта
    if (!setPoint) {
      return false
    }

    // Для команды A
    if (setPoint === "teamA" && teamASets === setsToWin - 1) {
      return "teamA"
    }

    // Для команды B
    if (setPoint === "teamB" && teamBSets === setsToWin - 1) {
      return "teamB"
    }

    return false
  }

  // Функция для определения важного момента
  const getImportantPointIndicator = (match) => {
    if (!match || !match.score || !match.score.currentSet) {
      return { type: null, team: null }
    }

    // Проверяем, идет ли тай-брейк
    const isTiebreak = match.score.currentSet.isTiebreak || false

    // Сначала проверяем match point (самый приоритетный)
    let matchPoint = isMatchPointIndicator(match)
    if (matchPoint) {
      return { type: "MATCH POINT", team: matchPoint }
    }
    // Сначала проверяем match point (самый приоритетный)
    matchPoint = isMatchPointIndicator(match)
    if (matchPoint) {
      return { type: "MATCH POINT", team: matchPoint }
    }

    // Затем проверяем set point
    const setPoint = isSetPointIndicator(match)
    if (setPoint) {
      return { type: "SET POINT", team: setPoint }
    }

    // Затем проверяем game point
    const gamePoint = isGamePointIndicator(match)
    if (gamePoint) {
      // Если идет тай-брейк, показываем "TIEBREAK POINT" вместо "GAME POINT"
      if (isTiebreak) {
        return { type: "TIEBREAK POINT", team: gamePoint }
      }
      return { type: "GAME POINT", team: gamePoint }
    }

    // Если нет важного момента, возвращаем тип индикатора в зависимости от того, идет ли тай-брейк
    return { type: isTiebreak ? "TIEBREAK" : null, team: null }
  }

  // Функция для получения текста важного события
  const getImportantEventText = () => {
    if (!match || !match.score) return null

    // Проверяем, завершен ли матч
    if (match.isCompleted) {
      return "MATCH IS OVER"
    }

    const importantPoint = getImportantPointIndicator(match)

    // Возвращаем тип важного события, если оно есть
    if (importantPoint.type) {
      return importantPoint.type
    }

    return null
  }

  const isServing = (team, playerIndex) => {
    return match.currentServer.team === team && match.currentServer.playerIndex === playerIndex
  }

  const getServeSide = () => {
    // Если матч не инициализирован, вернуть правую сторону по умолчанию
    if (!match || !match.score || !match.score.currentSet) return "R"

    // Получаем текущий гейм
    const currentGame = match.score.currentSet.currentGame

    // Считаем общее количество очков в текущем гейме
    const totalPoints =
      (currentGame.teamA === "Ad"
        ? 4
        : typeof currentGame.teamA === "number"
          ? currentGame.teamA === 0
            ? 0
            : currentGame.teamA === 15
              ? 1
              : currentGame.teamA === 30
                ? 2
                : 3
          : 0) +
      (currentGame.teamB === "Ad"
        ? 4
        : typeof currentGame.teamB === "number"
          ? currentGame.teamB === 0
            ? 0
            : currentGame.teamB === 15
              ? 1
              : currentGame.teamB === 30
                ? 2
                : 3
          : 0)

    // В тай-брейке логика немного другая
    if (match.score.currentSet.isTiebreak) {
      // В тай-брейке первая подача справа, затем чередуется каждые 2 очка
      // Но первая смена происходит после 1 очка
      if (totalPoints === 0) return "R"

      // После первого очка и далее
      // Нечетное количество очков - левая сторона, четное - правая
      return totalPoints % 2 === 1 ? "L" : "R"
    }

    // В обычном гейме: четное количество очков - правая сторона, нечетное - левая
    return totalPoints % 2 === 0 ? "R" : "L"
  }

  const manualSwitchServer = () => {
    if (!updateMatch || match.isCompleted) return

    // Save the current match state before any changes
    const previousState = JSON.parse(JSON.stringify(match))
    // Save to history
    setMatchHistory((prev) => [...prev, previousState])

    // Create a copy of the match
    const updatedMatch = { ...match }

    // Switch server
    switchServer(updatedMatch)

    // Update match
    updateMatch(updatedMatch)
  }

  const manualSwitchSides = () => {
    if (!updateMatch || match.isCompleted) return

    // Save the current match state before any changes
    const previousState = JSON.parse(JSON.stringify(match))
    // Save to history
    setMatchHistory((prev) => [...prev, previousState])

    // Create a copy of the match
    const updatedMatch = { ...match }

    // Switch sides
    updatedMatch.courtSides = {
      teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
      teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
    }

    // Update match
    updateMatch(updatedMatch)
  }

  // Получаем текущий счет в виде строки (0, 15, 30, 40, Ad)
  const getCurrentGameScore = (team) => {
    if (currentSet.isTiebreak) {
      return currentSet.currentGame[team]
    }

    return getTennisPointName(currentSet.currentGame[team])
  }

  // Определяем общее количество сетов в матче
  const totalSets = match.settings.sets
  const currentSetIndex = match.score.sets.length

  // Создаем массив всех сетов (включая будущие)
  const allSets = []

  // Добавляем прошедшие сеты
  for (let i = 0; i < match.score.sets.length; i++) {
    allSets.push(match.score.sets[i])
  }

  // Добавляем текущий сет, если матч не завершен
  if (!match.isCompleted && currentSet) {
    allSets.push({
      teamA: currentSet.teamA,
      teamB: currentSet.teamB,
      isCurrent: true,
    })
  }

  // Добавляем будущие сеты
  while (allSets.length < totalSets) {
    allSets.push({ teamA: "-", teamB: "-", isFuture: true })
  }

  const isGamePoint = (team) => {
    const currentGame = match.score.currentSet.currentGame
    const otherTeam = team === "teamA" ? "teamB" : "teamA"
    const teamAIndex = currentGame.teamA
    const teamBIndex = currentGame.teamB

    if (match.settings.scoringSystem === "classic") {
      if (currentGame[team] === 40 && currentGame[otherTeam] < 40) {
        return team
      } else if (currentGame[team] === "Ad") {
        return team
      }
    } else if (match.settings.scoringSystem === "no-ad" || match.settings.scoringSystem === "fast4") {
      if (currentGame[team] === 40) {
        return team
      }
    }

    // Add this to the isGamePoint function or similar logic
    if (match.settings.isSuperSet) {
      const teamAScore = match.score.currentSet.teamA
      const teamBScore = match.score.currentSet.teamB

      // Special case for 7-7 in Super Set
      if (teamAScore === 7 && teamBScore === 7) {
        // Check if this point would make it 8-7
        if (currentGame.teamA > currentGame.teamB && teamAIndex >= 3 && teamBIndex <= 2) {
          return "teamA"
        }
        // Check if this point would make it 7-8
        if (currentGame.teamB > currentGame.teamA && teamBIndex >= 3 && teamAIndex <= 2) {
          return "teamB"
        }
      }

      // Special case for 8-7 or 7-8 in Super Set
      if ((teamAScore === 8 && teamBScore === 7) || (teamAScore === 7 && teamBScore === 8)) {
        // Check if this point would make it 9-7 or 7-9 (winning the set)
        if (teamAScore > teamBScore && teamAIndex >= 3 && teamBIndex <= 2) {
          return "teamA"
        }
        if (teamBScore > teamAScore && teamBIndex >= 3 && teamAIndex <= 2) {
          return "teamB"
        }
      }
    }

    return null
  }

  return (
    <>
      <AlertDialog open={showMatchEndDialog} onOpenChange={setShowMatchEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("match.finishMatch")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMatchUpdate &&
                t("match.teamWonMatch", {
                  team:
                    pendingMatchUpdate.winner === "teamA"
                      ? pendingMatchUpdate.teamA.players.map((p) => p.name).join(" & ")
                      : pendingMatchUpdate.teamB.players.map((p) => p.name).join(" & "),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelMatchCompletion}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => setShowMatchEndDialog(false)}>{t("common.continue")}</AlertDialogAction>
            <AlertDialogAction onClick={handleCompleteMatch}>{t("match.finishMatch")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-center mb-4 w-full">
        <Tabs
          defaultValue={fixedSides ? "sides" : "players"}
          value={fixedSides ? "sides" : "players"}
          onValueChange={(value) => {
            const newValue = value === "sides"
            setFixedSides(newValue)
            // Генерируем пользовательское событие для синхронизации с другими компонентами
            const event = new CustomEvent("fixedSidesChanged", {
              detail: { value: newValue },
            })
            window.dispatchEvent(event)
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 bg-[#f5fef3] shadow-md">
            <TabsTrigger
              value="sides"
              className="data-[state=active]:bg-[#c5f87e] data-[state=inactive]:bg-[#f5fef3] flex items-center justify-center gap-1 px-3 py-1 text-xs sm:text-sm"
            >
              {fixedSides && <CircleDot className="h-3 w-3 text-green-700" />}
              {t("match.fixedSides")}
            </TabsTrigger>
            <TabsTrigger
              value="players"
              className="data-[state=active]:bg-[#c5f87e] data-[state=inactive]:bg-[#f5fef3] flex items-center justify-center gap-1 px-3 py-1 text-xs sm:text-sm"
            >
              {!fixedSides && <CircleDot className="h-3 w-3 text-green-700" />}
              {t("match.fixedPlayers")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-0 items-center w-full">
        <div className="text-right space-y-1 pr-3 border-r border-gray-200">
          {fixedSides && <div className="text-sm text-muted-foreground mb-1 text-right">Ліва сторона</div>}
          {!fixedSides && (
            <div className="text-xs text-green-600 font-medium">
              {match.courtSides?.teamA === "left" ? "Ліва сторона" : "Права сторона"}
            </div>
          )}
          {fixedSides
            ? match.courtSides?.teamA === "left"
              ? // Команда A на левой стороне
                teamA.players.map((player, idx) => {
                  // Учитываем смену игроков
                  const actualIdx = swappedTeamA ? (idx === 0 ? 1 : 0) : idx
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-end w-full ${isServing("teamA", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                    >
                      {isServing("teamA", actualIdx) && (
                        <Badge
                          variant="outline"
                          className="mr-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                          style={{ width: "14.4px", height: "14.4px" }}
                        >
                          <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                        </Badge>
                      )}
                      <div className="w-full overflow-hidden max-w-full">
                        <p className="font-medium text-right truncate text-[10px] sm:text-[14px] md:text-[16px]">
                          {teamA.players[actualIdx].name}
                        </p>
                      </div>
                    </div>
                  )
                })
              : // Команда B на левой стороне
                teamB.players.map((player, idx) => {
                  // Учитываем смену игроков
                  const actualIdx = swappedTeamB ? (idx === 0 ? 1 : 0) : idx
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-end w-full ${isServing("teamB", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                    >
                      {isServing("teamB", actualIdx) && (
                        <Badge
                          variant="outline"
                          className="mr-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                          style={{ width: "14.4px", height: "14.4px" }}
                        >
                          <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                        </Badge>
                      )}
                      <div className="w-full overflow-hidden max-w-full">
                        <p className="font-medium text-right truncate text-[10px] sm:text-[14px] md:text-[16px]">
                          {teamB.players[actualIdx].name}
                        </p>
                      </div>
                    </div>
                  )
                })
            : // Fixed players mode - always show Team A on left
              teamA.players.map((player, idx) => {
                // Учитываем смену игроков
                const actualIdx = swappedTeamA ? (idx === 0 ? 1 : 0) : idx
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-end w-full ${isServing("teamA", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                  >
                    {isServing("teamA", actualIdx) && (
                      <Badge
                        variant="outline"
                        className="mr-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                        style={{ width: "14.4px", height: "14.4px" }}
                      >
                        <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                      </Badge>
                    )}
                    <div className="w-full overflow-hidden max-w-full">
                      <p className="font-medium text-right truncate text-[10px] sm:text-[14px] md:text-[16px]">
                        {teamA.players[actualIdx].name}
                      </p>
                    </div>
                  </div>
                )
              })}
        </div>
        <div className="text-left space-y-1 pl-3">
          {fixedSides && <div className="text-sm text-muted-foreground mb-1 text-left">Права сторона</div>}
          {!fixedSides && (
            <div className="text-xs text-green-600 font-medium">
              {match.courtSides?.teamB === "left" ? "Ліва сторона" : "Права сторона"}
            </div>
          )}
          {fixedSides
            ? match.courtSides?.teamA === "right"
              ? // Команда A на правой стороне
                teamA.players.map((player, idx) => {
                  // Учитываем смену игроков
                  const actualIdx = swappedTeamA ? (idx === 0 ? 1 : 0) : idx
                  return (
                    <div
                      key={idx}
                      className={`flex items-center w-full ${isServing("teamA", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                    >
                      <div className="w-full overflow-hidden max-w-full">
                        <p className="font-medium text-left truncate text-[10px] sm:text-[14px] md:text-[16px]">
                          {teamA.players[actualIdx].name}
                        </p>
                      </div>
                      {isServing("teamA", actualIdx) && (
                        <Badge
                          variant="outline"
                          className="ml-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                          style={{ width: "14.4px", height: "14.4px" }}
                        >
                          <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                        </Badge>
                      )}
                    </div>
                  )
                })
              : // Команда B на правой стороне
                teamB.players.map((player, idx) => {
                  // Учитываем смену игроков
                  const actualIdx = swappedTeamB ? (idx === 0 ? 1 : 0) : idx
                  return (
                    <div
                      key={idx}
                      className={`flex items-center w-full ${isServing("teamB", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                    >
                      <div className="w-full overflow-hidden max-w-full">
                        <p className="font-medium text-left truncate text-[10px] sm:text-[14px] md:text-[16px]">
                          {teamB.players[actualIdx].name}
                        </p>
                      </div>
                      {isServing("teamB", actualIdx) && (
                        <Badge
                          variant="outline"
                          className="ml-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                          style={{ width: "14.4px", height: "14.4px" }}
                        >
                          <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                        </Badge>
                      )}
                    </div>
                  )
                })
            : // Fixed players mode - always show Team B on right
              teamB.players.map((player, idx) => {
                // Учитываем смену игроков
                const actualIdx = swappedTeamB ? (idx === 0 ? 1 : 0) : idx
                return (
                  <div
                    key={idx}
                    className={`flex items-center w-full ${isServing("teamB", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                  >
                    <div className="w-full overflow-hidden max-w-full">
                      <p className="font-medium text-left truncate text-[10px] sm:text-[14px] md:text-[16px]">
                        {teamB.players[actualIdx].name}
                      </p>
                    </div>
                    {isServing("teamB", actualIdx) && (
                      <Badge
                        variant="outline"
                        className="ml-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                        style={{ width: "14.4px", height: "14.4px" }}
                      >
                        <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                      </Badge>
                    )}
                  </div>
                )
              })}
        </div>
      </div>

      <Card>
        <CardContent className="p-3 shadow-md rounded-lg">
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="text-center flex flex-col items-center gap-2">
              <button
                disabled={isProcessingClick}
                className={`text-6xl font-bold px-8 py-4 rounded-md transition-all transform active:scale-95 active:translate-y-1 active:shadow-inner shadow-md scale-110 ${
                  isProcessingClick && processingTeam === (fixedSides ? (displayMatch.courtSides?.teamA === "left" ? "teamA" : "teamB") : "teamA")
                    ? "bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse opacity-75" 
                    : currentSet.isTiebreak
                    ? "bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 active:from-red-200 active:to-red-300"
                    : "bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 active:from-blue-200 active:to-blue-300"
                }`}
                onClick={() =>
                  handleScoreClick(fixedSides ? (displayMatch.courtSides?.teamA === "left" ? "teamA" : "teamB") : "teamA")
                }
              >
                {fixedSides
                  ? match.courtSides?.teamA === "left"
                    ? getCurrentGameScore("teamA")
                    : getCurrentGameScore("teamB")
                  : getCurrentGameScore("teamA")}
              </button>
              <button
                disabled={isProcessingClick}
                className={`text-sm font-medium px-4 py-1 rounded-md transition-all transform active:scale-95 shadow-sm ${isProcessingClick ? 'bg-gray-200 opacity-75' : 'bg-red-100 hover:bg-red-200 active:bg-red-300'}`}
                onClick={() =>
                  handleScoreDecrease(fixedSides ? (displayMatch.courtSides?.teamA === "left" ? "teamA" : "teamB") : "teamA")
                }
              >
                -1
              </button>
            </div>
            <div className="text-center flex flex-col items-center gap-2">
              <button
                disabled={isProcessingClick}
                className={`text-6xl font-bold px-8 py-4 rounded-md transition-all transform active:scale-95 active:translate-y-1 active:shadow-inner shadow-md scale-110 ${
                  isProcessingClick && processingTeam === (fixedSides ? (displayMatch.courtSides?.teamA === "right" ? "teamA" : "teamB") : "teamB")
                    ? "bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse opacity-75" 
                    : currentSet.isTiebreak
                    ? "bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 active:from-red-200 active:to-red-300"
                    : "bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 active:from-blue-200 active:to-blue-300"
                }`}
                onClick={() =>
                  handleScoreClick(fixedSides ? (displayMatch.courtSides?.teamA === "right" ? "teamA" : "teamB") : "teamB")
                }
              >
                {fixedSides
                  ? match.courtSides?.teamA === "right"
                    ? getCurrentGameScore("teamA")
                    : getCurrentGameScore("teamB")
                  : getCurrentGameScore("teamB")}
              </button>
              <button
                disabled={isProcessingClick}
                className={`text-sm font-medium px-4 py-1 rounded-md transition-all transform active:scale-95 shadow-sm ${isProcessingClick ? 'bg-gray-200 opacity-75' : 'bg-red-100 hover:bg-red-200 active:bg-red-300'}`}
                onClick={() =>
                  handleScoreDecrease(fixedSides ? (displayMatch.courtSides?.teamA === "right" ? "teamA" : "teamB") : "teamB")
                }
              >
                -1
              </button>
            </div>
          </div>

          {/* Кнопка отмены изменения счета */}
          <div className="mt-4">
            <button
              className="w-full py-2 px-4 bg-gradient-to-br from-blue-800 to-blue-950 hover:from-blue-700 hover:to-blue-900 active:from-blue-600 active:to-blue-800 text-white border border-blue-700 rounded-md text-sm font-medium flex items-center justify-center transition-all shadow-md transform active:scale-95 active:translate-y-1 active:shadow-inner disabled:opacity-50 disabled:pointer-events-none"
              onClick={() => {
                if (matchHistory.length > 0) {
                  const previousMatch = matchHistory[matchHistory.length - 1]
                  updateMatch(previousMatch)
                  setMatchHistory((prev) => prev.slice(0, -1))
                }
              }}
              disabled={matchHistory.length === 0}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M3 7v6h6"></path>
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
              </svg>
              {t("match.undo") || "Undo"}
            </button>

            {/* Индикатор важных событий */}
            {getImportantEventText() && (
              <div
                className="mt-2 py-0.5 px-2 bg-red-700 text-white font-bold text-center rounded-md shadow-md text-[9px]"
                style={{
                  opacity: getImportantEventText() ? 1 : 0,
                  transition: "opacity 0.3s ease",
                }}
              >
                {getImportantEventText()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
        <div className="text-center">
          <span className="text-xl font-bold">
            {fixedSides ? (match.courtSides?.teamA === "left" ? currentSet.teamA : currentSet.teamB) : currentSet.teamA}
            {match.isCompleted &&
              match.winner === (fixedSides ? (match.courtSides?.teamA === "left" ? "teamA" : "teamB") : "teamA") && (
                <Trophy size={20} className="ml-1 text-yellow-500 inline-block" />
              )}
          </span>
        </div>
        <div className="text-center text-muted-foreground">
          {`${t("match.set")} ${currentSetIndex + 1} ${t("match.of")} ${totalSets}`}
          {currentSet.isTiebreak && currentSet.isSuperTiebreak && (
            <span className="ml-2 text-red-600 font-medium">(Финальный тайбрейк)</span>
          )}
        </div>
        <div className="text-center">
          <span className="text-xl font-bold">
            {fixedSides
              ? match.courtSides?.teamA === "right"
                ? currentSet.teamA
                : currentSet.teamB
              : currentSet.teamB}
            {match.isCompleted &&
              match.winner === (fixedSides ? (match.courtSides?.teamA === "right" ? "teamA" : "teamB") : "teamB") && (
                <Trophy size={20} className="ml-1 text-yellow-500 inline-block" />
              )}
          </span>
        </div>
      </div>

      {allSets.length > 0 && (
        <div className="mt-2">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-sm leading-tight">
            <div></div>
            <div className="text-center">
              <div className="font-medium -mt-1 mb-0">{t("match.teamA")}</div>
              <div className="flex flex-col -space-y-0.5">
                {teamA.players.map((player, idx) => (
                  <div key={idx} className="text-xs text-gray-500 truncate">
                    {player.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium -mt-1 mb-0">{t("match.teamB")}</div>
              <div className="flex flex-col -space-y-0.5">
                {teamB.players.map((player, idx) => (
                  <div key={idx} className="text-xs text-gray-500 truncate">
                    {player.name}
                  </div>
                ))}
              </div>
            </div>

            {allSets.map((set, index) => {
              // Skip rendering the current set if the match is completed
              if (match.isCompleted && set.isCurrent) {
                return null
              }

              return (
                <div key={index} className="contents">
                  <div className="font-medium flex items-center">
                    {t("match.setX").replace("{{number}}", (index + 1).toString())}
                    {set.isCurrent && (
                      <Badge variant="outline" className="ml-1 bg-blue-100 text-blue-800 text-[10px] px-1 py-0">
                        {t("match.current")}
                      </Badge>
                    )}
                  </div>
                  <div className={`text-center ${set.isFuture ? "text-muted-foreground" : ""}`}>{set.teamA}</div>
                  <div className={`text-center ${set.isFuture ? "text-muted-foreground" : ""}`}>{set.teamB}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
