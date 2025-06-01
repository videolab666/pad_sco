"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { LockOpenIcon } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { useLanguage } from "@/contexts/language-context"

// Обновим тип пропсов, чтобы сделать некоторые параметры опциональными
type MatchSettingsProps = {
  match?: any
  updateMatch?: any
  type?: string
  settings?: {
    sets: number
    games: number
    tiebreak: boolean
    finalSetTiebreak: boolean
    goldPoint: boolean
    servingSide: "left" | "right"
    servingTeam: 1 | 2
    servingPlayer: 1 | 2 | 3 | 4
  }
  onChange?: (settings: any) => void
}

// Обновим начало функции компонента, чтобы обрабатывать оба случая использования
export function MatchSettings({ match, updateMatch, type, settings, onChange }: MatchSettingsProps) {
  const { t } = useLanguage()
  const [tiebreakEnabled, setTiebreakEnabled] = useState(match?.settings?.tiebreakEnabled)
  const [tiebreakType, setTiebreakType] = useState(match?.settings?.tiebreakType || "regular")
  const [tiebreakAt, setTiebreakAt] = useState(match?.settings?.tiebreakAt)
  const [finalSetTiebreak, setFinalSetTiebreak] = useState(match?.settings?.finalSetTiebreak)
  const [scoringSystem, setScoringSystem] = useState(match?.settings?.scoringSystem || "classic")
  const [goldenGame, setGoldenGame] = useState(match?.settings?.goldenGame || false)
  const [goldenPoint, setGoldenPoint] = useState(match?.settings?.goldenPoint || false)
  const [windbreak, setWindbreak] = useState(match?.settings?.windbreak || false)

  // Состояние для редактирования счета сетов
  const [editSetIndex, setEditSetIndex] = useState(null)
  const [editSetScoreA, setEditSetScoreA] = useState(0)
  const [editSetScoreB, setEditSetScoreB] = useState(0)

  // Добавим проверку на наличие settings и onChange
  const handleChange = (key: string, value: any) => {
    if (onChange && settings) {
      onChange({ ...settings, [key]: value })
    }
  }

  const applySettings = () => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }

    // Отключаем историю
    updatedMatch.history = []

    // Обновляем настройки
    updatedMatch.settings = {
      ...updatedMatch.settings,
      tiebreakEnabled,
      tiebreakType,
      tiebreakAt,
      finalSetTiebreak,
      scoringSystem,
      goldenGame,
      goldenPoint,
      windbreak,
    }

    try {
      updateMatch(updatedMatch)
    } catch (error) {
      console.error("Ошибка при обновлении настроек:", error)

      // Если произошла ошибка, пробуем упростить объект матча
      const minimalMatch = {
        ...updatedMatch,
        history: [],
      }

      // Удаляем историю геймов для экономии места
      if (minimalMatch.score && minimalMatch.score.currentSet) {
        minimalMatch.score.currentSet.games = []
      }

      if (minimalMatch.score && minimalMatch.score.sets) {
        minimalMatch.score.sets = minimalMatch.score.sets.map((set) => ({
          teamA: set.teamA,
          teamB: set.teamB,
          winner: set.winner,
        }))
      }

      updateMatch(minimalMatch)
    }
  }

  const startTiebreak = () => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }

    // Отключаем историю
    updatedMatch.history = []

    // Начинаем тай-брейк
    updatedMatch.score.currentSet.isTiebreak = true
    updatedMatch.score.currentSet.currentGame = {
      teamA: 0,
      teamB: 0,
    }

    try {
      updateMatch(updatedMatch)
    } catch (error) {
      console.error("Ошибка при запуске тай-брейка:", error)

      // Если произошла ошибка, пробуем упростить объект матча
      const minimalMatch = {
        ...updatedMatch,
        history: [],
      }

      // Удаляем историю геймов для экономии места
      if (minimalMatch.score && minimalMatch.score.currentSet) {
        minimalMatch.score.currentSet.games = []
      }

      if (minimalMatch.score && minimalMatch.score.sets) {
        minimalMatch.score.sets = minimalMatch.score.sets.map((set) => ({
          teamA: set.teamA,
          teamB: set.teamB,
          winner: set.winner,
        }))
      }

      updateMatch(minimalMatch)
    }
  }

  const endTiebreak = (winner) => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }

    // Отключаем историю
    updatedMatch.history = []

    // Сохраняем счет тай-брейка перед завершением
    const tiebreakScore = {
      teamA: updatedMatch.score.currentSet.currentGame.teamA,
      teamB: updatedMatch.score.currentSet.currentGame.teamB,
    }

    // Завершаем тай-брейк и увеличиваем счет победителя
    updatedMatch.score.currentSet[winner]++

    // Сохраняем информацию о тай-брейке в текущем сете
    updatedMatch.score.currentSet.tiebreak = tiebreakScore

    // Отмечаем, что тай-брейк завершен
    updatedMatch.score.currentSet.isTiebreak = false

    // Завершаем сет
    winSet(winner, updatedMatch)
  }

  const winSet = (team, updatedMatch) => {
    if (!match || !updateMatch) return

    // Увеличиваем счет матча
    updatedMatch.score[team]++

    // Сохраняем текущий сет в историю сетов
    updatedMatch.score.sets.push({
      teamA: updatedMatch.score.currentSet.teamA,
      teamB: updatedMatch.score.currentSet.teamB,
      winner: team,
    })

    // Проверка на победу в матче
    const setsToWin = Math.ceil(match.settings.sets / 2)
    if (updatedMatch.score[team] >= setsToWin) {
      // Запрашиваем подтверждение перед завершением матча
      if (confirm(`Команда ${team === "teamA" ? "A" : "B"} выиграла матч! Завершить матч?`)) {
        updatedMatch.isCompleted = true
        updatedMatch.winner = team
        updateMatch(updatedMatch)
        return
      }
    }

    // Начинаем новый сет
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

    updateMatch(updatedMatch)
  }

  const endMatch = () => {
    if (!match || !updateMatch) return

    console.log("endMatch function called")

    // Create a copy of the match
    const updatedMatch = { ...match }

    // Mark as completed
    updatedMatch.isCompleted = true
    updatedMatch.history = []

    // Determine winner based on sets
    if (updatedMatch.score.teamA > updatedMatch.score.teamB) {
      updatedMatch.winner = "teamA"
    } else if (updatedMatch.score.teamB > updatedMatch.score.teamA) {
      updatedMatch.winner = "teamB"
    } else {
      // If sets are equal, determine by games in current set
      if (updatedMatch.score.currentSet.teamA > updatedMatch.score.currentSet.teamB) {
        updatedMatch.winner = "teamA"
      } else if (updatedMatch.score.currentSet.teamB > updatedMatch.score.currentSet.teamA) {
        updatedMatch.winner = "teamB"
      } else {
        // If games are also equal, use current game points
        if (updatedMatch.score.currentSet.currentGame.teamA > updatedMatch.score.currentSet.currentGame.teamB) {
          updatedMatch.winner = "teamA"
        } else {
          updatedMatch.winner = "teamB"
        }
      }
    }

    console.log("Updating match with:", updatedMatch)
    updateMatch(updatedMatch)
  }

  const unlockMatch = () => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }
    updatedMatch.isCompleted = false
    updatedMatch.history = []
    updateMatch(updatedMatch)
  }

  const updateSetScore = (index, team, delta) => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }
    updatedMatch.history = []

    if (index === match.score.sets.length) {
      // Обновляем текущий сет
      if (delta > 0 || updatedMatch.score.currentSet[team] > 0) {
        updatedMatch.score.currentSet[team] += delta
        if (updatedMatch.score.currentSet[team] < 0) {
          updatedMatch.score.currentSet[team] = 0
        }
      }
    } else if (index < match.score.sets.length) {
      // Обновляем завершенный сет
      if (delta > 0 || updatedMatch.score.sets[index][team] > 0) {
        updatedMatch.score.sets[index][team] += delta
        if (updatedMatch.score.sets[index][team] < 0) {
          updatedMatch.score.sets[index][team] = 0
        }
      }

      // Определяем победителя сета
      const set = updatedMatch.score.sets[index]
      if (set.teamA > set.teamB) {
        set.winner = "teamA"
      } else if (set.teamB > set.teamA) {
        set.winner = "teamB"
      } else {
        set.winner = null
      }

      // Пересчитываем общий счет матча
      updatedMatch.score.teamA = updatedMatch.score.sets.filter((set) => set.winner === "teamA").length
      updatedMatch.score.teamB = updatedMatch.score.sets.filter((set) => set.winner === "teamB").length
    }

    updateMatch(updatedMatch)
  }

  const startEditSet = (index) => {
    if (!match) return

    if (index < match.score.sets.length) {
      const set = match.score.sets[index]
      setEditSetScoreA(set.teamA)
      setEditSetScoreB(set.teamB)
      setEditSetIndex(index)
    } else if (index === match.score.sets.length) {
      // Текущий сет
      setEditSetScoreA(match.score.currentSet.teamA)
      setEditSetScoreB(match.score.currentSet.teamB)
      setEditSetIndex(index)
    }
  }

  const saveSetScore = () => {
    if (editSetIndex === null || !match || !updateMatch) return

    const updatedMatch = { ...match }
    updatedMatch.history = []

    if (editSetIndex < match.score.sets.length) {
      // Обновляем завершенный сет
      updatedMatch.score.sets[editSetIndex].teamA = editSetScoreA
      updatedMatch.score.sets[editSetIndex].teamB = editSetScoreB

      // Определяем победителя сета
      if (editSetScoreA > editSetScoreB) {
        updatedMatch.score.sets[editSetIndex].winner = "teamA"
      } else if (editSetScoreB > editSetScoreA) {
        updatedMatch.score.sets[editSetIndex].winner = "teamB"
      }

      // Пересчитываем общий счет матча
      updatedMatch.score.teamA = updatedMatch.score.sets.filter((set) => set.winner === "teamA").length
      updatedMatch.score.teamB = updatedMatch.score.sets.filter((set) => set.winner === "teamB").length
    } else if (editSetIndex === match.score.sets.length) {
      // Обновляем текущий сет
      updatedMatch.score.currentSet.teamA = editSetScoreA
      updatedMatch.score.currentSet.teamB = editSetScoreB
    }

    updateMatch(updatedMatch)
    setEditSetIndex(null)
  }

  // Создаем массив для отображения всех запланированных сетов
  const totalSets = match?.settings?.sets || 3 // По умолчанию 3 сета
  const allSetsArray = []

  // Добавляем завершенные сеты, если есть match
  if (match && match.score && match.score.sets) {
    for (let i = 0; i < match.score.sets.length; i++) {
      allSetsArray.push({
        index: i,
        isCompleted: true,
        isCurrent: false,
        teamA: match.score.sets[i].teamA,
        teamB: match.score.sets[i].teamB,
      })
    }

    // Добавляем текущий сет
    allSetsArray.push({
      index: match.score.sets.length,
      isCompleted: false,
      isCurrent: true,
      teamA: match.score.currentSet.teamA,
      teamB: match.score.currentSet.teamB,
    })

    // Добавляем будущие сеты
    for (let i = match.score.sets.length + 1; i < totalSets; i++) {
      allSetsArray.push({
        index: i,
        isCompleted: false,
        isCurrent: false,
        teamA: 0,
        teamB: 0,
      })
    }
  }

  // Если нет match, но есть settings и onChange, отрендерим только настройки для нового матча
  if (!match && settings && onChange) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-medium mb-2">{t("newMatch.matchSettings")}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sets">{t("newMatch.sets")}</Label>
            <Select
              value={settings.sets.toString()}
              onValueChange={(value) => handleChange("sets", Number.parseInt(value))}
            >
              <SelectTrigger id="sets">
                <SelectValue placeholder={t("newMatch.sets")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="games">{t("newMatch.games")}</Label>
            <Select
              value={settings.games.toString()}
              onValueChange={(value) => handleChange("games", Number.parseInt(value))}
            >
              <SelectTrigger id="games">
                <SelectValue placeholder={t("newMatch.games")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="8">8</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="tiebreak"
              checked={settings.tiebreak}
              onCheckedChange={(checked) => handleChange("tiebreak", checked)}
            />
            <Label htmlFor="tiebreak">{t("newMatch.tiebreak")}</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="finalSetTiebreak"
              checked={settings.finalSetTiebreak}
              onCheckedChange={(checked) => handleChange("finalSetTiebreak", checked)}
            />
            <Label htmlFor="finalSetTiebreak">{t("newMatch.finalSetTiebreak")}</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="goldPoint"
              checked={settings.goldPoint}
              onCheckedChange={(checked) => handleChange("goldPoint", checked)}
            />
            <Label htmlFor="goldPoint">{t("newMatch.goldPoint")}</Label>
          </div>
        </div>

        <div className="space-y-4">
          <Label>{t("newMatch.servingSide")}</Label>
          <RadioGroup
            value={settings.servingSide}
            onValueChange={(value) => handleChange("servingSide", value)}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="left" id="left" />
              <Label htmlFor="left">{t("newMatch.left")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="right" id="right" />
              <Label htmlFor="right">{t("newMatch.right")}</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <Label>{t("newMatch.servingTeam")}</Label>
          <RadioGroup
            value={settings.servingTeam.toString()}
            onValueChange={(value) => handleChange("servingTeam", Number.parseInt(value) as 1 | 2)}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="1" id="team1" />
              <Label htmlFor="team1">1</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="2" id="team2" />
              <Label htmlFor="team2">2</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <Label>{t("newMatch.servingPlayer")}</Label>
          <RadioGroup
            value={settings.servingPlayer.toString()}
            onValueChange={(value) => handleChange("servingPlayer", Number.parseInt(value) as 1 | 2 | 3 | 4)}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="1" id="player1" />
              <Label htmlFor="player1">1</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="2" id="player2" />
              <Label htmlFor="player2">2</Label>
            </div>
            {type === "padel" && (
              <>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3" id="player3" />
                  <Label htmlFor="player3">3</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="4" id="player4" />
                  <Label htmlFor="player4">4</Label>
                </div>
              </>
            )}
          </RadioGroup>
        </div>
      </div>
    )
  }

  if (!match) return null

  // Получаем имена игроков для отображения
  const getTeamPlayerNames = (teamKey) => {
    // Проверяем разные форматы данных игроков

    // Формат 1: match.teamA.players или match.teamB.players
    if (match[teamKey]?.players && Array.isArray(match[teamKey].players)) {
      return match[teamKey].players
        .map((p) => p.name || p.firstName || p.lastName || "")
        .filter(Boolean)
        .join(", ")
    }

    // Формат 2: match.players с полем team
    if (match.players && Array.isArray(match.players)) {
      // Преобразуем teamKey в формат, который может быть в поле team
      const teamIdentifiers = [
        teamKey, // "teamA"
        teamKey.replace("team", ""), // "A"
        teamKey === "teamA" ? "1" : "2", // "1" или "2"
        teamKey === "teamA" ? 1 : 2, // 1 или 2
      ]

      const teamPlayers = match.players.filter(
        (p) => teamIdentifiers.includes(p.team) || teamIdentifiers.includes(p.teamId),
      )

      if (teamPlayers.length > 0) {
        return teamPlayers
          .map((p) => p.name || p.firstName || p.lastName || "")
          .filter(Boolean)
          .join(", ")
      }
    }

    // Формат 3: match.teamAPlayers или match.teamBPlayers
    const playersKey = `${teamKey}Players`
    if (match[playersKey] && Array.isArray(match[playersKey])) {
      return match[playersKey]
        .map((p) => p.name || p.firstName || p.lastName || "")
        .filter(Boolean)
        .join(", ")
    }

    // Формат 4: match.teamAPlayer1, match.teamAPlayer2 и т.д.
    const player1Key = `${teamKey}Player1`
    const player2Key = `${teamKey}Player2`

    const player1 = match[player1Key]
    const player2 = match[player2Key]

    const player1Name = typeof player1 === "string" ? player1 : player1?.name || player1?.firstName || ""
    const player2Name = typeof player2 === "string" ? player2 : player2?.name || player2?.firstName || ""

    const playerNames = [player1Name, player2Name].filter(Boolean)

    if (playerNames.length > 0) {
      return playerNames.join(", ")
    }

    // Жестко закодированные имена для демонстрации
    if (teamKey === "teamA") {
      return "Игрок 1, Игрок 2"
    } else {
      return "Игрок 3, Игрок 4"
    }
  }

  // Получаем имена игроков для обеих команд
  const teamAPlayerNames = getTeamPlayerNames("teamA")
  const teamBPlayerNames = getTeamPlayerNames("teamB")

  return (
    <>
      {/* Score Editing Card */}
      <Card className="w-full mb-4 bg-gradient-to-b from-[#019fe3] to-[#00336d]">
        <CardHeader>
          <CardTitle className="text-white">{t("match.scoreEditing")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-800 px-[3px]">
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-center">
            {t("match.matchCode")}: <span className="font-bold">{match.code || match.id}</span>
          </div>

          <div className="py-4 px-[3px] bg-blue-50 border border-blue-200 rounded-md mt-4">
            <h3 className="font-medium text-center mb-3">{t("match.editSets") || "Edit Set Scores"}</h3>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border-b-2 border-gray-300"></th>
                    <th className="p-2 border-b-2 border-gray-300 text-center">
                      <div className="font-bold">
                        {match.teamA?.name || match.teamAName || t("match.teamA") || "Команда A"}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{teamAPlayerNames}</div>
                    </th>
                    <th className="p-2 border-b-2 border-gray-300 text-center">
                      <div className="font-bold">
                        {match.teamB?.name || match.teamBName || t("match.teamB") || "Команда B"}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{teamBPlayerNames}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allSetsArray.map((set, idx) => (
                    <tr key={idx} className={set.isCurrent ? "bg-blue-100" : ""}>
                      <td className="p-2 border-r border-gray-300 text-[13px] text-center" style={{ fontSize: "13px" }}>
                        <span className="font-bold">{t("match.set")}</span> {idx + 1}
                      </td>
                      <td className="p-2 border-r border-gray-300">
                        <div className="flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateSetScore(set.index, "teamA", -1)}
                            disabled={match.isCompleted}
                          >
                            -
                          </Button>
                          <span className="mx-3 font-bold text-lg">{set.teamA}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateSetScore(set.index, "teamA", 1)}
                            disabled={match.isCompleted}
                          >
                            +
                          </Button>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateSetScore(set.index, "teamB", -1)}
                            disabled={match.isCompleted}
                          >
                            -
                          </Button>
                          <span className="mx-3 font-bold text-lg">{set.teamB}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateSetScore(set.index, "teamB", 1)}
                            disabled={match.isCompleted}
                          >
                            +
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            {/* Sets selection - similar to new match page */}
            <div className="border rounded-md py-3 px-[3px] bg-[#f8fdf9] shadow-md">
              <Label>{t("newMatch.sets")}</Label>
              <Select
                value={match.settings?.sets?.toString() || "3"}
                onValueChange={(value) => {
                  const updatedMatch = { ...match }
                  updatedMatch.settings.sets = Number.parseInt(value)
                  updateMatch(updatedMatch)
                }}
                disabled={match.isCompleted}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("newMatch.sets")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("newMatch.oneSets")}</SelectItem>
                  <SelectItem value="3">{t("newMatch.threeSets")}</SelectItem>
                  <SelectItem value="5">{t("newMatch.fiveSets")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Final Set Tiebreak - similar to new match page */}
            <div className="border border-green-200 rounded-md py-3 px-[3px] bg-green-50 shadow-md mt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>{t("newMatch.finalSetTiebreak")}</Label>
                <Switch
                  id="final-set-tiebreak"
                  checked={finalSetTiebreak}
                  onCheckedChange={setFinalSetTiebreak}
                  disabled={match.isCompleted}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                />
              </div>
            </div>

            {/* Scoring System - similar to new match page */}
            <div className="border rounded-md py-3 px-[3px] bg-[#f8fdf9] shadow-md">
              <Label>{t("match.scoringSystem")}</Label>
              <Select value={scoringSystem} onValueChange={setScoringSystem} disabled={match.isCompleted}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("match.scoringSystem")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">{t("match.classicScoring")}</SelectItem>
                  <SelectItem value="no-ad">{t("match.noAdScoring")}</SelectItem>
                  <SelectItem value="fast4">{t("match.fast4Scoring")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tiebreak settings - similar to new match page */}
            <div className="border rounded-md py-4 px-[3px] bg-[#f3f5f7] shadow-md">
              <div className="flex items-center justify-between mb-4">
                <Label>{t("newMatch.tiebreak")}</Label>
                <Switch
                  id="tiebreak-enabled"
                  checked={tiebreakEnabled}
                  onCheckedChange={setTiebreakEnabled}
                  disabled={match.isCompleted}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                />
              </div>

              {tiebreakEnabled && (
                <>
                  <div>
                    <Label>{t("match.tiebreakType")}</Label>
                    <RadioGroup
                      value={tiebreakType}
                      onValueChange={setTiebreakType}
                      className="grid grid-cols-1 gap-2 mt-2"
                      disabled={match.isCompleted}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="regular" id="tiebreak-regular" disabled={match.isCompleted} />
                        <div>
                          <Label htmlFor="tiebreak-regular" className="font-medium">
                            {t("newMatch.regularTiebreak")}
                          </Label>
                          <p className="text-xs text-muted-foreground">До 7 очков (с разницей в 2 очка)</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="championship" id="tiebreak-championship" disabled={match.isCompleted} />
                        <div>
                          <Label htmlFor="tiebreak-championship" className="font-medium">
                            {t("newMatch.championshipTiebreak")}
                          </Label>
                          <p className="text-xs text-muted-foreground">До 10 очков (с разницей в 2 очка)</p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="mt-4">
                    <Label>{t("match.tiebreakAt")}</Label>
                    <Select value={tiebreakAt} onValueChange={setTiebreakAt} disabled={match.isCompleted}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("match.selectTiebreakScore")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6-6">6:6</SelectItem>
                        <SelectItem value="5-5">5:5</SelectItem>
                        <SelectItem value="4-4">4:4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            {/* Additional settings - similar to new match page */}
            <div className="border rounded-md py-4 px-[3px] bg-[#f8fdf9] shadow-md">
              <Label className="text-base font-medium">{t("match.additional")}</Label>
              <div className="space-y-2 mt-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="golden-game"
                    checked={goldenGame}
                    onCheckedChange={setGoldenGame}
                    disabled={match.isCompleted}
                  />
                  <Label htmlFor="golden-game" className="text-sm">
                    {t("match.goldenGame")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="golden-point"
                    checked={goldenPoint}
                    onCheckedChange={setGoldenPoint}
                    disabled={match.isCompleted}
                  />
                  <Label htmlFor="golden-point" className="text-sm">
                    {t("match.goldenPoint")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="windbreak"
                    checked={windbreak}
                    onCheckedChange={setWindbreak}
                    disabled={match.isCompleted}
                  />
                  <Label htmlFor="windbreak" className="text-sm">
                    {t("match.windbreak")}
                  </Label>
                </div>
              </div>
            </div>

            <Button
              className="w-full shadow-md transition-all duration-200 active:scale-95 bg-gradient-to-b from-[#f5f9fd] to-[#e1e9f5] hover:from-white hover:to-[#f5f9fd] text-[#00336d]"
              onClick={applySettings}
              disabled={match.isCompleted}
            >
              {t("match.applySettings")}
            </Button>
          </div>

          <div className="pt-2 border-t">
            {match.isCompleted ? (
              <Button
                variant="outline"
                className="w-full mt-2 shadow-md transition-all duration-200 active:scale-95 bg-gradient-to-b from-white to-[#f5f9fd] hover:from-[#f5f9fd] hover:to-[#e1e9f5] border-white text-[#00336d]"
                onClick={unlockMatch}
              >
                <LockOpenIcon className="mr-2 h-4 w-4" />
                {t("match.unlockMatch")}
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="w-full mt-2 shadow-md transition-all duration-200 active:scale-95 bg-gradient-to-b from-[#ff6b6b] to-[#dc3545] hover:from-[#ff8585] hover:to-[#ff6b6b] text-white"
                onClick={() => {
                  if (confirm(t("match.confirmEndMatch"))) {
                    endMatch()
                  }
                }}
              >
                {t("match.endMatch")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
