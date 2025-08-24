"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { getMatch, subscribeToMatchUpdates } from "@/lib/match-storage"
import { getTennisPointName } from "@/lib/tennis-utils"
import { logEvent } from "@/lib/error-logger"
import { decompressFromUTF16 } from "lz-string"
import { useLanguage } from "@/contexts/language-context"

type MatchParams = {
  params: {
    id: string
  }
}

// Функция для безопасного парсинга JSON
const safeParseJSON = (data) => {
  try {
    return JSON.parse(data)
  } catch (e) {
    return null
  }
}

// Функция для безопасного получения данных из localStorage с поддержкой декомпрессии
const safeGetLocalStorageItem = (key) => {
  try {
    const item = localStorage.getItem(key)
    if (!item) return null

    // Пробуем распаковать сжатые данные
    try {
      const decompressed = decompressFromUTF16(item)
      // Проверяем, что распакованные данные - валидный JSON
      const parsed = safeParseJSON(decompressed)
      if (parsed) {
        return parsed
      }
    } catch (decompressError) {
      logEvent("warn", `vMix: Ошибка при распаковке данных из localStorage: ${key}`, "vmix-page", decompressError)
    }

    // Если не удалось распаковать, пробуем парсить как обычный JSON
    const parsed = safeParseJSON(item)
    if (parsed) {
      return parsed
    }

    return null
  } catch (error) {
    logEvent("error", `vMix: Ошибка при получении данных из localStorage: ${key}`, "vmix-page", error)
    return null
  }
}

// Функция для преобразования параметра цвета из URL
const parseColorParam = (param, defaultColor) => {
  if (!param) return defaultColor
  // Если параметр не содержит #, добавляем его
  return param.startsWith("#") ? param : `#${param}`
}

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

// Улучшенная функция для определения game point с подробным логированием
const isGamePoint = (match) => {
  console.log("=== CHECKING GAME POINT ===")

  if (!match || !match.score || !match.score.currentSet) {
    console.log("No match data or current set")
    return false
  }

  const currentSet = match.score.currentSet
  const currentGame = currentSet.currentGame

  if (!currentGame) {
    console.log("No current game data")
    return false
  }

  console.log("Current game score:", JSON.stringify(currentGame))
  console.log("Is tiebreak:", currentSet.isTiebreak)
  console.log("Team A points:", currentGame.teamA, "Team B points:", currentGame.teamB)
  console.log("Team A points name:", getTennisPointName(currentGame.teamA))
  console.log("Team B points name:", getTennisPointName(currentGame.teamB))

  // Получаем индексы очков для правильного сравнения
  const teamAIndex = getPointIndex(currentGame.teamA)
  const teamBIndex = getPointIndex(currentGame.teamB)

  console.log("Team A points index:", teamAIndex, "Team B points index:", teamBIndex)

  // Для тай-брейка
  if (currentSet.isTiebreak) {
    console.log("Tiebreak logic")
    // В тай-брейке обычно нужно набрать 7 очков с разницей в 2 очка
    // Если команда A имеет 6 очков и ведет, это game point
    if (currentGame.teamA >= 6 && currentGame.teamA >= currentGame.teamB + 1) {
      console.log("Game point for teamA in tiebreak")
      return "teamA"
    }
    // Если команда B имеет 6 очков и ведет, это game point
    if (currentGame.teamB >= 6 && currentGame.teamB >= currentGame.teamA + 1) {
      console.log("Game point for teamB in tiebreak")
      return "teamB"
    }
    console.log("No game point in tiebreak")
    return false
  }

  // Для обычного гейма - исправленная логика с использованием индексов

  // Если у команды A преимущество (Ad)
  if (teamAIndex === 4 && teamBIndex <= 3) {
    console.log("Game point for teamA: Ad")
    return "teamA"
  }

  // Если команда A имеет 40 (индекс 3) и команда B имеет меньше или равно 30 (индекс <= 2)
  if (teamAIndex === 3 && teamBIndex <= 2) {
    console.log("Game point for teamA: 40-x")
    return "teamA"
  }

  // Если у команды B преимущество (Ad)
  if (teamBIndex === 4 && teamAIndex <= 3) {
    console.log("Game point for teamB: Ad")
    return "teamB"
  }

  // Если команда B имеет 40 (индекс 3) и команда A имеет меньше или равно 30 (индекс <= 2)
  if (teamBIndex === 3 && teamAIndex <= 2) {
    console.log("Game point for teamB: 40-x")
    return "teamB"
  }

  console.log("No game point detected")
  return false
}

// Улучшенная функция для определения set point с подробным логированием
const isSetPoint = (match) => {
  console.log("=== CHECKING SET POINT ===")

  if (!match || !match.score || !match.score.currentSet) {
    console.log("No match data or current set")
    return false
  }

  const currentSet = match.score.currentSet
  const teamAGames = currentSet.teamA
  const teamBGames = currentSet.teamB

  console.log("Current set score - Team A:", teamAGames, "Team B:", teamBGames)

  // Если идет тай-брейк, проверяем особым образом
  if (currentSet.isTiebreak) {
    // Получаем, кто имеет гейм-поинт в тай-брейке
    const gamePoint = isGamePoint(match)
    console.log("Game point in tiebreak result:", gamePoint)

    // Если есть гейм-поинт в тай-брейке, то это также и сет-поинт
    if (gamePoint) {
      console.log("Set point in tiebreak for", gamePoint)
      return gamePoint
    }

    console.log("No set point in tiebreak")
    return false
  }

  // Для обычного гейма
  // Получаем, кто имеет гейм-поинт
  const gamePoint = isGamePoint(match)
  console.log("Game point result:", gamePoint)

  if (!gamePoint) {
    console.log("No game point, so no set point")
    return false
  }

  // Для команды A
  if (gamePoint === "teamA") {
    // Если команда A ведет 5-x и выиграет этот гейм, то счет станет 6-x
    if (teamAGames === 5 && teamBGames <= 4) {
      console.log("Set point for teamA: 5-x")
      return "teamA"
    }
    // Если команда A ведет 6-5 и выиграет этот гейм, то счет станет 7-5
    if (teamAGames === 6 && teamBGames === 5) {
      console.log("Set point for teamA: 6-5")
      return "teamA"
    }
  }

  // Для команды B
  if (gamePoint === "teamB") {
    // Если команда B ведет 5-x и выиграет этот гейм, то счет станет 6-x
    if (teamBGames === 5 && teamAGames <= 4) {
      console.log("Set point for teamB: 5-x")
      return "teamB"
    }
    // Если команда B ведет 6-5 и выиграет этот гейм, то счет станет 7-5
    if (teamBGames === 6 && teamAGames === 5) {
      console.log("Set point for teamB: 6-5")
      return "teamB"
    }
  }

  console.log("No set point detected")
  return false
}

