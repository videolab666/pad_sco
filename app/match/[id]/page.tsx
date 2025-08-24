"use client"

import React, { useState, useEffect, useContext } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Share2, Copy, Download, Upload, ExternalLink, CircleDot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScoreBoard } from "@/components/score-board"
import { ScoreControls } from "@/components/score-controls"
import { MatchSettings } from "@/components/match-settings"
import { SupabaseStatus } from "@/components/supabase-status"
import { OfflineNotice } from "@/components/offline-notice"
import {
  getMatch,
  updateMatch,
  getMatchShareUrl,
  exportMatchToJson,
  importMatchFromJson,
  subscribeToMatchUpdates,
} from "@/lib/match-storage"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { VmixButton } from "@/components/vmix-button"
import { Badge } from "@/components/ui/badge"
import { LanguageContext } from "@/contexts/language-context"
import { translations } from "@/lib/translations"

type MatchParams = {
  params: {
    id: string
  }
}

export default function MatchPage({ params }: MatchParams) {
  // Access params directly but safely
  const matchId = typeof params.id === 'string' ? params.id : ''
  
  const router = useRouter()
  const { language } = useContext(LanguageContext)
  const t = translations[language]

  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState("")
  const [importData, setImportData] = useState("")
  const [activeTab, setActiveTab] = useState("match")
  const [sideChangeAlert, setSideChangeAlert] = useState(false)

  useEffect(() => {
    const loadMatch = async () => {
      try {
        if (!matchId || matchId === "[object%20Promise]") {
          setError(language === "ru" ? "Некорректный ID матча" : "Invalid match ID")
          setLoading(false)
          return
        }

        const matchData = await getMatch(matchId)
        if (matchData) {
          // Убедимся, что структура матча полная
          if (!matchData.score.sets) {
            matchData.score.sets = []
          }
          setMatch(matchData)
          setError("")
        } else {
          setError(language === "ru" ? "Матч не найден" : "Match not found")
        }
      } catch (err) {
        setError(language === "ru" ? "Ошибка загрузки матча" : "Error loading match")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadMatch()

    // Подписываемся на обновления матча в реальном времени
    const unsubscribe = subscribeToMatchUpdates(matchId, (updatedMatch) => {
      if (updatedMatch) {
        setMatch(updatedMatch)
        setError("")
      } else {
        // Если матч был удален, показываем ошибку
        setError(language === "ru" ? "Матч не найден или был удален" : "Match not found or was deleted")
      }
    })

    // Добавляем обработчик события match-updated
    const handleMatchUpdated = async (event) => {
      if (event.detail && event.detail.id === matchId) {
        // Перезагружаем матч при получении события обновления
        const matchData = await getMatch(matchId)
        if (matchData) {
          setMatch(matchData)
          setError("")
        }
      }
    }

    window.addEventListener("match-updated", handleMatchUpdated)

    // Добавляем обработчик события смены сторон
    const handleCourtSidesSwapped = (event) => {
      if (event.detail && event.detail.newSides) {
        setSideChangeAlert(true)
        setTimeout(() => setSideChangeAlert(false), 2000)
      }
    }

    window.addEventListener("courtSidesSwapped", handleCourtSidesSwapped)

    return () => {
      // Отписываемся при размонтировании компонента
      if (unsubscribe) {
        unsubscribe()
      }
      window.removeEventListener("match-updated", handleMatchUpdated)
      window.removeEventListener("courtSidesSwapped", handleCourtSidesSwapped)
    }
  }, [params.id, language])

  const handleUpdateMatch = async (updatedMatch) => {
    try {
      // Отключаем функцию отмены для экономии места
      updatedMatch.history = []

      await updateMatch(updatedMatch)
      setMatch(updatedMatch)

      // Убираем показ уведомления при обновлении счета
      // setAlertMessage(t.matchPage.scoreUpdated)
      // setShowAlert(true)
      // setTimeout(() => setShowAlert(false), 2000)
    } catch (err) {
      console.error("Ошибка обновления матча:", err)

      // Если произошла ошибка, пробуем упростить объект матча
      try {
        // Создаем минимальную версию матча
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

        await updateMatch(minimalMatch)
        setMatch(minimalMatch)

        // Показываем уведомление о проблеме
        setAlertMessage(t.matchPage.matchDataSimplified)
        setShowAlert(true)
        setTimeout(() => setShowAlert(false), 3000)
      } catch (innerErr) {
        console.error("Критическая ошибка обновления матча:", innerErr)
        setError(
          language === "ru"
            ? "Не удалось обновить матч. Попробуйте обновить страницу."
            : "Failed to update match. Try refreshing the page.",
        )
      }
    }
  }

  const handleShare = () => {
    const url = getMatchShareUrl(params.id)

    if (navigator.share) {
      navigator.share({
        title: language === "ru" ? "Теннисный матч" : "Tennis match",
        text: language === "ru" ? "Следите за счетом матча в реальном времени" : "Follow the match score in real-time",
        url,
      })
    } else {
      navigator.clipboard.writeText(url)
      setAlertMessage(t.matchPage.linkCopied)
      setShowAlert(true)
      setTimeout(() => setShowAlert(false), 2000)
    }
  }

  const copyMatchId = () => {
    navigator.clipboard.writeText(params.id)
    setAlertMessage(t.matchPage.matchCodeCopied)
    setShowAlert(true)
    setTimeout(() => setShowAlert(false), 2000)
  }

  const handleExportMatch = async () => {
    const jsonData = await exportMatchToJson(params.id)
    if (jsonData) {
      navigator.clipboard.writeText(jsonData)
      setAlertMessage(t.matchPage.matchDataCopied)
      setShowAlert(true)
      setTimeout(() => setShowAlert(false), 2000)
    }
  }

  const handleImportMatch = async () => {
    if (!importData.trim()) {
      setAlertMessage(t.matchPage.importDataRequired)
      setShowAlert(true)
      setTimeout(() => setShowAlert(false), 2000)
      return
    }

    try {
      const matchId = await importMatchFromJson(importData)
      if (matchId) {
        setAlertMessage(t.matchPage.matchImported)
        setShowAlert(true)
        setTimeout(() => {
          setShowAlert(false)
          router.push(`/match/${matchId}`)
        }, 2000)
      } else {
        throw new Error("Ошибка импорта")
      }
    } catch (err) {
      setAlertMessage(t.matchPage.importError)
      setShowAlert(true)
      setTimeout(() => setShowAlert(false), 3000)
    }
  }

  // Обработчик смены подающего
  const handleSwitchServer = () => {
    const event = new CustomEvent("switchServer", {
      detail: { matchId: params.id },
    })
    window.dispatchEvent(event)
  }

  // Если матч не найден, предлагаем создать новый
  const handleCreateNewMatch = () => {
    router.push("/new-match")
  }

  if (loading) {
    return <div className="container max-w-4xl mx-auto px-4 py-8 text-center">{t.matchPage.loadingMatch}</div>
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-4" onClick={() => router.push("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.matchPage.home}
        </Button>
        <Card className="p-6 text-center">
          <h2 className="text-xl font-bold text-red-500 mb-2">{t.matchPage.errorTitle}</h2>
          <p className="mb-4">{error}</p>
          <Button onClick={handleCreateNewMatch}>{t.matchPage.createNewMatch}</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {sideChangeAlert && (
        <Alert className="fixed top-4 right-4 w-auto z-50 bg-yellow-50 border-yellow-200">
          <AlertTitle>{t.matchPage.sideChange}</AlertTitle>
          <AlertDescription>{t.matchPage.sidesSwapped}</AlertDescription>
        </Alert>
      )}
      {showAlert && !sideChangeAlert && (
        <Alert className="fixed top-4 right-4 w-auto z-50 bg-green-50 border-green-200">
          <AlertTitle>{t.matchPage.notification}</AlertTitle>
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          {(!match || match.created_via_court_link !== true) && (
            <Button variant="ghost" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t.matchPage.home}
            </Button>
          )}
          {match && match.courtNumber !== null && (
            <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800">
              {t.matchPage.court} {match.courtNumber}
            </Badge>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <SupabaseStatus />
        </div>
      </div>

      {!(match?.created_via_court_link === true) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          <Button variant="outline" onClick={handleShare} className="w-full">
            <Share2 className="mr-2 h-4 w-4" />
            {t.matchPage.share}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/match/${params.id}/view`)} className="w-full">
            <ExternalLink className="mr-2 h-4 w-4" />
            {t.matchPage.viewScore}
          </Button>
        </div>
      )}

      <OfflineNotice />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="match">{t.matchPage.matchTab}</TabsTrigger>
          <TabsTrigger value="export">{t.matchPage.exportImportTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="match">
          <div className="flex flex-col gap-1 mb-3">
            <Card className="px-[3px] py-2 bg-[#fefcf8]" aria-label={t.match.scoreCard}>
              <ScoreBoard match={match} updateMatch={handleUpdateMatch} />

              <div className="mt-2 pt-1.5 border-t border-gray-200 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs shadow-md hover:bg-gradient-to-b hover:from-green-700 hover:to-green-900 bg-gradient-to-b from-green-800 to-green-950 text-white border-green-700 transition-all duration-200 active:scale-95 active:translate-y-0.5 active:shadow-inner webkit-appearance-none"
                  onClick={handleSwitchServer}
                  style={{
                    WebkitAppearance: 'none',
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1
                  }}
                >
                  {/* Заменяем SVG иконку на простой CSS-индикатор для Safari */}
                  <span
                    className="inline-block w-3 h-3 mr-2 rounded-full bg-lime-500 border border-lime-400"
                    style={{
                      minWidth: '12px',
                      minHeight: '12px',
                      flexShrink: 0
                    }}
                    aria-hidden="true"
                  />
                  {t.matchPage.switchServer || "Switch Server"}
                </Button>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <ScoreControls match={match} updateMatch={handleUpdateMatch} />
            <MatchSettings match={match} updateMatch={handleUpdateMatch} />
          </div>
        </TabsContent>

        <TabsContent value="export">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">{t.matchPage.exportMatch}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t.matchPage.exportDescription}</p>
              <Button onClick={handleExportMatch}>
                <Download className="mr-2 h-4 w-4" />
                {t.matchPage.exportButton}
              </Button>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">{t.matchPage.importMatch}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t.matchPage.importDescription}</p>
              <Textarea
                placeholder={t.matchPage.importPlaceholder}
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="mb-4"
                rows={6}
              />
              <Button onClick={handleImportMatch}>
                <Upload className="mr-2 h-4 w-4" />
                {t.matchPage.importButton}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      {activeTab === "match" && (
        <Card className="mt-3 p-4" style={{ backgroundColor: "#fbf2da" }}>
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">{t.matchPage.technicalFunctions}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {match?.created_via_court_link === true ? (
              <Button
                variant="outline"
                onClick={() => {
                  const savedSettings = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem("vmix_settings") : null
                  if (savedSettings) {
                    const settings = JSON.parse(savedSettings)
                    const url = new URL(`${window.location.origin}/vmix/${params.id}`)
                    url.searchParams.set("theme", settings.theme || "custom")
                    url.searchParams.set("showNames", (settings.showNames !== undefined ? settings.showNames : true).toString())
                    url.searchParams.set("showPoints", (settings.showPoints !== undefined ? settings.showPoints : true).toString())
                    url.searchParams.set("showSets", (settings.showSets !== undefined ? settings.showSets : true).toString())
                    url.searchParams.set("showServer", (settings.showServer !== undefined ? settings.showServer : true).toString())
                    url.searchParams.set("showCountry", (settings.showCountry !== undefined ? settings.showCountry : false).toString())
                    url.searchParams.set("fontSize", settings.fontSize || "normal")
                    url.searchParams.set("bgOpacity", (settings.bgOpacity !== undefined ? settings.bgOpacity : 0.5).toString())
                    url.searchParams.set("textColor", (settings.textColor || "#ffffff").replace("#", ""))
                    url.searchParams.set("accentColor", (settings.accentColor || "#00ff00").replace("#", ""))
                    url.searchParams.set("namesBgColor", (settings.namesBgColor || "#0369a1").replace("#", ""))
                    url.searchParams.set("countryBgColor", (settings.countryBgColor || "#0369a1").replace("#", ""))
                    url.searchParams.set("serveBgColor", (settings.serveBgColor || "#0369a1").replace("#", ""))
                    url.searchParams.set("pointsBgColor", (settings.pointsBgColor || "#0369a1").replace("#", ""))
                    url.searchParams.set("setsBgColor", (settings.setsBgColor || "#ffffff").replace("#", ""))
                    url.searchParams.set("setsTextColor", (settings.setsTextColor || "#000000").replace("#", ""))
                    url.searchParams.set("namesGradient", (settings.namesGradient !== undefined ? settings.namesGradient : true).toString())
                    url.searchParams.set("namesGradientFrom", (settings.namesGradientFrom || "#0369a1").replace("#", ""))
                    url.searchParams.set("namesGradientTo", (settings.namesGradientTo || "#0284c7").replace("#", ""))
                    url.searchParams.set("countryGradient", (settings.countryGradient !== undefined ? settings.countryGradient : true).toString())
                    url.searchParams.set("countryGradientFrom", (settings.countryGradientFrom || "#0369a1").replace("#", ""))
                    url.searchParams.set("countryGradientTo", (settings.countryGradientTo || "#0284c7").replace("#", ""))
                    url.searchParams.set("serveGradient", (settings.serveGradient !== undefined ? settings.serveGradient : true).toString())
                    url.searchParams.set("serveGradientFrom", (settings.serveGradientFrom || "#0369a1").replace("#", ""))
                    url.searchParams.set("serveGradientTo", (settings.serveGradientTo || "#0284c7").replace("#", ""))
                    url.searchParams.set("pointsGradient", (settings.pointsGradient !== undefined ? settings.pointsGradient : true).toString())
                    url.searchParams.set("pointsGradientFrom", (settings.pointsGradientFrom || "#0369a1").replace("#", ""))
                    url.searchParams.set("pointsGradientTo", (settings.pointsGradientTo || "#0284c7").replace("#", ""))
                    url.searchParams.set("setsGradient", (settings.setsGradient !== undefined ? settings.setsGradient : true).toString())
                    url.searchParams.set("setsGradientFrom", (settings.setsGradientFrom || "#ffffff").replace("#", ""))
                    url.searchParams.set("setsGradientTo", (settings.setsGradientTo || "#f0f0f0").replace("#", ""))
                    url.searchParams.set("indicatorBgColor", (settings.indicatorBgColor || "#7c2d12").replace("#", ""))
                    url.searchParams.set("indicatorTextColor", (settings.indicatorTextColor || "#ffffff").replace("#", ""))
                    url.searchParams.set("indicatorGradient", (settings.indicatorGradient !== undefined ? settings.indicatorGradient : true).toString())
                    url.searchParams.set("indicatorGradientFrom", (settings.indicatorGradientFrom || "#7c2d12").replace("#", ""))
                    url.searchParams.set("indicatorGradientTo", (settings.indicatorGradientTo || "#991b1b").replace("#", ""))
                    url.searchParams.set("animationType", settings.animationType || "fade")
                    url.searchParams.set("animationDuration", (settings.animationDuration || 500).toString())
                    window.open(url.toString(), "_blank")
                  } else {
                    window.open(`/vmix/${params.id}`, "_blank")
                  }
                }}
                className="w-full text-sm shadow-md transition-all duration-200 active:scale-95 hover:bg-gradient-to-b hover:from-white hover:to-[#f5f9fd]"
                size="sm"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t.matchPage.vmixMatch}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={copyMatchId}
                  className="w-full text-sm shadow-md transition-all duration-200 active:scale-95 hover:bg-gradient-to-b hover:from-white hover:to-[#f5f9fd]"
                  size="sm"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {t.matchPage.matchCode}
                </Button>
                <VmixButton
                  matchId={params.id}
                  courtNumber={match?.courtNumber}
                  className="w-full text-sm shadow-md transition-all duration-200 active:scale-95 hover:bg-gradient-to-b hover:from-white hover:to-[#f5f9fd]"
                  size="sm"
                />
                {match?.courtNumber && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/api/court/${match.courtNumber}`, "_blank")}
                    className="w-full text-sm shadow-md transition-all duration-200 active:scale-95 hover:bg-gradient-to-b hover:from-white hover:to-[#f5f9fd]"
                    size="sm"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t.matchPage.jsonCourt} {match.courtNumber}
                  </Button>
                )}
                {match?.courtNumber && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/court-vmix/${match.courtNumber}`, "_blank")}
                    className="w-full text-sm shadow-md transition-all duration-200 active:scale-95 hover:bg-gradient-to-b hover:from-white hover:to-[#f5f9fd]"
                    size="sm"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t.matchPage.vmixCourt} {match.courtNumber}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => window.open(`/api/vmix/${params.id}`, "_blank")}
                  className="w-full text-sm shadow-md transition-all duration-200 active:scale-95 hover:bg-gradient-to-b hover:from-white hover:to-[#f5f9fd]"
                  size="sm"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t.matchPage.jsonMatch}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Загружаем сохраненные настройки vMix
                    const savedSettings = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem("vmix_settings") : null
                    if (savedSettings) {
                      const settings = JSON.parse(savedSettings)
                      // Формируем URL с параметрами
                      const url = new URL(`${window.location.origin}/vmix/${params.id}`)

                      // Добавляем основные параметры
                      url.searchParams.set("theme", settings.theme || "custom")
                      url.searchParams.set(
                        "showNames",
                        (settings.showNames !== undefined ? settings.showNames : true).toString(),
                      )
                      url.searchParams.set(
                        "showPoints",
                        (settings.showPoints !== undefined ? settings.showPoints : true).toString(),
                      )
                      url.searchParams.set(
                        "showSets",
                        (settings.showSets !== undefined ? settings.showSets : true).toString(),
                      )
                      url.searchParams.set(
                        "showServer",
                        (settings.showServer !== undefined ? settings.showServer : true).toString(),
                      )
                      url.searchParams.set(
                        "showCountry",
                        (settings.showCountry !== undefined ? settings.showCountry : true).toString(),
                      )
                      url.searchParams.set("fontSize", settings.fontSize || "normal")
                      url.searchParams.set(
                        "bgOpacity",
                        (settings.bgOpacity !== undefined ? settings.bgOpacity : 0.5).toString(),
                      )
                      url.searchParams.set("textColor", (settings.textColor || "#ffffff").replace("#", ""))
                      url.searchParams.set("accentColor", (settings.accentColor || "#fbbf24").replace("#", ""))

                      // Добавляем параметры цветов и градиентов
                      if (settings.theme !== "transparent") {
                        url.searchParams.set("namesBgColor", (settings.namesBgColor || "#0369a1").replace("#", ""))
                        url.searchParams.set("countryBgColor", (settings.countryBgColor || "#0369a1").replace("#", ""))
                        url.searchParams.set("serveBgColor", (settings.serveBgColor || "#000000").replace("#", ""))
                        url.searchParams.set("pointsBgColor", (settings.pointsBgColor || "#0369a1").replace("#", ""))
                        url.searchParams.set("setsBgColor", (settings.setsBgColor || "#ffffff").replace("#", ""))
                        url.searchParams.set("setsTextColor", (settings.setsTextColor || "#000000").replace("#", ""))
                        url.searchParams.set(
                          "namesGradient",
                          (settings.namesGradient !== undefined ? settings.namesGradient : false).toString(),
                        )
                        url.searchParams.set(
                          "namesGradientFrom",
                          (settings.namesGradientFrom || "#0369a1").replace("#", ""),
                        )
                        url.searchParams.set("namesGradientTo", (settings.namesGradientTo || "#0284c7").replace("#", ""))
                        url.searchParams.set(
                          "countryGradient",
                          (settings.countryGradient !== undefined ? settings.countryGradient : false).toString(),
                        )
                        url.searchParams.set(
                          "countryGradientFrom",
                          (settings.countryGradientFrom || "#0369a1").replace("#", ""),
                        )
                        url.searchParams.set(
                          "countryGradientTo",
                          (settings.countryGradientTo || "#0284c7").replace("#", ""),
                        )
                        url.searchParams.set(
                          "serveGradient",
                          (settings.serveGradient !== undefined ? settings.serveGradient : false).toString(),
                        )
                        url.searchParams.set(
                          "serveGradientFrom",
                          (settings.serveGradientFrom || "#000000").replace("#", ""),
                        )
                        url.searchParams.set("serveGradientTo", (settings.serveGradientTo || "#1e1e1e").replace("#", ""))
                        url.searchParams.set(
                          "pointsGradient",
                          (settings.pointsGradient !== undefined ? settings.pointsGradient : false).toString(),
                        )
                        url.searchParams.set(
                          "pointsGradientFrom",
                          (settings.pointsGradientFrom || "#0369a1").replace("#", ""),
                        )
                        url.searchParams.set("pointsGradientTo", (settings.pointsGradientTo || "#0284c7").replace("#", ""))
                        url.searchParams.set(
                          "setsGradient",
                          (settings.setsGradient !== undefined ? settings.setsGradient : false).toString(),
                        )
                        url.searchParams.set("setsGradientFrom", (settings.setsGradientFrom || "#ffffff").replace("#", ""))
                        url.searchParams.set("setsGradientTo", (settings.setsGradientTo || "#f0f0f0").replace("#", ""))

                        // Добавляем параметры для индикатора
                        url.searchParams.set("indicatorBgColor", (settings.indicatorBgColor || "#7c2d12").replace("#", ""))
                        url.searchParams.set(
                          "indicatorTextColor",
                          (settings.indicatorTextColor || "#ffffff").replace("#", ""),
                        )
                        url.searchParams.set(
                          "indicatorGradient",
                          (settings.indicatorGradient !== undefined ? settings.indicatorGradient : false).toString(),
                        )
                        url.searchParams.set(
                          "indicatorGradientFrom",
                          (settings.indicatorGradientFrom || "#7c2d12").replace("#", ""),
                        )
                        url.searchParams.set(
                          "indicatorGradientTo",
                          (settings.indicatorGradientTo || "#991b1b").replace("#", ""),
                        )
                      }

                      // Добавляем параметры анимаций
                      url.searchParams.set("animationType", settings.animationType || "fade")
                      url.searchParams.set("animationDuration", (settings.animationDuration || 500).toString())

                      window.open(url.toString(), "_blank")
                    } else {
                      // Если настройки не найдены, открываем страницу без параметров
                      window.open(`/vmix/${params.id}`, "_blank")
                    }
                  }}
                  className="w-full text-sm shadow-md transition-all duration-200 active:scale-95 hover:bg-gradient-to-b hover:from-white hover:to-[#f5f9fd]"
                  size="sm"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t.matchPage.vmixMatch}
                </Button>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
