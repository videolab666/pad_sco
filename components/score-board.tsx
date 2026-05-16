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
import { applyScoreIncrement, getImportantPoint } from "@/lib/scoring-logic"

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
  // Task 4: tracks the rule revision the scoreboard has already reconciled.
  const [ruleRevisionSeen, setRuleRevisionSeen] = useState(match?.ruleRevision)
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

  // Task 4, Step 3: when a settings edit is saved the match arrives with a
  // bumped ruleRevision. Drop the stale click/history buffers and the pending
  // match-end confirmation, then refresh the scoreboard from the canonical match.
  useEffect(() => {
    const rev = match?.ruleRevision
    if (rev === undefined || rev === ruleRevisionSeen) return
    setRuleRevisionSeen(rev)
    setMatchHistory([])
    setLocalMatchState(match)
    setPendingMatchUpdate(null)
    setPreviousMatchState(null)
    setShowMatchEndDialog(false)
  }, [match?.ruleRevision])

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

    // Deep copy to avoid mutating state
    const updatedMatch = JSON.parse(JSON.stringify(currentMatchState))

    // Apply score using unified engine
    const resultMatch = applyScoreIncrement(updatedMatch, team)

    // If the engine completed the match, show confirmation dialog
    if (resultMatch.isCompleted && !currentMatchState.isCompleted) {
      setPendingMatchUpdate(resultMatch)
      setPreviousMatchState(previousState)
      setLocalMatchState(resultMatch)
      setShowMatchEndDialog(true)
      return
    }

    setLocalMatchState(resultMatch)
    updateMatch(resultMatch)
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
      setProcessingTeam(null)
    }, 500)
    
    // Set which team is being processed for visual feedback
    setProcessingTeam(team)

    // Use localMatchState if available, otherwise use the match prop
    const currentMatchState = localMatchState || match

    // If there is history, use undo (pop last state)
    if (matchHistory.length > 0) {
      const previousMatch = matchHistory[matchHistory.length - 1]
      setMatchHistory((prev) => prev.slice(0, -1))
      setLocalMatchState(previousMatch)
      updateMatch(previousMatch)
      return
    }

    // No history — best-effort single-point decrement
    const updatedMatch = JSON.parse(JSON.stringify(currentMatchState))
    updatedMatch.history = []

    const currentSet = updatedMatch.score.currentSet

    if (currentSet.isTiebreak) {
      if (updatedMatch.score.currentSet.currentGame[team] > 0) {
        updatedMatch.score.currentSet.currentGame[team]--
      }
    } else {
      const currentGame = updatedMatch.score.currentSet.currentGame
      const scoringSystem = updatedMatch.settings.scoringSystem || "classic"

      if (scoringSystem === "classic") {
        if (currentGame[team] === "Ad") {
          currentGame[team] = 40
        } else if (currentGame[team] === 40) {
          currentGame[team] = 30
        } else if (currentGame[team] === 30) {
          currentGame[team] = 15
        } else if (currentGame[team] === 15) {
          currentGame[team] = 0
        }
        // At 0 there is nothing to decrement — user should use Undo
      } else if (scoringSystem === "no-ad" || scoringSystem === "fast4") {
        if (currentGame[team] === 40) {
          currentGame[team] = 30
        } else if (currentGame[team] === 30) {
          currentGame[team] = 15
        } else if (currentGame[team] === 15) {
          currentGame[team] = 0
        }
      }
    }

    updateMatch(updatedMatch)
  }

  const handleCompleteMatch = () => {
    if (pendingMatchUpdate) {
      const finalMatch = { ...pendingMatchUpdate }
      finalMatch.isCompleted = true
      finalMatch.winner = pendingMatchUpdate.winner

      updateMatch(finalMatch)

      setPendingMatchUpdate(null)
      setPreviousMatchState(null)
    }

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

  // Функция для получения текста важного события
  const getImportantEventText = () => {
    if (!match || !match.score) return null
    if (match.isCompleted) return "MATCH IS OVER"
    const { type } = getImportantPoint(match)
    return type || null
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
            <AlertDialogAction onClick={handleCancelMatchCompletion}>{t("common.continue")}</AlertDialogAction>
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