// Улучшенная функция для определения match point с подробным логированием
const isMatchPoint = (match) => {
  console.log("=== CHECKING MATCH POINT ===")

  if (!match || !match.score || !match.score.currentSet) {
    console.log("No match data or current set")
    return false
  }

  // Определяем, сколько сетов нужно для победы (обычно 2 из 3)
  const setsToWin = match.setsToWin || 2
  console.log("Sets to win:", setsToWin)

  // Получаем текущий счет по сетам
  const teamASets = match.score.sets ? match.score.sets.filter((set) => set.teamA > set.teamB).length : 0
  const teamBSets = match.score.sets ? match.score.sets.filter((set) => set.teamB > set.teamA).length : 0
  console.log("Sets won - Team A:", teamASets, "Team B:", teamBSets)

  // Проверяем, является ли текущий гейм сет-поинтом
  const setPoint = isSetPoint(match)
  console.log("Set point result:", setPoint)

  // Если нет сет-поинта, то не может быть и матч-поинта
  if (!setPoint) {
    console.log("No set point, so no match point")
    return false
  }

  // Для команды A
  if (setPoint === "teamA" && teamASets === setsToWin - 1) {
    console.log("Match point for teamA")
    return "teamA"
  }

  // Для команды B
  if (setPoint === "teamB" && teamBSets === setsToWin - 1) {
    console.log("Match point for teamB")
    return "teamB"
  }

  console.log("No match point detected")
  return false
}

// Улучшенная функция для определения важного момента с подробным логированием
const getImportantPoint = (match) => {
  console.log("=== GETTING IMPORTANT POINT ===")

  // Для отладки - выводим текущий счет
  if (match && match.score && match.score.currentSet) {
    console.log("Current game score:", JSON.stringify(match.score.currentSet.currentGame))
    console.log("Current set score:", {
      teamA: match.score.currentSet.teamA,
      teamB: match.score.currentSet.teamB,
      isTiebreak: match.score.currentSet.isTiebreak,
    })
    if (match.score.sets) {
      console.log("Sets:", JSON.stringify(match.score.sets))
    }

    // Выводим полную структуру матча для отладки
    console.log("Full match structure:", JSON.stringify(match, null, 2))
  } else {
    console.log("No match data available")
  }

  // Проверяем, идет ли тай-брейк
  const isTiebreak = match?.score?.currentSet?.isTiebreak || false

  // Сначала проверяем match point (самый приоритетный)
  const matchPoint = isMatchPoint(match)
  if (matchPoint) {
    console.log("MATCH POINT detected for", matchPoint)
    return { type: "MATCH POINT", team: matchPoint }
  }

  // Затем проверяем set point
  const setPoint = isSetPoint(match)
  if (setPoint) {
    console.log("SET POINT detected for", setPoint)
    return { type: "SET POINT", team: setPoint }
  }

  // Затем проверяем game point
  const gamePoint = isGamePoint(match)
  if (gamePoint) {
    console.log("GAME POINT detected for", gamePoint)
    // Если идет тай-брейк, показываем "TIEBREAK POINT" вместо "GAME POINT"
    if (isTiebreak) {
      return { type: "TIEBREAK POINT", team: gamePoint }
    }
    return { type: "GAME POINT", team: gamePoint }
  }

  console.log("No important point detected")
  // Если нет важного момента, возвращаем тип индикатора в зависимости от того, идет ли тай-брейк
  return { type: isTiebreak ? "TIEBREAK" : "GAME", team: null }
}

// Получаем страну игрока - эта функция не должна использовать переменную match
const getPlayerCountry = (team, playerIndex, matchData) => {
  if (!matchData) return null
  const player = matchData[team]?.players[playerIndex]
  return player?.country || null
}

// Изменяем функцию getPlayerCountry, чтобы она возвращала пробел вместо "---"
const getPlayerCountryDisplay = (team, playerIndex, matchData) => {
  return getPlayerCountry(team, playerIndex, matchData) || " "
}

