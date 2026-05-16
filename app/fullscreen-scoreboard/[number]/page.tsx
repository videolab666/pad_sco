"use client"

import React, { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { getMatchByCourtNumber } from "@/lib/court-utils"
import { getTennisPointName } from "@/lib/tennis-utils"
import { logEvent } from "@/lib/error-logger"
import { subscribeToMatchUpdates } from "@/lib/match-storage"
import { applyScoreIncrement, getImportantPoint } from "@/lib/scoring-logic"
import { Maximize2, Minimize2, Trophy, ArrowLeft, Clock } from "lucide-react"
import { translations, type Language } from "@/lib/translations"
import { getDefaultVmixSettings } from "@/lib/vmix-settings-storage"

type FullscreenScoreboardParams = {
  params: Promise<{
    number: string
  }>
}

// Функция для преобразования параметра цвета из URL
const parseColorParam = (param, defaultColor) => {
  if (!param) return defaultColor
  // Если параметр не содержит #, добавляем его
  return param.startsWith("#") ? param : `#${param}`
}

// Получаем страну игрока
const getPlayerCountryDisplay = (team, playerIndex, matchData) => {
  if (!matchData) return " "
  const player = matchData[team]?.players[playerIndex]
  return player?.country || " "
}

export default function FullscreenScoreboard({ params }: FullscreenScoreboardParams) {
  const resolvedParams = React.use(params)
  // --- All state hooks must be at the top ---
  // TODO: Replace 'any' with a proper Match type if available
  const [match, setMatch] = useState<any>(null);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCompletedMatch, setIsCompletedMatch] = useState(false);
  const [lastMatchId, setLastMatchId] = useState(null);
  const searchParams = useSearchParams();
  const containerRef = useRef(null);
  const courtNumber = Number.parseInt(resolvedParams.number);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Состояние для настроек отображения
  const [theme, setTheme] = useState("default");
  const [showNames, setShowNames] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [showSets, setShowSets] = useState(true);
  const [showServer, setShowServer] = useState(true);
  const [showCountry, setShowCountry] = useState(false);
  const [textColor, setTextColor] = useState("#ffffff");
  const [accentColor, setAccentColor] = useState("#a4fb23");
  const [namesBgColor, setNamesBgColor] = useState("#0369a1");
  const [countryBgColor, setCountryBgColor] = useState("#0369a1");
  const [pointsBgColor, setPointsBgColor] = useState("#0369a1");
  const [setsBgColor, setSetsBgColor] = useState("#ffffff");
  const [setsTextColor, setSetsTextColor] = useState("#000000");
  const [serveBgColor, setServeBgColor] = useState("#000000");
  const [namesGradient, setNamesGradient] = useState(true);
  const [namesGradientFrom, setNamesGradientFrom] = useState("#0369a1");
  const [namesGradientTo, setNamesGradientTo] = useState("#0284c7");
  const [countryGradient, setCountryGradient] = useState(true);
  const [countryGradientFrom, setCountryGradientFrom] = useState("#0369a1");
  const [countryGradientTo, setCountryGradientTo] = useState("#0284c7");
  const [pointsGradient, setPointsGradient] = useState(true);
  const [pointsGradientFrom, setPointsGradientFrom] = useState("#0369a1");
  const [pointsGradientTo, setPointsGradientTo] = useState("#0284c7");
  const [setsGradient, setSetsGradient] = useState(true);
  const [setsGradientFrom, setSetsGradientFrom] = useState("#ffffff");
  const [setsGradientTo, setSetsGradientTo] = useState("#f0f0f0");
  const [serveGradient, setServeGradient] = useState(true);
  const [serveGradientFrom, setServeGradientFrom] = useState("#000000");
  const [serveGradientTo, setServeGradientTo] = useState("#1e1e1e");
  const [indicatorBgColor, setIndicatorBgColor] = useState("#7c2d12");
  const [indicatorTextColor, setIndicatorTextColor] = useState("#ffffff");
  const [indicatorGradient, setIndicatorGradient] = useState(true);
  const [indicatorGradientFrom, setIndicatorGradientFrom] = useState("#7c2d12");
  const [indicatorGradientTo, setIndicatorGradientTo] = useState("#991b1b");
  const [language, setLanguage] = useState<Language>("ru");
  const showDebug = searchParams.get("debug") === "true";

  // Handler to increment score for Team A or B
  const handleIncrementScore = async (team: 'teamA' | 'teamB') => {
    if (!match || match.isCompleted) return;
    // Save current match state to history for undo
    setMatchHistory(prev => [...prev, JSON.parse(JSON.stringify(match))]);
    // Deep copy to avoid mutating state directly
    const updatedMatch = JSON.parse(JSON.stringify(match));
    // Use shared scoring logic
    const resultMatch = applyScoreIncrement(updatedMatch, team);
    setMatch(resultMatch);
    try {
      if (typeof window !== "undefined") {
        const { updateMatch } = await import("@/lib/match-storage");
        await updateMatch(resultMatch);
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Failed to update match after increment score:", e);
      }
    }
    logEvent("info", `Score incremented for ${team}`, "fullscreen-scoreboard", { matchId: match.id });
  };

  // Undo last score change
  const handleUndoScoreChange = async () => {
    if (!matchHistory.length) return;
    const prevMatch = matchHistory[matchHistory.length - 1];
    setMatch(prevMatch);
    setMatchHistory(history => history.slice(0, -1));
    try {
      if (typeof window !== "undefined") {
        const { updateMatch } = await import("@/lib/match-storage");
        await updateMatch(prevMatch);
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Failed to update match after undo:", e);
      }
    }
    logEvent("info", `Undo last score change`, "fullscreen-scoreboard", { matchId: prevMatch?.id });
  };

  // Handler to finish the match
  const handleFinishMatch = async () => {
    if (!match || match.isCompleted) return;
    const updatedMatch = { ...match, isCompleted: true, winner: null };
    setMatch(updatedMatch);
    setIsCompletedMatch(true);

    // Try to update backend (Supabase/localStorage)
    try {
      // Use updateMatch if available
      if (typeof window !== "undefined") {
        const { updateMatch } = await import("@/lib/match-storage");
        await updateMatch(updatedMatch);
      }
    } catch (e) {
      // Ignore backend errors but log for debug
      if (process.env.NODE_ENV !== 'production') {
        console.error("Failed to update match in backend:", e);
      }
    }
  };

  // Global keydown event for F key (finish match)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // F key (case-insensitive)
      if (e.key === 'F' || e.key === 'f') {
        handleFinishMatch();
        return;
      }
      // A key (increment Team A)
      if (e.key === 'A' || e.key === 'a') {
        handleIncrementScore('teamA');
        return;
      }
      // B key (increment Team B)
      if (e.key === 'B' || e.key === 'b') {
        handleIncrementScore('teamB');
        return;
      }
      // U key (undo last score change)
      if (e.key === 'U' || e.key === 'u') {
        handleUndoScoreChange();
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [match, matchHistory]);

  // Функция для загрузки настроек из базы данных
  const loadSettingsFromDatabase = async () => {
    try {
      setLoadingSettings(true)
      logEvent("info", "Загрузка настроек vMix из базы данных", "fullscreen-scoreboard")

      const defaultSettings = await getDefaultVmixSettings()

      if (defaultSettings && defaultSettings.settings) {
        logEvent("info", "Настройки vMix загружены из базы данных", "fullscreen-scoreboard", {
          settingsName: defaultSettings.name,
        })

        // Применяем настройки из базы данных
        applySettings(defaultSettings.settings)
      } else {
        logEvent("warn", "Настройки vMix по умолчанию не найдены в базе данных", "fullscreen-scoreboard")
        // Если настроек по умолчанию нет, пробуем загрузить из localStorage
        loadSettingsFromLocalStorage()
      }
    } catch (error) {
      logEvent("error", "Ошибка при загрузке настроек vMix из базы данных", "fullscreen-scoreboard", error)
      // В случае ошибки пробуем загрузить из localStorage
      loadSettingsFromLocalStorage()
    } finally {
      setLoadingSettings(false)
      setSettingsLoaded(true)
    }
  }

  // Функция для загрузки настроек из localStorage
  const loadSettingsFromLocalStorage = () => {
    try {
      const savedSettings = localStorage.getItem("vmix_settings")
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        applySettings(settings)
        logEvent("info", "Настройки vMix загружены из localStorage", "fullscreen-scoreboard")
      }
    } catch (error) {
      logEvent("error", "Ошибка при загрузке настроек vMix из localStorage", "fullscreen-scoreboard", error)
    }
  }

  // Функция для применения настроек
  const applySettings = (settings) => {
    if (!settings) return

    // Применяем основные настройки
    setTheme(settings.theme || "default")
    setShowNames(settings.showNames !== undefined ? settings.showNames : true)
    setShowPoints(settings.showPoints !== undefined ? settings.showPoints : true)
    setShowSets(settings.showSets !== undefined ? settings.showSets : true)
    setShowServer(settings.showServer !== undefined ? settings.showServer : true)
    setShowCountry(settings.showCountry !== undefined ? settings.showCountry : false)
    setTextColor(settings.textColor || "#ffffff")
    setAccentColor(settings.accentColor || "#a4fb23")

    // Применяем настройки цветов
    setNamesBgColor(settings.namesBgColor || "#0369a1")
    setCountryBgColor(settings.countryBgColor || "#0369a1")
    setPointsBgColor(settings.pointsBgColor || "#0369a1")
    setSetsBgColor(settings.setsBgColor || "#ffffff")
    setSetsTextColor(settings.setsTextColor || "#000000")
    setServeBgColor(settings.serveBgColor || "#000000")

    // Применяем настройки градиентов
    setNamesGradient(settings.namesGradient !== undefined ? settings.namesGradient : true)
    setNamesGradientFrom(settings.namesGradientFrom || "#0369a1")
    setNamesGradientTo(settings.namesGradientTo || "#0284c7")

    setCountryGradient(settings.countryGradient !== undefined ? settings.countryGradient : true)
    setCountryGradientFrom(settings.countryGradientFrom || "#0369a1")
    setCountryGradientTo(settings.countryGradientTo || "#0284c7")

    setPointsGradient(settings.pointsGradient !== undefined ? settings.pointsGradient : true)
    setPointsGradientFrom(settings.pointsGradientFrom || "#0369a1")
    setPointsGradientTo(settings.pointsGradientTo || "#0284c7")

    setSetsGradient(settings.setsGradient !== undefined ? settings.setsGradient : true)
    setSetsGradientFrom(settings.setsGradientFrom || "#ffffff")
    setSetsGradientTo(settings.setsGradientTo || "#f0f0f0")

    setServeGradient(settings.serveGradient !== undefined ? settings.serveGradient : true)
    setServeGradientFrom(settings.serveGradientFrom || "#000000")
    setServeGradientTo(settings.serveGradientTo || "#1e1e1e")

    // Применяем настройки индикатора
    setIndicatorBgColor(settings.indicatorBgColor || "#7c2d12")
    setIndicatorTextColor(settings.indicatorTextColor || "#ffffff")
    setIndicatorGradient(settings.indicatorGradient !== undefined ? settings.indicatorGradient : true)
    setIndicatorGradientFrom(settings.indicatorGradientFrom || "#7c2d12")
    setIndicatorGradientTo(settings.indicatorGradientTo || "#991b1b")
  }

  // Загрузка настроек из URL или базы данных при первом рендере
  useEffect(() => {
    // Проверяем, есть ли параметры настроек в URL
    const hasSettingsInUrl =
      searchParams.has("theme") ||
      searchParams.has("showNames") ||
      searchParams.has("showPoints") ||
      searchParams.has("showSets") ||
      searchParams.has("showServer") ||
      searchParams.has("showCountry") ||
      searchParams.has("textColor") ||
      searchParams.has("accentColor")

    if (hasSettingsInUrl) {
      // Если настройки есть в URL, применяем их
      setTheme(searchParams.get("theme") || "default")
      setShowNames(searchParams.get("showNames") !== "false")
      setShowPoints(searchParams.get("showPoints") !== "false")
      setShowSets(searchParams.get("showSets") !== "false")
      setShowServer(searchParams.get("showServer") !== "false")
      setShowCountry(searchParams.get("showCountry") === "true")
      setTextColor(parseColorParam(searchParams.get("textColor"), "#ffffff"))
      setAccentColor(parseColorParam(searchParams.get("accentColor"), "#a4fb23"))

      // Применяем настройки цветов из URL
      setNamesBgColor(parseColorParam(searchParams.get("namesBgColor"), "#0369a1"))
      setCountryBgColor(parseColorParam(searchParams.get("countryBgColor"), "#0369a1"))
      setPointsBgColor(parseColorParam(searchParams.get("pointsBgColor"), "#0369a1"))
      setSetsBgColor(parseColorParam(searchParams.get("setsBgColor"), "#ffffff"))
      setSetsTextColor(parseColorParam(searchParams.get("setsTextColor"), "#000000"))
      setServeBgColor(parseColorParam(searchParams.get("serveBgColor"), "#000000"))

      // Применяем настройки градиентов из URL
      setNamesGradient(searchParams.get("namesGradient") === "true")
      setNamesGradientFrom(parseColorParam(searchParams.get("namesGradientFrom"), "#0369a1"))
      setNamesGradientTo(parseColorParam(searchParams.get("namesGradientTo"), "#0284c7"))

      setCountryGradient(searchParams.get("countryGradient") === "true")
      setCountryGradientFrom(parseColorParam(searchParams.get("countryGradientFrom"), "#0369a1"))
      setCountryGradientTo(parseColorParam(searchParams.get("countryGradientTo"), "#0284c7"))

      setPointsGradient(searchParams.get("pointsGradient") === "true")
      setPointsGradientFrom(parseColorParam(searchParams.get("pointsGradientFrom"), "#0369a1"))
      setPointsGradientTo(parseColorParam(searchParams.get("pointsGradientTo"), "#0284c7"))

      setSetsGradient(searchParams.get("setsGradient") === "true")
      setSetsGradientFrom(parseColorParam(searchParams.get("setsGradientFrom"), "#ffffff"))
      setSetsGradientTo(parseColorParam(searchParams.get("setsGradientTo"), "#f0f0f0"))

      setServeGradient(searchParams.get("serveGradient") === "true")
      setServeGradientFrom(parseColorParam(searchParams.get("serveGradientFrom"), "#000000"))
      setServeGradientTo(parseColorParam(searchParams.get("serveGradientTo"), "#1e1e1e"))

      // Применяем настройки индикатора из URL
      setIndicatorBgColor(parseColorParam(searchParams.get("indicatorBgColor"), "#7c2d12"))
      setIndicatorTextColor(parseColorParam(searchParams.get("indicatorTextColor"), "#ffffff"))
      setIndicatorGradient(searchParams.get("indicatorGradient") === "true")
      setIndicatorGradientFrom(parseColorParam(searchParams.get("indicatorGradientFrom"), "#7c2d12"))
      setIndicatorGradientTo(parseColorParam(searchParams.get("indicatorGradientTo"), "#991b1b"))

      setSettingsLoaded(true)
      logEvent("info", "Настройки vMix загружены из URL", "fullscreen-scoreboard")
    } else {
      // Если настроек нет в URL, загружаем из базы данных
      loadSettingsFromDatabase()
    }
  }, [searchParams])

  useEffect(() => {
    // Сначала проверяем URL параметр
    const urlLang = searchParams.get("language") as Language
    if (urlLang && Object.keys(translations).includes(urlLang)) {
      setLanguage(urlLang)
      return
    }

    // Затем проверяем localStorage
    try {
      const storedLang = localStorage.getItem("language") as Language
      if (storedLang && Object.keys(translations).includes(storedLang)) {
        setLanguage(storedLang)
      }
    } catch (e) {
      // Игнорируем ошибки localStorage (например, в режиме инкогнито)
      console.error("Error accessing localStorage:", e)
    }
  }, [searchParams])

  // Функция для переключения полноэкранного режима
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Входим в полноэкранный режим
      if (containerRef.current?.requestFullscreen) {
        containerRef.current
          .requestFullscreen()
          .then(() => {
            setIsFullscreen(true)
          })
          .catch((err) => {
            console.error(`${translations[language].common.error}: ${err.message}`)
          })
      }
    } else {
      // Выходим из полноэкранного режима
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => {
            setIsFullscreen(false)
          })
          .catch((err) => {
            console.error(`${translations[language].common.error}: ${err.message}`)
          })
      }
    }
  }

  // Слушаем изменения состояния полноэкранного режима
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Эффект для автоматического перехода в полноэкранный режим при параметре autoFullscreen=true
  useEffect(() => {
    if (typeof window !== "undefined" && settingsLoaded) {
      const searchParams = new URLSearchParams(window.location.search)
      const autoFullscreen = searchParams.get("autoFullscreen")

      if (autoFullscreen === "true" && containerRef.current && !document.fullscreenElement) {
        // Небольшая задержка для уверенности, что компонент полностью отрендерился
        const timer = setTimeout(() => {
          containerRef.current.requestFullscreen().catch((err) => {
            console.error("Ошибка при переходе в полноэкранный режим:", err)
            logEvent("error", "Ошибка при автоматическом переходе в полноэкранный режим", "fullscreen-scoreboard", err)
          })
        }, 1000)

        return () => clearTimeout(timer)
      }
    }
  }, [match, settingsLoaded]) // Зависимость от match и settingsLoaded гарантирует, что эффект сработает после загрузки данных и настроек

  // Функция для загрузки матча
  const loadMatch = async () => {
    try {
      if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 10) {
        setError(
          translations[language].common.error +
          ": " +
          (translations[language].scoreboard.invalidCourt || "Invalid court number"),
        )
        setLoading(false)
        logEvent("error", "Fullscreen Scoreboard: invalid court number", "fullscreen-scoreboard")
        return
      }

      logEvent("info", `Fullscreen Scoreboard: начало загрузки матча на корте ${courtNumber}`, "fullscreen-scoreboard")

      // Получаем матч по номеру корта
      const matchData = await getMatchByCourtNumber(courtNumber)

      if (matchData) {
        console.log("Loaded match data:", JSON.stringify(matchData, null, 2))

        // Проверяем, изменился ли ID матча
        if (lastMatchId !== matchData.id) {
          console.log(`New match detected! Previous ID: ${lastMatchId}, New ID: ${matchData.id}`)
          setLastMatchId(matchData.id)
        }

        setMatch(matchData)
        setError("")

        // Отмечаем, если это завершенный матч
        setIsCompletedMatch(matchData.isCompleted === true)

        logEvent("info", `Fullscreen Scoreboard: матч загружен: ${courtNumber}`, "fullscreen-scoreboard", {
          matchId: matchData.id,
          isCompleted: matchData.isCompleted,
        })

        return matchData
      } else {
        setError(
          translations[language].scoreboard.noActiveMatches?.replace("{number}", courtNumber) ||
          `No active matches on court ${courtNumber}`,
        )
        logEvent("warn", `Fullscreen Scoreboard: no active matches on court ${courtNumber}`, "fullscreen-scoreboard")
        return null
      }
    } catch (err) {
      setError(
        translations[language].common.error +
        ": " +
        (translations[language].scoreboard.loadError || "Error loading match"),
      )
      logEvent("error", "Ошибка загрузки матча для Fullscreen Scoreboard", "fullscreen-scoreboard", err)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Загрузка матча и настройка подписки на обновления
  useEffect(() => {
    let unsubscribe = null
    let checkInterval = null

    const setupSubscription = async () => {
      // Загружаем матч
      const matchData = await loadMatch()

      if (!matchData) return

      // Настраиваем подписку на обновления матча
      unsubscribe = subscribeToMatchUpdates(matchData.id, async (updatedMatch) => {
        if (updatedMatch) {
          // Загружаем состояние синхронизации
          let hasPendingOperations = false;
          try {
            const { getMatchSyncState } = await import("@/lib/match-sync");
            const syncState = getMatchSyncState(matchData.id);
            hasPendingOperations = syncState && syncState.pendingCount > 0;
          } catch (e) {
            console.error("Ошибка при получении состояния синхронизации:", e);
          }

          if (hasPendingOperations) {
            return;
          }

          console.log("Match update received:", JSON.stringify(updatedMatch, null, 2))
          setMatch((prev) => {
            if (
              prev &&
              typeof prev.revision === "number" &&
              typeof updatedMatch.revision === "number" &&
              updatedMatch.revision <= prev.revision
            ) {
              return prev;
            }
            return updatedMatch;
          })
          setError("")

          // Preserve local completed state if we've already finished the match
          if (isCompletedMatch && updatedMatch.isCompleted !== true) {
            // Prevent rollback of completion status
            setIsCompletedMatch(true);
            // Optionally, merge isCompleted into match object for UI
            setMatch((prev) => prev ? { ...prev, isCompleted: true } : updatedMatch);
            logEvent("warn", "Realtime update tried to reset isCompleted to false, preserving local completed state", "fullscreen-scoreboard", {
              matchId: updatedMatch.id,
            });
          } else {
            setIsCompletedMatch(updatedMatch.isCompleted === true);
          }

          logEvent("debug", "Fullscreen Scoreboard: получено обновление матча", "fullscreen-scoreboard", {
            matchId: updatedMatch.id,
            scoreA: updatedMatch.score.teamA,
            scoreB: updatedMatch.score.teamB,
            isCompleted: updatedMatch.isCompleted,
          })
        } else {
          // Если матч не найден, пробуем загрузить новый матч
          loadMatch()
        }
      })
    }

    // Запускаем первоначальную загрузку и подписку
    setupSubscription()

    // Настраиваем перидическую проверку наличия нового матча
    checkInterval = setInterval(async () => {
      // Если текущий матч завершен, проверяем наличие нового матча
      if (isCompletedMatch) {
        console.log("Checking for new match on court", courtNumber)
        const newMatchData = await getMatchByCourtNumber(courtNumber)

        // Если найден новый матч с другим ID
        if (newMatchData && newMatchData.id !== lastMatchId) {
          console.log("New match found on court", courtNumber, "ID:", newMatchData.id)

          // Отписываемся от старого матча
          if (unsubscribe) {
            unsubscribe()
          }

          // Обновляем данные и подписываемся на новый матч
          setMatch(newMatchData)
          setLastMatchId(newMatchData.id)
          setIsCompletedMatch(newMatchData.isCompleted === true)
          setError("")

          // Настраиваем новую подписку
          unsubscribe = subscribeToMatchUpdates(newMatchData.id, async (updatedMatch) => {
            if (updatedMatch) {
              // Загружаем состояние синхронизации
              let hasPendingOperations = false;
              try {
                const { getMatchSyncState } = await import("@/lib/match-sync");
                const syncState = getMatchSyncState(newMatchData.id);
                hasPendingOperations = syncState && syncState.pendingCount > 0;
              } catch (e) {
                console.error("Ошибка при получении состояния синхронизации:", e);
              }

              if (hasPendingOperations) {
                return;
              }

              setMatch((prev) => {
                if (
                  prev &&
                  typeof prev.revision === "number" &&
                  typeof updatedMatch.revision === "number" &&
                  updatedMatch.revision <= prev.revision
                ) {
                  return prev;
                }
                return updatedMatch;
              })
              setIsCompletedMatch(updatedMatch.isCompleted === true)
              setError("")
            }
          })
        }
      }
    }, 10000) // Проверяем каждые 10 секунд

    // Очистка при размонтировании
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
      if (checkInterval) {
        clearInterval(checkInterval)
      }
    }
  }, [courtNumber, language, lastMatchId, isCompletedMatch])

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
    if (tiebreakScore === null) return <span>{score}</span>

    return (
      <span className="relative">
        {score}
        <span className="absolute -top-[12px] -right-4 text-[0.45em] font-bold" style={{ color: "inherit" }}>
          {tiebreakScore}
        </span>
      </span>
    )
  }

  // Получаем данные о тай-брейках
  const getTiebreakScores = () => {
    if (!match || !match.score || !match.score.sets || match.score.sets.length === 0) return {}

    const tiebreakScores = {}
    match.score.sets.forEach((set, index) => {
      // Проверяем наличие тай-брейка в данных сета
      if (set.tiebreak) {
        tiebreakScores[index] = {
          teamA: set.tiebreak.teamA,
          teamB: set.tiebreak.teamB,
        }
      }
      // Удаляем альтернативный способ определения тай-брейка, который создавал примерный счет
      // Если данных о тай-брейке нет, просто не показываем его
    })

    return tiebreakScores
  }

  // getPointIndex, isGamePoint, isSetPoint, isMatchPoint, getImportantPoint
  // → removed, now imported from @/lib/scoring-logic

  const getImportantEvent = () => {
    if (!match || !match.score) return null

    if (match.isCompleted) {
      return translations[language].scoreboard.matchCompleted || "MATCH IS OVER"
    }

    const { type } = getImportantPoint(match)
    return type || null
  }

  // Получаем стиль градиента для фона
  const getGradientStyle = (useGradient, fromColor, toColor) => {
    if (!useGradient) return {}
    return {
      background: `linear-gradient(to bottom, ${fromColor}, ${toColor})`,
    }
  }

  // Определяем победителя матча
  const getMatchWinner = () => {
    if (!match || !match.isCompleted || !match.score || !match.score.sets) return null

    const setsWonA = match.score.sets.filter((set) => set.teamA > set.teamB).length
    const setsWonB = match.score.sets.filter((set) => set.teamB > set.teamA).length

    if (setsWonA > setsWonB) return "teamA"
    if (setsWonB > setsWonA) return "teamB"
    return null // ничья (не должно происходить в теннисе/паделе)
  }

  // Добавить в начало функции render (перед return)
  if (showDebug) {
    console.log("Current language:", language)
    console.log("Available translations:", Object.keys(translations))
    console.log("Checking translations for current language:")
    const translationsToCheck = [
      "common.back",
      "common.loading",
      "common.error",
      "common.exitFullscreen",
      "common.enterFullscreen",
      "scoreboard.tennis",
      "scoreboard.padel",
      "scoreboard.singles",
      "scoreboard.doubles",
      "scoreboard.court",
      "scoreboard.invalidCourt",
      "scoreboard.noActiveMatches",
      "scoreboard.loadError",
      "scoreboard.matchCompleted",
    ]

    translationsToCheck.forEach((key) => {
      const parts = key.split(".")
      let result = translations[language]
      let exists = true

      for (const part of parts) {
        if (!result || !result[part]) {
          exists = false
          break
        }
        result = result[part]
      }

      console.log(`Translation '${key}': ${exists ? "EXISTS" : "MISSING"}`)
    })
  }

  if (loading || loadingSettings) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-black text-white">
        <div className="text-center">
          <div className="mb-4 text-xl">
            {loading ? getTranslation("common.loading", "Loading...", language) : "Загрузка настроек..."}
          </div>
          <div className="w-16 h-16 border-4 border-gray-300 border-t-white rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-black">
        <div className="text-red-500 text-2xl p-8 text-center">{error}</div>
      </div>
    )
  }

  if (!match || !settingsLoaded) return null

  const tiebreakScores = getTiebreakScores()

  return (
    <>
      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
          overflow: hidden;
          background-color: black;
          font-family: Arial, sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        .fullscreen-container {
          display: grid;
          grid-template-rows: auto 1fr auto;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          position: relative;
          margin: 0;
          padding: 0;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5vh 1vw;
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          border-bottom: 1px solid #333;
          max-height: 5vh;
        }

        .fullscreen-button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          margin-left: 10px;
          transition: background 0.2s;
        }

        .fullscreen-button:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .scoreboard {
          display: grid;
          grid-template-rows: 1fr 1fr;
          height: 100%;
          width: 100%;
          gap: 2px;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        .team-row {
          display: grid;
          grid-template-columns: ${showNames ? "4.6fr " : ""}${showCountry ? "1fr " : ""}${showServer ? "0.5fr " : ""}${showSets ? `repeat(${(match.score.sets?.length || 0) + (match.score.currentSet ? 1 : 0)}, 0.8fr) ` : ""}${showPoints ? "1.4fr 0fr" : ""};
          height: 100%;
          width: 100%;
          gap: 0;
          max-width: 100vw;
          margin: 0;
          padding: 0;
        }

        .cell {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
          padding: 0;
        }

        .player-name-container {
          width: 100%;
          height: ${match.format === "doubles" ? "50%" : "100%"};
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        .player-divider {
          height: 1px;
          background-color: rgba(192, 192, 192, 0.5);
          width: 100%;
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          margin: 0;
        }

        .names-cell {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          padding: 3px;
          height: 100%;
          position: relative;
        }

        .player-name {
          white-space: normal;
          overflow: hidden;
          word-wrap: break-word;
          font-weight: bold;
          width: 100%;
          text-align: left;
          font-size: clamp(1.9vh, 9.5vh, 19vh); /* Увеличено в 1.9 раза */
          line-height: 1.1;
          display: -webkit-box;
          -webkit-line-clamp: ${match.format === "doubles" ? "2" : "3"}; /* Ограничение количества строк */
          -webkit-box-orient: vertical;
        }

        .server-cell {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          align-items: center;
          padding: 0;
          margin: 0;
        }

        .server-indicator {
          font-size: 15vh; /* Увеличено в 3 раза */
          line-height: 1;
          padding: 0;
          margin: 0;
        }

        .set-cell {
          font-weight: bold;
          font-size: 10vh; /* Увеличено в 2 раза */
          padding: 0 0.5vw; /* Уменьшенные отступы по бокам */
        }

        .points-cell {
          font-weight: bold;
          font-size: 19.2vh;
          width: 100%;
          text-align: center;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0;
          margin: 0;
          flex-grow: 1;
          box-sizing: border-box;
          min-width: 0;
        }

        .points-cell span {
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 0.9em;
        }

        .points-cell .trophy-icon {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100%;
        }

        .important-event {
          color: ${indicatorTextColor};
          font-weight: bold;
          text-align: center;
          padding: 3px;
          font-size: 4vh;
          height: 6vh;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.5s ease; /* Добавлен плавный переход */
          z-index: 10;
          ${indicatorGradient
          ? `background: linear-gradient(to bottom, ${indicatorGradientFrom}, ${indicatorGradientTo});`
          : `background-color: ${indicatorBgColor};`
        }
        }

        /* Responsive font sizes */
        @media (max-width: 768px) {
          .server-indicator {
            font-size: 12vh; /* Увеличено в 3 раза */
          }
          .set-cell {
            font-size: 8vh; /* Увеличено в 2 раза */
          }
          .points-cell {
            font-size: 14.4vh; /* Уменьшено на 40% от 24vh */
          }
          .important-event {
            font-size: 3vh;
          }
        }

        @media (min-width: 769px) and (max-width: 1200px) {
          .server-indicator {
            font-size: 15vh; /* Увеличено в 3 раза */
          }
          .set-cell {
            font-size: 10vh; /* Увеличено в 2 раза */
          }
          .points-cell {
            font-size: 16.8vh; /* Уменьшено на 40% от 28vh */
          }
          .important-event {
            font-size: 3.5vh;
          }
        }

        @media (min-width: 1201px) {
          .server-indicator {
            font-size: 18vh; /* Увеличено в 3 раза */
          }
          .set-cell {
            font-size: 12vh; /* Увеличено в 2 раза */
          }
          .points-cell {
            font-size: 21.6vh; /* Уменьшено на 40% от 36vh */
          }
          .important-event {
            font-size: 4vh;
          }
        }

        sup {
          font-size: 0.45em;
          position: relative;
          top: -0.49em; /* Moved higher by 20% of font size */
          margin-left: 0.6em; /* Moved further right */
        }
      `}</style>

      <div className="fullscreen-container" ref={containerRef}>
        <div className="header">
          <div className="flex items-center">
            <Link href="/" className="mr-4 text-white hover:text-gray-300 transition-colors flex items-center">
              <ArrowLeft size={24} />
            </Link>
            <div className="text-2xl font-bold">
              {match.type === "tennis"
                ? getTranslation("scoreboard.tennis", "Tennis", language)
                : getTranslation("scoreboard.padel", "Padel", language)}{" "}
              -{" "}
              {match.format === "singles"
                ? getTranslation("scoreboard.singles", "Singles", language)
                : getTranslation("scoreboard.doubles", "Doubles", language)}
              {isCompletedMatch && (
                <span className="ml-2 inline-flex items-center text-amber-400">
                  <Clock size={20} />
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <div className="text-xl">
              {getTranslation("scoreboard.court", "Court", language)} {courtNumber} - {new Date().toLocaleTimeString()}
            </div>
            <button
              className="fullscreen-button"
              onClick={toggleFullscreen}
              title={
                isFullscreen
                  ? getTranslation("common.exitFullscreen", "Exit fullscreen", language)
                  : getTranslation("common.enterFullscreen", "Enter fullscreen", language)
              }
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        <div className="scoreboard">
          {/* Команда A */}
          <div className="team-row">
            {showNames && (
              <div
                className="cell names-cell"
                style={{
                  color: theme === "transparent" ? textColor : "white",
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : namesGradient
                      ? getGradientStyle(true, namesGradientFrom, namesGradientTo)
                      : { background: namesBgColor }),
                }}
              >
                {match.teamA.players.map((player, idx) => (
                  <div key={idx} className="player-name-container">
                    <div className="player-name pl-6" title={player.name}>
                      {player.name}
                    </div>
                  </div>
                ))}
                {match.format === "doubles" && <div className="player-divider"></div>}
              </div>
            )}

            {showCountry && (
              <div
                className="cell country-cell"
                style={{
                  color: theme === "transparent" ? textColor : "white",
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : countryGradient
                      ? getGradientStyle(true, countryGradientFrom, countryGradientTo)
                      : { background: countryBgColor }),
                }}
              >
                {match.teamA.players.map((player, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${100 / match.teamA.players.length}%`, display: "flex", alignItems: "center" }}
                  >
                    {getPlayerCountryDisplay("teamA", idx, match)}
                  </div>
                ))}
              </div>
            )}

            {showServer && (
              <div
                className="cell server-cell"
                style={{
                  color: theme === "transparent" ? accentColor : accentColor,
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : serveGradient
                      ? getGradientStyle(true, serveGradientFrom, serveGradientTo)
                      : { background: serveBgColor }),
                }}
              >
                {match.teamA.players.map((player, idx) => (
                  <div
                    key={idx}
                    className="server-indicator"
                    style={{ visibility: isServing("teamA", idx) ? "visible" : "hidden" }}
                  >
                    •
                  </div>
                ))}
              </div>
            )}

            {showSets &&
              match.score.sets &&
              match.score.sets.map((set, idx) => (
                <div
                  key={idx}
                  className="cell set-cell"
                  style={{
                    ...(theme === "transparent"
                      ? { background: "transparent" }
                      : setsGradient
                        ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
                        : { background: setsBgColor }),
                    color: theme === "transparent" ? textColor : setsTextColor,
                  }}
                >
                  {tiebreakScores[idx] ? formatSetScore(set.teamA, tiebreakScores[idx].teamA) : set.teamA}
                </div>
              ))}

            {showSets && match.score.currentSet && !match.isCompleted && (
              <div
                className="cell set-cell"
                style={{
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : setsGradient
                      ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
                      : { background: setsBgColor }),
                  color: theme === "transparent" ? textColor : setsTextColor,
                }}
              >
                {match.score.currentSet.teamA}
              </div>
            )}

            {showPoints && (
              <>
                <div
                  className="cell points-cell"
                  style={{
                    color: theme === "transparent" ? textColor : "white",
                    ...(theme === "transparent"
                      ? { background: "transparent" }
                      : pointsGradient
                        ? getGradientStyle(true, pointsGradientFrom, pointsGradientTo)
                        : { background: pointsBgColor }),
                  }}
                >
                  {!match.isCompleted ? (
                    <span>{getCurrentGameScore("teamA")}</span>
                  ) : getMatchWinner() === "teamA" ? (
                    <div className="trophy-icon">
                      <Trophy size={48} />
                    </div>
                  ) : null}
                </div>
                <div style={{ width: 0, padding: 0, margin: 0 }}></div>
              </>
            )}
          </div>

          {/* Команда B */}
          <div className="team-row">
            {showNames && (
              <div
                className="cell names-cell"
                style={{
                  color: theme === "transparent" ? textColor : "white",
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : namesGradient
                      ? getGradientStyle(true, namesGradientFrom, namesGradientTo)
                      : { background: namesBgColor }),
                }}
              >
                {match.teamB.players.map((player, idx) => (
                  <div key={idx} className="player-name-container">
                    <div className="player-name pl-6" title={player.name}>
                      {player.name}
                    </div>
                  </div>
                ))}
                {match.format === "doubles" && <div className="player-divider"></div>}
              </div>
            )}

            {showCountry && (
              <div
                className="cell country-cell"
                style={{
                  color: theme === "transparent" ? textColor : "white",
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : countryGradient
                      ? getGradientStyle(true, countryGradientFrom, countryGradientTo)
                      : { background: countryBgColor }),
                }}
              >
                {match.teamB.players.map((player, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${100 / match.teamB.players.length}%`, display: "flex", alignItems: "center" }}
                  >
                    {getPlayerCountryDisplay("teamB", idx, match)}
                  </div>
                ))}
              </div>
            )}

            {showServer && (
              <div
                className="cell server-cell"
                style={{
                  color: theme === "transparent" ? accentColor : accentColor,
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : serveGradient
                      ? getGradientStyle(true, serveGradientFrom, serveGradientTo)
                      : { background: serveBgColor }),
                }}
              >
                {match.teamB.players.map((player, idx) => (
                  <div
                    key={idx}
                    className="server-indicator"
                    style={{ visibility: isServing("teamB", idx) ? "visible" : "hidden" }}
                  >
                    •
                  </div>
                ))}
              </div>
            )}

            {showSets &&
              match.score.sets &&
              match.score.sets.map((set, idx) => (
                <div
                  key={idx}
                  className="cell set-cell"
                  style={{
                    ...(theme === "transparent"
                      ? { background: "transparent" }
                      : setsGradient
                        ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
                        : { background: setsBgColor }),
                    color: theme === "transparent" ? textColor : setsTextColor,
                  }}
                >
                  {tiebreakScores[idx] ? formatSetScore(set.teamB, tiebreakScores[idx].teamB) : set.teamB}
                </div>
              ))}

            {showSets && match.score.currentSet && !match.isCompleted && (
              <div
                className="cell set-cell"
                style={{
                  ...(theme === "transparent"
                    ? { background: "transparent" }
                    : setsGradient
                      ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
                      : { background: setsBgColor }),
                  color: theme === "transparent" ? textColor : setsTextColor,
                }}
              >
                {match.score.currentSet.teamB}
              </div>
            )}

            {showPoints && (
              <>
                <div
                  className="cell points-cell"
                  style={{
                    color: theme === "transparent" ? textColor : "white",
                    ...(theme === "transparent"
                      ? { background: "transparent" }
                      : pointsGradient
                        ? getGradientStyle(true, pointsGradientFrom, pointsGradientTo)
                        : { background: pointsBgColor }),
                  }}
                >
                  {!match.isCompleted ? (
                    <span>{getCurrentGameScore("teamB")}</span>
                  ) : getMatchWinner() === "teamB" ? (
                    <div className="trophy-icon">
                      <Trophy size={48} />
                    </div>
                  ) : null}
                </div>
                <div style={{ width: 0, padding: 0, margin: 0 }}></div>
              </>
            )}
          </div>
        </div>

        {/* Строка важных событий - всегда видима, но прозрачна когда нет событий */}
        <div
          className="important-event"
          style={{ opacity: getImportantEvent() ? 1 : 0, display: getImportantEvent() ? "flex" : "flex" }}
        >
          {getImportantEvent() || ""}
        </div>
      </div>
    </>
  )
}

// Добавить эту функцию после объявления компонента FullscreenScoreboard
// (No changes needed here for F key logic)
const getTranslation = (path: string, fallback: string, lang: Language): string => {
  const parts = path.split(".")
  let result = translations[lang]

  for (const part of parts) {
    if (!result || !result[part]) {
      console.warn(`Missing translation: ${path} for language ${lang}`)
      return fallback
    }
    result = result[part]
  }

  return result as string
}
