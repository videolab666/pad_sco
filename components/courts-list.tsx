"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, ExternalLink } from "lucide-react"
import { getOccupiedCourts, MAX_COURTS } from "@/lib/court-utils"
import { subscribeToMatchesListUpdates } from "@/lib/match-storage"
import { VmixButton } from "@/components/vmix-button"
import { FullscreenButton } from "@/components/fullscreen-button"
import { logEvent } from "@/lib/error-logger"
import { useLanguage } from "@/contexts/language-context"

export function CourtsList() {
  const { t } = useLanguage()
  const [occupiedCourts, setOccupiedCourts] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // Дебаунс-таймер превращён в trailing-throttle: таймер НЕ сбрасывается
  // новым событием — пачка realtime-событий (очко, завершение, несколько
  // PUT) схлопывается в один перезапрос максимум раз в 500 мс.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Зеркало occupiedCourts для синхронного доступа из realtime-колбэка
  // (стейт в замыкании эффекта устаревает).
  const occupiedRef = useRef<number[]>([])

  // Загрузка списка занятых кортов. silent=true — фоновой перезагрузкой без
  // спиннера на весь блок (иначе каждое realtime-событие мигает UI).
  const loadOccupiedCourts = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const courts = await getOccupiedCourts()
      occupiedRef.current = courts
      setOccupiedCourts(courts)
      logEvent("info", "Список занятых кортов загружен", "courts-list", { courts, silent })
    } catch (error) {
      console.error("Ошибка при загрузке занятых кортов:", error)
      logEvent("error", "Ошибка при загрузке занятых кортов", "courts-list", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Обновление списка кортов
  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await loadOccupiedCourts()
    } finally {
      setRefreshing(false)
    }
  }

  const scheduleReload = useCallback(() => {
    if (refreshTimerRef.current) return // перезапрос уже запланирован
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      void loadOccupiedCourts(true)
    }, 500)
  }, [loadOccupiedCourts])

  // Загрузка при монтировании + живое обновление (фикс 2026-09-04): корт
  // «висел занятым» до F5 — завершение доезжало до сервера ПОСЛЕ возврата
  // на главную (drain асинхронный), а список грузился один раз на маунте.
  // Теперь: realtime на таблицу matches + перезагрузка на фокус/видимость
  // (возврат со страницы матча или из другой вкладки).
  useEffect(() => {
    loadOccupiedCourts()

    const unsubscribe = subscribeToMatchesListUpdates((_matches: unknown, payload?: any) => {
      // Занятость корта меняют только: завершение (is_completed=true),
      // появление/удаление матча, ЗАНИМАНИЕ ранее свободного корта (анлок
      // или назначение court_number). Очко в матче на УЖЕ занятом корте
      // занятость не меняет — на нём не перезапрашиваем (фикс 2026-09-04:
      // главная грузила браузер запросом на каждый счёт). REPLICA IDENTITY
      // дефолтный (old = только id), поэтому диф по old невозможен.
      const evt = payload?.eventType ?? payload?.event
      if (evt === "UPDATE") {
        const row = payload?.new
        const court = typeof row?.court_number === "number" ? row.court_number : null
        // isActive-UPDATE интересна только если её корт сейчас СВОБОДЕН:
        // занят → это очко (пропуск), null → QR-корт, числовую занятость не меняет.
        if (row?.is_completed === false && (court === null || occupiedRef.current.includes(court))) return
      }
      scheduleReload()
    })

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleReload()
    }
    window.addEventListener("focus", scheduleReload)
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      unsubscribe()
      window.removeEventListener("focus", scheduleReload)
      document.removeEventListener("visibilitychange", onVisible)
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [loadOccupiedCourts, scheduleReload])

  // Проверка, занят ли корт
  const isCourtOccupied = (courtNumber: number) => {
    return occupiedCourts.includes(courtNumber)
  }

  return (
    <Card className="bg-gradient-to-br from-blue-900 to-blue-950 text-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-white">{t("courtsList.title")}</CardTitle>
          <CardDescription className="text-blue-200">{t("courtsList.description")}</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-blue-800 text-white hover:bg-blue-700 border-blue-700"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="sr-only">{t("courtsList.refresh")}</span>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Array.from({ length: MAX_COURTS }, (_, i) => i + 1).map((courtNumber) => {
              const occupied = isCourtOccupied(courtNumber)
              return (
                <div
                  key={courtNumber}
                  className={`p-3 rounded-lg border ${occupied
                      ? "bg-gradient-to-br from-[#ffeeee] to-[#ffe6e6] border-[#ffd6d6]"
                      : "bg-gradient-to-br from-[#fdfefb] to-[#f7f8f4] border-[#eceee9]"
                    }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-lg font-medium text-blue-900">
                      {t("courtsList.court")} {courtNumber}
                    </div>
                    <Badge
                      variant={(occupied ? "default" : "outline") as any}
                      className={`shadow-md ${occupied ? "bg-green-600" : "bg-blue-700 text-white"}`}
                    >
                      {occupied ? t("courtsList.occupied") : t("courtsList.available")}
                    </Badge>

                    <div className="flex flex-col gap-1 w-full mt-1">
                      <VmixButton
                        matchId=""
                        courtNumber={courtNumber}
                        directLink={true}
                        size="sm"
                        className="w-full text-xs bg-[#f6f9fe] hover:bg-blue-100 text-blue-900 border-blue-200 shadow-md"
                        iconClassName="mr-1"
                      />
                      <VmixButton
                        matchId=""
                        courtNumber={courtNumber}
                        directLink={false}
                        size="sm"
                        className="w-full text-xs bg-[#f6f9fe] hover:bg-blue-100 text-blue-900 border-blue-200 shadow-md"
                        iconClassName="mr-1"
                      />
                      <FullscreenButton
                        courtNumber={courtNumber}
                        size="sm"
                        className="w-full text-xs bg-[#f6f9fe] hover:bg-blue-100 text-blue-900 border-blue-200 shadow-md"
                        iconClassName="mr-1"
                      />
                      <Button
                        variant="outline"
                        onClick={() => window.open(`/api/court/${courtNumber}`, "_blank")}
                        className="w-full text-xs bg-[#f6f9fe] hover:bg-blue-100 text-blue-900 border-blue-200 shadow-md"
                        size="sm"
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        {t("courtsList.jsonData")}
                      </Button>
                      {/* Завершить матч и статическая ссылка */}
                      {occupied && (
                        <>
                          <Button
                            size="sm"
                            className="w-full text-xs bg-red-600 hover:bg-red-700 text-white mt-1"
                            onClick={async () => {
                              // Импортировать здесь, чтобы избежать циклических зависимостей
                              const mod = await import("@/lib/court-utils")
                              const ok = await mod.freeUpCourt(courtNumber)
                              if (!ok) {
                                alert("Не удалось завершить матч — активный матч на корте не найден. Обновите страницу.")
                              }
                              handleRefresh()
                            }}
                          >
                            {t("common.courtStatus.finishMatchButton")}
                          </Button>
                          <a
                            href={`/court-finish/${courtNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full text-xs block text-center underline text-blue-700 mt-1"
                          >
                            {t("common.courtStatus.finishMatchLink")}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