export default function VmixPage({ params }: { params: { id: string } }) { // Исправление здесь!
  const id = params.id
  const router = useRouter()
  const { t } = useLanguage()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const [jsonOutput, setJsonOutput] = useState("")
  const [debugInfo, setDebugInfo] = useState("")
  const [prevImportantPoint, setPrevImportantPoint] = useState({ type: null, team: null })
  const [indicatorState, setIndicatorState] = useState("hidden") // "entering", "visible", "exiting", "hidden"

  // Параметры отображения из URL
  const theme = searchParams.get("theme") || "default"
  const showNames = searchParams.get("showNames") !== "false"
  const showPoints = searchParams.get("showPoints") !== "false"
  const showSets = searchParams.get("showSets") !== "false"
  const showServer = searchParams.get("showServer") !== "false"
  const showCountry = searchParams.get("showCountry") !== "false"
  const fontSize = searchParams.get("fontSize") || "normal"
  const bgOpacity = Number.parseFloat(searchParams.get("bgOpacity") || "0.5")
  const textColor = parseColorParam(searchParams.get("textColor"), "#ffffff")
  const accentColor = parseColorParam(searchParams.get("accentColor"), "#a4fb23")
  const playerNamesFontSize = Number.parseFloat(searchParams.get("playerNamesFontSize") || "1.2")
  const outputFormat = searchParams.get("format") || "html"
  const showDebug = searchParams.get("debug") === "true"

  // Цвета с правильной обработкой параметров
  const namesBgColor = parseColorParam(searchParams.get("namesBgColor"), "#0369a1")
  const countryBgColor = parseColorParam(searchParams.get("countryBgColor"), "#0369a1")
  const pointsBgColor = parseColorParam(searchParams.get("pointsBgColor"), "#0369a1")
  const setsBgColor = parseColorParam(searchParams.get("setsBgColor"), "#ffffff")
  const setsTextColor = parseColorParam(searchParams.get("setsTextColor"), "#000000")

  // Параметры для индикатора
  const indicatorBgColor = parseColorParam(searchParams.get("indicatorBgColor"), "#7c2d12")
  const indicatorTextColor = parseColorParam(searchParams.get("indicatorTextColor"), "#ffffff")
  // Исправляем чтение булевых параметров
  const indicatorGradient = searchParams.get("indicatorGradient") === "true"
  const indicatorGradientFrom = parseColorParam(searchParams.get("indicatorGradientFrom"), "#7c2d12")
  const indicatorGradientTo = parseColorParam(searchParams.get("indicatorGradientTo"), "#991b1b")

  // Параметры градиентов - исправляем чтение булевых параметров
  const namesGradient = searchParams.get("namesGradient") === "true"
  const namesGradientFrom = parseColorParam(searchParams.get("namesGradientFrom"), "#0369a1")
  const namesGradientTo = parseColorParam(searchParams.get("namesGradientTo"), "#0284c7")
  const countryGradient = searchParams.get("countryGradient") === "true"
  const countryGradientFrom = parseColorParam(searchParams.get("countryGradientFrom"), "#0369a1")
  const countryGradientTo = parseColorParam(searchParams.get("countryGradientTo"), "#0284c7")
  const pointsGradient = searchParams.get("pointsGradient") === "true"
  const pointsGradientFrom = parseColorParam(searchParams.get("pointsGradientFrom"), "#0369a1")
  const pointsGradientTo = parseColorParam(searchParams.get("pointsGradientTo"), "#0284c7")
  // Параметры для градиента счета в сетах
  const setsGradient = searchParams.get("setsGradient") === "true"
  const setsGradientFrom = parseColorParam(searchParams.get("setsGradientFrom"), "#ffffff")
  const setsGradientTo = parseColorParam(searchParams.get("setsGradientTo"), "#f0f0f0")

  // Обновляем параметры отображения из URL
  const serveBgColor = parseColorParam(searchParams.get("serveBgColor"), "#000000")
  const serveGradient = searchParams.get("serveGradient") === "true"
  const serveGradientFrom = parseColorParam(searchParams.get("serveGradientFrom"), "#000000")
  const serveGradientTo = parseColorParam(searchParams.get("serveGradientTo"), "#1e1e1e")

  // Загрузка сохраненных настроек из localStorage
  useEffect(() => {
    // Проверяем, есть ли параметры в URL
    const hasUrlParams = searchParams.toString() !== ""

    // Если в URL нет параметров, пробуем загрузить из localStorage
    if (!hasUrlParams && typeof window !== "undefined") {
      try {
        const savedSettings = localStorage.getItem("vmix_settings")
        if (savedSettings) {
          const settings = JSON.parse(savedSettings)

          // Обновляем URL с сохраненными настройками
          const newParams = new URLSearchParams()
          if (settings.theme) newParams.set("theme", settings.theme)
          if (settings.showNames !== undefined) newParams.set("showNames", settings.showNames.toString())
          if (settings.showPoints !== undefined) newParams.set("showPoints", settings.showPoints.toString())
          if (settings.showSets !== undefined) newParams.set("showSets", settings.showSets.toString())
          if (settings.showServer !== undefined) newParams.set("showServer", settings.showServer.toString())
          if (settings.showCountry !== undefined) newParams.set("showCountry", settings.showCountry.toString())
          if (settings.fontSize) newParams.set("fontSize", settings.fontSize)
          if (settings.bgOpacity !== undefined) newParams.set("bgOpacity", settings.bgOpacity.toString())
          if (settings.textColor) newParams.set("textColor", settings.textColor.replace("#", ""))
          if (settings.accentColor) newParams.set("accentColor", settings.accentColor.replace("#", ""))
          if (settings.playerNamesFontSize !== undefined)
            newParams.set("playerNamesFontSize", settings.playerNamesFontSize.toString())

          if (settings.namesBgColor) newParams.set("namesBgColor", settings.namesBgColor.replace("#", ""))
          if (settings.countryBgColor) newParams.set("countryBgColor", settings.countryBgColor.replace("#", "")) // Новый параметр
          if (settings.pointsBgColor) newParams.set("pointsBgColor", settings.pointsBgColor.replace("#", ""))
          if (settings.setsBgColor) newParams.set("setsBgColor", settings.setsBgColor.replace("#", ""))
          if (settings.setsTextColor) newParams.set("setsTextColor", settings.setsTextColor.replace("#", ""))

          // Добавляем параметры для индикатора
          if (settings.indicatorBgColor) newParams.set("indicatorBgColor", settings.indicatorBgColor.replace("#", ""))
          if (settings.indicatorTextColor)
            newParams.set("indicatorTextColor", settings.indicatorTextColor.replace("#", ""))
          if (settings.indicatorGradient !== undefined)
            newParams.set("indicatorGradient", settings.indicatorGradient.toString())
          if (settings.indicatorGradientFrom)
            newParams.set("indicatorGradientFrom", settings.indicatorGradientFrom.replace("#", ""))
          if (settings.indicatorGradientTo)
            newParams.set("indicatorGradientTo", settings.indicatorGradientTo.replace("#", ""))

          if (settings.namesGradient !== undefined) newParams.set("namesGradient", settings.namesGradient.toString())
          if (settings.namesGradientFrom)
            newParams.set("namesGradientFrom", settings.namesGradientFrom.replace("#", ""))
          if (settings.namesGradientTo) newParams.set("namesGradientTo", settings.namesGradientTo.replace("#", ""))
          if (settings.countryGradient !== undefined)
            newParams.set("countryGradient", settings.countryGradient.toString()) // Новый параметр
          if (settings.countryGradientFrom)
            newParams.set("countryGradientFrom", settings.countryGradientFrom.replace("#", "")) // Новый параметр
          if (settings.countryGradientTo)
            newParams.set("countryGradientTo", settings.countryGradientTo.replace("#", "")) // Новый параметр
          if (settings.pointsGradient !== undefined) newParams.set("pointsGradient", settings.pointsGradient.toString())
          if (settings.pointsGradientFrom)
            newParams.set("pointsGradientFrom", settings.pointsGradientFrom.replace("#", ""))
          if (settings.pointsGradientTo) newParams.set("pointsGradientTo", settings.pointsGradientTo.replace("#", ""))
          if (settings.setsGradient !== undefined) newParams.set("setsGradient", settings.setsGradient.toString())
          if (settings.setsGradientFrom) newParams.set("setsGradientFrom", settings.setsGradientFrom.replace("#", ""))
          if (settings.setsGradientTo) newParams.set("setsGradientTo", settings.setsGradientTo.replace("#", ""))
          if (settings.animationType) newParams.set("animationType", settings.animationType)
          if (settings.animationDuration !== undefined)
            newParams.set("animationDuration", settings.animationDuration.toString())

          // Добавляем параметры для индикатора подач
          if (settings.serveBgColor) newParams.set("serveBgColor", settings.serveBgColor.replace("#", ""))
          if (settings.serveGradient !== undefined) newParams.set("serveGradient", settings.serveGradient.toString())
          if (settings.serveGradientFrom)
            newParams.set("serveGradientFrom", settings.serveGradientFrom.replace("#", ""))
          if (settings.serveGradientTo) newParams.set("serveGradientTo", settings.serveGradientTo.replace("#", ""))

          const newUrl = `${window.location.pathname}?${newParams.toString()}`
          window.history.replaceState({}, "", newUrl)
        }
      } catch (error) {
        console.error("Ошибка при загрузке сохраненных настроек:", error)
      }
    }
  }, [searchParams])

  // Для отладки - выводим параметры в консоль
  useEffect(() => {
    console.log("Параметры отображения:", {
      theme,
      namesBgColor,
      countryBgColor,
      pointsBgColor,
      setsBgColor,
      setsTextColor,
      namesGradient,
      namesGradientFrom,
      namesGradientTo,
      countryGradient,
      countryGradientFrom,
      countryGradientTo,
      pointsGradient,
      pointsGradientFrom,
      pointsGradientTo,
      setsGradient,
      setsGradientFrom,
      setsGradientTo,
      indicatorBgColor,
      indicatorTextColor,
      indicatorGradient,
      indicatorGradientFrom,
      indicatorGradientTo,
      // Добавляем параметры индикатора подач для отладки
      serveBgColor,
      serveGradient,
      serveGradientFrom,
      serveGradientTo,
    })
  }, [
    theme,
    namesBgColor,
    countryBgColor,
    pointsBgColor,
    setsBgColor,
    setsTextColor,
    namesGradient,
    namesGradientFrom,
    namesGradientTo,
    countryGradient,
    countryGradientFrom,
    countryGradientTo,
    pointsGradient,
    pointsGradientFrom,
    pointsGradientTo,
    setsGradient,
    setsGradientFrom,
    setsGradientTo,
    indicatorBgColor,
    indicatorTextColor,
    indicatorGradient,
    indicatorGradientFrom,
    indicatorGradientTo,
    // Добавляем параметры индикатора подач в зависимости
    serveBgColor,
    serveGradient,
    serveGradientFrom,
    serveGradientTo,
  ])

  useEffect(() => {
    const loadMatch = async () => {
      try {
        if (!id) {
          setError("Некорректный ID матча")
          setLoading(false)
          logEvent("error", "vMix страница: некорректный ID матча", "vmix-page")
          return
        }

        logEvent("info", `vMix страница: начало загрузки матча ${id}`, "vmix-page")

        // Пробуем получить матч напрямую из localStorage
        let matchData = null
        let matchSource = "unknown"

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            // Пробуем получить матч напрямую из localStorage
            const matchKey = `match_${id}`
            matchData = safeGetLocalStorageItem(matchKey)

            if (matchData) {
              matchSource = "localStorage-direct"
              logEvent("info", `vMix страница: матч найден в localStorage напрямую`, "vmix-page", {
                matchId: id,
              })
            } else {
              // Если не нашли напрямую, проверяем в общем списке
              const matchesList = safeGetLocalStorageItem("tennis_padel_matches")

              if (matchesList && Array.isArray(matchesList)) {
                const foundMatch = matchesList.find((m) => m.id === id)

                if (foundMatch) {
                  logEvent("info", `vMix страница: матч найден в списке матчей`, "vmix-page", { matchId: id })
                  matchSource = "localStorage-list"
                  // Используем найденный матч как временное решение
                  matchData = foundMatch
                }
              }
            }
          } catch (localError) {
            logEvent("error", "vMix страница: ошибка при доступе к localStorage", "vmix-page", localError)
          }
        }

        // Если не нашли в localStorage, пробуем получить через getMatch
        if (!matchData) {
          logEvent("info", `vMix страница: матч не найден в localStorage, пробуем getMatch`, "vmix-page", {
            matchId: params.id,
          })
          try {
            matchData = await getMatch(id)
            if (matchData) {
              matchSource = "getMatch"
              logEvent("info", `vMix страница: матч найден через getMatch`, "vmix-page", { matchId: id })
            }
          } catch (getMatchError) {
            logEvent("error", `vMix страница: ошибка при вызове getMatch`, "vmix-page", {
              error: getMatchError,
              matchId: params.id,
            })
          }
        }

        if (matchData) {
          console.log("Loaded match data:", JSON.stringify(matchData, null, 2))
          setMatch(matchData)

          // Обновляем отладочную информацию
          if (showDebug) {
            setDebugInfo(
              JSON.stringify(
                {
                  currentGame: matchData.score.currentSet?.currentGame,
                  currentSet: {
                    teamA: matchData.score.currentSet?.teamA,
                    teamB: matchData.score.currentSet?.teamB,
                    isTiebreak: matchData.score.currentSet?.isTiebreak,
                  },
                  sets: matchData.score.sets,
                  gamePoint: isGamePoint(matchData),
                  setPoint: isSetPoint(matchData),
                  matchPoint: isMatchPoint(matchData),
                },
                null,
                2,
              ),
            )
          }

          // Подготавливаем JSON для vMix
          if (outputFormat === "json") {
            const vmixData = {
              id: matchData.id,
              teamA: {
                name: matchData.teamA.players.map((p) => p.name).join(" / "),
                score: matchData.score.teamA,
                currentGameScore: matchData.score.currentSet
                  ? matchData.score.currentSet.isTiebreak
                    ? matchData.score.currentSet.currentGame.teamA
                    : getTennisPointName(matchData.score.currentSet.currentGame.teamA)
                  : "0",
                sets: matchData.score.sets ? matchData.score.sets.map((set) => set.teamA) : [],
                currentSet: matchData.score.currentSet ? matchData.score.currentSet.teamA : 0,
                serving: matchData.currentServer && matchData.currentServer.team === "teamA",
                countries: matchData.teamA.players.map((p) => p.country || "").filter(Boolean),
              },
              teamB: {
                name: matchData.teamB.players.map((p) => p.name).join(" / "),
                score: matchData.score.teamB,
                currentGameScore: matchData.score.currentSet
                  ? matchData.score.currentSet.isTiebreak
                    ? matchData.score.currentSet.currentGame.teamB
                    : getTennisPointName(matchData.score.currentSet.currentGame.teamB)
                  : "0",
                sets: matchData.score.sets ? matchData.score.sets.map((set) => set.teamB) : [],
                currentSet: matchData.score.currentSet ? matchData.score.currentSet.teamB : 0,
                serving: matchData.currentServer && matchData.currentServer.team === "teamB",
                countries: matchData.teamB.players.map((p) => p.country || "").filter(Boolean),
              },
              isTiebreak: matchData.score.currentSet ? matchData.score.currentSet.isTiebreak : false,
              isCompleted: matchData.isCompleted || false,
              winner: matchData.winner || null,
              timestamp: new Date().toISOString(),
            }
            setJsonOutput(JSON.stringify(vmixData, null, 2))
          }

          setError("")
          logEvent("info", `vMix страница загружена для матча: ${id} (источник: ${matchSource})`, "vmix-page")
        } else {
          setError("Матч не найден")
          logEvent("error", `vMix страница: матч не найден: ${id}`, "vmix-page", {
            triedSources: ["localStorage-direct", "localStorage-list", "getMatch"],
          })
        }
      } catch (err) {
        setError("Ошибка загрузки матча")
        logEvent("error", "Ошибка загрузки матча для vMix", "vmix-page", err)
      } finally {
        setLoading(false)
      }
    }

    loadMatch()

    // Подписываемся на обновления матча в реальном времени
    const unsubscribe = subscribeToMatchUpdates(id, (updatedMatch) => {
      if (updatedMatch) {
        console.log("Match update received:", JSON.stringify(updatedMatch, null, 2))
        setMatch(updatedMatch)

        // Обновляем отладочную информацию
        if (showDebug) {
          setDebugInfo(
            JSON.stringify(
              {
                currentGame: updatedMatch.score.currentSet?.currentGame,
                currentSet: {
                  teamA: updatedMatch.score.currentSet?.teamA,
                  teamB: updatedMatch.score.currentSet?.teamB,
                  isTiebreak: updatedMatch.score.currentSet?.isTiebreak,
                },
                sets: updatedMatch.score.sets,
                gamePoint: isGamePoint(updatedMatch),
                setPoint: isSetPoint(updatedMatch),
                matchPoint: isMatchPoint(updatedMatch),
              },
              null,
              2,
            ),
          )
        }

        // Обновляем JSON при получении обновлений
        if (outputFormat === "json") {
          const vmixData = {
            id: updatedMatch.id,
            teamA: {
              name: updatedMatch.teamA.players.map((p) => p.name).join(" / "),
              score: updatedMatch.score.teamA,
              currentGameScore: updatedMatch.score.currentSet
                ? updatedMatch.score.currentSet.isTiebreak
                  ? updatedMatch.score.currentSet.currentGame.teamA
                  : getTennisPointName(updatedMatch.score.currentSet.currentGame.teamA)
                : "0",
              sets: updatedMatch.score.sets ? updatedMatch.score.sets.map((set) => set.teamA) : [],
              currentSet: updatedMatch.score.currentSet ? updatedMatch.score.currentSet.teamA : 0,
              serving: updatedMatch.currentServer && updatedMatch.currentServer.team === "teamA",
              countries: updatedMatch.teamA.players.map((p) => p.country || "").filter(Boolean),
            },
            teamB: {
              name: updatedMatch.teamB.players.map((p) => p.name).join(" / "),
              score: updatedMatch.score.teamB,
              currentGameScore: updatedMatch.score.currentSet
                ? updatedMatch.score.currentSet.isTiebreak
                  ? updatedMatch.score.currentSet.currentGame.teamB
                  : getTennisPointName(updatedMatch.score.currentSet.currentGame.teamB)
                : "0",
              sets: updatedMatch.score.sets ? updatedMatch.score.sets.map((set) => set.teamB) : [],
              currentSet: updatedMatch.score.currentSet ? updatedMatch.score.currentSet.teamB : 0,
              serving: updatedMatch.currentServer && updatedMatch.currentServer.team === "teamB",
              countries: updatedMatch.teamB.players.map((p) => p.country || "").filter(Boolean),
            },
            isTiebreak: updatedMatch.score.currentSet ? updatedMatch.score.currentSet.isTiebreak : false,
            isCompleted: updatedMatch.isCompleted || false,
            winner: updatedMatch.winner || null,
            timestamp: new Date().toISOString(),
          }
          setJsonOutput(JSON.stringify(vmixData, null, 2))
        }

        setError("")
        logEvent("debug", "vMix страница: получено обновление матча", "vmix-page", {
          matchId: params.id,
          scoreA: updatedMatch.score.teamA,
          scoreB: updatedMatch.score.teamB,
        })
      } else {
        setError("Матч не найден или был удален")
        logEvent("warn", "vMix страница: матч не найден при обновлении", "vmix-page", { matchId: params.id })
      }
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [id, outputFormat, showDebug])

  // Эффект для отслеживания изменений важного момента и управления анимацией
  useEffect(() => {
    if (!match) return

    const currentImportantPoint = getImportantPoint(match)

    // Проверяем, действительно ли изменился тип важного момента
    const currentType = currentImportantPoint.type
    const prevType = prevImportantPoint.type

    // Если тип не изменился, ничего не делаем
    if (currentType === prevType) return

    // Если появился важный момент
    if (currentType && currentType !== "GAME" && (!prevType || prevType === "GAME")) {
      setIndicatorState("entering")

      // Через 1 секунду (длительность анимации) меняем состояние на "visible"
      const timer = setTimeout(() => {
        setIndicatorState("visible")
      }, 1000)

      return () => clearTimeout(timer)
    }

    // Если важный момент исчез
    if ((!currentType || currentType === "GAME") && prevType && prevType !== "GAME") {
      setIndicatorState("exiting")

      // Через 1 секун��у (длительность анимации) меняем состояние на "hidden"
      const timer = setTimeout(() => {
        setIndicatorState("hidden")
      }, 1000)

      return () => clearTimeout(timer)
    }

    // Обновляем предыдущее значение только если оно действительно изменилось
    setPrevImportantPoint(currentImportantPoint)
  }, [match, prevImportantPoint.type]) // Зависим только от match и prevImportantPoint.type

  // Получаем текущий счет в виде строки (0, 15, 30, 40, Ad)
  const getCurrentGameScore = (team) => {
    if (!match || !match.score || !match.score.currentSet) return ""

    const currentSet = match.score.currentSet

    if (currentSet.isTiebreak) {
      return currentSet.currentGame[team]
    }

    return getTennisPointName(currentSet.currentGame[team])
  }

  // Определяем, кто подает
  const isServing = (team, playerIndex) => {
    if (!match || !match.currentServer) return false
    return match.currentServer.team === team && match.currentServer.playerIndex === playerIndex
  }

  // Форматируем счет сета с верхним индексом для тай-брейка
  const formatSetScore = (score, tiebreakScore = null) => {
    return (
      <span>
        {score}
        <sup>{tiebreakScore}</sup>
      </span>
    )
  }

  // Стили в зависимости от темы и параметров
  const getStyles = () => {
    const fontSizeMap = {
      small: {
        container: "text-sm",
        score: "text-2xl", // Увеличено в 2 раза (было text-xl)
        point: "text-xl", // Увеличено в 2 раза (было text-lg)
      },
      normal: {
        container: "text-base",
        score: "text-4xl", // Увеличено в 2 раза (было text-2xl)
        point: "text-2xl", // Увеличено в 2 раза (было text-xl)
      },
      large: {
        container: "text-lg",
        score: "text-6xl", // Увеличено в 2 раза (было text-3xl)
        point: "text-4xl", // Увеличено в 2 раза (было text-2xl)
      },
      xlarge: {
        container: "text-xl",
        score: "text-8xl", // Увеличено в 2 раза (было text-4xl)
        point: "text-6xl", // Увеличено в 2 раза (было text-3xl)
      },
    }

    const sizes = fontSizeMap[fontSize] || fontSizeMap.normal

    const themeStyles = {
      default: {
        bg: `rgba(0, 0, 0, ${bgOpacity})`,
        text: textColor,
        accent: accentColor,
      },
      light: {
        bg: `rgba(255, 255, 255, ${bgOpacity})`,
        text: "#000000",
        accent: "#2563eb",
      },
      dark: {
        bg: `rgba(0, 0, 0, ${bgOpacity})`,
        text: "#ffffff",
        accent: "#f59e0b",
      },
      transparent: {
        bg: "transparent",
        text: textColor,
        accent: accentColor,
      },
    }

    const currentTheme = themeStyles[theme] || themeStyles.default

    return {
      container: `${sizes.container}`,
      score: `${sizes.score} font-bold`,
      point: `${sizes.point} font-bold`,
      bg: currentTheme.bg,
      text: currentTheme.text,
      accent: currentTheme.accent,
    }
  }

  const styles = getStyles()

  // Получаем стиль градиента для фона
  const getGradientStyle = (useGradient, fromColor, toColor) => {
    if (!useGradient) return {}
    return {
      background: `linear-gradient(to bottom, ${fromColor}, ${toColor})`,
    }
  }

  if (loading) {
    return (
      <div
        style={{
          background: "transparent",
          color: "#ffffff",
          padding: "10px",
          textAlign: "center",
          fontFamily: "Arial, sans-serif",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div>
          <div style={{ marginBottom: "10px" }}>Загрузка данных матча...</div>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid rgba(255,255,255,0.3)",
              borderTop: "4px solid #ffffff",
              borderRadius: "50%",
              margin: "0 auto",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          <style jsx>{`
            @keyframes spin {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </div>
    )
  }

  if (error) {
    return <div style={{ color: "red", padding: "20px", background: "transparent" }}>Ошибка: {error}</div>
  }

  if (!match) return null

  // Если запрошен JSON формат, возвращаем только JSON
  if (outputFormat === "json") {
    return (
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
          padding: "20px",
          background: "#f5f5f5",
          color: "#333",
          fontFamily: "monospace",
          fontSize: "14px",
          borderRadius: "4px",
          overflow: "auto",
        }}
      >
        {jsonOutput}
      </pre>
    )
  }

  // Получаем данные о тай-брейках
  const getTiebreakScores = () => {
    if (!match.score.sets || match.score.sets.length === 0) return {}

    const tiebreakScores = {}
    match.score.sets.forEach((set, index) => {
      if (set.tiebreak) {
        tiebreakScores[index] = {
          teamA: set.tiebreak.teamA,
          teamB: set.tiebreak.teamB,
        }
      }
    })

    return tiebreakScores
  }

  const tiebreakScores = getTiebreakScores()

  // Получаем информацию о важном моменте матча
  const importantPoint = getImportantPoint(match)

  // Для отладки - выводим информацию о важных моментах
  console.log("Важный момент матча:", importantPoint)
  console.log("Game Point:", isGamePoint(match))
  console.log("Set Point:", isSetPoint(match))
  console.log("Match Point:", isMatchPoint(match))

  // Определяем фиксированную ширину для ячеек имен
  const nameColumnWidth = 300
  const countryColumnWidth = 50 // Ширина столбца для страны
  const serveColumnWidth = 30 // Ширина столбца для индикации подачи

  // Рассчитываем ширину таблицы для индикатора
  const tableWidth = showPoints
    ? nameColumnWidth +
      (showCountry ? countryColumnWidth : 0) +
      (showServer ? serveColumnWidth : 0) +
      (match.score.sets?.length || 0) * 40 +
      (match.score.currentSet ? 40 : 0) +
      60
    : nameColumnWidth +
      (showCountry ? countryColumnWidth : 0) +
      (showServer ? serveColumnWidth : 0) +
      (match.score.sets?.length || 0) * 40 +
      (match.score.currentSet ? 40 : 0)

  // Иначе возвращаем HTML интерфейс в стиле скриншота
  return (
    <>
      {/* Добавляем стиль для всей страницы */}
      <style jsx global>{`
        html,
        body {
          background-color: transparent !important;
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
        }
        
        @keyframes slideIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(100%);
            opacity: 0;
          }
        }
        
        .indicator-animation-enter {
          animation: slideIn 1s ease forwards;
        }
        
        .indicator-animation-exit {
          animation: slideOut 1s ease forwards;
        }
      `}</style>

      <div
        style={{
          background: "transparent",
          color: styles.text,
          padding: "0",
          fontFamily: "Arial, sans-serif",
          width: "auto",
          height: "auto",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          position: "relative", // Добавляем позиционирование
          zIndex: 2, // Устанавливаем z-index выше, чем у индикатора
        }}
        className={styles.container}
      >
        {/* Контейнер для счета */}
        <div style={{ display: "flex", flexDirection: "column", width: "fit-content" }}>
          {/* Строка для первого игрока/команды */}
          <div style={{ display: "flex", marginBottom: "1px" }}>
            {/* Имя первого игрока/команды */}
            <div
              style={{
                color: theme === "transparent" ? textColor : "white",
                padding: "1px",
                flex: "0 0 auto",
                width: `${nameColumnWidth}px`,
                minWidth: `${nameColumnWidth}px`,
                maxWidth: `${nameColumnWidth}px`,
                display: "flex",
                alignItems: "center",
                ...(theme === "transparent"
                  ? { background: "transparent" }
                  : namesGradient
                    ? getGradientStyle(true, namesGradientFrom, namesGradientTo)
                    : { background: namesBgColor }),
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", width: "100%", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontSize: `${playerNamesFontSize}em`,
                      padding: "7px",
                    }}
                  >
                    {match.teamA.players[0]?.name}
                  </span>
                </div>
                {match.teamA.players.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontSize: `${playerNamesFontSize}em`,
                        padding: "7px",
                      }}
                    >
                      {match.teamA.players[1]?.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Страна первого игрока/команды */}
            {showCountry && (
              <div
                style={{
                  color: theme === "transparent" ? textColor : "white",
                  padding: "1px",
                  flex: "0 0 auto",
                  width: `${countryColumnWidth}px`,
                  minWidth: `${countryColumnWidth}px`,
                  maxWidth: `${countryColumnWidth}px`,
                  display: "flex",
                  flexDirection: "column",
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : countryGradient
                      ? getGradientStyle(true, countryGradientFrom, countryGradientTo)
                      : { background: countryBgColor }),
                }}
              >
                <div
                  style={{
                    height: match.teamA.players.length > 1 ? "50%" : "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {getPlayerCountryDisplay("teamA", 0, match)}
                </div>
                {match.teamA.players.length > 1 && (
                  <div style={{ height: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {getPlayerCountryDisplay("teamA", 1, match)}
                  </div>
                )}
              </div>
            )}

            {/* Индикация подачи для первого игрока/команды */}
            {showServer && (
              <div
                style={{
                  color: theme === "transparent" ? accentColor : accentColor,
                  padding: "1px",
                  flex: "0 0 auto",
                  width: `${serveColumnWidth}px`,
                  minWidth: `${serveColumnWidth}px`,
                  maxWidth: `${serveColumnWidth}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : serveGradient
                      ? getGradientStyle(true, serveGradientFrom, serveGradientTo)
                      : { background: serveBgColor }),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "space-around",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      visibility: isServing("teamA", 0) ? "visible" : "hidden",
                      fontSize: "4em", // Было "5em"
                      lineHeight: "0.5",
                    }}
                  >
                    •
                  </div>
                  {match.teamA.players.length > 1 && (
                    <div
                      style={{
                        visibility: isServing("teamA", 1) ? "visible" : "hidden",
                        fontSize: "4em", // Было "5em"
                        lineHeight: "0.5",
                      }}
                    >
                      •
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Счет сетов для первого игрока */}
            {showSets && match.score.sets && (
              <>
                {match.score.sets.map((set, idx) => (
                  <div
                    key={idx}
                    style={{
                      ...(theme === "transparent"
                        ? { background: "transparent" }
                        : setsGradient
                          ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
                          : { background: setsBgColor }),
                      color: theme === "transparent" ? textColor : setsTextColor,
                      padding: "1px",
                      flex: "0 0 auto",
                      width: "40px",
                      minWidth: "40px",
                      textAlign: "center",
                      borderLeft: theme === "transparent" ? "none" : "1px solid #e5e5e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.8em",
                    }}
                  >
                    {tiebreakScores[idx] ? formatSetScore(set.teamA, tiebreakScores[idx].teamA) : set.teamA}
                  </div>
                ))}
                {/* Текущий сет */}
                {match.score.currentSet && (
                  <div
                    style={{
                      ...(theme === "transparent"
                        ? { background: "transparent" }
                        : setsGradient
                          ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
                          : { background: setsBgColor }),
                      color: theme === "transparent" ? textColor : setsTextColor,
                      padding: "1px",
                      flex: "0 0 auto",
                      width: "40px",
                      minWidth: "40px",
                      textAlign: "center",
                      borderLeft: theme === "transparent" ? "none" : "1px solid #e5e5e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.8em",
                    }}
                  >
                    {match.score.currentSet.teamA}
                  </div>
                )}
              </>
            )}

            {/* Текущий счет в гейме для первого игрока */}
            {showPoints && match.score.currentSet && (
              <div
                style={{
                  color: theme === "transparent" ? textColor : "white",
                  padding: "1px",
                  flex: "0 0 auto",
                  width: "60px",
                  minWidth: "60px",
                  textAlign: "center",
                  borderLeft: theme === "transparent" ? "none" : "1px solid #e5e5e5",
                  fontSize: "2em", // Было "2.5em"
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : pointsGradient
                      ? getGradientStyle(true, pointsGradientFrom, pointsGradientTo)
                      : { background: pointsBgColor }),
                }}
              >
                {getCurrentGameScore("teamA")}
              </div>
            )}
          </div>

          {/* Строка для второго игрока/команды */}
          <div style={{ display: "flex" }}>
            {/* Имя второго игрока/команды */}
            <div
              style={{
                color: theme === "transparent" ? textColor : "white",
                padding: "1px",
                flex: "0 0 auto",
                width: `${nameColumnWidth}px`,
                minWidth: `${nameColumnWidth}px`,
                maxWidth: `${nameColumnWidth}px`,
                display: "flex",
                alignItems: "center",
                ...(theme === "transparent"
                  ? { background: "transparent" }
                  : namesGradient
                    ? getGradientStyle(true, namesGradientFrom, namesGradientTo)
                    : { background: namesBgColor }),
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", width: "100%", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontSize: `${playerNamesFontSize}em`,
                      padding: "7px",
                    }}
                  >
                    {match.teamB.players[0]?.name}
                  </span>
                </div>
                {match.teamB.players.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontSize: `${playerNamesFontSize}em`,
                        padding: "7px",
                      }}
                    >
                      {match.teamB.players[1]?.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Страна второго игрока/команды */}
            {showCountry && (
              <div
                style={{
                  color: theme === "transparent" ? textColor : "white",
                  padding: "1px",
                  flex: "0 0 auto",
                  width: `${countryColumnWidth}px`,
                  minWidth: `${countryColumnWidth}px`,
                  maxWidth: `${countryColumnWidth}px`,
                  display: "flex",
                  flexDirection: "column",
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : countryGradient
                      ? getGradientStyle(true, countryGradientFrom, countryGradientTo)
                      : { background: countryBgColor }),
                }}
              >
                <div
                  style={{
                    height: match.teamB.players.length > 1 ? "50%" : "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {getPlayerCountryDisplay("teamB", 0, match)}
                </div>
                {match.teamB.players.length > 1 && (
                  <div style={{ height: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {getPlayerCountryDisplay("teamB", 1, match)}
                  </div>
                )}
              </div>
            )}

            {/* Индикация подачи для второго игрока/команды */}
            {showServer && (
              <div
                style={{
                  color: theme === "transparent" ? accentColor : accentColor,
                  padding: "1px",
                  flex: "0 0 auto",
                  width: `${serveColumnWidth}px`,
                  minWidth: `${serveColumnWidth}px`,
                  maxWidth: `${serveColumnWidth}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : serveGradient
                      ? getGradientStyle(true, serveGradientFrom, serveGradientTo)
                      : { background: serveBgColor }),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "space-around",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      visibility: isServing("teamB", 0) ? "visible" : "hidden",
                      fontSize: "4em", // Было "5em"
                      lineHeight: "0.5",
                    }}
                  >
                    •
                  </div>
                  {match.teamB.players.length > 1 && (
                    <div
                      style={{
                        visibility: isServing("teamB", 1) ? "visible" : "hidden",
                        fontSize: "4em", // Было "5em"
                        lineHeight: "0.5",
                      }}
                    >
                      •
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Счет сетов для второго игрока */}
            {showSets && match.score.sets && (
              <>
                {match.score.sets.map((set, idx) => (
                  <div
                    key={idx}
                    style={{
                      ...(theme === "transparent"
                        ? { background: "transparent" }
                        : setsGradient
                          ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
                          : { background: setsBgColor }),
                      color: theme === "transparent" ? textColor : setsTextColor,
                      padding: "1px",
                      flex: "0 0 auto",
                      width: "40px",
                      minWidth: "40px",
                      textAlign: "center",
                      borderLeft: theme === "transparent" ? "none" : "1px solid #e5e5e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.8em",
                    }}
                  >
                    {tiebreakScores[idx] ? formatSetScore(set.teamB, tiebreakScores[idx].teamB) : set.teamB}
                  </div>
                ))}

                {/* Текущий сет */}
                {match.score.currentSet && (
                  <div
                    style={{
                      ...(theme === "transparent"
                        ? { background: "transparent" }
                        : setsGradient
                          ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
                          : { background: setsBgColor }),
                      color: theme === "transparent" ? textColor : setsTextColor,
                      padding: "1px",
                      flex: "0 0 auto",
                      width: "40px",
                      minWidth: "40px",
                      textAlign: "center",
                      borderLeft: theme === "transparent" ? "none" : "1px solid #e5e5e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.8em",
                    }}
                  >
                    {match.score.currentSet.teamB}
                  </div>
                )}
              </>
            )}

            {/* Текущий счет в гейме для второго игрока */}
            {showPoints && match.score.currentSet && (
              <div
                style={{
                  color: theme === "transparent" ? textColor : "white",
                  padding: "1px",
                  flex: "0 0 auto",
                  width: "60px",
                  minWidth: "60px",
                  textAlign: "center",
                  borderLeft: theme === "transparent" ? "none" : "1px solid #e5e5e5",
                  fontSize: "2em", // Было "2.5em"
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : pointsGradient
                      ? getGradientStyle(true, pointsGradientFrom, pointsGradientTo)
                      : { background: pointsBgColor }),
                }}
              >
                {getCurrentGameScore("teamB")}
              </div>
            )}
          </div>

          {/* Индикатор особой ситуации (game point, set point, match point) - всегда показываем */}
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "18px", // Увеличиваем высоту до 18px (было 7px)
              marginTop: "1px", // Небольшой отступ от таблицы счета
              justifyContent: "flex-end", // Выравниваем содержимое по правому краю
              position: "relative", // Добавляем позиционирование
              overflow: "hidden", // Скрываем выходящие за пределы элементы
            }}
          >
            {/* Показываем индикатор только если есть важное событие или идет тай-брейк */}
            {((importantPoint.type && importantPoint.type !== "GAME") || indicatorState === "exiting") && (
              <div
                className={
                  indicatorState === "entering" || indicatorState === "visible"
                    ? "indicator-animation-enter"
                    : "indicator-animation-exit"
                }
                style={{
                  color: theme === "transparent" ? accentColor : indicatorTextColor,
                  backgroundColor:
                    theme === "transparent" ? "transparent" : indicatorGradient ? undefined : indicatorBgColor,
                  ...(indicatorGradient ? getGradientStyle(true, indicatorGradientFrom, indicatorGradientTo) : {}),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "33%", // Ширина индикатора - треть от общей ширины
                  height: "100%",
                  fontWeight: "bold",
                  fontSize: "0.8em", // Увеличиваем размер шрифта для большей высоты
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  position: "absolute", // Абсолютное позиционирование
                  bottom: 0, // Прикрепляем к нижней части контейнера
                  right: 0, // Прикрепляем к правой части контейнера
                  zIndex: 1, // Устанавливаем z-index ниже, чем у основного блока
                }}
              >
                {prevImportantPoint.type !== "GAME" && prevImportantPoint.type
                  ? prevImportantPoint.type
                  : importantPoint.type}
              </div>
            )}
          </div>

          {/* Отладочная информация */}
          {showDebug && (
            <div
              style={{
                marginTop: "20px",
                padding: "10px",
                backgroundColor: "rgba(0,0,0,0.8)",
                color: "white",
                fontFamily: "monospace",
                fontSize: "12px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxWidth: "100%",
                overflow: "auto",
              }}
            >
              {debugInfo}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
