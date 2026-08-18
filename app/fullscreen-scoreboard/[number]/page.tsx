"use client"

import React, { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { getMatchByCourtNumber } from "@/lib/court-utils"
import { isMatchOnCourt } from "@/lib/court-match-guard"
import { logEvent } from "@/lib/error-logger"
import { subscribeToMatchUpdates } from "@/lib/match-storage"
import { getMatchSyncState } from "@/lib/match-sync"
import { applyScoreIncrement } from "@/lib/scoring-logic"
import { sendMatchCommand } from "@/lib/match-command-client"
import { Maximize2, Minimize2, ArrowLeft, Clock } from "lucide-react"
import { translations, type Language } from "@/lib/translations"
import { getDefaultVmixSettings } from "@/lib/vmix-settings-storage"
import { parseScoreboardSettings, sanitizeScoreboardSettings } from "@/lib/scoreboard-settings"
import { VmixScoreboard } from "@/components/vmix-scoreboard"
import { CourtMediaLayer } from "@/components/media-overlay"
import type { ScoreboardSettings } from "@/lib/scoreboard-settings"

type FullscreenScoreboardParams = {
  params: Promise<{
    number: string
  }>
  /**
   * Режим по ID матча (Шаг 2, §247): вечная ссылка /c/{code} для нечисловых
   * кортов — матч резолвится серверно и передаётся напрямую, без номера корта.
   */
  matchId?: string
}

export default function FullscreenScoreboard({ params, matchId }: FullscreenScoreboardParams) {
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
  // guard against double-tap double-counting a point (debounce window)
  const scoringRef = useRef(false);
  const courtNumber = Number.parseInt(resolvedParams.number);
  // §247: в режиме matchId гард «матч на этом корте» заменяется на совпадение ID.
  const isOnThisCourt = (m: any) => (matchId ? m?.id === matchId : isMatchOnCourt(m, courtNumber));
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Состояние для настроек отображения
  const [theme, setTheme] = useState("default");
  const [showNames, setShowNames] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [showSets, setShowSets] = useState(true);
  const [showServer, setShowServer] = useState(true);
  const [showCountry, setShowCountry] = useState(false);
  const [countryAs, setCountryAs] = useState<"flag" | "code" | "name">("flag");
  const [hideSameCountry, setHideSameCountry] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [hideSameAvatar, setHideSameAvatar] = useState(true);
  const [playerNameFormat, setPlayerNameFormat] = useState<"full" | "first" | "last">("full");
  const [nameLines, setNameLines] = useState<"single" | "two">("single");
  const [nameLineOrder, setNameLineOrder] = useState<"first-top" | "last-top">("first-top");
  const [nameCase, setNameCase] = useState<"as-is" | "upper" | "lower" | "capitalize">("as-is");
  const [nameSizeLinked, setNameSizeLinked] = useState(true);
  const [nameSizeFirst, setNameSizeFirst] = useState(1);
  const [nameSizeLast, setNameSizeLast] = useState(1);
  const [nameWeightLinked, setNameWeightLinked] = useState(true);
  const [nameWeightFirst, setNameWeightFirst] = useState("700");
  const [nameWeightLast, setNameWeightLast] = useState("700");
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
  // Break-point indicator — shown on every scoreboard (Т1). Default on.
  const showBreakPoint = searchParams.get("showBreakPoint") !== "false";

  // Handler to increment score for Team A or B
  const handleIncrementScore = async (team: 'teamA' | 'teamB') => {
    if (!match || match.isCompleted || !isOnThisCourt(match)) return;
    // Защита от двойного тапа — иначе одно очко засчитывается дважды.
    if (scoringRef.current) return;
    scoringRef.current = true;
    setTimeout(() => { scoringRef.current = false }, 150);
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
        // Шаг 3 (§99): снапшот — локально; на сервер уходит команда point
        // (журнал/тайминги на сервере ставит applyPointWithExtras в роуте).
        await updateMatch(resultMatch, { localOnly: true });
        void sendMatchCommand(match.id, "point", { team }, { clientId: "fullscreen" }).then((res) => {
          if (res.status === "conflict" && res.match) {
            setMatch(res.match);
            void updateMatch(res.match);
          }
        });
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
    if (!matchHistory.length || !isOnThisCourt(match)) return;
    const prevMatch = matchHistory[matchHistory.length - 1];
    setMatch(prevMatch);
    setMatchHistory(history => history.slice(0, -1));
    try {
      if (typeof window !== "undefined") {
        const { updateMatch } = await import("@/lib/match-storage");
        // Шаг 3 (§99): undo — командой (журнальный replay на сервере);
        // при неудаче (нет журнала/оффлайн-очередь) — fallback-снапшот.
        const res = await sendMatchCommand(match.id, "undo-point", {}, { clientId: "fullscreen" });
        if (res.status === "conflict" && res.match) {
          setMatch(res.match);
          await updateMatch(res.match);
        } else if (res.status === "failed") {
          await updateMatch(prevMatch);
        } else {
          await updateMatch(prevMatch, { localOnly: true });
        }
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
    if (!match || match.isCompleted || !isOnThisCourt(match)) return;
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

        // Применяем настройки из базы данных (через общий санитайзер)
        applySettings(sanitizeScoreboardSettings(defaultSettings.settings))
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
        const settings = sanitizeScoreboardSettings(JSON.parse(savedSettings))
        applySettings(settings)
        logEvent("info", "Настройки vMix загружены из localStorage", "fullscreen-scoreboard")
      }
    } catch (error) {
      logEvent("error", "Ошибка при загрузке настроек vMix из localStorage", "fullscreen-scoreboard", error)
    }
  }

  // Функция для применения настроек
  const applySettings = (settings: any) => {
    if (!settings) return

    // Применяем основные настройки
    setTheme(settings.theme || "default")
    setShowNames(settings.showNames !== undefined ? settings.showNames : true)
    setShowPoints(settings.showPoints !== undefined ? settings.showPoints : true)
    setShowSets(settings.showSets !== undefined ? settings.showSets : true)
    setShowServer(settings.showServer !== undefined ? settings.showServer : true)
    setShowCountry(settings.showCountry !== undefined ? settings.showCountry : false)
    // Новые настройки отображения (флаги/аватары/имена) — те же поля, что
    // сериализует редактор vMix в localStorage/Supabase и в URL.
    if (settings.countryAs === "code" || settings.countryAs === "name" || settings.countryAs === "flag") {
      setCountryAs(settings.countryAs)
    }
    if (settings.hideSameCountry !== undefined) setHideSameCountry(settings.hideSameCountry)
    if (settings.showAvatar !== undefined) setShowAvatar(settings.showAvatar)
    if (settings.hideSameAvatar !== undefined) setHideSameAvatar(settings.hideSameAvatar)
    if (settings.playerNameFormat === "first" || settings.playerNameFormat === "last" || settings.playerNameFormat === "full") {
      setPlayerNameFormat(settings.playerNameFormat)
    }
    if (settings.nameLines === "single" || settings.nameLines === "two") setNameLines(settings.nameLines)
    if (settings.nameLineOrder === "first-top" || settings.nameLineOrder === "last-top") setNameLineOrder(settings.nameLineOrder)
    if (settings.nameCase === "as-is" || settings.nameCase === "upper" || settings.nameCase === "lower" || settings.nameCase === "capitalize") {
      setNameCase(settings.nameCase)
    }
    if (typeof settings.nameSizeFirst === "number" && settings.nameSizeFirst > 0) setNameSizeFirst(settings.nameSizeFirst)
    if (typeof settings.nameSizeLast === "number" && settings.nameSizeLast > 0) setNameSizeLast(settings.nameSizeLast)
    if (settings.nameSizeLinked !== undefined) setNameSizeLinked(settings.nameSizeLinked)
    if (typeof settings.nameWeightFirst === "string" && settings.nameWeightFirst) setNameWeightFirst(settings.nameWeightFirst)
    if (typeof settings.nameWeightLast === "string" && settings.nameWeightLast) setNameWeightLast(settings.nameWeightLast)
    if (settings.nameWeightLinked !== undefined) setNameWeightLinked(settings.nameWeightLinked)
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
    // Настройки из URL разбирает общий парсер (lib/scoreboard-settings) — тот же,
    // что у scorebug-страниц. Любой новый параметр поддерживается здесь автоматически.
    const parsed = parseScoreboardSettings(searchParams)
    const hasSettingsInUrl =
      searchParams.has("theme") ||
      searchParams.has("showNames") ||
      searchParams.has("showPoints") ||
      searchParams.has("showSets") ||
      searchParams.has("showServer") ||
      searchParams.has("showCountry") ||
      searchParams.has("textColor") ||
      searchParams.has("accentColor") ||
      searchParams.has("countryAs") ||
      searchParams.has("hideSameCountry") ||
      searchParams.has("showAvatar") ||
      searchParams.has("hideSameAvatar") ||
      searchParams.has("nameAs") ||
      searchParams.has("nameLines") ||
      searchParams.has("nameLineOrder") ||
      searchParams.has("nameCase") ||
      searchParams.has("nameSizeFirst") ||
      searchParams.has("nameWeightFirst")

    if (hasSettingsInUrl) {
      // Историческая особенность fullscreen: колонка стран по умолчанию ВЫКЛЮЧЕНА
      // (у scorebug включена), поэтому переопределяем дефолт парсера.
      applySettings({ ...parsed, showCountry: searchParams.get("showCountry") === "true" })

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
      if ((containerRef.current as any)?.requestFullscreen) {
        (containerRef.current as any)
          .requestFullscreen()
          .then(() => {
            setIsFullscreen(true)
          })
          .catch((err: any) => {
            console.error(`${(translations[language] as any).common.error}: ${err.message}`)
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
          .catch((err: any) => {
            console.error(`${(translations[language] as any).common.error}: ${err.message}`)
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
          (containerRef.current as any).requestFullscreen().catch((err: any) => {
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
      // §247: режим matchId — матч уже резолвлен серверно по вечной ссылке.
      let matchData: any = null
      if (matchId) {
        const { getMatch } = await import("@/lib/match-storage")
        matchData = await getMatch(matchId)
      } else {
        if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 10) {
          setError(
            (translations[language] as any).common.error +
            ": " +
            ((translations[language] as any).scoreboard.invalidCourt || "Invalid court number"),
          )
          setLoading(false)
          logEvent("error", "Fullscreen Scoreboard: invalid court number", "fullscreen-scoreboard")
          return
        }

        logEvent("info", `Fullscreen Scoreboard: начало загрузки матча на корте ${courtNumber}`, "fullscreen-scoreboard")
        matchData = await getMatchByCourtNumber(courtNumber)
      }

      if (matchData) {
        // Проверяем, изменился ли ID матча
        if (lastMatchId !== matchData.id) {
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
          (translations[language] as any).scoreboard.noActiveMatches?.replace("{number}", matchId ? "" : courtNumber) ||
          `No active matches on court ${courtNumber}`,
        )
        logEvent("warn", `Fullscreen Scoreboard: no active matches on court ${courtNumber}`, "fullscreen-scoreboard")
        return null
      }
    } catch (err: any) {
      setError(
        (translations[language] as any).common.error +
        ": " +
        ((translations[language] as any).scoreboard.loadError || "Error loading match"),
      )
      logEvent("error", "Ошибка загрузки матча для Fullscreen Scoreboard", "fullscreen-scoreboard", err)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Загрузка матча и настройка подписки на обновления
  useEffect(() => {
    let unsubscribe: any = null
    let checkInterval: NodeJS.Timeout | null = null

    const setupSubscription = async () => {
      // Загружаем матч
      const matchData = await loadMatch()

      if (!matchData) return

      // Настраиваем подписку на обновления матча.
      // ВАЖНО: колбэк должен быть СИНХРОННЫМ. На медленном интернете `await
      // import(...)` отдаёт управление event loop'у; за это время drain успевает
      // завершиться, `pendingCount` падает до 0, и щит против эха ломается —
      // устаревший снапшот с сервера затирает локальный оптимистичный счёт
      // ("откат" счёта при slow 3G). Импорт `getMatchSyncState` поднят на верх.
      unsubscribe = subscribeToMatchUpdates(matchData.id, (updatedMatch: any) => {
        if (!updatedMatch) {
          // Если матч не найден, пробуем загрузить новый матч
          loadMatch()
          return
        }

        if (!isOnThisCourt(updatedMatch)) {
          setMatch(null)
          setIsCompletedMatch(false)
          setError(
            (translations[language] as any).scoreboard.noActiveMatches?.replace("{number}", matchId ? "" : courtNumber) ||
            `No active matches on court ${courtNumber}`,
          )
          return
        }

        let hasPendingOperations = false
        try {
          const syncState = getMatchSyncState(matchData.id)
          hasPendingOperations = syncState && syncState.pendingCount > 0
        } catch (e) {
          console.error("Ошибка при получении состояния синхронизации:", e)
        }

        if (hasPendingOperations) return

        setMatch((prev: any) => {
          if (
            prev &&
            typeof prev.revision === "number" &&
            typeof updatedMatch.revision === "number" &&
            updatedMatch.revision <= prev.revision
          ) {
            return prev
          }
          return updatedMatch
        })
        setError("")

        // Preserve local completed state if we've already finished the match
        if (isCompletedMatch && updatedMatch.isCompleted !== true) {
          // Prevent rollback of completion status
          setIsCompletedMatch(true)
          // Optionally, merge isCompleted into match object for UI
          setMatch((prev: any) => (prev ? { ...prev, isCompleted: true } : updatedMatch))
          logEvent(
            "warn",
            "Realtime update tried to reset isCompleted to false, preserving local completed state",
            "fullscreen-scoreboard",
            { matchId: updatedMatch.id },
          )
        } else {
          setIsCompletedMatch(updatedMatch.isCompleted === true)
        }

        logEvent("debug", "Fullscreen Scoreboard: получено обновление матча", "fullscreen-scoreboard", {
          matchId: updatedMatch.id,
          scoreA: updatedMatch.score.teamA,
          scoreB: updatedMatch.score.teamB,
          isCompleted: updatedMatch.isCompleted,
        })
      })
    }

    // Запускаем первоначальную загрузку и подписку
    setupSubscription()

    // Настраиваем перидическую проверку наличия нового матча
    checkInterval = setInterval(async () => {
      // §247: в режиме matchId (вечная ссылка /c/{code} нечислового корта)
      // автопереключение на «следующий матч корта» не работает — страницу
      // обновит серверный резолв; здесь только числовой режим.
      if (isCompletedMatch && !matchId) {
        const newMatchData = await getMatchByCourtNumber(courtNumber)

        // Если найден новый матч с другим ID
        if (newMatchData && newMatchData.id !== lastMatchId) {
          // Отписываемся от старого матча
          if (unsubscribe) {
            unsubscribe()
          }

          // Обновляем данные и подписываемся на новый матч
          setMatch(newMatchData)
          setLastMatchId(newMatchData.id)
          setIsCompletedMatch(newMatchData.isCompleted === true)
          setError("")

          // Настраиваем новую подписку — синхронный колбэк (см. пояснение выше).
          unsubscribe = subscribeToMatchUpdates(newMatchData.id, (updatedMatch: any) => {
            if (!updatedMatch) return

            if (!isOnThisCourt(updatedMatch)) {
              setMatch(null)
              setIsCompletedMatch(false)
              setError(
                (translations[language] as any).scoreboard.noActiveMatches?.replace("{number}", matchId ? "" : courtNumber) ||
                `No active matches on court ${courtNumber}`,
              )
              return
            }

            let hasPendingOperations = false
            try {
              const syncState = getMatchSyncState(newMatchData.id)
              hasPendingOperations = syncState && syncState.pendingCount > 0
            } catch (e) {
              console.error("Ошибка при получении состояния синхронизации:", e)
            }

            if (hasPendingOperations) return

            setMatch((prev: any) => {
              if (
                prev &&
                typeof prev.revision === "number" &&
                typeof updatedMatch.revision === "number" &&
                updatedMatch.revision <= prev.revision
              ) {
                return prev
              }
              return updatedMatch
            })
            setIsCompletedMatch(updatedMatch.isCompleted === true)
            setError("")
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

  // All states (loading / error / no match / live match) render through the
  // same container so CourtMediaLayer stays mounted across transitions — ads
  // must keep playing when a match ends, appears or errors out.
  let content: React.ReactNode
  if (loading || loadingSettings) {
    content = (
      <div className="flex items-center justify-center h-full w-full bg-black text-white">
        <div className="text-center">
          <div className="mb-4 text-xl">
            {loading ? getTranslation("common.loading", "Loading...", language) : "Загрузка настроек..."}
          </div>
          <div className="w-16 h-16 border-4 border-gray-300 border-t-white rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  } else if (error) {
    content = (
      <div className="flex items-center justify-center h-full w-full bg-black">
        <div className="text-red-500 text-2xl p-8 text-center">{error}</div>
      </div>
    )
  } else if (!match || !settingsLoaded) {
    content = <div className="h-full w-full bg-black" />
  } else {
    // Сборка единой модели настроек для <VmixScoreboard>. Поля, не влияющие на
    // полноэкранную раскладку (fontSize/bgOpacity/playerNamesFontSize/outputFormat),
    // заполнены безопасными значениями по умолчанию.
    const settings: ScoreboardSettings = {
      theme,
      showNames,
      showPoints,
      showSets,
      showServer,
      showCountry,
      countryAs,
      hideSameCountry,
      showAvatar,
      hideSameAvatar,
      playerNameFormat,
      nameLines,
      nameLineOrder,
      nameCase,
      nameSizeLinked,
      nameSizeFirst,
      nameSizeLast,
      nameWeightLinked,
      nameWeightFirst,
      nameWeightLast,
      showBreakPoint,
      fontSize: "normal",
      bgOpacity: 0.5,
      textColor,
      accentColor,
      playerNamesFontSize: 1.2,
      outputFormat: "html",
      showDebug,
      namesBgColor,
      countryBgColor,
      pointsBgColor,
      setsBgColor,
      setsTextColor,
      indicatorBgColor,
      indicatorTextColor,
      indicatorGradient,
      indicatorGradientFrom,
      indicatorGradientTo,
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
      serveBgColor,
      serveGradient,
      serveGradientFrom,
      serveGradientTo,
    }

    content = (
      <>
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

        <VmixScoreboard
          match={match}
          settings={settings}
          variant="fullscreen"
          matchOverLabel={getTranslation("scoreboard.matchCompleted", "MATCH IS OVER", language)}
        />
      </>
    )
  }

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
      `}</style>

      <div className="fullscreen-container" ref={containerRef}>
        {content}
        <CourtMediaLayer courtNumber={courtNumber} match={match} />
      </div>
    </>
  )
}

// Добавить эту функцию после объявления компонента FullscreenScoreboard
// (No changes needed here for F key logic)
const getTranslation = (path: string, fallback: string, lang: Language): string => {
  const parts = path.split(".")
  let result: any = translations[lang]

  for (const part of parts) {
    if (!result || !result[part]) {
      console.warn(`Missing translation: ${path} for language ${lang}`)
      return fallback
    }
    result = result[part]
  }

  return result as string
}
