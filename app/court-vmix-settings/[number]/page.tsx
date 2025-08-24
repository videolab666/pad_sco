"use client"

import { CardFooter } from "@/components/ui/card"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getMatchByCourtNumber } from "@/lib/court-utils"
import { logEvent } from "@/lib/error-logger"
import { ArrowLeft, Copy, ExternalLink, Eye, Save, ArrowRight, Database, Trash2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { useLanguage } from "@/contexts/language-context"
import {
  getAllVmixSettings,
  getVmixSettingsById,
  getDefaultVmixSettings,
  saveVmixSettings,
  deleteVmixSettings,
  type VmixSettings,
} from "@/lib/vmix-settings-storage"
import { Checkbox } from "@/components/ui/checkbox"
import { useEffect as useEffectForPreview } from "react"

// Add a new component for the vMix preview
function VmixPreview({ url, height = 200 }) {
  return (
    <div className="border rounded-md overflow-hidden bg-gray-100 w-full">
      <div className="bg-gray-200 p-2 flex justify-between items-center">
        <span className="text-sm font-medium">vMix Preview</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
          Open in new tab
        </a>
      </div>
      <div className="relative" style={{ height: `${height}px`, overflow: "hidden", padding: 0 }}>
        <div
          className="absolute inset-0"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            padding: 0,
            overflow: "visible",
            width: "100%",
          }}
        >
          <iframe
            src={url}
            style={{
              width: "300%",
              height: "100%",
              border: "none",
              transform: "scale(0.65)",
              transformOrigin: "0% 0%",
              maxHeight: "none",
              minHeight: "100%",
              margin: "0 -50% 0 0",
              padding: 0,
              boxSizing: "border-box",
            }}
            scrolling="no"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}

