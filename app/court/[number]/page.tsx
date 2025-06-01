"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink, Share2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMatchByCourtNumber } from "@/lib/court-utils"
import { FullScreenScoreboard } from "@/components/full-screen-scoreboard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useSoundEffects } from "@/hooks/use-sound-effects"
import { SoundToggle } from "@/components/sound-toggle"
import { subscribeToMatchUpdates } from "@/lib/match-storage"
import { logEvent } from "@/lib/error-logger"

export default function CourtViewPage({ params }) {
  const router = useRouter()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState("")
  const [isFullScreen, setIsFullScreen] = useState(false)
  const { soundsEnabled, toggleSounds } = useSoundEffects()
  const courtNumber = Number.parseInt(params.number)

  useEffect(() => {
    const loadMatch = async () => {
      try {
        if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 10) {
          setError("Некорректный номер корта")
          setLoading(false)
          return
        }

        const matchData = await getMatchByCourtNumber(courtNumber)
        if (matchData) {
          setMatch(matchData)
          setError("")

          // Подписываемся на обновления матча
          const unsubscribe = subscribeToMatchUpdates(matchData.id, (updatedMatch) => {
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
        } else {
          setError(`На корте ${courtNumber} нет активных матчей`)
        }
      } catch (err) {
        setError("Ошибка загрузки матча")
        console.error(err)
        logEvent("error", `Ошибка загрузки матча для корта ${courtNumber}`, "CourtViewPage", err)
      } finally {
        setLoading(false)
      }
    }

    loadMatch()
  }, [courtNumber])

  const handleShare = () => {
    const url = window.location.href

    if (navigator.share) {
      navigator.share({
        title: `Счет матча на корте ${courtNumber}`,
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
          <div>
            <Button
              variant="outline"
              className="text-white border-gray-700 hover:bg-gray-800 bg-gray-800"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              На главную
            </Button>
            <span className="ml-4 text-xl font-bold">Корт {courtNumber}</span>
          </div>
          <div className="flex gap-2">
            <SoundToggle enabled={soundsEnabled} onToggle={toggleSounds} />
            <Button
              variant="outline"
              className="text-white border-gray-700 hover:bg-gray-800 bg-gray-800"
              onClick={handleShare}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Поделиться
            </Button>
            <Button
              variant="outline"
              className="text-white border-gray-700 hover:bg-gray-800 bg-gray-800"
              onClick={toggleFullScreen}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {isFullScreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
            </Button>
            <Button
              onClick={() => window.open(`/court-vmix/${courtNumber}`, "_blank")}
              variant="outline"
              className="text-white border-gray-700 hover:bg-gray-800 bg-gray-800"
            >
              vMix корт
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-2 text-white border-gray-700 hover:bg-gray-800 bg-gray-800"
              onClick={() => router.push(`/court-vmix-settings/${params.number}`)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Настройки vMix
            </Button>
          </div>
        </div>
      )}

      <FullScreenScoreboard
        match={match}
        isFullScreen={isFullScreen}
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
