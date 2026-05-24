"use client"

import React, { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { isGamePoint, isSetPoint, isMatchPoint } from "@/lib/scoring-logic"
import { parseScoreboardSettings } from "@/lib/scoreboard-settings"
import { getTennisPointName } from "@/lib/tennis-utils"
import { VmixScoreboard } from "@/components/vmix-scoreboard"
import { useVmixMatch } from "@/hooks/use-vmix-match"

// Плоский JSON-объект матча для формата vMix (format=json).
const buildVmixJson = (matchData: any) => ({
  id: matchData.id,
  teamA: {
    name: matchData.teamA.players.map((p: any) => p.name).join(" / "),
    score: matchData.score.teamA,
    currentGameScore: matchData.score.currentSet
      ? matchData.score.currentSet.isTiebreak
        ? matchData.score.currentSet.currentGame.teamA
        : getTennisPointName(matchData.score.currentSet.currentGame.teamA)
      : "0",
    sets: matchData.score.sets ? matchData.score.sets.map((set: any) => set.teamA) : [],
    currentSet: matchData.score.currentSet ? matchData.score.currentSet.teamA : 0,
    serving: matchData.currentServer && matchData.currentServer.team === "teamA",
    countries: matchData.teamA.players.map((p: any) => p.country || "").filter(Boolean),
  },
  teamB: {
    name: matchData.teamB.players.map((p: any) => p.name).join(" / "),
    score: matchData.score.teamB,
    currentGameScore: matchData.score.currentSet
      ? matchData.score.currentSet.isTiebreak
        ? matchData.score.currentSet.currentGame.teamB
        : getTennisPointName(matchData.score.currentSet.currentGame.teamB)
      : "0",
    sets: matchData.score.sets ? matchData.score.sets.map((set: any) => set.teamB) : [],
    currentSet: matchData.score.currentSet ? matchData.score.currentSet.teamB : 0,
    serving: matchData.currentServer && matchData.currentServer.team === "teamB",
    countries: matchData.teamB.players.map((p: any) => p.country || "").filter(Boolean),
  },
  isTiebreak: matchData.score.currentSet ? matchData.score.currentSet.isTiebreak : false,
  isCompleted: matchData.isCompleted || false,
  winner: matchData.winner || null,
  timestamp: new Date().toISOString(),
})

// Отладочная информация о текущем состоянии матча.
const buildDebugInfo = (matchData: any) =>
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
  )

export default function VmixPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  const id = resolvedParams.id
  const searchParams = useSearchParams()

  // Загрузка матча и realtime — единый хук (lib/use-vmix-match, Этап E).
  const { match, loading, error } = useVmixMatch({ kind: "id", id })

  // Параметры отображения — единый разбор (lib/scoreboard-settings).
  const settings = parseScoreboardSettings(searchParams)
  const { outputFormat, showDebug } = settings

  // JSON / отладочный вывод пересчитываются при каждом обновлении матча.
  const jsonOutput = match && outputFormat === "json" ? JSON.stringify(buildVmixJson(match), null, 2) : ""
  const debugInfo = match && showDebug ? buildDebugInfo(match) : ""

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

  // Табло — единый презентационный компонент <VmixScoreboard>.
  return (
    <>
      <style jsx global>{`
        html,
        body {
          background-color: transparent !important;
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
        }
      `}</style>

      <VmixScoreboard match={match} settings={settings} variant="overlay" />

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
    </>
  )
}
