"use client"

import React, { useState, useEffect } from "react"
import type { Match } from "@/lib/types"
import { getMatch } from "@/lib/match-storage"
import { logEvent } from "@/lib/error-logger"
import { useLanguage } from "@/contexts/language-context"
import { VmixSettingsEditor } from "@/components/vmix-settings-editor"

// Thin wrapper — loads the match by id and renders the shared <VmixSettingsEditor>
// (Этап D of vmix-scoreboard-unification.md). All settings UI lives in the editor.

export default function VmixSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const { t } = useLanguage()
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        if (!id) {
          setError("Некорректный ID матча")
          return
        }
        const data = await getMatch(id)
        if (data) {
          setMatch(data)
          setError("")
          logEvent("info", `vMix настройки загружены для матча: ${id}`, "vmix-settings")
        } else {
          setError("Матч не найден")
          logEvent("error", `vMix настройки: матч не найден: ${id}`, "vmix-settings")
        }
      } catch (err) {
        setError("Ошибка загрузки матча")
        logEvent("error", "Ошибка загрузки матча для vMix настроек", "vmix-settings", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

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

  const title = `${match.teamA.players.map((p) => p.name).join(" / ")} vs ${match.teamB.players
    .map((p) => p.name)
    .join(" / ")}`

  return <VmixSettingsEditor variant="overlay" matchId={id} matchTitle={title} />
}
