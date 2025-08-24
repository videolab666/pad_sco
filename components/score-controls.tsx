"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeftRightIcon, RepeatIcon } from "lucide-react"
import { shouldChangeSides } from "@/lib/tennis-utils"
import { useSoundEffects } from "@/hooks/use-sound-effects"
import { useLanguage } from "@/contexts/language-context"
import { useEffect, useState } from "react"
import CourtPreview from "@/components/court-svg-preview"

export function ScoreControls({ match, updateMatch }) {
  // Используем хук для звуковых эффектов
  const { soundsEnabled, playSound, toggleSounds } = useSoundEffects()
  const { t } = useLanguage()

  // Ensure t.match exists to prevent errors
  const tMatch = t?.match || {}

  // Локальное состояние для отслеживания необходимости смены сторон
  const [localMatch, setLocalMatch] = useState(match)
  const [fixedSides, setFixedSides] = useState(() => {
    // Try to get the saved preference from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fixedSidesPreference")
      return saved ? saved === "true" : true
    }
    return true // Default to fixed sides
  })

  const [matchHistory, setMatchHistory] = useState([])

  // Обновляем локальное состояние при изменении match
  useEffect(() => {
    setLocalMatch(match)
  }, [match])

  // Автоматическая смена сторон при необходимости
  useEffect(() => {
    if (localMatch?.shouldChangeSides) {
      changeSides()
    }
  }, [localMatch?.shouldChangeSides])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fixedSidesPreference", fixedSides.toString())
    }

    // Добавляем обработчик пользовательского события
    const handleFixedSidesChanged = (event) => {
      if (event.detail && event.detail.value !== undefined) {
        setFixedSides(event.detail.value)
      }
    }

    window.addEventListener("fixedSidesChanged", handleFixedSidesChanged)

    return () => {
      window.removeEventListener("fixedSidesChanged", handleFixedSidesChanged)
    }
  }, [fixedSides])

  if (!localMatch) return null

  // Извлекаем текущий сет из объекта match
  const currentSet = localMatch.score.currentSet

  // Изменяем функцию changeSides, чтобы она меняла стороны
  const changeSides = () => {
    const updatedMatch = { ...localMatch, history: [] }

    // Меняем стороны
    updatedMatch.courtSides = {
      teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
      teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
    }

    // Сбрасываем флаг необходимости смены сторон
    updatedMatch.shouldChangeSides = false

    // Обновляем локальное состояние немедленно
    setLocalMatch(updatedMatch)

    // Обновляем глобальное состояние
    updateMatch(updatedMatch)
  }

  const manualSwitchSides = () => {
    const updatedMatch = { ...localMatch, history: [] }

    // Меняем стороны
    updatedMatch.courtSides = {
      teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
      teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
    }

    // Сбрасываем флаг необходимости смены сторон
    updatedMatch.shouldChangeSides = false

    // Обновляем локальное состояние немедленно
    setLocalMatch(updatedMatch)

    // Обновляем глобальное состояние
    updateMatch(updatedMatch)
  }

  // Изменяем функцию addPoint
  const addPoint = (team) => {
    // Сохраняем текущее состояние матча в историю
    const previousState = JSON.parse(JSON.stringify(localMatch))
    setMatchHistory((prev) => [...prev, previousState])

    // Создаем новый объект матча
    const updatedMatch = { ...localMatch }

    // Полностью отключаем историю для экономии места
    updatedMatch.history = []

    const otherTeam = team === "teamA" ? "teamB" : "teamA"
    const currentSet = updatedMatch.score.currentSet

    if (currentSet.isTiebreak) {
      // Логика для тай-брейка
      currentSet.currentGame[team]++

      // Определяем количество очков для победы в тай-брейке в зависимости от типа
      let pointsToWin = 7 // Обычный тай-брейк по умолчанию

      // Если это супер-тай-брейк в решающем сете
      if (currentSet.isSuperTiebreak) {
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
        isSuperTiebreak: currentSet.isSuperTiebreak,
      })

      // Проверка на победу в тай-брейке
      if (
        currentSet.currentGame[team] >= pointsToWin &&
        currentSet.currentGame[team] - currentSet.currentGame[otherTeam] >= 2
      ) {
        // Победа в тай-брейке = победа в сете
        // Увеличиваем счет в сете для победителя тай-брейка
        currentSet[team]++
        // Воспроизводим звук выигрыша сета
        playSound("set")
        return winSet(team, updatedMatch)
      }

      // Смена подающего в тай-брейке (каждые 2 очка, кроме первого)
      const totalPoints = currentSet.currentGame.teamA + currentSet.currentGame.teamB
      if (totalPoints % 2 === 1) {
        switchServer(updatedMatch)
      }

      // Проверка необходимости смены сторон в тай-брейке (каждые 6 очков)
      if (totalPoints > 0 && totalPoints % 6 === 0) {
        updatedMatch.shouldChangeSides = true
      }

      // Воспроизводим звук очка
      playSound("point")
    } else {
      // Обычный гейм
      const currentGame = currentSet.currentGame

      // Логика тенниса: 0, 15, 30, 40, гейм
      if (currentGame[team] === 0) {
        currentGame[team] = 15
        playSound("point")
      } else if (currentGame[team] === 15) {
        currentGame[team] = 30
        playSound("point")
      } else if (currentGame[team] === 30) {
        currentGame[team] = 40
        playSound("point")
      } else if (currentGame[team] === 40) {
        if (currentGame[otherTeam] < 40) {
          // Победа в гейме
          playSound("game")
          return winGame(team, updatedMatch)
        } else if (currentGame[otherTeam] === 40) {
          // Преимущество
          currentGame[team] = "Ad"
          playSound("point")
        } else if (currentGame[otherTeam] === "Ad") {
          // Ровно
          currentGame[team] = 40
          currentGame[otherTeam] = 40
          playSound("point")
        }
      } else if (currentGame[team] === "Ad") {
        // Победа в гейме после преимущества
        playSound("game")
        return winGame(team, updatedMatch)
      }
    }

    try {
      // Обновляем локальное состояние немедленно
      setLocalMatch(updatedMatch)

      // Обновляем глобальное состояние
      updateMatch(updatedMatch)
    } catch (error) {
      console.error("Ошибка при обновлении счета:", error)

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

      // Обновляем локальное состояние немедленно
      setLocalMatch(minimalMatch)

      // Обновляем глобальное состояние
      updateMatch(minimalMatch)
    }
  }

  // Изменяем функцию removePoint
  const removePoint = (team) => {
    // Сохраняем текущее состояние матча в историю
    const previousState = JSON.parse(JSON.stringify(localMatch))
    setMatchHistory((prev) => [...prev, previousState])

    // Создаем новый объект матча
    const updatedMatch = { ...localMatch }

    // Полностью отключаем историю для экономии места
    updatedMatch.history = []

    const otherTeam = team === "teamA" ? "teamB" : "teamA"
    const currentSet = updatedMatch.score.currentSet

    if (currentSet.isTiebreak) {
      // Логика для тай-брейка
      if (currentSet.currentGame[team] > 0) {
        currentSet.currentGame[team]--
        // Воспроизводим звук отмены
        playSound("undo")
      }
    } else {
      // Обычный гейм
      const currentGame = currentSet.currentGame

      // Логика тенниса: 0, 15, 30, 40, гейм (в обратном порядке)
      if (currentGame[team] === "Ad") {
        currentGame[team] = 40
        playSound("undo")
      } else if (currentGame[team] === 40) {
        currentGame[team] = 30
        playSound("undo")
      } else if (currentGame[team] === 30) {
        currentGame[team] = 15
        playSound("undo")
      } else if (currentGame[team] === 15) {
        currentGame[team] = 0
        playSound("undo")
      }
    }

    try {
      // Обновляем локальное состояние немедленно
      setLocalMatch(updatedMatch)

      // Обновляем глобальное состояние
      updateMatch(updatedMatch)
    } catch (error) {
      console.error("Ошибка при обновлении счета:", error)
      // Если произошла ошибка, пробуем упростить объект матча
      const simplifiedMatch = {
        ...updatedMatch,
        history: [],
      }

      // Обновляем локальное состояние немедленно
      setLocalMatch(simplifiedMatch)

      // Обновляем глобальное состояние
      updateMatch(simplifiedMatch)
    }
  }

  // Изменяем функции обработчиков, чтобы они не использовали состояния
  // Заменим функцию handleAddPointTeamA:
  const handleAddPointTeamA = () => {
    addPoint("teamA")
  }

  // Заменим функцию handleAddPointTeamB:
  const handleAddPointTeamB = () => {
    addPoint("teamB")
  }

  // Заменим функцию handleRemovePointTeamA:
  const handleRemovePointTeamA = () => {
    removePoint("teamA")
  }

  // Заменим функцию handleRemovePointTeamB:
  const handleRemovePointTeamB = () => {
    removePoint("teamB")
  }

  const winGame = (team, updatedMatch) => {
    const otherTeam = team === "teamA" ? "teamB" : "teamA"
    const currentSet = updatedMatch.score.currentSet

    // Увеличиваем счет в сете
    currentSet[team]++

    // Сохраняем минимальную информацию о гейме
    currentSet.games.push({
      winner: team,
    })

    // Сбрасываем текущий гейм
    currentSet.currentGame = {
      teamA: 0,
      teamB: 0,
    }

    // Смена подающего
    switchServer(updatedMatch)

    // Проверка на необходимость смены сторон (после нечетного количества геймов)
    // Используем длину массива games для определения общего количества сыгранных геймов
    const totalGames = currentSet.games.length
    console.log(
      `Проверка необходимости смены сторон: totalGames=${totalGames}, shouldChange=${shouldChangeSides(totalGames)}`,
    )

    // Проверяем, нужно ли менять стороны
    if (shouldChangeSides(totalGames)) {
      console.log("Установка флага shouldChangeSides в true")
      updatedMatch.shouldChangeSides = true
    }

    // Проверка на финальный сет и тайбрейк в финальном сете
    const isDecidingSet = updatedMatch.score.sets.length + 1 === updatedMatch.settings.sets
    const isTwoSetsMatch =
      updatedMatch.settings.sets === 2 && updatedMatch.score.teamA === 1 && updatedMatch.score.teamB === 1

    // Проверяем, нужно ли начать тайбрейк в финальном сете
    if (updatedMatch.settings.finalSetTiebreak && (isDecidingSet || isTwoSetsMatch)) {
      // Если это финальный сет и включен тайбрейк в финальном сете
      const tiebreakAt = Number.parseInt(localMatch.settings.tiebreakAt.split("-")[0])
      if (currentSet.teamA === tiebreakAt && currentSet.teamB === tiebreakAt) {
        // Начинаем тайбрейк в финальном сете
        currentSet.isTiebreak = true
        currentSet.isSuperTiebreak = true // Отмечаем, что это супер-тай-брейк
        console.log("Starting final set tiebreak at", tiebreakAt, "all")
      }
    }
    // Обычный тайбрейк для нефинальных сетов
    else if (localMatch.settings.tiebreakEnabled) {
      const tiebreakAt = Number.parseInt(localMatch.settings.tiebreakAt.split("-")[0])
      if (currentSet.teamA === tiebreakAt && currentSet.teamB === tiebreakAt) {
        // Начинаем тай-брейк
        currentSet.isTiebreak = true
        console.log("Starting regular tiebreak at", tiebreakAt, "all")
      }
    }

    // Проверка на победу в сете
    if (currentSet.teamA >= 6 && currentSet.teamA - currentSet.teamB >= 2) {
      playSound("set")
      return winSet("teamA", updatedMatch)
    } else if (currentSet.teamB >= 6 && currentSet.teamB - currentSet.teamA >= 2) {
      playSound("set")
      return winSet("teamB", updatedMatch)
    }

    try {
      // Обновляем локальное состояние немедленно
      setLocalMatch(updatedMatch)

      // Обновляем глобальное состояние
      updateMatch(updatedMatch)
    } catch (error) {
      console.error("Ошибка при обновлении после выигрыша гейма:", error)

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

      // Обновляем локальное состояние немедленно
      setLocalMatch(minimalMatch)

      // Обновляем глобальное состояние
      updateMatch(minimalMatch)
    }
  }

  const winSet = (team, updatedMatch) => {
    // Увеличиваем счет матча
    updatedMatch.score[team]++

    // Сохраняем текущий сет в историю сетов
    updatedMatch.score.sets.push({
      teamA: updatedMatch.score.currentSet.teamA,
      teamB: updatedMatch.score.currentSet.teamB,
      winner: team,
    })

    // Проверка на победу в матче
    const totalSets = localMatch.settings.sets

    // Special handling for 2-set matches
    if (totalSets === 2) {
      // If a team has won 2 sets, the match is over
      if (updatedMatch.score[team] === 2) {
        // Воспроизводим звук победы в матче
        playSound("match")

        // Запрашиваем подтверждение перед завершением матча
        if (confirm(`Команда ${team === "teamA" ? "A" : "B"} выиграла матч! Завершить матч?`)) {
          updatedMatch.isCompleted = true
          updatedMatch.winner = team

          // Обновляем локальное состояние немедленно
          setLocalMatch(updatedMatch)

          // Обновляем глобальное состояние
          updateMatch(updatedMatch)
          return
        }
      }
      // If the score is 1-1, we continue to a deciding tiebreak
      // Do not end the match here
    } else {
      // For matches with 1, 3, or 5 sets, use the standard logic
      const setsToWin = Math.ceil(localMatch.settings.sets / 2)
      if (updatedMatch.score[team] >= setsToWin) {
        // Воспроизводим звук победы в матче
        playSound("match")

        // Запрашиваем подтверждение перед завершением матча
        if (confirm(`Команда ${team === "teamA" ? "A" : "B"} выиграла матч! Завершить матч?`)) {
          updatedMatch.isCompleted = true
          updatedMatch.winner = team

          // Обновляем локальное состояние немедленно
          setLocalMatch(updatedMatch)

          // Обновляем глобальное состояние
          updateMatch(updatedMatch)
          return
        }
      }
    }

    // Проверяем, нужно ли использовать супер-тай-брейк вместо третьего сета
    const isDecidingSet = updatedMatch.score.sets.length + 1 === updatedMatch.settings.sets
    const isTwoSetsMatch = updatedMatch.settings.sets === 2
    const isThirdSetTiebreak =
      updatedMatch.settings.finalSetTiebreak &&
      (isDecidingSet || (isTwoSetsMatch && updatedMatch.score.teamA === 1 && updatedMatch.score.teamB === 1))

    // Start new set
    let newSet
    if (isThirdSetTiebreak) {
      // Если это решающий сет и включен тайбрейк в решающем сете
      // Сразу начинаем с тайбрейка вместо обычного сета
      const tiebreakLength = updatedMatch.settings.finalSetTiebreakLength || 10

      newSet = {
        teamA: 0,
        teamB: 0,
        games: [],
        currentGame: {
          teamA: 0,
          teamB: 0,
        },
        isTiebreak: true,
        isSuperTiebreak: true,
        tiebreakLength: tiebreakLength,
      }
      console.log(`Starting final set as a tiebreak with length: ${tiebreakLength}`)
    } else {
      // Обычный сет
      newSet = {
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
    updatedMatch.score.currentSet = newSet

    // Смена сторон после нечетного количества сетов
    if (updatedMatch.score.sets.length % 2 === 1) {
      // Меняем стороны автоматически при смене сета
      updatedMatch.courtSides = {
        teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
        teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
      }
    }

    try {
      // Обновляем локальное состояние немедленно
      setLocalMatch(updatedMatch)

      // Обновляем глобальное состояние
      updateMatch(updatedMatch)
    } catch (error) {
      console.error("Ошибка при обновлении после выигрыша сета:", error)

      // Если произошла ошибка, пробуем упростить объект матча
      const minimalMatch = {
        ...updatedMatch,
        history: [],
      }

      // Удаляем историю геймов для экономии места
      if (minimalMatch.score && minimalMatch.score.sets) {
        minimalMatch.score.sets = minimalMatch.score.sets.map((set) => ({
          teamA: set.teamA,
          teamB: set.teamB,
          winner: set.winner,
        }))
      }

      // Обновляем локальное состояние немедленно
      setLocalMatch(minimalMatch)

      // Обновляем глобальное состояние
      updateMatch(minimalMatch)
    }
  }

  const switchServer = (updatedMatch) => {
    const currentTeam = updatedMatch.currentServer.team
    const otherTeam = currentTeam === "teamA" ? "teamB" : "teamA"

    // Для одиночной игры просто меняем команду
    if (localMatch.format === "singles") {
      updatedMatch.currentServer.team = otherTeam
      updatedMatch.currentServer.playerIndex = 0
    } else {
      // Для парной игры - после каждого гейма подача переходит к следующему игроку по порядку
      // Порядок: A1 -> B1 -> A2 -> B2 -> A1 и т.д.
      if (currentTeam === "teamA") {
        // Если подавала команда A, переходим к команде B
        updatedMatch.currentServer.team = "teamB"
        // Сохраняем тот же индекс игрока
        // (если подавал A1, то теперь B1; если подавал A2, то теперь B2)
      } else {
        // Если подавала команда B, переходим к команде A и меняем игрока
        updatedMatch.currentServer.team = "teamA"
        // Меняем индекс игрока на следующего в команде A
        updatedMatch.currentServer.playerIndex = updatedMatch.currentServer.playerIndex === 0 ? 1 : 0
      }
    }

    return updatedMatch
  }

  const manualSwitchServer = () => {
    const updatedMatch = { ...localMatch }

    // Отключаем историю
    updatedMatch.history = []

    // Меняем подающего
    switchServer(updatedMatch)

    // Обновляем локальное состояние немедленно
    setLocalMatch(updatedMatch)

    // Обновляем глобальное состояние
    updateMatch(updatedMatch)
  }

  // Функция для отображения имен игроков команды
  const renderPlayerNames = (team) => {
    const players = team.players

    // Для одиночной игры просто возвращаем имя игрока
    if (localMatch.format === "singles" || players.length === 1) {
      return (
        <div className="text-sm text-muted-foreground text-center w-full overflow-hidden truncate">
          {players[0].name}
        </div>
      )
    }

    // Для парной игры отображаем каждое имя на отдельной строке
    return (
      <div className="text-sm text-muted-foreground text-center w-full">
        <div className="truncate overflow-hidden">{players[0].name}</div>
        <div className="truncate overflow-hidden">{players[1].name}</div>
      </div>
    )
  }

  // Проверяем, является ли текущий сет финальным
  const isDecidingSet = localMatch.score.sets.length + 1 === localMatch.settings.sets
  const isTwoSetsMatch = localMatch.settings.sets === 2 && localMatch.score.teamA === 1 && localMatch.score.teamB === 1
  const isFinalSet = isDecidingSet || isTwoSetsMatch

  return (
    <div className="w-full">
      {/* Court SVG Preview with buttons */}
      <CourtPreview match={localMatch}>
        {/* Кнопки управления сервером и сменой сторон */}
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            className="flex-1 text-xs sm:text-sm py-1 sm:py-2 score-button transition-all hover:bg-blue-50"
            onClick={manualSwitchServer}
            disabled={localMatch.isCompleted}
          >
            <RepeatIcon className="h-4 w-4 mr-1" />
            {tMatch.switchServer}
          </Button>

          <Button
            variant="outline"
            className="flex-1 text-xs sm:text-sm py-1 sm:py-2 score-button transition-all hover:bg-blue-50"
            onClick={manualSwitchSides}
            disabled={localMatch.isCompleted}
          >
            <ArrowLeftRightIcon className="h-4 w-4 mr-1" />
            {tMatch.switchSides}
          </Button>
        </div>
      </CourtPreview>
    </div>
  )
}
