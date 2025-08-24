"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import React from "react"
import type { Match } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getMatch } from "@/lib/match-storage"
import { logEvent } from "@/lib/error-logger"
// Добавим импорт для иконки сохранения
import { ArrowLeft, Copy, ExternalLink, Eye, Save, ArrowRight } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { useLanguage } from "@/contexts/language-context"

interface VmixSettingsPageProps {
  params: {
    id: string
  }
}

export default function VmixSettingsPage({ params }: VmixSettingsPageProps) {
  const id = React.use(params.id)
  const router = useRouter()
  const { t } = useLanguage()
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copying, setCopying] = useState(false)

  // Настройки отображения
  const [theme, setTheme] = useState("custom")
  const [showNames, setShowNames] = useState(true)
  const [showPoints, setShowPoints] = useState(true)
  const [showSets, setShowSets] = useState(true)
  const [showServer, setShowServer] = useState(true)
  const [showCountry, setShowCountry] = useState(true)
  const [fontSize, setFontSize] = useState("normal")
  const [bgOpacity, setBgOpacity] = useState(0.5)
  const [textColor, setTextColor] = useState("#ffffff")
  const [accentColor, setAccentColor] = useState("#fbbf24")

  // Настройки размера шрифта имен игроков
  const [playerNamesFontSize, setPlayerNamesFontSize] = useState(1.2)

  // Настройки цветов и градиентов
  const [namesBgColor, setNamesBgColor] = useState("#0369a1")
  const [countryBgColor, setCountryBgColor] = useState("#0369a1")
  const [serveBgColor, setServeBgColor] = useState("#000000")
  const [pointsBgColor, setPointsBgColor] = useState("#0369a1")
  const [setsBgColor, setSetsBgColor] = useState("#ffffff")
  const [setsTextColor, setSetsTextColor] = useState("#000000")
  const [namesGradient, setNamesGradient] = useState(true)
  const [namesGradientFrom, setNamesGradientFrom] = useState("#0369a1")
  const [namesGradientTo, setNamesGradientTo] = useState("#0284c7")
  const [countryGradient, setCountryGradient] = useState(true)
  const [countryGradientFrom, setCountryGradientFrom] = useState("#0369a1")
  const [countryGradientTo, setCountryGradientTo] = useState("#0284c7")
  const [serveGradient, setServeGradient] = useState(true)
  const [serveGradientFrom, setServeGradientFrom] = useState("#0369a1")
  const [serveGradientTo, setServeGradientTo] = useState("#0284c7")
  const [pointsGradient, setPointsGradient] = useState(true)

  const [pointsGradientFrom, setPointsGradientFrom] = useState("#0369a1")
  const [pointsGradientTo, setPointsGradientTo] = useState("#0284c7")
  const [setsGradient, setSetsGradient] = useState(true)
  const [setsGradientFrom, setSetsGradientFrom] = useState("#ffffff")
  const [setsGradientTo, setSetsGradientTo] = useState("#f0f0f0")

  // Настройки для индикатора важных моментов
  const [indicatorBgColor, setIndicatorBgColor] = useState("#7c2d12")
  const [indicatorTextColor, setIndicatorTextColor] = useState("#ffffff")
  const [indicatorGradient, setIndicatorGradient] = useState(true)
  const [indicatorGradientFrom, setIndicatorGradientFrom] = useState("#7c2d12")
  const [indicatorGradientTo, setIndicatorGradientTo] = useState("#991b1b")

  // Добавим функцию сохранения настроек и загрузки сохраненных настроек
  // Добавьте эти функции после объявления всех состояний (useState) и перед useEffect

  // Функция для сохранения настроек в localStorage
  const saveSettings = () => {
    try {
      const settings = {
        theme,
        showNames,
        showPoints,
        showSets,
        showServer,
        showCountry,
        fontSize,
        bgOpacity,
        textColor,
        accentColor,
        namesBgColor,
        countryBgColor,
        serveBgColor,
        pointsBgColor,
        setsBgColor,
        setsTextColor,
        namesGradient,
        namesGradientFrom,
        namesGradientTo,
        countryGradient,
        countryGradientFrom,
        countryGradientTo,
        serveGradient,
        serveGradientFrom,
        serveGradientTo,
        pointsGradient,
        pointsGradientFrom,
        pointsGradientTo,
        setsGradient,
        setsGradientFrom,
        setsGradientTo,
        // Добавляем настройки индикатора
        indicatorBgColor,
        indicatorTextColor,
        indicatorGradient,
        indicatorGradientFrom,
        indicatorGradientTo,
        // Добавляем размер шрифта имен игроков
        playerNamesFontSize,
      }

      localStorage.setItem("vmix_settings", JSON.stringify(settings))
      toast({
        title: t("vmixSettings.settingsSaved"),
        description: t("common.success"),
      })
      logEvent("info", "Настройки vMix сохранены", "vmix-settings-save")
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("vmixSettings.errorSavingSettings"),
        variant: "destructive",
      })
      logEvent("error", "Ошибка при сохранении настроек vMix", "vmix-settings-save", error)
    }
  }

  // Функция для загрузки сохраненных настроек
  const loadSavedSettings = () => {
    try {
      const savedSettings = localStorage.getItem("vmix_settings")
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)

        // Применяем сохраненные настройки
        setTheme(settings.theme || "custom")
        setShowNames(settings.showNames !== undefined ? settings.showNames : true)
        setShowPoints(settings.showPoints !== undefined ? settings.showPoints : true)
        setShowSets(settings.showSets !== undefined ? settings.showSets : true)
        setShowServer(settings.showServer !== undefined ? settings.showServer : true)
        setShowCountry(settings.showCountry !== undefined ? settings.showCountry : true)
        setFontSize(settings.fontSize || "normal")
        setBgOpacity(settings.bgOpacity !== undefined ? settings.bgOpacity : 0.5)
        setTextColor(settings.textColor || "#ffffff")
        setAccentColor(settings.accentColor || "#fbbf24")

        setNamesBgColor(settings.namesBgColor || "#0369a1")
        setCountryBgColor(settings.countryBgColor || "#0369a1")
        setServeBgColor(settings.serveBgColor || "#000000")
        setPointsBgColor(settings.pointsBgColor || "#0369a1")
        setSetsBgColor(settings.setsBgColor || "#ffffff")
        setSetsTextColor(settings.setsTextColor || "#000000")

        // Загружаем настройки градиентов
        setNamesGradient(settings.namesGradient !== undefined ? settings.namesGradient : true)
        setNamesGradientFrom(settings.namesGradientFrom || "#0369a1")
        setNamesGradientTo(settings.namesGradientTo || "#0284c7")

        setCountryGradient(settings.countryGradient !== undefined ? settings.countryGradient : true)
        setCountryGradientFrom(settings.countryGradientFrom || "#0369a1")
        setCountryGradientTo(settings.countryGradientTo || "#0284c7")

        setServeGradient(settings.serveGradient !== undefined ? settings.serveGradient : true)
        setServeGradientFrom(settings.serveGradientFrom || "#0369a1")
        setServeGradientTo(settings.serveGradientTo || "#0284c7")

        setPointsGradient(settings.pointsGradient !== undefined ? settings.pointsGradient : true)

        setPointsGradientFrom(settings.pointsGradientFrom || "#0369a1")
        setPointsGradientTo(settings.pointsGradientTo || "#0284c7")

        setSetsGradient(settings.setsGradient !== undefined ? settings.setsGradient : true)
        setSetsGradientFrom(settings.setsGradientFrom || "#ffffff")
        setSetsGradientTo(settings.setsGradientTo || "#f0f0f0")

        // Загружаем настройки индикатора
        setIndicatorBgColor(settings.indicatorBgColor || "#7c2d12")
        setIndicatorTextColor(settings.indicatorTextColor || "#ffffff")
        setIndicatorGradient(settings.indicatorGradient !== undefined ? settings.indicatorGradient : true)
        setIndicatorGradientFrom(settings.indicatorGradientFrom || "#7c2d12")
        setIndicatorGradientTo(settings.indicatorGradientTo || "#991b1b")

        // Загружаем размер шрифта имен игроков
        setPlayerNamesFontSize(settings.playerNamesFontSize !== undefined ? settings.playerNamesFontSize : 1.2)

        logEvent("info", "Загружены сохраненные настройки vMix", "vmix-settings-load")
      }
    } catch (error) {
      logEvent("error", "Ошибка при загрузке сохраненных настроек vMix", "vmix-settings-load", error)
    }
  }

  // Модифицируем существующий useEffect для загрузки сохраненных настроек
  // Найдите существующий useEffect, который загружает матч, и добавьте вызов loadSavedSettings() в конце

  useEffect(() => {
    const loadMatch = async () => {
      try {
        if (!id) {
          setError("Некорректный ID матча")
          setLoading(false)
          return
        }

        const matchData = await getMatch(id)
        if (matchData) {
          setMatch(matchData)
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

    loadMatch()
    // Загружаем сохраненные настройки после загрузки матча
    loadSavedSettings()
  }, [id])

  const handleBack = () => {
    router.back()
  }

  // Функция для корректной передачи цветов в URL
  const formatColorForUrl = (color: string) => {
    // Удаляем # из цвета для URL
    return color.replace("#", "")
  }

  const generateVmixUrl = () => {
    const baseUrl = window.location.origin
    const url = new URL(`${baseUrl}/vmix/${id}`)

    // Добавляем основные параметры
    url.searchParams.set("theme", theme)
    url.searchParams.set("showNames", showNames.toString())
    url.searchParams.set("showPoints", showPoints.toString())
    url.searchParams.set("showSets", showSets.toString())
    url.searchParams.set("showServer", showServer.toString())
    url.searchParams.set("showCountry", showCountry.toString())
    url.searchParams.set("fontSize", fontSize)
    url.searchParams.set("bgOpacity", bgOpacity.toString())
    url.searchParams.set("textColor", formatColorForUrl(textColor))
    url.searchParams.set("accentColor", formatColorForUrl(accentColor))
    url.searchParams.set("playerNamesFontSize", playerNamesFontSize.toString())

    // Добавляем параметры цветов и градиентов (только если тема не прозрачная)
    if (theme !== "transparent") {
      url.searchParams.set("namesBgColor", formatColorForUrl(namesBgColor))
      url.searchParams.set("countryBgColor", formatColorForUrl(countryBgColor))
      url.searchParams.set("serveBgColor", formatColorForUrl(serveBgColor))
      url.searchParams.set("pointsBgColor", formatColorForUrl(pointsBgColor))
      url.searchParams.set("setsBgColor", formatColorForUrl(setsBgColor))
      url.searchParams.set("setsTextColor", formatColorForUrl(setsTextColor))

      // Явно передаем строковые значения "true" или "false" для булевых параметров
      url.searchParams.set("namesGradient", namesGradient ? "true" : "false")
      url.searchParams.set("namesGradientFrom", formatColorForUrl(namesGradientFrom))
      url.searchParams.set("namesGradientTo", formatColorForUrl(namesGradientTo))
      url.searchParams.set("countryGradient", countryGradient ? "true" : "false")
      url.searchParams.set("countryGradientFrom", formatColorForUrl(countryGradientFrom))
      url.searchParams.set("countryGradientTo", formatColorForUrl(countryGradientTo))
      url.searchParams.set("serveGradient", serveGradient ? "true" : "false")
      url.searchParams.set("serveGradientFrom", formatColorForUrl(serveGradientFrom))
      url.searchParams.set("serveGradientTo", formatColorForUrl(serveGradientTo))
      url.searchParams.set("pointsGradient", pointsGradient ? "true" : "false")
      url.searchParams.set("pointsGradientFrom", formatColorForUrl(pointsGradientFrom))
      url.searchParams.set("pointsGradientTo", formatColorForUrl(pointsGradientTo))
      url.searchParams.set("setsGradient", setsGradient ? "true" : "false")
      url.searchParams.set("setsGradientFrom", formatColorForUrl(setsGradientFrom))
      url.searchParams.set("setsGradientTo", formatColorForUrl(setsGradientTo))

      // Добавляем параметры для индикатора
      url.searchParams.set("indicatorBgColor", formatColorForUrl(indicatorBgColor))
      url.searchParams.set("indicatorTextColor", formatColorForUrl(indicatorTextColor))
      url.searchParams.set("indicatorGradient", indicatorGradient ? "true" : "false")
      url.searchParams.set("indicatorGradientFrom", formatColorForUrl(indicatorGradientFrom))
      url.searchParams.set("indicatorGradientTo", formatColorForUrl(indicatorGradientTo))
    }

    return url.toString()
  }

  // Добавим функцию для генерации URL для страницы корта
  // Добавьте эту функцию после функции generateVmixUrl()

  const generateCourtVmixUrl = () => {
    // Получаем номер корта из матча
    const courtNumber = match?.courtNumber || 1

    const baseUrl = window.location.origin
    const url = new URL(`${baseUrl}/court-vmix/${courtNumber}`)

    // Добавляем основные параметры
    url.searchParams.set("theme", theme)
    url.searchParams.set("showNames", showNames.toString())
    url.searchParams.set("showPoints", showPoints.toString())
    url.searchParams.set("showSets", showSets.toString())
    url.searchParams.set("showServer", showServer.toString())
    url.searchParams.set("showCountry", showCountry.toString())
    url.searchParams.set("fontSize", fontSize)
    url.searchParams.set("bgOpacity", bgOpacity.toString())
    url.searchParams.set("textColor", formatColorForUrl(textColor))
    url.searchParams.set("accentColor", formatColorForUrl(accentColor))
    url.searchParams.set("playerNamesFontSize", playerNamesFontSize.toString())

    // Добавляем параметры цветов и градиентов (только если тема не прозрачная)
    if (theme !== "transparent") {
      url.searchParams.set("namesBgColor", formatColorForUrl(namesBgColor))
      url.searchParams.set("countryBgColor", formatColorForUrl(countryBgColor))
      url.searchParams.set("serveBgColor", formatColorForUrl(serveBgColor))
      url.searchParams.set("pointsBgColor", formatColorForUrl(pointsBgColor))
      url.searchParams.set("setsBgColor", formatColorForUrl(setsBgColor))
      url.searchParams.set("setsTextColor", formatColorForUrl(setsTextColor))

      // Явно передаем строковые значения "true" или "false" для булевых параметров
      url.searchParams.set("namesGradient", namesGradient ? "true" : "false")
      url.searchParams.set("namesGradientFrom", formatColorForUrl(namesGradientFrom))
      url.searchParams.set("namesGradientTo", formatColorForUrl(namesGradientTo))
      url.searchParams.set("countryGradient", countryGradient ? "true" : "false")
      url.searchParams.set("countryGradientFrom", formatColorForUrl(countryGradientFrom))
      url.searchParams.set("countryGradientTo", formatColorForUrl(countryGradientTo))
      url.searchParams.set("serveGradient", serveGradient ? "true" : "false")
      url.searchParams.set("serveGradientFrom", formatColorForUrl(serveGradientFrom))
      url.searchParams.set("serveGradientTo", formatColorForUrl(serveGradientTo))
      url.searchParams.set("pointsGradient", pointsGradient ? "true" : "false")
      url.searchParams.set("pointsGradientFrom", formatColorForUrl(pointsGradientFrom))
      url.searchParams.set("pointsGradientTo", formatColorForUrl(pointsGradientTo))
      url.searchParams.set("setsGradient", setsGradient ? "true" : "false")
      url.searchParams.set("setsGradientFrom", formatColorForUrl(setsGradientFrom))
      url.searchParams.set("setsGradientTo", formatColorForUrl(setsGradientTo))

      // Добавляем параметры для индикатора
      url.searchParams.set("indicatorBgColor", formatColorForUrl(indicatorBgColor))
      url.searchParams.set("indicatorTextColor", formatColorForUrl(indicatorTextColor))
      url.searchParams.set("indicatorGradient", indicatorGradient ? "true" : "false")
      url.searchParams.set("indicatorGradientFrom", formatColorForUrl(indicatorGradientFrom))
      url.searchParams.set("indicatorGradientTo", formatColorForUrl(indicatorGradientTo))
    }

    return url.toString()
  }

  // Добавим функции для работы с URL корта
  const handleCopyCourtUrl = async () => {
    try {
      setCopying(true)
      await navigator.clipboard.writeText(generateCourtVmixUrl())
      toast({
        title: t("vmixSettings.urlCopied"),
        description: t("vmixSettings.courtUrlCopied"),
      })
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("vmixSettings.failedToCopyUrl"),
        variant: "destructive",
      })
    } finally {
      setCopying(false)
    }
  }

  const handleOpenCourtVmix = () => {
    window.open(generateCourtVmixUrl(), "_blank")
  }

  const handleOpenCourtVmixInCurrentWindow = () => {
    router.push(generateCourtVmixUrl())
  }

  const generateJsonUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/api/vmix/${id}`
  }

  const handleCopyUrl = async () => {
    try {
      setCopying(true)
      await navigator.clipboard.writeText(generateVmixUrl())
      toast({
        title: t("vmixSettings.urlCopied"),
        description: t("vmixSettings.vmixUrlCopied"),
      })
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("vmixSettings.failedToCopyUrl"),
        variant: "destructive",
      })
    } finally {
      setCopying(false)
    }
  }

  const handleCopyJsonUrl = async () => {
    try {
      setCopying(true)
      await navigator.clipboard.writeText(generateJsonUrl())
      toast({
        title: t("vmixSettings.urlCopied"),
        description: t("vmixSettings.jsonApiUrlCopied"),
      })
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("vmixSettings.failedToCopyUrl"),
        variant: "destructive",
      })
    } finally {
      setCopying(false)
    }
  }

  const handleOpenVmix = () => {
    window.open(generateVmixUrl(), "_blank")
  }

  // Добавим новую функцию-обработчик после функции handleOpenVmix
  const handleOpenVmixInCurrentWindow = () => {
    router.push(generateVmixUrl())
  }

  const handlePreview = () => {
    const previewUrl = generateVmixUrl()
    window.open(previewUrl, "vmix_preview", "width=800,height=400")
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>{t("vmixSettings.loadingSettings")}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("common.back")}
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <Button onClick={handleBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("vmixSettings.backToMatch")}
      </Button>

      <h1 className="text-2xl font-bold mb-4">{t("vmixSettings.title")}</h1>

      {match && (
        <div className="mb-4">
          <p className="font-medium">
            {match.teamA.players.map((p) => p.name).join(" / ")} vs {match.teamB.players.map((p) => p.name).join(" / ")}
          </p>
        </div>
      )}

      <Tabs defaultValue="settings">
        <TabsList className="mb-4">
          <TabsTrigger value="settings">{t("vmixSettings.displaySettings")}</TabsTrigger>
          <TabsTrigger value="api">{t("vmixSettings.apiForVmix")}</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Левая колонка - основные настройки */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("vmixSettings.basicSettings")}</CardTitle>
                  <CardDescription>{t("vmixSettings.configureBasicParams")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">{t("vmixSettings.theme")}</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger id="theme">
                        <SelectValue placeholder={t("vmixSettings.selectTheme")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">{t("vmixSettings.customTheme")}</SelectItem>
                        <SelectItem value="transparent">{t("vmixSettings.transparentTheme")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fontSize">{t("vmixSettings.fontSize")}</Label>
                    <Select value={fontSize} onValueChange={setFontSize}>
                      <SelectTrigger id="fontSize">
                        <SelectValue placeholder={t("vmixSettings.selectFontSize")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">{t("vmixSettings.small")}</SelectItem>
                        <SelectItem value="normal">{t("vmixSettings.normal")}</SelectItem>
                        <SelectItem value="large">{t("vmixSettings.large")}</SelectItem>
                        <SelectItem value="xlarge">{t("vmixSettings.extraLarge")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="playerNamesFontSize">
                      {t("vmixSettings.playerNamesFontSize")}: {playerNamesFontSize}em
                    </Label>
                    <Slider
                      id="playerNamesFontSize"
                      min={0.6}
                      max={2.0}
                      step={0.1}
                      value={[playerNamesFontSize]}
                      onValueChange={(value) => setPlayerNamesFontSize(value[0])}
                    />
                  </div>

                  {theme !== "transparent" && (
                    <div className="space-y-2">
                      <Label htmlFor="bgOpacity">
                        {t("vmixSettings.backgroundOpacity")}: {Math.round(bgOpacity * 100)}%
                      </Label>
                      <Slider
                        id="bgOpacity"
                        min={0}
                        max={1}
                        step={0.05}
                        value={[bgOpacity]}
                        onValueChange={(value) => setBgOpacity(value[0])}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="textColor">{t("vmixSettings.textColor")}</Label>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: textColor }}></div>
                      <Input
                        id="textColor"
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-12 p-1 h-8"
                      />
                      <Input
                        type="text"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accentColor">{t("vmixSettings.accentColor")}</Label>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: accentColor }}></div>
                      <Input
                        id="accentColor"
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-12 p-1 h-8"
                      />
                      <Input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="showNames">{t("vmixSettings.showPlayerNames")}</Label>
                      <Switch
                        id="showNames"
                        checked={showNames}
                        onCheckedChange={setShowNames}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="showPoints">{t("vmixSettings.showCurrentPoints")}</Label>
                      <Switch
                        id="showPoints"
                        checked={showPoints}
                        onCheckedChange={setShowPoints}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="showSets">{t("vmixSettings.showSetScore")}</Label>
                      <Switch
                        id="showSets"
                        checked={showSets}
                        onCheckedChange={setShowSets}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="showServer">{t("vmixSettings.showServingPlayer")}</Label>
                      <Switch
                        id="showServer"
                        checked={showServer}
                        onCheckedChange={setShowServer}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="showCountry">{t("vmixSettings.showCountries")}</Label>
                      <Switch
                        id="showCountry"
                        checked={showCountry}
                        onCheckedChange={setShowCountry}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Правая колонка - настройки цветов и градиентов */}
            <div className="space-y-6">
              {theme !== "transparent" && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("vmixSettings.colorsAndGradients")}</CardTitle>
                    <CardDescription>{t("vmixSettings.configureColorsAndGradients")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Имена игроков */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("vmixSettings.playerNameBlock")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="namesBgColor">{t("vmixSettings.playerNameBgColor")}</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: namesBgColor }}></div>
                          <Input
                            id="namesBgColor"
                            type="color"
                            value={namesBgColor}
                            onChange={(e) => setNamesBgColor(e.target.value)}
                            className="w-12 p-1 h-8"
                          />
                          <Input
                            type="text"
                            value={namesBgColor}
                            onChange={(e) => setNamesBgColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="namesGradient">{t("vmixSettings.useGradientForNames")}</Label>
                        <Switch
                          id="namesGradient"
                          checked={namesGradient}
                          onCheckedChange={setNamesGradient}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                        />
                      </div>

                      {namesGradient && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="namesGradientFrom">{t("vmixSettings.nameGradientStartColor")}</Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: namesGradientFrom }}
                              ></div>
                              <Input
                                id="namesGradientFrom"
                                type="color"
                                value={namesGradientFrom}
                                onChange={(e) => setNamesGradientFrom(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={namesGradientFrom}
                                onChange={(e) => setNamesGradientFrom(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="namesGradientTo">{t("vmixSettings.nameGradientEndColor")}</Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: namesGradientTo }}
                              ></div>
                              <Input
                                id="namesGradientTo"
                                type="color"
                                value={namesGradientTo}
                                onChange={(e) => setNamesGradientTo(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={namesGradientTo}
                                onChange={(e) => setNamesGradientTo(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div
                            className="h-8 rounded"
                            style={{
                              background: `linear-gradient(to bottom, ${namesGradientFrom}, ${namesGradientTo})`,
                            }}
                          ></div>
                        </>
                      )}
                    </div>

                    {/* Страны игроков */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("vmixSettings.playerCountryBlock")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="countryBgColor">{t("vmixSettings.playerCountryBgColor")}</Label>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-6 h-6 rounded-full border"
                            style={{ backgroundColor: countryBgColor }}
                          ></div>
                          <Input
                            id="countryBgColor"
                            type="color"
                            value={countryBgColor}
                            onChange={(e) => setCountryBgColor(e.target.value)}
                            className="w-12 p-1 h-8"
                          />
                          <Input
                            type="text"
                            value={countryBgColor}
                            onChange={(e) => setCountryBgColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="countryGradient">{t("vmixSettings.useGradientForCountries")}</Label>
                        <Switch
                          id="countryGradient"
                          checked={countryGradient}
                          onCheckedChange={setCountryGradient}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                        />
                      </div>

                      {countryGradient && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="countryGradientFrom">{t("vmixSettings.countryGradientStartColor")}</Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: countryGradientFrom }}
                              ></div>
                              <Input
                                id="countryGradientFrom"
                                type="color"
                                value={countryGradientFrom}
                                onChange={(e) => setCountryGradientFrom(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={countryGradientFrom}
                                onChange={(e) => setCountryGradientFrom(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="countryGradientTo">{t("vmixSettings.countryGradientEndColor")}</Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: countryGradientTo }}
                              ></div>
                              <Input
                                id="countryGradientTo"
                                type="color"
                                value={countryGradientTo}
                                onChange={(e) => setCountryGradientTo(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={countryGradientTo}
                                onChange={(e) => setCountryGradientTo(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div
                            className="h-8 rounded"
                            style={{
                              background: `linear-gradient(to bottom, ${countryGradientFrom}, ${countryGradientTo})`,
                            }}
                          ></div>
                        </>
                      )}
                    </div>

                    {/* Индикатор подачи */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("vmixSettings.servingIndicatorBlock")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="serveBgColor">{t("vmixSettings.servingIndicatorBgColor")}</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: serveBgColor }}></div>
                          <Input
                            id="serveBgColor"
                            type="color"
                            value={serveBgColor}
                            onChange={(e) => setServeBgColor(e.target.value)}
                            className="w-12 p-1 h-8"
                          />
                          <Input
                            type="text"
                            value={serveBgColor}
                            onChange={(e) => setServeBgColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="accentColor">{t("vmixSettings.servingIndicatorColor")}</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: accentColor }}></div>
                          <Input
                            id="accentColor"
                            type="color"
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            className="w-12 p-1 h-8"
                          />
                          <Input
                            type="text"
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="serveGradient">{t("vmixSettings.useGradientForServingIndicator")}</Label>
                        <Switch
                          id="serveGradient"
                          checked={serveGradient}
                          onCheckedChange={setServeGradient}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                        />
                      </div>

                      {serveGradient && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="serveGradientFrom">
                              {t("vmixSettings.servingIndicatorGradientStartColor")}
                            </Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: serveGradientFrom }}
                              ></div>
                              <Input
                                id="serveGradientFrom"
                                type="color"
                                value={serveGradientFrom}
                                onChange={(e) => setServeGradientFrom(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={serveGradientFrom}
                                onChange={(e) => setServeGradientFrom(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="serveGradientTo">
                              {t("vmixSettings.servingIndicatorGradientEndColor")}
                            </Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: serveGradientTo }}
                              ></div>
                              <Input
                                id="serveGradientTo"
                                type="color"
                                value={serveGradientTo}
                                onChange={(e) => setServeGradientTo(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={serveGradientTo}
                                onChange={(e) => setServeGradientTo(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div
                            className="h-8 rounded"
                            style={{
                              background: `linear-gradient(to bottom, ${serveGradientFrom}, ${serveGradientTo})`,
                            }}
                          ></div>
                        </>
                      )}

                      {/* Пример индикатора подачи */}
                      <div className="mt-4 flex items-center space-x-2">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center"
                          style={{
                            ...(serveGradient
                              ? { background: `linear-gradient(to bottom, ${serveGradientFrom}, ${serveGradientTo})` }
                              : { background: serveBgColor }),
                            color: accentColor,
                          }}
                        >
                          <span style={{ fontSize: "2em", lineHeight: "0.5" }}>&bull;</span>
                        </div>
                        <span className="text-sm">{t("vmixSettings.servingIndicatorExample")}</span>
                      </div>
                    </div>

                    {/* Текущий счет */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("vmixSettings.currentScoreBlock")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="pointsBgColor">{t("vmixSettings.currentScoreBgColor")}</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: pointsBgColor }}></div>
                          <Input
                            id="pointsBgColor"
                            type="color"
                            value={pointsBgColor}
                            onChange={(e) => setPointsBgColor(e.target.value)}
                            className="w-12 p-1 h-8"
                          />
                          <Input
                            type="text"
                            value={pointsBgColor}
                            onChange={(e) => setPointsBgColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="pointsGradient">{t("vmixSettings.useGradientForScore")}</Label>
                        <Switch
                          id="pointsGradient"
                          checked={pointsGradient}
                          onCheckedChange={setPointsGradient}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                        />
                      </div>

                      {pointsGradient && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="pointsGradientFrom">{t("vmixSettings.scoreGradientStartColor")}</Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: pointsGradientFrom }}
                              ></div>
                              <Input
                                id="pointsGradientFrom"
                                type="color"
                                value={pointsGradientFrom}
                                onChange={(e) => setPointsGradientFrom(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={pointsGradientFrom}
                                onChange={(e) => setPointsGradientFrom(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="pointsGradientTo">{t("vmixSettings.scoreGradientEndColor")}</Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: pointsGradientTo }}
                              ></div>
                              <Input
                                id="pointsGradientTo"
                                type="color"
                                value={pointsGradientTo}
                                onChange={(e) => setPointsGradientTo(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={pointsGradientTo}
                                onChange={(e) => setPointsGradientTo(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div
                            className="h-8 rounded"
                            style={{
                              background: `linear-gradient(to bottom, ${pointsGradientFrom}, ${pointsGradientTo})`,
                            }}
                          ></div>
                        </>
                      )}
                    </div>

                    {/* Счет в сетах */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("vmixSettings.setScoreBlock")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="setsBgColor">{t("vmixSettings.setScoreBgColor")}</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: setsBgColor }}></div>
                          <Input
                            id="setsBgColor"
                            type="color"
                            value={setsBgColor}
                            onChange={(e) => setSetsBgColor(e.target.value)}
                            className="w-12 p-1 h-8"
                          />
                          <Input
                            type="text"
                            value={setsBgColor}
                            onChange={(e) => setSetsBgColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="setsTextColor">{t("vmixSettings.setScoreTextColor")}</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: setsTextColor }}></div>
                          <Input
                            id="setsTextColor"
                            type="color"
                            value={setsTextColor}
                            onChange={(e) => setSetsTextColor(e.target.value)}
                            className="w-12 p-1 h-8"
                          />
                          <Input
                            type="text"
                            value={setsTextColor}
                            onChange={(e) => setSetsTextColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="setsGradient">{t("vmixSettings.useGradientForSetScore")}</Label>
                        <Switch
                          id="setsGradient"
                          checked={setsGradient}
                          onCheckedChange={setSetsGradient}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                        />
                      </div>

                      {setsGradient && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="setsGradientFrom">{t("vmixSettings.setScoreGradientStartColor")}</Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: setsGradientFrom }}
                              ></div>
                              <Input
                                id="setsGradientFrom"
                                type="color"
                                value={setsGradientFrom}
                                onChange={(e) => setSetsGradientFrom(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={setsGradientFrom}
                                onChange={(e) => setSetsGradientFrom(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="setsGradientTo">{t("vmixSettings.setScoreGradientEndColor")}</Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: setsGradientTo }}
                              ></div>
                              <Input
                                id="setsGradientTo"
                                type="color"
                                value={setsGradientTo}
                                onChange={(e) => setSetsGradientTo(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={setsGradientTo}
                                onChange={(e) => setSetsGradientTo(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div
                            className="h-8 rounded"
                            style={{
                              background: `linear-gradient(to bottom, ${setsGradientFrom}, ${setsGradientTo})`,
                            }}
                          ></div>
                        </>
                      )}
                    </div>

                    {/* Индикатор важных моментов */}
                    <div className="space-y-4">
                      <h3 className="font-medium">{t("vmixSettings.importantMomentIndicator")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="indicatorBgColor">{t("vmixSettings.indicatorBgColor")}</Label>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-6 h-6 rounded-full border"
                            style={{ backgroundColor: indicatorBgColor }}
                          ></div>
                          <Input
                            id="indicatorBgColor"
                            type="color"
                            value={indicatorBgColor}
                            onChange={(e) => setIndicatorBgColor(e.target.value)}
                            className="w-12 p-1 h-8"
                          />
                          <Input
                            type="text"
                            value={indicatorBgColor}
                            onChange={(e) => setIndicatorBgColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="indicatorTextColor">{t("vmixSettings.indicatorTextColor")}</Label>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-6 h-6 rounded-full border"
                            style={{ backgroundColor: indicatorTextColor }}
                          ></div>
                          <Input
                            id="indicatorTextColor"
                            type="color"
                            value={indicatorTextColor}
                            onChange={(e) => setIndicatorTextColor(e.target.value)}
                            className="w-12 p-1 h-8"
                          />
                          <Input
                            type="text"
                            value={indicatorTextColor}
                            onChange={(e) => setIndicatorTextColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="indicatorGradient">{t("vmixSettings.useGradientForIndicator")}</Label>
                        <Switch
                          id="indicatorGradient"
                          checked={indicatorGradient}
                          onCheckedChange={setIndicatorGradient}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                        />
                      </div>

                      {indicatorGradient && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="indicatorGradientFrom">
                              {t("vmixSettings.indicatorGradientStartColor")}
                            </Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: indicatorGradientFrom }}
                              ></div>
                              <Input
                                id="indicatorGradientFrom"
                                type="color"
                                value={indicatorGradientFrom}
                                onChange={(e) => setIndicatorGradientFrom(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={indicatorGradientFrom}
                                onChange={(e) => setIndicatorGradientFrom(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="indicatorGradientTo">{t("vmixSettings.indicatorGradientEndColor")}</Label>
                            <div className="flex items-center space-x-2">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: indicatorGradientTo }}
                              ></div>
                              <Input
                                id="indicatorGradientTo"
                                type="color"
                                value={indicatorGradientTo}
                                onChange={(e) => setIndicatorGradientTo(e.target.value)}
                                className="w-12 p-1 h-8"
                              />
                              <Input
                                type="text"
                                value={indicatorGradientTo}
                                onChange={(e) => setIndicatorGradientTo(e.target.value)}
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div
                            className="h-8 rounded"
                            style={{
                              background: `linear-gradient(to bottom, ${indicatorGradientFrom}, ${indicatorGradientTo})`,
                            }}
                          ></div>
                        </>
                      )}

                      {/* Пример индикатора */}
                      <div className="mt-4">
                        <div
                          className="rounded text-center py-1 px-2 font-bold"
                          style={{
                            color: indicatorTextColor,
                            ...(indicatorGradient
                              ? {
                                  background: `linear-gradient(to bottom, ${indicatorGradientFrom}, ${indicatorGradientTo})`,
                                }
                              : { background: indicatorBgColor }),
                          }}
                        >
                          MATCH POINT
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Кнопки действий */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("vmixSettings.actions")}</CardTitle>
                  <CardDescription>{t("vmixSettings.previewAndUseSettings")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={handlePreview} className="w-full">
                    <Eye className="mr-2 h-4 w-4" />
                    {t("vmixSettings.previewWithCurrentSettings")}
                  </Button>
                  <Button onClick={handleOpenVmix} className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("vmixSettings.openInNewWindow")}
                  </Button>
                  <Button onClick={handleOpenVmixInCurrentWindow} className="w-full">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {t("vmixSettings.openInCurrentWindow")}
                  </Button>
                  <Button onClick={handleCopyUrl} className="w-full" disabled={copying}>
                    <Copy className="mr-2 h-4 w-4" />
                    {copying ? t("common.copying") : t("vmixSettings.copyUrl")}
                  </Button>
                  <Button onClick={saveSettings} className="w-full" variant="secondary">
                    <Save className="mr-2 h-4 w-4" />
                    {t("vmixSettings.saveSettings")}
                  </Button>
                  <Button onClick={handleOpenCourtVmix} className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("vmixSettings.openCourtInNewWindow")}
                  </Button>
                  <Button onClick={handleOpenCourtVmixInCurrentWindow} className="w-full">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {t("vmixSettings.openCourtInCurrentWindow")}
                  </Button>
                  <Button onClick={handleCopyCourtUrl} className="w-full" disabled={copying}>
                    <Copy className="mr-2 h-4 w-4" />
                    {copying ? t("common.copying") : t("vmixSettings.copyCourtUrl")}
                  </Button>
                  <Separator className="my-4" />

                  <div className="text-sm font-medium text-gray-500 mb-2">{t("vmixSettings.courtPageActions")}</div>

                  {match && match.courtNumber ? (
                    <>
                      <Button onClick={handleOpenCourtVmix} className="w-full" variant="outline">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t("vmixSettings.openCourtPageNewWindow", { courtNumber: match.courtNumber })}
                      </Button>

                      <Button onClick={handleOpenCourtVmixInCurrentWindow} className="w-full" variant="outline">
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {t("vmixSettings.openCourtPageCurrentWindow", { courtNumber: match.courtNumber })}
                      </Button>

                      <Button onClick={handleCopyCourtUrl} className="w-full" variant="outline" disabled={copying}>
                        <Copy className="mr-2 h-4 w-4" />
                        {copying
                          ? t("common.copying")
                          : t("vmixSettings.copyCourtPageUrl", { courtNumber: match.courtNumber })}
                      </Button>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400 italic p-2 text-center">
                      {t("vmixSettings.matchNotAssignedToCourt")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>{t("vmixSettings.jsonApiForVmix")}</CardTitle>
              <CardDescription>{t("vmixSettings.useApiToGetMatchData")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("vmixSettings.jsonApiUrl")}</Label>
                <div className="flex items-center space-x-2">
                  <Input readOnly value={generateJsonUrl()} />
                  <Button variant="outline" onClick={handleCopyJsonUrl} disabled={copying}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("vmixSettings.usageInstructions")}</Label>
                <div className="bg-gray-100 p-4 rounded-md text-sm">
                  <p className="font-semibold mb-2">{t("vmixSettings.dataSourceSetup")}</p>
                  <ol className="list-decimal pl-5 space-y-1 mb-4">
                    <li>{t("vmixSettings.goToSettingsDataSources")}</li>
                    <li>{t("vmixSettings.clickAddAndSelectWeb")}</li>
                    <li>{t("vmixSettings.pasteApiUrl")}</li>
                    <li>{t("vmixSettings.setUpdateInterval")}</li>
                    <li>{t("vmixSettings.clickOkToSave")}</li>
                  </ol>

                  <p className="font-semibold mb-2">{t("vmixSettings.usingInTitleDesigner")}</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>{t("vmixSettings.createOrOpenTitle")}</li>
                    <li>{t("vmixSettings.addTextFields")}</li>
                    <li>{t("vmixSettings.inTextFieldPropertiesSelectDataBinding")}</li>
                    <li>{t("vmixSettings.selectDataSourceAndField")}</li>
                    <li>{t("vmixSettings.repeatForAllFields")}</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("vmixSettings.availableDataFields")}</Label>
                <div className="bg-gray-100 p-4 rounded-md text-sm">
                  <p className="font-semibold mb-2">{t("vmixSettings.teamA")}:</p>
                  <ul className="list-disc pl-5 space-y-1 mb-3">
                    <li>
                      <code>teamA_name</code> - {t("vmixSettings.teamAName")}
                    </li>
                    <li>
                      <code>teamA_score</code> - {t("vmixSettings.teamAScore")}
                    </li>
                    <li>
                      <code>teamA_game_score</code> - {t("vmixSettings.teamAGameScore")}
                    </li>
                    <li>
                      <code>teamA_current_set</code> - {t("vmixSettings.teamACurrentSet")}
                    </li>
                    <li>
                      <code>teamA_serving</code> - {t("vmixSettings.teamAServing")}
                    </li>
                    <li>
                      <code>teamA_set1</code>, <code>teamA_set2</code>, <code>teamA_set3</code> -{" "}
                      {t("vmixSettings.teamASetScores")}
                    </li>
                  </ul>

                  <p className="font-semibold mb-2">{t("vmixSettings.teamB")}:</p>
                  <ul className="list-disc pl-5 space-y-1 mb-3">
                    <li>
                      <code>teamB_name</code> - {t("vmixSettings.teamBName")}
                    </li>
                    <li>
                      <code>teamB_score</code> - {t("vmixSettings.teamBScore")}
                    </li>
                    <li>
                      <code>teamB_game_score</code> - {t("vmixSettings.teamBGameScore")}
                    </li>
                    <li>
                      <code>teamB_current_set</code> - {t("vmixSettings.teamBCurrentSet")}
                    </li>
                    <li>
                      <code>teamB_serving</code> - {t("vmixSettings.teamBServing")}
                    </li>
                    <li>
                      <code>teamB_set1</code>, <code>teamB_set2</code>, <code>teamB_set3</code> -{" "}
                      {t("vmixSettings.teamBSetScores")}
                    </li>
                  </ul>

                  <p className="font-semibold mb-2">{t("vmixSettings.generalData")}:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      <code>match_id</code> - {t("vmixSettings.matchId")}
                    </li>
                    <li>
                      <code>is_tiebreak</code> - {t("vmixSettings.isTiebreak")}
                    </li>
                    <li>
                      <code>is_completed</code> - {t("vmixSettings.isCompleted")}
                    </li>
                    <li>
                      <code>winner</code> - {t("vmixSettings.winner")}
                    </li>
                    <li>
                      <code>update_time</code> - {t("vmixSettings.updateTime")}
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("vmixSettings.dataFormatExample")}</Label>
                <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-auto">
                  {`[
  {
    "match_id": "6dbff28b-8611-473c-a62d-22936df1ab31",
    "teamA_name": "Игрок 1 / Игрок 2",
    "teamA_score": 0,
    "teamA_game_score": "0",
    "teamA_current_set": 4,
    "teamA_serving": "Да",
    "teamB_name": "Игрок 3 / Игрок 4",
    "teamB_score": 1,
    "teamB_game_score": "0",
    "teamB_current_set": 4,
    "teamB_serving": "Нет",
    "is_tiebreak": "Нет",
    "is_completed": "Нет",
    "winner": "",
    "teamA_set1": 4,
    "teamA_set2": "",
    "teamA_set3": "",
    "teamB_set1": 6,
    "teamB_set2": "",
    "teamB_set3": "",
    "timestamp": "2025-04-22T18:54:21.069Z",
    "update_time": "6:54:21 PM"
  }
]`}
                </pre>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleCopyJsonUrl} className="w-full" disabled={copying}>
                <Copy className="mr-2 h-4 w-4" />
                {copying ? t("common.copying") : t("vmixSettings.copyJsonApiUrl")}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
