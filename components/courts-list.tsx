"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, ExternalLink } from "lucide-react"
import { getOccupiedCourts, MAX_COURTS } from "@/lib/court-utils"
import { VmixButton } from "@/components/vmix-button"
import { FullscreenButton } from "@/components/fullscreen-button"
import { logEvent } from "@/lib/error-logger"
import { useLanguage } from "@/contexts/language-context"

export function CourtsList() {
  const { t } = useLanguage()
  const [occupiedCourts, setOccupiedCourts] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Загрузка списка занятых кортов
  const loadOccupiedCourts = async () => {
    try {
      setLoading(true)
      const courts = await getOccupiedCourts()
      setOccupiedCourts(courts)
      logEvent("info", "Список занятых кортов загружен", "courts-list", { courts })
    } catch (error) {
      console.error("Ошибка при загрузке занятых кортов:", error)
      logEvent("error", "Ошибка при загрузке занятых кортов", "courts-list", error)
    } finally {
      setLoading(false)
    }
  }

  // Обновление списка кортов
  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await loadOccupiedCourts()
    } finally {
      setRefreshing(false)
    }
  }

  // Загрузка при монтировании компонента
  useEffect(() => {
    loadOccupiedCourts()
  }, [])

  // Проверка, занят ли корт
  const isCourtOccupied = (courtNumber) => {
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
      className={`p-3 rounded-lg border ${
        occupied
          ? "bg-gradient-to-br from-[#ffeeee] to-[#ffe6e6] border-[#ffd6d6]"
          : "bg-gradient-to-br from-[#fdfefb] to-[#f7f8f4] border-[#eceee9]"
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="text-lg font-medium text-blue-900">
          {t("courtsList.court")} {courtNumber}
        </div>
        <Badge
          variant={occupied ? "success" : "outline"}
          className={`shadow-md ${occupied ? "bg-green-600" : "bg-blue-700 text-white"}`}
        >
          {occupied ? t("courtsList.occupied") : t("courtsList.available")}
        </Badge>

        <div className="flex flex-col gap-1 w-full mt-1">
          <VmixButton
            courtNumber={courtNumber}
            directLink={true}
            size="sm"
            className="w-full text-xs bg-[#f6f9fe] hover:bg-blue-100 text-blue-900 border-blue-200 shadow-md"
            iconClassName="mr-1"
          />
          <VmixButton
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
                  await mod.freeUpCourt(courtNumber)
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
