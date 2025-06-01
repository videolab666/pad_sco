"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Maximize2 } from "lucide-react"

export function AutoFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showButton, setShowButton] = useState(true)

  // Функция для перехода в полноэкранный режим
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
        setShowButton(false)
      }
    } catch (error) {
      console.error("Ошибка при переходе в полноэкранный режим:", error)
    }
  }

  // Обработчик изменения состояния полноэкранного режима
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      if (!document.fullscreenElement) {
        setShowButton(true)
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Автоматически пытаемся войти в полноэкранный режим при загрузке
  useEffect(() => {
    // Небольшая задержка для обеспечения взаимодействия пользователя
    const timer = setTimeout(() => {
      enterFullscreen()
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  if (!showButton) return null

  return (
    <div className="fixed top-2 right-2 z-50">
      <Button variant="secondary" onClick={enterFullscreen} className="bg-black/50 hover:bg-black/70 text-white">
        <Maximize2 className="mr-2 h-4 w-4" />
        На весь экран
      </Button>
    </div>
  )
}
