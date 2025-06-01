"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMatch, subscribeToMatchUpdates } from "@/lib/match-storage"
import { FullScreenScoreboard } from "@/components/full-screen-scoreboard"
import { ScoreboardSettings } from "@/components/scoreboard-settings"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useSoundEffects } from "@/hooks/use-sound-effects"
import { SoundToggle } from "@/components/sound-toggle"
import { useLanguage } from "@/contexts/language-context"

type MatchParams = {
  params: {
    id: string
  }
}

export default function MatchViewPage({ params }: MatchParams) {
  const router = useRouter()
  const { t } = useLanguage()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState("")
  const [isFullScreen, setIsFullScreen] = useState(false)
  const { soundsEnabled, toggleSounds } = useSoundEffects()

  // Состояние для настроек отображения
  const [settings, setSettings] = useState({
    backgroundColor: "#000000",
    textColor: "#ffffff",
    teamAColor: "from-blue-600 to-blue-800",
    teamBColor: "from-red-600 to-red-800",
    teamAColorFrom: "#2563eb", // blue-600
    teamAColorTo: "#1e40af", // blue-800
    teamBColorFrom: "#dc2626", // red-600
    teamBColorTo: "#991b1b", // red-800
    showCourtSides: true,
    showCurrentServer: true,
    showSetsScore: true,
    fontSize: 100,
    playerNamesFontSize: 100,
    gameScoreFontSize: 100,
    setsScoreFontSize: 100,
  })

  // Загрузка настроек из localStorage при монтировании
  useEffect(() => {
    const savedSettings = localStorage.getItem("scoreboardSettings")
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings)
        setSettings({
          ...settings,
          ...parsedSettings,
          // Добавляем новую опцию с дефолтным значением, если она отсутствует
          showSetsScore: parsedSettings.showSetsScore !== undefined ? parsedSettings.showSetsScore : true,
        })
      } catch (e) {
        console.error("Ошибка при загрузке настроек:", e)
      }
    }
  }, [])

  // Сохранение настроек в localStorage при их изменении
  useEffect(() => {
    localStorage.setItem("scoreboardSettings", JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const loadMatch = async () => {
      try {
        if (!params.id) {
          setError("Некорректный ID матча")
          setLoading(false)
          return
        }

        const matchData = await getMatch(params.id)
        if (matchData) {
          setMatch(matchData)
          setError("")
        } else {
          setError("Матч не найден")
        }
      } catch (err) {
        setError("Ошибка загрузки матча")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadMatch()

    // Подписываемся на обновления матча в реальном времени
    const unsubscribe = subscribeToMatchUpdates(params.id, (updatedMatch) => {
      if (updatedMatch) {
        setMatch(updatedMatch)
        setError("")
      } else {
        setError("Матч не найден или был удален")
      }
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [params.id])

  const handleShare = () => {
    const url = window.location.href

    if (navigator.share) {
      navigator.share({
        title: "Счет теннисного матча",
        text: "Следите за счетом матча в реальном времени",
        url,
      })
    } else {
      navigator.clipboard.writeText(url)
      setAlertMessage("Ссылка скопирована в буфер обмена")
      setShowAlert(true)
      setTimeout(() => setShowAlert(false), 2000)
    }
  }

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Ошибка при переходе в полноэкранный режим: ${err.message}`)
      })
      setIsFullScreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullScreen(false)
      }
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-black text-white">Загрузка матча...</div>
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-8 bg-black text-white">
        <Button
          variant="outline"
          className="mb-4 text-white border-gray-700 hover:bg-gray-800 bg-gray-800"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          На главную
        </Button>
        <div className="p-6 text-center border border-gray-700 rounded-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Ошибка</h2>
          <p className="mb-4">{error}</p>
          <Button
            variant="outline"
            className="text-white border-gray-700 hover:bg-gray-800 bg-gray-800"
            onClick={() => router.push("/")}
          >
            Вернуться на главную
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {showAlert && (
        <Alert className="fixed top-4 right-4 w-auto z-50 bg-green-900 border-green-700 text-white">
          <AlertTitle>Уведомление</AlertTitle>
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      )}

      {!isFullScreen && (
        <div className="container max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button
            variant="outline"
            className="text-white border-gray-700 hover:bg-gray-800 bg-gray-800"
            onClick={() => router.push(`/match/${params.id}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("matchPage.backToMatchControl")}
          </Button>
          <div className="flex gap-2">
            <ScoreboardSettings settings={settings} onSettingsChange={setSettings} />
            <SoundToggle enabled={soundsEnabled} onToggle={toggleSounds} />
            <Button
              variant="outline"
              className="text-white border-gray-700 hover:bg-gray-800 bg-gray-800"
              onClick={handleShare}
            >
              <Share2 className="mr-2 h-4 w-4" />
              {t("matchPage.share")}
            </Button>
            <Button
              variant="outline"
              className="text-white border-gray-700 hover:bg-gray-800 bg-gray-800"
              onClick={toggleFullScreen}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("common.fullscreen")}
            </Button>
          </div>
        </div>
      )}

      <FullScreenScoreboard
        match={match}
        isFullScreen={isFullScreen}
        settings={settings}
        onExitFullScreen={() => {
          if (document.exitFullscreen) {
            document.exitFullscreen()
            setIsFullScreen(false)
          }
        }}
      />
    </div>
  )
}
