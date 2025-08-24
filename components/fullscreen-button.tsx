"use client"

import { Button } from "@/components/ui/button"
import { Maximize2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { getDefaultVmixSettings } from "@/lib/vmix-settings-storage"

interface FullscreenButtonProps {
  courtNumber: number | null
  matchId?: string
  className?: string
  size?: "default" | "sm" | "lg"
  iconClassName?: string
}

// Функция для загрузки настроек из localStorage
const loadVmixSettings = () => {
  if (typeof window === "undefined") return null

  try {
    const savedSettings = localStorage.getItem("vmix_settings")
    if (savedSettings) {
      return JSON.parse(savedSettings)
    }
  } catch (error) {
    console.error("Ошибка при загрузке настроек vMix:", error)
  }
  return null
}

// Функция для форматирования цвета в URL
const formatColorForUrl = (color) => {
  if (!color) return ""
  return color.replace("#", "")
}

// Функция для генерации URL с настройками
const generateFullscreenUrl = (courtNumber, settings) => {
  const baseUrl = window.location.origin
  const url = new URL(`${baseUrl}/fullscreen-scoreboard/${courtNumber}`)

  if (!settings) return url.toString()

  // Добавляем основные параметры
  url.searchParams.set("theme", settings.theme || "custom")
  url.searchParams.set("showNames", (settings.showNames !== undefined ? settings.showNames : true).toString())
  url.searchParams.set("showPoints", (settings.showPoints !== undefined ? settings.showPoints : true).toString())
  url.searchParams.set("showSets", (settings.showSets !== undefined ? settings.showSets : true).toString())
  url.searchParams.set("showServer", (settings.showServer !== undefined ? settings.showServer : true).toString())
  url.searchParams.set("showCountry", (settings.showCountry !== undefined ? settings.showCountry : true).toString())
  url.searchParams.set("fontSize", settings.fontSize || "normal")
  url.searchParams.set("bgOpacity", (settings.bgOpacity !== undefined ? settings.bgOpacity : 0.5).toString())
  url.searchParams.set("textColor", formatColorForUrl(settings.textColor || "#ffffff"))
  url.searchParams.set("accentColor", formatColorForUrl(settings.accentColor || "#fbbf24"))
  url.searchParams.set(
    "playerNamesFontSize",
    (settings.playerNamesFontSize !== undefined ? settings.playerNamesFontSize : 1.2).toString(),
  )

  // Добавляем параметры цветов и градиентов (только если тема не прозрачная)
  if (settings.theme !== "transparent") {
    url.searchParams.set("namesBgColor", formatColorForUrl(settings.namesBgColor || "#0369a1"))
    url.searchParams.set("countryBgColor", formatColorForUrl(settings.countryBgColor || "#0369a1"))
    url.searchParams.set("serveBgColor", formatColorForUrl(settings.serveBgColor || "#000000"))
    url.searchParams.set("pointsBgColor", formatColorForUrl(settings.pointsBgColor || "#0369a1"))
    url.searchParams.set("setsBgColor", formatColorForUrl(settings.setsBgColor || "#ffffff"))
    url.searchParams.set("setsTextColor", formatColorForUrl(settings.setsTextColor || "#000000"))

    // Явно передаем строковые значения "true" или "false" для булевых параметров
    url.searchParams.set(
      "namesGradient",
      (settings.namesGradient !== undefined ? settings.namesGradient : true) ? "true" : "false",
    )
    url.searchParams.set("namesGradientFrom", formatColorForUrl(settings.namesGradientFrom || "#0369a1"))
    url.searchParams.set("namesGradientTo", formatColorForUrl(settings.namesGradientTo || "#0284c7"))
    url.searchParams.set(
      "countryGradient",
      (settings.countryGradient !== undefined ? settings.countryGradient : true) ? "true" : "false",
    )
    url.searchParams.set("countryGradientFrom", formatColorForUrl(settings.countryGradientFrom || "#0369a1"))
    url.searchParams.set("countryGradientTo", formatColorForUrl(settings.countryGradientTo || "#0284c7"))
    url.searchParams.set(
      "serveGradient",
      (settings.serveGradient !== undefined ? settings.serveGradient : true) ? "true" : "false",
    )
    url.searchParams.set("serveGradientFrom", formatColorForUrl(settings.serveGradientFrom || "#0369a1"))
    url.searchParams.set("serveGradientTo", formatColorForUrl(settings.serveGradientTo || "#0284c7"))
    url.searchParams.set(
      "pointsGradient",
      (settings.pointsGradient !== undefined ? settings.pointsGradient : true) ? "true" : "false",
    )
    url.searchParams.set("pointsGradientFrom", formatColorForUrl(settings.pointsGradientFrom || "#0369a1"))
    url.searchParams.set("pointsGradientTo", formatColorForUrl(settings.pointsGradientTo || "#0284c7"))
    url.searchParams.set(
      "setsGradient",
      (settings.setsGradient !== undefined ? settings.setsGradient : true) ? "true" : "false",
    )
    url.searchParams.set("setsGradientFrom", formatColorForUrl(settings.setsGradientFrom || "#ffffff"))
    url.searchParams.set("setsGradientTo", formatColorForUrl(settings.setsGradientTo || "#f0f0f0"))

    // Добавляем параметры для индикатора
    url.searchParams.set("indicatorBgColor", formatColorForUrl(settings.indicatorBgColor || "#7c2d12"))
    url.searchParams.set("indicatorTextColor", formatColorForUrl(settings.indicatorTextColor || "#ffffff"))
    url.searchParams.set(
      "indicatorGradient",
      (settings.indicatorGradient !== undefined ? settings.indicatorGradient : true) ? "true" : "false",
    )
    url.searchParams.set("indicatorGradientFrom", formatColorForUrl(settings.indicatorGradientFrom || "#7c2d12"))
    url.searchParams.set("indicatorGradientTo", formatColorForUrl(settings.indicatorGradientTo || "#991b1b"))
  }

  return url.toString()
}

export function FullscreenButton({
  courtNumber,
  matchId,
  size = "default",
  className = "",
  iconClassName = "",
}: {
  courtNumber?: number
  matchId?: string
  size?: "default" | "sm" | "lg"
  className?: string
  iconClassName?: string
}) {
  const router = useRouter()
  const { t } = useLanguage()

  // Изменяем функцию handleClick, чтобы она переходила в текущем окне вместо открытия нового
  const handleClick = () => {
    if (!courtNumber) return

    // Загружаем настройки из localStorage
    let settings = loadVmixSettings()

    // Если настройки не найдены, создаем настройки по умолчанию
    if (!settings) {
      settings = {
        theme: "custom",
        showNames: true,
        showPoints: true,
        showSets: true,
        showServer: true,
        showCountry: true,
        fontSize: "normal",
        bgOpacity: 0.5,
        textColor: "#ffffff",
        accentColor: "#fbbf24",
        playerNamesFontSize: 1.2,
        namesBgColor: "#0369a1",
        countryBgColor: "#0369a1",
        serveBgColor: "#000000",
        pointsBgColor: "#0369a1",
        setsBgColor: "#ffffff",
        setsTextColor: "#000000",
        namesGradient: true,
        namesGradientFrom: "#0369a1",
        namesGradientTo: "#0284c7",
        countryGradient: true,
        countryGradientFrom: "#0369a1",
        countryGradientTo: "#0284c7",
        serveGradient: true,
        serveGradientFrom: "#0369a1",
        serveGradientTo: "#0284c7",
        pointsGradient: true,
        pointsGradientFrom: "#0369a1",
        pointsGradientTo: "#0284c7",
        setsGradient: true,
        setsGradientFrom: "#ffffff",
        setsGradientTo: "#f0f0f0",
        indicatorBgColor: "#7c2d12",
        indicatorTextColor: "#ffffff",
        indicatorGradient: true,
        indicatorGradientFrom: "#7c2d12",
        indicatorGradientTo: "#991b1b",
      }
    }

    // Генерируем URL с настройками
    const url = generateFullscreenUrl(courtNumber, settings)

    // Переходим в текущем окне вместо открытия нового
    router.push(url)
  }

  // Изменяем функцию handleShortUrlClick, чтобы использовать короткий URL "sb" и открывать страницу в новом окне

  const handleShortUrlClick = async () => {
    if (!courtNumber) return

    try {
      // Получаем настройки по умолчанию из базы данных
      const defaultSettings = await getDefaultVmixSettings()

      // Если настройки найдены, сохраняем их в localStorage для использования на странице полного экрана
      if (defaultSettings && defaultSettings.settings) {
        localStorage.setItem("vmix_settings", JSON.stringify(defaultSettings.settings))
      }

      // Используем короткий URL "sb" вместо "fullscreen-scoreboard"
      // Добавляем параметр autoFullscreen=true для автоматического перехода в полноэкранный режим
      const url = `/sb/${courtNumber}?autoFullscreen=true`

      // Открываем в новом окне
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (error) {
      console.error("Ошибка при получении настроек из базы данных:", error)
      // В случае ошибки, все равно открываем страницу
      window.open(`/sb/${courtNumber}?autoFullscreen=true`, "_blank", "noopener,noreferrer")
    }
  }

  if (!courtNumber) return null

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size={size} className={`whitespace-normal ${className}`} onClick={handleClick}>
        <Maximize2 className={`h-4 w-4 ${iconClassName}`} />
        {t("common.fullscreen")}
      </Button>
      <Button variant="outline" size={size} className={`whitespace-normal ${className}`} onClick={handleShortUrlClick}>
        <Maximize2 className={`h-4 w-4 ${iconClassName}`} />
        Табло
      </Button>
    </div>
  )
}