export default function CourtVmixSettingsPage({ params }) {
  const router = useRouter()
  const { t } = useLanguage()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [copying, setCopying] = useState(false)
  const courtNumber = Number.parseInt(params.number)

  // Состояние для работы с базой данных
  const [savedSettings, setSavedSettings] = useState<VmixSettings[]>([])
  const [selectedSettingsId, setSelectedSettingsId] = useState<string | null>(null)
  const [settingsName, setSettingsName] = useState("Мои настройки")
  const [isDefault, setIsDefault] = useState(false)
  const [savingToDb, setSavingToDb] = useState(false)
  const [loadingFromDb, setLoadingFromDb] = useState(false)
  const [deletingFromDb, setDeletingFromDb] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Настройки отображения
  const [theme, setTheme] = useState("custom")
  const [showNames, setShowNames] = useState(true)
  const [showPoints, setShowPoints] = useState(true)
  const [showSets, setShowSets] = useState(true)
  const [showServer, setShowServer] = useState(true)
  const [showCountry, setShowCountry] = useState(false)
  const [fontSize, setFontSize] = useState("normal")
  const [bgOpacity, setBgOpacity] = useState(0.5)
  const [textColor, setTextColor] = useState("#ffffff")
  const [accentColor, setAccentColor] = useState("#fbbf24")

  // Настройки размера шрифта имен игроков
  const [playerNamesFontSize, setPlayerNamesFontSize] = useState(1.2)

  // Настройки цветов и градиентов
  const [namesBgColor, setNamesBgColor] = useState("#0369a1")
  const [countryBgColor, setCountryBgColor] = useState("#0369a1")
  const [serveBgColor, setServeBgColor] = useState("#0369a1")
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

  // Функция для получения текущих настроек
  const getCurrentSettings = () => {
    return {
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
      indicatorBgColor,
      indicatorTextColor,
      indicatorGradient,
      indicatorGradientFrom,
      indicatorGradientTo,
      playerNamesFontSize,
    }
  }

  // Функция для применения настроек
  const applySettings = (settings) => {
    if (!settings) return

    // Применяем сохраненные настройки
    setTheme(settings.theme || "custom")
    setShowNames(settings.showNames !== undefined ? settings.showNames : true)
    setShowPoints(settings.showPoints !== undefined ? settings.showPoints : true)
    setShowSets(settings.showSets !== undefined ? settings.showSets : true)
    setShowServer(settings.showServer !== undefined ? settings.showServer : true)
    setShowCountry(settings.showCountry !== undefined ? settings.showCountry : false)
    setFontSize(settings.fontSize || "normal")
    setBgOpacity(settings.bgOpacity !== undefined ? settings.bgOpacity : 0.5)
    setTextColor(settings.textColor || "#ffffff")
    setAccentColor(settings.accentColor || "#fbbf24")

    setNamesBgColor(settings.namesBgColor || "#0369a1")
    setCountryBgColor(settings.countryBgColor || "#0369a1")
    setServeBgColor(settings.serveBgColor || "#0369a1")
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
  }

  // Функция для сохранения настроек в localStorage
  const saveSettingsToLocalStorage = () => {
    try {
      const settings = getCurrentSettings()
      localStorage.setItem("vmix_settings", JSON.stringify(settings))
      toast({
        title: t("courtVmixSettings.settingsSaved"),
        description: t("vmixSettings.settingsSaved"),
      })
      logEvent("info", "Настройки vMix сохранены в localStorage", "court-vmix-settings-save-local")
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("courtVmixSettings.errorSavingSettings"),
        variant: "destructive",
      })
      logEvent("error", "Ошибка при сохранении настроек vMix в localStorage", "court-vmix-settings-save-local", error)
    }
  }

  // Функция для загрузки сохраненных настроек из localStorage
  const loadSettingsFromLocalStorage = () => {
    try {
      const savedSettings = localStorage.getItem("vmix_settings")
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        applySettings(settings)
        logEvent("info", "Загружены сохраненные настройки vMix из localStorage", "court-vmix-settings-load-local")
      }
    } catch (error) {
      logEvent(
        "error",
        "Ошибка при загрузке сохраненных настроек vMix из localStorage",
        "court-vmix-settings-load-local",
        error,
      )
    }
  }

  // Функция для сохранения настроек в базу данных
  const saveSettingsToDatabase = async () => {
    try {
      setSavingToDb(true)
      const settings = getCurrentSettings()

      const vmixSettings: VmixSettings = {
        id: selectedSettingsId || undefined,
        name: settingsName,
        settings: settings,
        is_default: isDefault,
      }

      const result = await saveVmixSettings(vmixSettings)

      if (result) {
        toast({
          title: "Настройки сохранены в базу данных",
          description: `Настройки "${settingsName}" успешно сохранены`,
        })

        // Обновляем список настроек
        loadSavedSettingsFromDatabase()

        // Если это новые настройки, выбираем их
        if (!selectedSettingsId) {
          setSelectedSettingsId(result.id)
        }

        setShowSaveDialog(false)
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить настройки в базу данных",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при сохранении настроек",
        variant: "destructive",
      })
      logEvent("error", "Ошибка при сохранении настроек vMix в базу данных", "court-vmix-settings-save-db", error)
    } finally {
      setSavingToDb(false)
    }
  }

  // Функция для загрузки настроек из базы данных
  const loadSettingsFromDatabase = async (id: string) => {
    try {
      setLoadingFromDb(true)
      const settings = await getVmixSettingsById(id)

      if (settings) {
        applySettings(settings.settings)
        setSettingsName(settings.name)
        setIsDefault(settings.is_default || false)
        setSelectedSettingsId(settings.id)

        toast({
          title: "Настройки загружены",
          description: `Настройки "${settings.name}" успешно загружены`,
        })
      } else {
        toast({
          title: "шибка",
          description: "Не удалось загрузить настройки из базы данных",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при загрузке настроек",
        variant: "destructive",
      })
      logEvent("error", "Ошибка при загрузке настроек vMix из базы данных", "court-vmix-settings-load-db", error)
    } finally {
      setLoadingFromDb(false)
    }
  }

  // Функция для загрузки настроек по умолчанию из базы данных
  const loadDefaultSettingsFromDatabase = async () => {
    try {
      setLoadingFromDb(true)
      const settings = await getDefaultVmixSettings()

      if (settings) {
        applySettings(settings.settings)
        setSettingsName(settings.name)
        setIsDefault(true)
        setSelectedSettingsId(settings.id)

        toast({
          title: "Настройки по умолчанию загружены",
          description: `Настройки "${settings.name}" успешно загружены`,
        })
      } else {
        // Если настроек по умолчанию нет, загружаем из localStorage
        loadSettingsFromLocalStorage()
        toast({
          title: "Настройки по умолчанию не найдены",
          description: "Загружены локальные настройки",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при загрузке настроек по умолчанию",
        variant: "destructive",
      })
      logEvent("error", "Ошибка при загрузке настроек vMix по умолчанию", "court-vmix-settings-load-default", error)
    } finally {
      setLoadingFromDb(false)
    }
  }

  // Функция для загрузки списка сохраненных настроек из базы данных
  const loadSavedSettingsFromDatabase = async () => {
    try {
      const settings = await getAllVmixSettings()
      setSavedSettings(settings)
    } catch (error) {
      logEvent("error", "Ошибка при загрузке списка настроек vMix", "court-vmix-settings-load-list", error)
    }
  }

  // Функция для удаления настроек из базы данных
  const deleteSettingsFromDatabase = async (id: string) => {
    try {
      setDeletingFromDb(true)
      const success = await deleteVmixSettings(id)

      if (success) {
        toast({
          title: "Настройки удалены",
          description: "Настройки успешно удалены из базы данных",
        })

        // Обновляем список настроек
        loadSavedSettingsFromDatabase()

        // Если удалили текущие настройки, сбрасываем выбор
        if (selectedSettingsId === id) {
          setSelectedSettingsId(null)
          setSettingsName("Мои настройки")
          setIsDefault(false)
        }

        setShowDeleteDialog(false)
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось удалить настройки из базы данных",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при удалении настроек",
        variant: "destructive",
      })
      logEvent("error", "Ошибка при удалении настроек vMix из базы данных", "court-vmix-settings-delete", error)
    } finally {
      setDeletingFromDb(false)
    }
  }

  // Функция для открытия диалога сохранения настроек
  const openSaveDialog = () => {
    setShowSaveDialog(true)
  }

  // Функция для открытия диалога удаления настроек
  const openDeleteDialog = () => {
    setShowDeleteDialog(true)
  }

  // Функция для создания новых настроек
  const createNewSettings = () => {
    setSelectedSettingsId(null)
    setSettingsName("Новые настройки")
    setIsDefault(false)
    openSaveDialog()
  }

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

    loadMatch()

    // Загружаем сохраненные настройки из localStorage
    loadSettingsFromLocalStorage()

    // Загружаем список настроек из базы данных
    loadSavedSettingsFromDatabase()

    // Загружаем настройки по умолчанию из базы данных
    loadDefaultSettingsFromDatabase()
  }, [courtNumber])

  const handleBack = () => {
    router.back()
  }

  // Функция для корректной передачи цветов в URL
  const formatColorForUrl = (color) => {
    // Удаляем # из цвета для URL
    return color.replace("#", "")
  }

  const generateCourtVmixUrl = () => {
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

  const generateJsonUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/api/court/${courtNumber}`
  }

  const handleCopyUrl = async () => {
    try {
      setCopying(true)
      await navigator.clipboard.writeText(generateCourtVmixUrl())
      toast({
        title: t("courtVmixSettings.copyUrl"),
        description: t("matchPage.linkCopied"),
      })
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("courtVmixSettings.errorSavingSettings"),
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
        title: t("courtVmixSettings.copyUrl"),
        description: "URL для JSON API скопирован в буфер обмена",
      })
    } catch (error) {
      toast({
        title: t("common.error"),
        description: "Не удалось скопировать URL",
        variant: "destructive",
      })
    } finally {
      setCopying(false)
    }
  }

  const handleOpenVmix = () => {
    window.open(generateCourtVmixUrl(), "_blank")
  }

  const handleOpenVmixInCurrentWindow = () => {
    router.push(generateCourtVmixUrl())
  }

  const handlePreview = () => {
    const previewUrl = generateCourtVmixUrl()
    window.open(previewUrl, "vmix_preview", "width=800,height=400")
  }

  // Force iframe refresh when settings change
  const [previewKey, setPreviewKey] = useState(0)
  const [showOverlay, setShowOverlay] = useState(false)

  useEffectForPreview(() => {
    // Show overlay when changes are made
    setShowOverlay(true)

    // Debounce the refresh to avoid too many reloads
    const timer = setTimeout(() => {
      setPreviewKey((prev) => prev + 1)

      // Hide the overlay after a short delay
      const hideOverlayTimer = setTimeout(() => {
        setShowOverlay(false)
      }, 1000)

      return () => clearTimeout(hideOverlayTimer)
    }, 500)

    return () => clearTimeout(timer)
  }, [
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
    playerNamesFontSize,
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
    indicatorBgColor,
    indicatorTextColor,
    indicatorGradient,
    indicatorGradientFrom,
    indicatorGradientTo,
  ])

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>{t("courtVmixSettings.loadingSettings")}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <Button onClick={handleBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("courtVmixSettings.backToMatch")}
      </Button>

      <h1 className="text-2xl font-bold mb-4">
        {t("courtVmixSettings.title")} - {courtNumber}
      </h1>

      {error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      ) : match ? (
        <div className="mb-4">
          <p className="font-medium">
            {t("courtVmixSettings.matchOnCourt")}: {courtNumber}: {match.teamA.players.map((p) => p.name).join(" / ")}{" "}
            vs {match.teamB.players.map((p) => p.name).join(" / ")}
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <p className="font-medium">{t("courtVmixSettings.noActiveMatches", { number: courtNumber })}</p>
        </div>
      )}

      {/* Карточка с сохраненными настройками */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("courtVmixSettings.savedSettings")}</CardTitle>
          <CardDescription>{t("courtVmixSettings.selectSaveOrDeleteSettings")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="savedSettings">{t("courtVmixSettings.selectSettings")}</Label>
              <Select
                value={selectedSettingsId || ""}
                onValueChange={(value) => {
                  if (value) {
                    loadSettingsFromDatabase(value)
                  }
                }}
              >
                <SelectTrigger id="savedSettings">
                  <SelectValue placeholder="Выберите сохраненные настройки" />
                </SelectTrigger>
                <SelectContent>
                  {savedSettings.map((setting) => (
                    <SelectItem key={setting.id} value={setting.id || ""}>
                      {setting.name} {setting.is_default && "⭐"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={createNewSettings} className="flex-1 whitespace-normal">
                {t("courtVmixSettings.createNewSettings")}
              </Button>
              <Button
                onClick={openSaveDialog}
                disabled={!selectedSettingsId}
                variant="outline"
                className="flex-1 whitespace-normal"
              >
                <Save className="mr-2 h-4 w-4" />
                {t("courtVmixSettings.updateSettings")}
              </Button>
              <Button
                onClick={openDeleteDialog}
                disabled={!selectedSettingsId}
                variant="destructive"
                className="flex-1 whitespace-normal"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("courtVmixSettings.deleteSettings")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="settings">
        <TabsList className="mb-4">
          <TabsTrigger value="settings">{t("courtVmixSettings.displaySettings")}</TabsTrigger>
          <TabsTrigger value="api">{t("courtVmixSettings.apiForVmix")}</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Левая колонка - основные настройки */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("courtVmixSettings.basicSettings")}</CardTitle>
                  <CardDescription>{t("courtVmixSettings.configureBasicParams")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">{t("courtVmixSettings.theme")}</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger id="theme">
                        <SelectValue placeholder={t("courtVmixSettings.selectTheme")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">{t("courtVmixSettings.customTheme")}</SelectItem>
                        <SelectItem value="transparent">{t("courtVmixSettings.transparentTheme")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fontSize">{t("courtVmixSettings.fontSize")}</Label>
                    <Select value={fontSize} onValueChange={setFontSize}>
                      <SelectTrigger id="fontSize">
                        <SelectValue placeholder={t("courtVmixSettings.selectFontSize")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">{t("courtVmixSettings.smallSize")}</SelectItem>
                        <SelectItem value="normal">{t("courtVmixSettings.mediumSize")}</SelectItem>
                        <SelectItem value="large">{t("courtVmixSettings.largeSize")}</SelectItem>
                        <SelectItem value="xlarge">{t("courtVmixSettings.xlargeSize")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="playerNamesFontSize">
                      {t("courtVmixSettings.playerNamesFontSize").replace("{size}", playerNamesFontSize.toString())}
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
                        {t("courtVmixSettings.bgOpacity").replace("{opacity}", Math.round(bgOpacity * 100).toString())}
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
                    <Label htmlFor="textColor">{t("courtVmixSettings.textColor")}</Label>
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

                  <Separator className="my-4" />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="showNames">{t("courtVmixSettings.showPlayerNames")}</Label>
                      <Switch
                        id="showNames"
                        checked={showNames}
                        onCheckedChange={setShowNames}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="showPoints">{t("courtVmixSettings.showCurrentPoints")}</Label>
                      <Switch
                        id="showPoints"
                        checked={showPoints}
                        onCheckedChange={setShowPoints}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="showSets">{t("courtVmixSettings.showSetsScore")}</Label>
                      <Switch
                        id="showSets"
                        checked={showSets}
                        onCheckedChange={setShowSets}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="showServer">{t("courtVmixSettings.showServer")}</Label>
                      <Switch
                        id="showServer"
                        checked={showServer}
                        onCheckedChange={setShowServer}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="showCountry">{t("courtVmixSettings.showCountries")}</Label>
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

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Realtime preview</CardTitle>
                  <CardDescription>Preview your changes in realtime</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <div></div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewKey((prev) => prev + 1)}
                      className="text-xs"
                    >
                      <ArrowRight className="h-3 w-3 mr-1" /> Refresh preview
                    </Button>
                  </div>
                  <div className="relative">
                    <VmixPreview url={generateCourtVmixUrl()} height={250} key={previewKey} />
                    {/* Overlay that shows when settings change */}
                    <div
                      className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none transition-opacity duration-300"
                      style={{
                        opacity: showOverlay ? 0.5 : 0,
                        visibility: showOverlay ? "visible" : "hidden",
                        transition: "opacity 0.3s, visibility 0.3s",
                      }}
                    >
                      <div className="bg-white/90 px-3 py-1 rounded-md shadow-md text-sm font-medium">
                        Applying changes
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Some changes may be unexpected. Click the "Refresh Preview"
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Правая колонка - настройки цветов и градиентов */}
            <div className="space-y-6">
              {theme !== "transparent" && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("courtVmixSettings.colorsAndGradients")}</CardTitle>
                    <CardDescription>{t("courtVmixSettings.configureColorsAndGradients")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Имена игроков */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("courtVmixSettings.playerNamesBlock")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="namesBgColor">{t("courtVmixSettings.playerNamesBgColor")}</Label>
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
                        <Label htmlFor="namesGradient">{t("courtVmixSettings.useGradientForNames")}</Label>
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
                            <Label htmlFor="namesGradientFrom">{t("courtVmixSettings.namesGradientStartColor")}</Label>
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
                            <Label htmlFor="namesGradientTo">{t("courtVmixSettings.namesGradientEndColor")}</Label>
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
                      <h3 className="font-medium">{t("courtVmixSettings.countriesBlock")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="countryBgColor">{t("courtVmixSettings.countriesBgColor")}</Label>
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
                        <Label htmlFor="countryGradient">{t("courtVmixSettings.useGradientForCountries")}</Label>
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
                            <Label htmlFor="countryGradientFrom">
                              {t("courtVmixSettings.countriesGradientStartColor")}
                            </Label>
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
                            <Label htmlFor="countryGradientTo">
                              {t("courtVmixSettings.countriesGradientEndColor")}
                            </Label>
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
                      <h3 className="font-medium">{t("courtVmixSettings.serveIndicatorBlock")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="serveBgColor">{t("courtVmixSettings.serveIndicatorBgColor")}</Label>
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

                      <div className="flex items-center justify-between">
                        <Label htmlFor="serveGradient">{t("courtVmixSettings.useGradientForServeIndicator")}</Label>
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
                              {t("courtVmixSettings.serveIndicatorGradientStartColor")}
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
                              {t("courtVmixSettings.serveIndicatorGradientEndColor")}
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
                        <span className="text-sm">{t("courtVmixSettings.serveIndicatorExample")}</span>
                      </div>

                      <div className="space-y-2 mt-4">
                        <Label htmlFor="accentColor">{t("courtVmixSettings.serveIndicatorColor")}</Label>
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
                    </div>

                    {/* Текущий счет */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("courtVmixSettings.currentScoreBlock")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="pointsBgColor">{t("courtVmixSettings.currentScoreBgColor")}</Label>
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
                        <Label htmlFor="pointsGradient">{t("courtVmixSettings.useGradientForCurrentScore")}</Label>
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
                            <Label htmlFor="pointsGradientFrom">
                              {t("courtVmixSettings.currentScoreGradientStartColor")}
                            </Label>
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
                            <Label htmlFor="pointsGradientTo">
                              {t("courtVmixSettings.currentScoreGradientEndColor")}
                            </Label>
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
                      <h3 className="font-medium">{t("courtVmixSettings.setsScoreBlock")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="setsBgColor">{t("courtVmixSettings.setsBgColor")}</Label>
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
                        <Label htmlFor="setsTextColor">{t("courtVmixSettings.setsTextColor")}</Label>
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
                        <Label htmlFor="setsGradient">{t("courtVmixSettings.useGradientForSets")}</Label>
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
                            <Label htmlFor="setsGradientFrom">{t("courtVmixSettings.setsGradientStartColor")}</Label>
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
                            <Label htmlFor="setsGradientTo">{t("courtVmixSettings.setsGradientEndColor")}</Label>
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
                      <h3 className="font-medium">{t("courtVmixSettings.importantMomentsIndicator")}</h3>
                      <div className="space-y-2">
                        <Label htmlFor="indicatorBgColor">{t("courtVmixSettings.indicatorBgColor")}</Label>
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
                        <Label htmlFor="indicatorTextColor">{t("courtVmixSettings.indicatorTextColor")}</Label>
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
                        <Label htmlFor="indicatorGradient">{t("courtVmixSettings.useGradientForIndicator")}</Label>
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
                              {t("courtVmixSettings.indicatorGradientStartColor")}
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
                            <Label htmlFor="indicatorGradientTo">
                              {t("courtVmixSettings.indicatorGradientEndColor")}
                            </Label>
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
                  <CardTitle>{t("courtVmixSettings.actions")}</CardTitle>
                  <CardDescription>{t("courtVmixSettings.previewAndUseSettings")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={handlePreview} className="w-full">
                    <Eye className="mr-2 h-4 w-4" />
                    {t("courtVmixSettings.preview")}
                  </Button>
                  <Button onClick={handleOpenVmix} className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("courtVmixSettings.openInNewWindow")}
                  </Button>
                  <Button onClick={handleOpenVmixInCurrentWindow} className="w-full">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {t("courtVmixSettings.openInCurrentWindow")}
                  </Button>
                  <Button onClick={handleCopyUrl} className="w-full" disabled={copying}>
                    <Copy className="mr-2 h-4 w-4" />
                    {copying ? t("courtVmixSettings.copying") : t("courtVmixSettings.copyUrl")}
                  </Button>
                  <Button onClick={saveSettingsToLocalStorage} className="w-full" variant="secondary">
                    <Save className="mr-2 h-4 w-4" />
                    {t("courtVmixSettings.saveSettings")}
                  </Button>
                  <Button onClick={openSaveDialog} className="w-full" variant="outline">
                    <Database className="mr-2 h-4 w-4" />
                    {t("courtVmixSettings.saveToDatabase")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>{t("courtVmixSettings.jsonApiForVmix")}</CardTitle>
              <CardDescription>{t("courtVmixSettings.useApiForVmixData")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("courtVmixSettings.jsonApiUrl")}</Label>
                <div className="flex items-center space-x-2">
                  <Input readOnly value={generateJsonUrl()} />
                  <Button variant="outline" onClick={handleCopyJsonUrl} disabled={copying}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("courtVmixSettings.instructionsForVmix")}</Label>
                <div className="bg-gray-100 p-4 rounded-md text-sm">
                  <p className="font-semibold mb-2">{t("courtVmixSettings.dataSourceSetup")}</p>
                  <ol className="list-decimal pl-5 space-y-1 mb-4">
                    {t("courtVmixSettings.dataSourceSteps")
                      .split("\n")
                      .map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                  </ol>

                  <p className="font-semibold mb-2">{t("courtVmixSettings.titleDesignerUsage")}</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    {t("courtVmixSettings.titleDesignerSteps")
                      .split("\n")
                      .map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                  </ol>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("courtVmixSettings.availableDataFields")}</Label>
                <div className="bg-gray-100 p-4 rounded-md text-sm">
                  <p className="font-semibold mb-2">{t("courtVmixSettings.teamA")}</p>
                  <ul className="list-disc pl-5 space-y-1 mb-3">
                    <li>
                      <code>teamA_name</code> - имена игроков команды A
                    </li>
                    <li>
                      <code>teamA_score</code> - общий счет команды A
                    </li>
                    <li>
                      <code>teamA_game_score</code> - текущий счет в гейме (0, 15, 30, 40, Ad)
                    </li>
                    <li>
                      <code>teamA_current_set</code> - счет в текущем сете
                    </li>
                    <li>
                      <code>teamA_set1</code> - счет команды A в первом сете
                    </li>
                    <li>
                      <code>teamA_set2</code> - счет команды A во втором сете
                    </li>
                    <li>
                      <code>teamA_set3</code> - счет команды A в третьем сете
                    </li>
                    <li>
                      <code>teamA_serving</code> - подает ли команда A (true/false)
                    </li>
                  </ul>

                  <p className="font-semibold mb-2">{t("courtVmixSettings.teamB")}</p>
                  <ul className="list-disc pl-5 space-y-1 mb-3">
                    <li>
                      <code>teamB_name</code> - имена игроков команды B
                    </li>
                    <li>
                      <code>teamB_score</code> - общий счет команды B
                    </li>
                    <li>
                      <code>teamB_game_score</code> - текущий счет в гейме (0, 15, 30, 40, Ad)
                    </li>
                    <li>
                      <code>teamB_current_set</code> - счет в текущем сете
                    </li>
                    <li>
                      <code>teamB_set1</code> - счет команды B в первом сете
                    </li>
                    <li>
                      <code>teamB_set2</code> - счет команды B во втором сете
                    </li>
                    <li>
                      <code>teamB_set3</code> - счет команды B в третьем сете
                    </li>
                    <li>
                      <code>teamB_serving</code> - подает ли команда B (true/false)
                    </li>
                  </ul>

                  <p className="font-semibold mb-2">{t("courtVmixSettings.matchInfo")}</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      <code>current_set</code> - номер текущего сета
                    </li>
                    <li>
                      <code>match_status</code> - статус матча (in_progress, completed)
                    </li>
                    <li>
                      <code>match_time</code> - продолжительность матча
                    </li>
                    <li>
                      <code>important_moment</code> - важный момент (match_point, set_point, break_point, пусто)
                    </li>
                    <li>
                      <code>court_number</code> - номер корта
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог сохранения настроек */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{selectedSettingsId ? "Обновить настройки" : "Сохранить настройки"}</CardTitle>
              <CardDescription>
                {selectedSettingsId ? "Обновите существующие настройки" : "Сохраните текущие настройки в базу данных"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="settingsName">Название настроек</Label>
                <Input
                  id="settingsName"
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  placeholder="Введите название настроек"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isDefault" checked={isDefault} onCheckedChange={setIsDefault} />
                <Label htmlFor="isDefault">Использовать как настройки по умолчанию</Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Отмена
              </Button>
              <Button onClick={saveSettingsToDatabase} disabled={savingToDb}>
                {savingToDb ? "Сохранение..." : "Сохранить"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Диалог удаления настроек */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Удалить настройки</CardTitle>
              <CardDescription>Вы уверены, что хотите удалить эти настройки?</CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                Настройки <strong>{settingsName}</strong> будут удалены безвозвратно.
              </p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Отмена
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteSettingsFromDatabase(selectedSettingsId)}
                disabled={deletingFromDb}
              >
                {deletingFromDb ? "Удаление..." : "Удалить"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
