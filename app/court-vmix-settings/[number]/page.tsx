"use client"

import React, { useState, useEffect } from "react"
import { getMatchByCourtNumber } from "@/lib/court-utils"
import { logEvent } from "@/lib/error-logger"
import { useLanguage } from "@/contexts/language-context"
import { VmixSettingsEditor } from "@/components/vmix-settings-editor"

// Thin wrapper — loads the match by court number and renders the shared
// <VmixSettingsEditor> (Этап D of vmix-scoreboard-unification.md).

export default function CourtVmixSettingsPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = React.use(params)
  const courtNumber = Number.parseInt(number)
  const { t } = useLanguage()
  const [match, setMatch] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 10) {
          setError("Некорректный номер корта")
          return
        }
        const data = await getMatchByCourtNumber(courtNumber)
        if (data) {
          setMatch(data)
          setError("")
          logEvent("info", `vMix настройки загружены для корта: ${courtNumber}`, "court-vmix-settings")
        } else {
          setError(`На корте ${courtNumber} нет активных матчей`)
          logEvent("warn", `vMix настройки: на корте ${courtNumber} нет активных матчей`, "court-vmix-settings")
        }
      } catch (err) {
        setError("Ошибка загрузки матча")
        logEvent("error", "Ошибка загрузки матча для vMix настроек корта", "court-vmix-settings", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [courtNumber])

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
            <p>{t("vmixSettings.loadingSettings")}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !match) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const title = `${t("vmixSettings.matchInfo")}: ${match.teamA.players
    .map((p: any) => p.name)
    .join(" / ")} vs ${match.teamB.players.map((p: any) => p.name).join(" / ")}`

  return <VmixSettingsEditor variant="court" courtNumber={courtNumber} matchTitle={title} />
}
