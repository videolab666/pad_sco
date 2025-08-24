"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { getMatchByCourtNumber } from "@/lib/court-utils"
import { getTennisPointName } from "@/lib/tennis-utils"
import { logEvent } from "@/lib/error-logger"
import { subscribeToMatchUpdates } from "@/lib/match-storage"
import { decompressFromUTF16 } from "lz-string"
import { Trophy } from "lucide-react"

type CourtParams = {
  params: {
    number: string
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

// Функция для определения break point
const isBreakPoint = (match) => {
  if (!match || !match.score || !match.score.currentSet || !match.currentServer) {
    return false
  }

  // Получаем текущий гейм-поинт
  const gamePoint = isGamePoint(match)

  // Если нет гейм-поинта, то не может быть и брейк-поинта
  if (!gamePoint) {
    return false
  }

  // Если гейм-поинт есть, проверяем, является ли он брейк-поинтом
  // Брейк-поинт - это когда гейм-поинт у принимающей команды
  const servingTeam = match.currentServer.team

  // Если подающая команда не та, у которой гейм-поинт, значит это брейк-поинт
  return gamePoint !== servingTeam ? gamePoint : false
}

// Функция для подсчета количества брейк-поинтов в текущем гейме
const getBreakPointCount = (match) => {
  if (!match || !match.score || !match.score.currentSet || !match.currentServer) {
    return { current: 0, total: 0 }
  }

  // Получаем текущий брейк-поинт
  const currentBreakPoint = isBreakPoint(match)

  // Если нет текущего брейк-поинта, возвращаем 0
  if (!currentBreakPoint) {
    return { current: 0, total: 0 }
  }

  // Для простоты реализации, просто возвращаем номер текущего брейк-поинта как 1
  // и общее количество как 1
  // В реальном приложении здесь должна быть логика отслеживания всех брейк-поинтов в гейме
  return { current: 1, total: 1 }
}

// Улучшенная функция для определения set point
const isSetPoint = (match) => {
  if (!match || !match.score || !match.score.currentSet) {
    return false
  }

  const currentSet = match.score.currentSet
  const teamAGames = currentSet.teamA
  const teamBGames = currentSet.teamB

  // Если идет тай-брейк, проверяем особым образом
  if (currentSet.isTiebreak) {
    // Получаем, кто имеет гейм-поинт в тай-брейке
    const gamePoint = isGamePoint(match)

    // Если есть гейм-поинт в тай-брейке, то это также и сет-поинт
    if (gamePoint) {
      return gamePoint
    }

    return false
  }

  // Для обычного гейма
  // Получаем, кто имеет гейм-поинт
  const gamePoint = isGamePoint(match)

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

// Улучшенная функция для определения match point
const isMatchPoint = (match) => {
  if (!match || !match.score || !match.score.currentSet) {
    return false
  }

  // Определяем, сколько сетов нужно для победы (обычно 2 из 3)
  const setsToWin = match.setsToWin || 2

  // Получаем текущий счет по сетам
  const teamASets = match.score.sets ? match.score.sets.filter((set) => set.teamA > set.teamB).length : 0
  const teamBSets = match.score.sets ? match.score.sets.filter((set) => set.teamB > set.teamA).length : 0

  // Проверяем, является ли текущий гейм сет-поинтом
  const setPoint = isSetPoint(match)

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

// Улучшенная функция для определения важного момента
const getImportantPoint = (match) => {
  if (!match || !match.score || !match.score.currentSet) {
    return { type: "GAME", team: null }
  }

  // Проверяем, идет ли тай-брейк
  const isTiebreak = match?.score?.currentSet?.isTiebreak || false

  // Сначала проверяем match point (самый приоритетный)
  const matchPoint = isMatchPoint(match)
  if (matchPoint) {
    return { type: "MATCH POINT", team: matchPoint }
  }

  // Затем проверяем set point
  const setPoint = isSetPoint(match)
  if (setPoint) {
    return { type: "SET POINT", team: setPoint }
  }

  // Затем проверяем game point
  const gamePoint = isGamePoint(match)
  if (gamePoint) {
    // Если идет тай-брейк, показываем "TIEBREAK POINT" вместо "GAME POINT"
    if (isTiebreak) {
      return { type: "TIEBREAK POINT", team: gamePoint }
    }
    return { type: "GAME POINT", team: gamePoint }
  }

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

export default function CourtVmixPage({ params }: CourtParams) {
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const [jsonOutput, setJsonOutput] = useState("")
  const [debugInfo, setDebugInfo] = useState("")
  const [prevImportantPoint, setPrevImportantPoint] = useState({ type: null, team: null })
  const [indicatorState, setIndicatorState] = useState("hidden") // "entering", "visible", "exiting", "hidden"
  const [breakPointState, setBreakPointState] = useState("hidden") // "entering", "visible", "exiting", "hidden"
  const [prevBreakPoint, setPrevBreakPoint] = useState({ team: null, count: { current: 0, total: 0 } })
  const courtNumber = Number.parseInt(params.number)

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

          // Проверяем, что параметры индикатора подач правильно добавляются в URL
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
    console.log("Параметры отображения корта:", {
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
    // Добавляем параметры индикатора подач в зависимость
    serveBgColor,
    serveGradient,
    serveGradientFrom,
    serveGradientTo,
  ])

  const loadMatch = useCallback(async () => {
    try {
      if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 10) {
        setError("Некорректный номер корта")
        setLoading(false)
        logEvent("error", "vMix страница корта: некорректный номер корта", "court-vmix-page")
        return
      }

      logEvent("info", `vMix страница корта: начало загрузки матча на корте ${courtNumber}`, "court-vmix-page")

      // Получаем матч по номеру корта
      const matchData = await getMatchByCourtNumber(courtNumber)

      if (matchData) {
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
                breakPoint: isBreakPoint(matchData),
                breakPointCount: getBreakPointCount(matchData),
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
            courtNumber: courtNumber,
            teamA: {
              name: matchData.teamA.players.map((p) => p.name).join(" / "),
              score: matchData.score.teamA,
              currentGameScore: matchData?.score?.currentSet
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
              currentGameScore: matchData?.score?.currentSet
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
        logEvent("info", `vMix страница корта загружена: ${courtNumber}`, "court-vmix-page")
      } else {
        setError(`На корте ${courtNumber} нет активных матчей`)
        logEvent("warn", `vMix страница корта: на корте ${courtNumber} нет активных матчей`, "court-vmix-page")
      }
    } catch (err) {
      setError("Ошибка загрузки матча")
      logEvent("error", "Ошибка загрузки матча для vMix корта", "court-vmix-page", err)
    } finally {
      setLoading(false)
    }
  }, [courtNumber, outputFormat, showDebug])

  useEffect(() => {
    loadMatch()
  }, [loadMatch])

  // Настраиваем интервал для периодической проверки матча на корте
  useEffect(() => {
    const checkCourtInterval = setInterval(async () => {
      try {
        const currentMatchData = await getMatchByCourtNumber(courtNumber)

        // Если матч не найден, но у нас был матч ранее, обновляем состояние
        if (!currentMatchData && match) {
          setMatch(null)
          setError(`На корте ${courtNumber} нет активных матчей`)
          return
        }

        // Если матч найден и его ID отличается от текущего, значит на корте новый матч
        if (currentMatchData && (!match || currentMatchData.id !== match.id)) {
          setMatch(currentMatchData)
          setError("")

          // Обновляем отладочную информацию
          if (showDebug) {
            setDebugInfo(
              JSON.stringify(
                {
                  currentGame: currentMatchData.score.currentSet?.currentGame,
                  currentSet: {
                    teamA: currentMatchData.score.currentSet?.teamA,
                    teamB: currentMatchData.score.currentSet?.teamB,
                    isTiebreak: currentMatchData.score.currentSet?.isTiebreak,
                  },
                  sets: currentMatchData.score.sets,
                  gamePoint: isGamePoint(currentMatchData),
                  setPoint: isSetPoint(currentMatchData),
                  matchPoint: isMatchPoint(currentMatchData),
                  breakPoint: isBreakPoint(currentMatchData),
                  breakPointCount: getBreakPointCount(currentMatchData),
                },
                null,
                2,
              ),
            )
          }

          // Обновляем JSON для vMix
          if (outputFormat === "json") {
            const vmixData = {
              id: currentMatchData.id,
              courtNumber: courtNumber,
              teamA: {
                name: currentMatchData.teamA.players.map((p) => p.name).join(" / "),
                score: currentMatchData.score.teamA,
                currentGameScore: currentMatchData.score.currentSet
                  ? currentMatchData.score.currentSet.isTiebreak
                    ? currentMatchData.score.currentSet.currentGame.teamA
                    : getTennisPointName(currentMatchData.score.currentSet.currentGame.teamA)
                  : "0",
                sets: currentMatchData.score.sets ? currentMatchData.score.sets.map((set) => set.teamA) : [],
                currentSet: currentMatchData.score.currentSet ? currentMatchData.score.currentSet.teamA : 0,
                serving: currentMatchData.currentServer && currentMatchData.currentServer.team === "teamA",
                countries: currentMatchData.teamA.players.map((p) => p.country || "").filter(Boolean),
              },
              teamB: {
                name: currentMatchData.teamB.players.map((p) => p.name).join(" / "),
                score: currentMatchData.score.teamB,
                currentGameScore: currentMatchData.score.currentSet
                  ? currentMatchData.score.currentSet.isTiebreak
                    ? currentMatchData.score.currentSet.currentGame.teamB
                    : getTennisPointName(currentMatchData.score.currentSet.currentGame.teamB)
                  : "0",
                sets: currentMatchData.score.sets ? currentMatchData.score.sets.map((set) => set.teamB) : [],
                currentSet: currentMatchData.score.currentSet ? currentMatchData.score.currentSet.teamB : 0,
                serving: currentMatchData.currentServer && currentMatchData.currentServer.team === "teamB",
                countries: currentMatchData.teamB.players.map((p) => p.country || "").filter(Boolean),
              },
              isTiebreak: currentMatchData.score.currentSet ? currentMatchData.score.currentSet.isTiebreak : false,
              isCompleted: currentMatchData.isCompleted || false,
              winner: currentMatchData.winner || null,
              timestamp: new Date().toISOString(),
            }
            setJsonOutput(JSON.stringify(vmixData, null, 2))
          }
        }
      } catch (error) {
        // Тихо обрабатываем ошибки при проверке корта
        console.error("Ошибка при проверке матча на корте:", error)
      }
    }, 10000) // Проверяем каждые 10 секунд

    return () => clearInterval(checkCourtInterval)
  }, [courtNumber, match, outputFormat, showDebug])

  // Подписываемся на обновления текущего матча, если он есть
  useEffect(() => {
    let matchUnsubscribe = null

    if (match && match.id) {
      matchUnsubscribe = subscribeToMatchUpdates(match.id, (updatedMatch) => {
        if (updatedMatch) {
          // Используем функциональное обновление состояния для гарантии актуальности
          setMatch((prevMatch) => {
            // Если ID матча изменился или это первое обновление, просто возвращаем новый матч
            if (!prevMatch || prevMatch.id !== updatedMatch.id) {
              return updatedMatch
            }

            // Проверяем, действительно ли изменился счет
            const prevScore = JSON.stringify(prevMatch.score)
            const newScore = JSON.stringify(updatedMatch.score)

            // Если счет не изменился, сохраняем предыдущее состояние
            if (prevScore === newScore) {
              return prevMatch
            }

            // Возвращаем обновленный матч с принудительным обновлением счета
            return {
              ...updatedMatch,
              _forceUpdate: Date.now(), // Добавляем временную метку для принудительного обновления
            }
          })

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
                  breakPoint: isBreakPoint(updatedMatch),
                  breakPointCount: getBreakPointCount(updatedMatch),
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
              courtNumber: courtNumber,
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
        }
      })
    }

    // Очистка при размонтировании компонента
    return () => {
      if (matchUnsubscribe) {
        matchUnsubscribe()
      }
    }
  }, [match?.id, courtNumber, outputFormat, showDebug]) // Изменяем зависимость на match?.id вместо всего match

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

      // Через 1 секунду (длительность анимации) меняем состояние на "hidden"
      const timer = setTimeout(() => {
        setIndicatorState("hidden")
      }, 1000)

      return () => clearTimeout(timer)
    }

    // Обновляем предыдущее значение только если оно действительно изменилось
    setPrevImportantPoint(currentImportantPoint)
  }, [match, prevImportantPoint.type]) // Зависим только от match и prevImportantPoint.type

  // Эффект для отслеживания изменений брейк-поинта и управления анимацией
  useEffect(() => {
    if (!match) return

    const currentBreakPoint = isBreakPoint(match)
    const breakPointCount = getBreakPointCount(match)

    // Проверяем, действительно ли изменился брейк-поинт
    const prevBreakPointTeam = prevBreakPoint.team

    // Если брейк-поинт не изменился, ничего не делаем
    if (currentBreakPoint === prevBreakPointTeam) return

    // Если появился брейк-поинт
    if (currentBreakPoint && !prevBreakPointTeam) {
      setBreakPointState("entering")

      // Через 1 секунду (длительность анимации) меняем состояние на "visible"
      const timer = setTimeout(() => {
        setBreakPointState("visible")
      }, 1000)

      return () => clearTimeout(timer)
    }

    // Если брейк-поинт исчез
    if (!currentBreakPoint && prevBreakPointTeam) {
      setBreakPointState("exiting")

      // Через 1 секунду (длительность анимации) меняем состояние на "hidden"
      const timer = setTimeout(() => {
        setBreakPointState("hidden")
      }, 1000)

      return () => clearTimeout(timer)
    }

    // Обновляем предыдущее значение только если оно действительно изменилось
    setPrevBreakPoint({ team: currentBreakPoint, count: breakPointCount })
  }, [match, prevBreakPoint.team])

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
    if (!tiebreakScore) {
      return <span>{score}</span>
    }

    return (
      <span>
        {score}
        <sup style={{ fontSize: "0.67em", position: "relative", top: "-0.8em" }}>{tiebreakScore}</sup>
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
          <div style={{ marginBottom: "10px" }}>Загрузка данных матча на корте {courtNumber}...</div>
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
          />
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

  // Получаем информацию о брейк-поинте
  const breakPoint = isBreakPoint(match)
  const breakPointCount = getBreakPointCount(match)

  // Для отладки - выводим информацию о важных моментах
  if (showDebug) {
    console.log("Важный момент матча:", importantPoint)
    console.log("Game Point:", isGamePoint(match))
    console.log("Set Point:", isSetPoint(match))
    console.log("Match Point:", isMatchPoint(match))
    console.log("Break Point:", breakPoint)
    console.log("Break Point Count:", breakPointCount)
  }

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
        {/* Индикатор брейк-поинта (сверху) */}
        <div
          style={{
            display: "flex",
            width: `${tableWidth}px`, // Устанавливаем ширину равной ширине таблицы счета
            height: "18px", // Такая же высота, как у индикатора важного события
            marginBottom: "1px", // Небольшой отступ от таблицы счета
            justifyContent: "flex-end", // Выравниваем содержимое по правому краю
            position: "relative", // Добавляем позиционирование
            overflow: "hidden", // Скрываем выходящие за пределы элементы
          }}
        >
          {/* Показываем индикатор только если есть брейк-поинт */}
          {(breakPoint || breakPointState === "exiting") && (
            <div
              className={
                breakPointState === "entering" || breakPointState === "visible"
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
                width: "120px", // Фиксированная ширина для лучшего контроля
                height: "100%",
                fontWeight: "bold",
                fontSize: "0.8em", // Такой же размер шрифта, как у индикатора важного события
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                position: "absolute", // Абсолютное позиционирование
                top: 0, // Прикрепляем к верхней части контейнера
                right: "60px", // Смещаем влево на половину ширины (120px/2 = 60px)
                zIndex: 1, // Устанавливаем z-index ниже, чем у основного блока
                overflow: "hidden", // Скрываем выходящий за пределы текст
              }}
            >
              {`BREAK POINT ${breakPointCount.current}/${breakPointCount.total}`}
            </div>
          )}
        </div>

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
                      paddingLeft: "10px", // Добавляем отступ слева
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
                        paddingLeft: "10px", // Добавляем отступ слева
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
                    key={`teamA-set-${idx}-${set.teamA}-${tiebreakScores[idx]?.teamA || ""}`}
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
                {/* Текущий сет - показываем только если матч не завершен */}
                {match.score.currentSet && !match.isCompleted && (
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
            {showPoints && (
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
                {match.isCompleted && match.winner === "teamA" ? (
                  <Trophy size={24} />
                ) : (
                  match.score.currentSet && (
                    <span
                      key={`teamA-score-${match.id}-${JSON.stringify(match.score.currentSet?.currentGame?.teamA || 0)}`}
                    >
                      {getCurrentGameScore("teamA")}
                    </span>
                  )
                )}
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
                      paddingLeft: "10px", // Добавляем отступ слева
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
                        paddingLeft: "10px", // Добавляем отступ слева
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
                    key={`teamB-set-${idx}-${set.teamB}-${tiebreakScores[idx]?.teamB || ""}`}
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

                {/* Текущий сет - показываем только если матч не завершен */}
                {match.score.currentSet && !match.isCompleted && (
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
            {showPoints && (
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
                {match.isCompleted && match.winner === "teamB" ? (
                  <Trophy size={24} />
                ) : (
                  match.score.currentSet && (
                    <span
                      key={`teamB-score-${match.id}-${JSON.stringify(match.score.currentSet?.currentGame?.teamB || 0)}`}
                    >
                      {getCurrentGameScore("teamB")}
                    </span>
                  )
                )}
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
