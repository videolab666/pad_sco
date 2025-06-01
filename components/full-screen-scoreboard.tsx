"use client"

import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { getTennisPointName } from "@/lib/tennis-utils"
import { Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

// Обновим компонент FullScreenScoreboard, чтобы учитывать настройку useCustomSizes

export function FullScreenScoreboard({
  match,
  isFullScreen,
  onExitFullScreen,
  settings = {
    backgroundColor: "#000000",
    textColor: "#ffffff",
    teamAColor: "from-blue-600 to-blue-800",
    teamAColorFrom: "#2563eb",
    teamAColorTo: "#1e40af",
    teamBColor: "from-red-600 to-red-800",
    teamBColorFrom: "#dc2626",
    teamBColorTo: "#991b1b",
    showCourtSides: true,
    showCurrentServer: true,
    showServerIndicator: true,
    showSetsScore: true,
    fontSize: 100,
    playerNamesFontSize: 100,
    gameScoreFontSize: 100,
    setsScoreFontSize: 100,
    playerCellWidth: 60,
    gameScoreTextColor: "#ffcc00",
    gameCellBgColor: "#333333",
    tiebreakCellBgColor: "#663300",
    setsScoreTextColor: "#ffffff",
    useCustomSizes: true,
    infoBlockFontSize: 100,
  },
}) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const wrapperRef = useRef(null)
  const { t } = useLanguage()

  // Деструктурируем настройки
  const {
    backgroundColor,
    textColor,
    teamAColor,
    teamBColor,
    teamAColorFrom,
    teamAColorTo,
    teamBColorFrom,
    teamBColorTo,
    showCourtSides,
    showCurrentServer,
    showServerIndicator = true, // Явно устанавливаем значение по умолчанию
    showSetsScore,
    fontSize,
    playerNamesFontSize,
    gameScoreFontSize,
    setsScoreFontSize,
    playerCellWidth = 60,
    gameScoreTextColor = "#ffcc00",
    gameCellBgColor = "#333333",
    tiebreakCellBgColor = "#663300",
    setsScoreTextColor = "#ffffff",
    useCustomSizes = true,
    infoBlockFontSize = 100,
  } = settings

  // Обновление времени каждую минуту
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // Добавляем логику масштабирования для полноэкранного режима
  useEffect(() => {
    if (!isFullScreen) return

    const handleResize = () => {
      if (wrapperRef.current) {
        // Сбрасываем стили, чтобы получить естественные азмеры
        wrapperRef.current.style.transform = ""
        wrapperRef.current.style.width = "100%"
        wrapperRef.current.style.height = "100%"
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isFullScreen])

  if (!match) return null

  const { teamA, teamB } = match
  const currentSet = match.score.currentSet
  const isServing = (team, playerIndex) => {
    return (
      showServerIndicator !== false &&
      match.currentServer.team === team &&
      match.currentServer.playerIndex === playerIndex
    )
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
  if (!match.isCompleted) {
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

  // Форматируем время
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Создаем градиентные стили для команд
  const getTeamAGradient = () => {
    if (teamAColorFrom && teamAColorTo) {
      return `linear-gradient(to right, ${teamAColorFrom}, ${teamAColorTo})`
    }
    return `bg-gradient-to-r ${teamAColor}`
  }

  const getTeamBGradient = () => {
    if (teamBColorFrom && teamBColorTo) {
      return `linear-gradient(to right, ${teamBColorFrom}, ${teamBColorTo})`
    }
    return `bg-gradient-to-r ${teamBColor}`
  }

  // Функция для определения, кто выиграл сет
  const getSetWinner = (set) => {
    if (set.isFuture || set.isCurrent) return null

    const teamAScore = Number.parseInt(set.teamA)
    const teamBScore = Number.parseInt(set.teamB)

    if (teamAScore > teamBScore) return "teamA"
    if (teamBScore > teamAScore) return "teamB"
    return null
  }

  // Динамические стили на основе настроек
  const dynamicStyles = {
    container: {
      backgroundColor: backgroundColor,
      color: textColor,
      fontSize: useCustomSizes ? `${fontSize}%` : "inherit",
    },
    header: {
      borderColor: textColor === "#ffffff" ? "#333333" : "#dddddd",
    },
    tableHeader: {
      color: textColor === "#ffffff" ? "#aaaaaa" : "#666666",
    },
    currentGameCell: {
      backgroundColor: currentSet.isTiebreak ? tiebreakCellBgColor : gameCellBgColor,
      color: gameScoreTextColor,
    },
    infoBlock: {
      backgroundColor: textColor === "#ffffff" ? "#333333" : "#eeeeee",
      color: textColor === "#ffffff" ? "#ffffff" : "#000000",
    },
    infoBlockTitle: {
      color: textColor === "#ffffff" ? "#aaaaaa" : "#666666",
    },
    teamABackground: {
      background: getTeamAGradient(),
    },
    teamBBackground: {
      background: getTeamBGradient(),
    },
    teamAWinnerBackground: {
      backgroundColor: teamAColorFrom || "#2563eb",
      opacity: 0.25,
    },
    teamBWinnerBackground: {
      backgroundColor: teamBColorFrom || "#dc2626",
      opacity: 0.25,
    },
    currentSetBackground: {
      backgroundColor: gameCellBgColor || "#333333",
      opacity: 0.15,
    },
  }

  // Рассчитываем ширину столбцов
  const playerColWidth = `${playerCellWidth}%`
  const setsColWidth = "5%"
  const gameColWidth = `${100 - playerCellWidth - (showSetsScore ? allSets.length * 5 : 0)}%`

  // Функция для получения стилей размера шрифта в зависимости от настроек
  const getFontSizeStyle = (baseSize, customSize, defaultValue = 100) => {
    if (!useCustomSizes) return {}
    return { fontSize: `${(baseSize * (customSize || defaultValue)) / 100}rem` }
  }

  // Добавьте эту функцию, если ее нет
  const getTiebreakScore = (set) => {
    // Проверяем наличие данных тай-брейка
    if (set && set.tiebreak) {
      console.log("Найден счет тай-брейка:", set.tiebreak)
      return `(${set.tiebreak.teamA}-${set.tiebreak.teamB})`
    }

    // Если данных нет, возвращаем null
    console.log("Счет тай-брейка не найден для сета:", set)
    return null
  }

  // Разные рендеры для полноэкранного и обычного режимов
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black" style={dynamicStyles.container}>
        <div ref={wrapperRef} className="w-full h-full flex flex-col overflow-hidden">
          {/* Верхняя панель с информацией о матче - 8% высоты */}
          <div className="w-full px-4 h-[8vh] flex justify-between items-center border-b" style={dynamicStyles.header}>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={onExitFullScreen}
                className="mr-2 p-1 h-auto w-auto text-white opacity-70 hover:opacity-100"
              >
                <Minimize2 className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold">
                {match.type === "tennis" ? t("scoreboard.tennis") : t("scoreboard.padel")} -{" "}
                {match.format === "singles" ? t("scoreboard.singles") : t("scoreboard.doubles")}
              </h1>
            </div>
            <div className="flex items-center">
              <p className="text-base mr-4" style={dynamicStyles.tableHeader}>
                {match.isCompleted
                  ? t("scoreboard.matchCompleted")
                  : `${t("scoreboard.set")} ${currentSetIndex + 1} ${t("scoreboard.of")} ${totalSets}`}
              </p>
              <p className="text-2xl">{formatTime(currentTime)}</p>
              {match.isCompleted && (
                <Badge variant="outline" className="ml-2 bg-green-900 text-green-100 border-green-700">
                  {t("scoreboard.matchCompleted")}
                </Badge>
              )}
            </div>
          </div>

          {/* Основное табло счета - 92% высоты */}
          <div className="w-full px-4 h-[92vh] flex flex-col">
            <table className="w-full h-full border-collapse table-fixed">
              <colgroup>
                <col style={{ width: playerColWidth }} />
                {showSetsScore && allSets.map((_, index) => <col key={index} style={{ width: setsColWidth }} />)}
                <col style={{ width: gameColWidth }} />
              </colgroup>
              <thead>
                <tr className="text-left h-[5vh]" style={dynamicStyles.tableHeader}>
                  <th className="py-2">Игрок</th>
                  {showSetsScore &&
                    allSets.map((_, index) => (
                      <th key={index} className="py-2 text-center">
                        {index + 1}
                      </th>
                    ))}
                  <th className="py-1 text-center" style={dynamicStyles.currentGameCell}>
                    <span>{currentSet.isTiebreak ? t("scoreboard.tiebreak") : t("scoreboard.game")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="h-[calc(100%-5vh)]">
                {/* Команда A */}
                <tr className="border-b h-[35%]" style={{ borderColor: dynamicStyles.header.borderColor }}>
                  <td className="py-2">
                    <div
                      className="flex flex-col p-2 rounded h-full flex items-center justify-center"
                      style={dynamicStyles.teamABackground}
                    >
                      {teamA.players.map((player, idx) => (
                        <div key={idx} className="flex items-center w-full">
                          {isServing("teamA", idx) && showServerIndicator && (
                            <span
                              className="mr-2 text-yellow-400"
                              style={
                                useCustomSizes ? { fontSize: "2.5rem" } : { fontSize: "clamp(1.5rem, 5vw, 2.5rem)" }
                              }
                            >
                              •
                            </span>
                          )}
                          <span
                            className="font-bold text-white"
                            style={
                              useCustomSizes
                                ? { fontSize: `${playerNamesFontSize * 0.04}rem` }
                                : { fontSize: "clamp(2rem, 6vw, 4rem)" } // Увеличено в 2 раза
                            }
                          >
                            {player.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  {showSetsScore &&
                    allSets.map((set, index) => {
                      const setWinner = getSetWinner(set)
                      const bgStyle = set.isCurrent
                        ? dynamicStyles.currentSetBackground
                        : setWinner === "teamA"
                          ? dynamicStyles.teamAWinnerBackground
                          : setWinner === "teamB"
                            ? null
                            : null

                      return (
                        <td key={index} className="py-2 text-center">
                          <div className="h-full flex items-center justify-center relative">
                            {bgStyle && (
                              <div
                                className="absolute inset-0 rounded"
                                style={{
                                  ...bgStyle,
                                  height: "100%",
                                  maxHeight: "100%",
                                  overflow: "hidden",
                                }}
                              />
                            )}
                            <span
                              className="font-bold relative z-10"
                              style={{
                                ...(useCustomSizes
                                  ? { fontSize: `${setsScoreFontSize * 0.04}rem` }
                                  : { fontSize: "clamp(1rem, 3vw, 1.5rem)" }),
                                color: setsScoreTextColor,
                                textShadow: "0px 0px 2px rgba(0,0,0,0.7)",
                                fontWeight: 800,
                              }}
                            >
                              {set.teamA}
                              {getTiebreakScore(set) && <span className="text-xs ml-1">{getTiebreakScore(set)}</span>}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  <td className="py-0 text-center align-middle" style={dynamicStyles.currentGameCell}>
                    <div className="flex items-center justify-center h-full">
                      <span
                        className="font-bold whitespace-nowrap leading-none"
                        style={
                          useCustomSizes
                            ? { fontSize: `${gameScoreFontSize * 0.08}rem`, color: gameScoreTextColor, lineHeight: 0.9 }
                            : { fontSize: "clamp(3rem, 15vw, 9rem)", color: gameScoreTextColor, lineHeight: 0.9 } // Увеличено в 1.5 раза
                        }
                      >
                        {getCurrentGameScore("teamA")}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Команда B */}
                <tr className="h-[35%]">
                  <td className="py-2">
                    <div
                      className="flex flex-col p-2 rounded h-full flex items-center justify-center"
                      style={dynamicStyles.teamBBackground}
                    >
                      {teamB.players.map((player, idx) => (
                        <div key={idx} className="flex items-center w-full">
                          {isServing("teamB", idx) && showServerIndicator && (
                            <span
                              className="mr-2 text-yellow-400"
                              style={
                                useCustomSizes ? { fontSize: "2.5rem" } : { fontSize: "clamp(1.5rem, 5vw, 2.5rem)" }
                              }
                            >
                              •
                            </span>
                          )}
                          <span
                            className="font-bold text-white"
                            style={
                              useCustomSizes
                                ? { fontSize: `${playerNamesFontSize * 0.04}rem` }
                                : { fontSize: "clamp(2rem, 6vw, 4rem)" } // Увеличено в 2 раза
                            }
                          >
                            {player.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  {showSetsScore &&
                    allSets.map((set, index) => {
                      const setWinner = getSetWinner(set)
                      const bgStyle = set.isCurrent
                        ? dynamicStyles.currentSetBackground
                        : setWinner === "teamB"
                          ? dynamicStyles.teamBWinnerBackground
                          : setWinner === "teamA"
                            ? null
                            : null

                      return (
                        <td key={index} className="py-2 text-center">
                          <div className="h-full flex items-center justify-center relative">
                            {bgStyle && (
                              <div
                                className="absolute inset-0 rounded"
                                style={{
                                  ...bgStyle,
                                  height: "100%",
                                  maxHeight: "100%",
                                  overflow: "hidden",
                                }}
                              />
                            )}
                            <span
                              className="font-bold relative z-10"
                              style={{
                                ...(useCustomSizes
                                  ? { fontSize: `${setsScoreFontSize * 0.04}rem` }
                                  : { fontSize: "clamp(1rem, 3vw, 1.5rem)" }),
                                color: setsScoreTextColor,
                                textShadow: "0px 0px 2px rgba(0,0,0,0.7)",
                                fontWeight: 800,
                              }}
                            >
                              {set.teamB}
                              {getTiebreakScore(set) && <span className="text-xs ml-1">{getTiebreakScore(set)}</span>}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  <td className="py-0 text-center align-middle" style={dynamicStyles.currentGameCell}>
                    <div className="flex items-center justify-center h-full">
                      <span
                        className="font-bold whitespace-nowrap leading-none"
                        style={
                          useCustomSizes
                            ? { fontSize: `${gameScoreFontSize * 0.08}rem`, color: gameScoreTextColor, lineHeight: 0.9 }
                            : { fontSize: "clamp(3rem, 15vw, 9rem)", color: gameScoreTextColor, lineHeight: 0.9 } // Увеличено в 1.5 раза
                        }
                      >
                        {getCurrentGameScore("teamB")}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Информация о сторонах корта и подаче */}
                {(showCourtSides || showCurrentServer) && (
                  <>
                    {showCourtSides && (
                      <tr className="h-[7.5%] border-t" style={{ borderColor: dynamicStyles.header.borderColor }}>
                        <td colSpan={showSetsScore ? allSets.length + 2 : 2} className="py-2">
                          <div className="grid grid-cols-2 gap-2 h-full">
                            <div
                              className="p-2 rounded-lg flex flex-col justify-center"
                              style={dynamicStyles.infoBlock}
                            >
                              <h3
                                className="text-xs mb-1"
                                style={{
                                  ...dynamicStyles.infoBlockTitle,
                                  fontSize: useCustomSizes
                                    ? `calc(${infoBlockFontSize || 100}% * 0.7rem)`
                                    : "clamp(0.7rem, 1.5vw, 0.875rem)",
                                }}
                              >
                                {t("scoreboard.leftCourtSide")}
                              </h3>
                              <p
                                className="font-bold truncate text-base"
                                style={{
                                  ...(useCustomSizes
                                    ? { fontSize: `calc(${infoBlockFontSize || 100}% * 0.875rem)` }
                                    : { fontSize: "clamp(0.875rem, 2vw, 1.25rem)" }),
                                }}
                              >
                                {match.courtSides?.teamA === "left"
                                  ? teamA.players.map((p) => p.name).join(" / ")
                                  : match.courtSides?.teamB === "left"
                                    ? teamB.players.map((p) => p.name).join(" / ")
                                    : ""}
                              </p>
                            </div>
                            <div
                              className="p-2 rounded-lg flex flex-col justify-center"
                              style={dynamicStyles.infoBlock}
                            >
                              <h3
                                className="text-xs mb-1"
                                style={{
                                  ...dynamicStyles.infoBlockTitle,
                                  fontSize: useCustomSizes
                                    ? `calc(${infoBlockFontSize || 100}% * 0.7rem)`
                                    : "clamp(0.7rem, 1.5vw, 0.875rem)",
                                }}
                              >
                                {t("scoreboard.rightCourtSide")}
                              </h3>
                              <p
                                className="font-bold truncate text-base"
                                style={{
                                  ...(useCustomSizes
                                    ? { fontSize: `calc(${infoBlockFontSize || 100}% * 0.875rem)` }
                                    : { fontSize: "clamp(0.875rem, 2vw, 1.25rem)" }),
                                }}
                              >
                                {match.courtSides?.teamA === "right"
                                  ? teamA.players.map((p) => p.name).join(" / ")
                                  : match.courtSides?.teamB === "right"
                                    ? teamB.players.map((p) => p.name).join(" / ")
                                    : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {showCurrentServer && (
                      <tr className="h-[3.75%]">
                        <td colSpan={showSetsScore ? allSets.length + 2 : 2} className="py-1">
                          <div
                            className="p-1 rounded-lg flex flex-col justify-center h-full"
                            style={dynamicStyles.infoBlock}
                          >
                            <h3
                              className="text-xs mb-0.5"
                              style={{
                                ...dynamicStyles.infoBlockTitle,
                                fontSize: useCustomSizes
                                  ? `calc(${infoBlockFontSize || 100}% * 0.7rem)`
                                  : "clamp(0.7rem, 1.5vw, 0.875rem)",
                              }}
                            >
                              {t("scoreboard.currentServer")}
                            </h3>
                            <div className="flex items-center">
                              <span
                                className="mr-2 text-yellow-400 text-xl"
                                style={{
                                  fontSize: useCustomSizes
                                    ? `calc(${infoBlockFontSize || 100}% * 1rem)`
                                    : "clamp(1rem, 2vw, 1.5rem)",
                                }}
                              >
                                •
                              </span>
                              <p
                                className="font-bold truncate text-base"
                                style={{
                                  ...(useCustomSizes
                                    ? { fontSize: `calc(${infoBlockFontSize || 100}% * 0.875rem)` }
                                    : { fontSize: "clamp(0.875rem, 2vw, 1.25rem)" }),
                                }}
                              >
                                {match.currentServer.team === "teamA"
                                  ? teamA.players[match.currentServer.playerIndex]?.name || t("scoreboard.playerA")
                                  : teamB.players[match.currentServer.playerIndex]?.name || t("scoreboard.playerB")}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  } else {
    // Обычный режим без масштабирования
    return (
      <div className="min-h-screen w-full flex flex-col" style={dynamicStyles.container}>
        {/* Верхняя панель с информацией о матче - 6% высоты */}
        <div
          className="w-full px-2 md:px-4 h-[6vh] flex justify-between items-center border-b"
          style={dynamicStyles.header}
        >
          <div className="flex items-center">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">
              {match.type === "tennis" ? t("scoreboard.tennis") : t("scoreboard.padel")} -{" "}
              {match.format === "singles" ? t("scoreboard.singles") : t("scoreboard.doubles")}
            </h1>
          </div>
          <div className="flex items-center">
            <p className="text-sm md:text-base mr-4" style={dynamicStyles.tableHeader}>
              {match.isCompleted
                ? t("scoreboard.matchCompleted")
                : `${t("scoreboard.set")} ${currentSetIndex + 1} ${t("scoreboard.of")} ${totalSets}`}
            </p>
            <p className="text-xl md:text-2xl">{formatTime(currentTime)}</p>
            {match.isCompleted && (
              <Badge variant="outline" className="ml-2 bg-green-900 text-green-100 border-green-700">
                {t("scoreboard.matchCompleted")}
              </Badge>
            )}
          </div>
        </div>

        {/* Основное табло счета */}
        <div className="w-full px-2 md:px-4 flex flex-col flex-grow overflow-hidden">
          <div style={{ height: "94vh" }}>
            <table className="w-full h-full border-collapse table-fixed">
              <colgroup>
                <col style={{ width: playerColWidth }} />
                {showSetsScore && allSets.map((_, index) => <col key={index} style={{ width: setsColWidth }} />)}
                <col style={{ width: gameColWidth }} />
              </colgroup>
              <thead>
                <tr className="text-left h-[4vh]" style={dynamicStyles.tableHeader}>
                  <th className="py-2">Игрок</th>
                  {showSetsScore &&
                    allSets.map((_, index) => (
                      <th key={index} className="py-2 text-center">
                        {index + 1}
                      </th>
                    ))}
                  <th className="py-1 text-center" style={dynamicStyles.currentGameCell}>
                    <span>{currentSet.isTiebreak ? t("scoreboard.tiebreak") : t("scoreboard.game")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="h-[calc(100%-4vh)]">
                {/* Команда A */}
                <tr className="border-b h-[35%]" style={{ borderColor: dynamicStyles.header.borderColor }}>
                  <td className="py-4">
                    <div
                      className="flex flex-col p-2 rounded h-full flex items-center justify-center"
                      style={dynamicStyles.teamABackground}
                    >
                      {teamA.players.map((player, idx) => (
                        <div key={idx} className="flex items-center w-full">
                          {isServing("teamA", idx) && showServerIndicator && (
                            <span
                              className="mr-2 text-yellow-400"
                              style={
                                useCustomSizes
                                  ? { fontSize: `calc(min(10vh, 10vw) * ${playerNamesFontSize || 100} / 50 * 0.5)` }
                                  : { fontSize: "clamp(1.5rem, 5vw, 2.5rem)" }
                              }
                            >
                              •
                            </span>
                          )}
                          <span
                            className="font-bold text-white text-xl md:text-2xl lg:text-4xl xl:text-5xl"
                            style={
                              useCustomSizes
                                ? { fontSize: `calc(min(5vh, 5vw) * ${playerNamesFontSize || 100} / 50)` }
                                : { fontSize: "clamp(2rem, 6vw, 4rem)" }
                            }
                          >
                            {player.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  {showSetsScore &&
                    allSets.map((set, index) => {
                      const setWinner = getSetWinner(set)
                      const bgStyle = set.isCurrent
                        ? dynamicStyles.currentSetBackground
                        : setWinner === "teamA"
                          ? dynamicStyles.teamAWinnerBackground
                          : setWinner === "teamB"
                            ? null
                            : null

                      return (
                        <td key={index} className="py-4 text-center">
                          <div className="h-full flex items-center justify-center relative">
                            {bgStyle && (
                              <div
                                className="absolute inset-0 rounded"
                                style={{
                                  ...bgStyle,
                                  height: "100%",
                                  maxHeight: "100%",
                                  overflow: "hidden",
                                }}
                              />
                            )}
                            <span
                              className="font-bold relative z-10"
                              style={{
                                ...(useCustomSizes
                                  ? {
                                      fontSize: `calc(min(6vh, 6vw) * ${setsScoreFontSize || 100} / 100)`,
                                      color: setsScoreTextColor,
                                    }
                                  : { fontSize: "clamp(1rem, 3vw, 1.5rem)", color: setsScoreTextColor }),
                                color: setsScoreTextColor,
                                textShadow: "0px 0px 2px rgba(0,0,0,0.7)",
                                fontWeight: 800,
                              }}
                            >
                              {set.teamA}
                              {getTiebreakScore(set) && <span className="text-xs ml-1">{getTiebreakScore(set)}</span>}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  <td className="py-0 text-center align-middle" style={dynamicStyles.currentGameCell}>
                    <div className="flex items-center justify-center h-full">
                      <span
                        className="font-bold whitespace-nowrap leading-none"
                        style={
                          useCustomSizes
                            ? {
                                fontSize: `calc(min(20vh, 20vw) * ${gameScoreFontSize || 100} / 100)`,
                                color: gameScoreTextColor,
                                lineHeight: 0.9,
                              }
                            : { fontSize: "clamp(3rem, 15vw, 9rem)", color: gameScoreTextColor, lineHeight: 0.9 }
                        }
                      >
                        {getCurrentGameScore("teamA")}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Команда B */}
                <tr className="h-[35%]">
                  <td className="py-4">
                    <div
                      className="flex flex-col p-2 rounded h-full flex items-center justify-center"
                      style={dynamicStyles.teamBBackground}
                    >
                      {teamB.players.map((player, idx) => (
                        <div key={idx} className="flex items-center w-full">
                          {isServing("teamB", idx) && showServerIndicator && (
                            <span
                              className="mr-2 text-yellow-400"
                              style={
                                useCustomSizes
                                  ? { fontSize: `calc(min(10vh, 10vw) * ${playerNamesFontSize || 100} / 50 * 0.5)` }
                                  : { fontSize: "clamp(1.5rem, 5vw, 2.5rem)" }
                              }
                            ></span>
                          )}
                          <span
                            className="font-bold text-white text-xl md:text-2xl lg:text-4xl xl:text-5xl"
                            style={
                              useCustomSizes
                                ? { fontSize: `calc(min(5vh, 5vw) * ${playerNamesFontSize || 100} / 50)` }
                                : { fontSize: "clamp(2rem, 6vw, 4rem)" }
                            }
                          >
                            {player.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  {showSetsScore &&
                    allSets.map((set, index) => {
                      const setWinner = getSetWinner(set)
                      const bgStyle = set.isCurrent
                        ? dynamicStyles.currentSetBackground
                        : setWinner === "teamB"
                          ? dynamicStyles.teamBWinnerBackground
                          : setWinner === "teamA"
                            ? null
                            : null

                      return (
                        <td key={index} className="py-4 text-center">
                          <div className="h-full flex items-center justify-center relative">
                            {bgStyle && (
                              <div
                                className="absolute inset-0 rounded"
                                style={{
                                  ...bgStyle,
                                  height: "100%",
                                  maxHeight: "100%",
                                  overflow: "hidden",
                                }}
                              />
                            )}
                            <span
                              className="font-bold relative z-10"
                              style={{
                                ...(useCustomSizes
                                  ? {
                                      fontSize: `calc(min(6vh, 6vw) * ${setsScoreFontSize || 100} / 100)`,
                                      color: setsScoreTextColor,
                                    }
                                  : { fontSize: "clamp(1rem, 3vw, 1.5rem)", color: setsScoreTextColor }),
                                color: setsScoreTextColor,
                                textShadow: "0px 0px 2px rgba(0,0,0,0.7)",
                                fontWeight: 800,
                              }}
                            >
                              {set.teamB}
                              {getTiebreakScore(set) && <span className="text-xs ml-1">{getTiebreakScore(set)}</span>}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  <td className="py-0 text-center align-middle" style={dynamicStyles.currentGameCell}>
                    <div className="flex items-center justify-center h-full">
                      <span
                        className="font-bold whitespace-nowrap leading-none"
                        style={
                          useCustomSizes
                            ? {
                                fontSize: `calc(min(20vh, 20vw) * ${gameScoreFontSize || 100} / 100)`,
                                color: gameScoreTextColor,
                                lineHeight: 0.9,
                              }
                            : { fontSize: "clamp(3rem, 15vw, 9rem)", color: gameScoreTextColor, lineHeight: 0.9 }
                        }
                      >
                        {getCurrentGameScore("teamB")}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Информация о сторонах корта и подаче */}
                {(showCourtSides || showCurrentServer) && (
                  <>
                    {showCourtSides && (
                      <tr className="h-[7.5%] border-t" style={{ borderColor: dynamicStyles.header.borderColor }}>
                        <td colSpan={showSetsScore ? allSets.length + 2 : 2} className="py-2">
                          <div className="grid grid-cols-2 gap-2 h-full">
                            <div
                              className="p-2 rounded-lg flex flex-col justify-center"
                              style={dynamicStyles.infoBlock}
                            >
                              <h3
                                className="text-xs md:text-sm mb-1"
                                style={{
                                  ...dynamicStyles.infoBlockTitle,
                                  fontSize: useCustomSizes
                                    ? "clamp(0.7rem, 1.5vw, 0.875rem)"
                                    : "clamp(0.7rem, 1.5vw, 0.875rem)",
                                }}
                              >
                                {t("scoreboard.leftCourtSide")}
                              </h3>
                              <p
                                className="font-bold truncate"
                                style={{
                                  ...(useCustomSizes
                                    ? { fontSize: `calc(${infoBlockFontSize || 100}% * 0.875rem)` }
                                    : { fontSize: "clamp(0.875rem, 2vw, 1.25rem)" }),
                                }}
                              >
                                {match.courtSides?.teamA === "left"
                                  ? teamA.players.map((p) => p.name).join(" / ")
                                  : match.courtSides?.teamB === "left"
                                    ? teamB.players.map((p) => p.name).join(" / ")
                                    : ""}
                              </p>
                            </div>
                            <div
                              className="p-2 rounded-lg flex flex-col justify-center"
                              style={dynamicStyles.infoBlock}
                            >
                              <h3
                                className="text-xs md:text-sm mb-1"
                                style={{
                                  ...dynamicStyles.infoBlockTitle,
                                  fontSize: useCustomSizes
                                    ? "clamp(0.7rem, 1.5vw, 0.875rem)"
                                    : "clamp(0.7rem, 1.5vw, 0.875rem)",
                                }}
                              >
                                {t("scoreboard.rightCourtSide")}
                              </h3>
                              <p
                                className="font-bold truncate"
                                style={{
                                  ...(useCustomSizes
                                    ? { fontSize: `calc(${infoBlockFontSize || 100}% * 0.875rem)` }
                                    : { fontSize: "clamp(0.875rem, 2vw, 1.25rem)" }),
                                }}
                              >
                                {match.courtSides?.teamA === "right"
                                  ? teamA.players.map((p) => p.name).join(" / ")
                                  : match.courtSides?.teamB === "right"
                                    ? teamB.players.map((p) => p.name).join(" / ")
                                    : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {showCurrentServer && (
                      <tr className="h-[3.75%]">
                        <td colSpan={showSetsScore ? allSets.length + 2 : 2} className="py-1">
                          <div
                            className="p-1 rounded-lg flex flex-col justify-center h-full"
                            style={dynamicStyles.infoBlock}
                          >
                            <h3
                              className="text-xs md:text-sm mb-0.5"
                              style={{
                                ...dynamicStyles.infoBlockTitle,
                                fontSize: useCustomSizes
                                  ? `calc(${infoBlockFontSize || 100}% * 0.7rem)`
                                  : "clamp(0.7rem, 1.5vw, 0.875rem)",
                              }}
                            >
                              {t("scoreboard.currentServer")}
                            </h3>
                            <div className="flex items-center">
                              <span
                                className="mr-2 text-yellow-400"
                                style={{
                                  fontSize: useCustomSizes
                                    ? `calc(${infoBlockFontSize || 100}% * 1rem)`
                                    : "clamp(1rem, 2vw, 1.5rem)",
                                }}
                              >
                                •
                              </span>
                              <p
                                className="font-bold truncate"
                                style={{
                                  ...(useCustomSizes
                                    ? { fontSize: `calc(${infoBlockFontSize || 100}% * 0.875rem)` }
                                    : { fontSize: "clamp(0.875rem, 2vw, 1.25rem)" }),
                                }}
                              >
                                {match.currentServer.team === "teamA"
                                  ? teamA.players[match.currentServer.playerIndex]?.name || t("scoreboard.playerA")
                                  : teamB.players[match.currentServer.playerIndex]?.name || t("scoreboard.playerB")}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }
}
