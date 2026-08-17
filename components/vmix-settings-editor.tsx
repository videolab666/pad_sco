"use client"

// <VmixSettingsEditor> — the single settings editor for every vMix scoreboard
// (Этап D of vmix-scoreboard-unification.md, Т2).
//
// It replaces the near-duplicate bodies of /vmix-settings/[id] and
// /court-vmix-settings/[number]. The page wrappers only load the match (by id
// or by court) and render this editor with the matching `variant`; all the
// settings UI, localStorage/Supabase persistence and URL generation live here.

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { ArrowLeft, Copy, ExternalLink, Eye, Save, ArrowRight, Database } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { logEvent } from "@/lib/error-logger"
import {
  getAllVmixSettings,
  getDefaultVmixSettings,
  saveVmixSettings,
  type VmixSettings,
} from "@/lib/vmix-settings-storage"

export type VmixSettingsVariant = "overlay" | "court"

/** Editable vMix display settings — the object saved to localStorage / Supabase
 *  and turned into scoreboard URL query parameters. */
export interface EditorSettings {
  theme: string
  showNames: boolean
  showPoints: boolean
  showSets: boolean
  showServer: boolean
  showCountry: boolean
  /** How a country is rendered: flag emoji / ISO code / country name. */
  countryAs: "flag" | "code" | "name"
  /** Hide the country column when both sides share one country (APK parity). */
  hideSameCountry: boolean
  /** Show the player avatar (photo) column. */
  showAvatar: boolean
  /** Hide avatars when every player uses the same image (APK parity). */
  hideSameAvatar: boolean
  /** Which part of the player name to show: full / first / last (APK NamePart). */
  playerNameFormat: "full" | "first" | "last"
  /** One line or two (surname on its own line). */
  nameLines: "single" | "two"
  /** Two lines: which part is on top; single line: word order. */
  nameLineOrder: "first-top" | "last-top"
  /** Letter case for displayed names. */
  nameCase: "as-is" | "upper" | "lower" | "capitalize"
  /** Per-part font size (em); linked = first value drives both. */
  nameSizeLinked: boolean
  nameSizeFirst: number
  nameSizeLast: number
  /** Per-part font weight; linked = first value drives both. */
  nameWeightLinked: boolean
  nameWeightFirst: string
  nameWeightLast: string
  showBreakPoint: boolean
  fontSize: string
  bgOpacity: number
  textColor: string
  accentColor: string
  playerNamesFontSize: number
  namesBgColor: string
  countryBgColor: string
  serveBgColor: string
  pointsBgColor: string
  setsBgColor: string
  setsTextColor: string
  namesGradient: boolean
  namesGradientFrom: string
  namesGradientTo: string
  countryGradient: boolean
  countryGradientFrom: string
  countryGradientTo: string
  serveGradient: boolean
  serveGradientFrom: string
  serveGradientTo: string
  pointsGradient: boolean
  pointsGradientFrom: string
  pointsGradientTo: string
  setsGradient: boolean
  setsGradientFrom: string
  setsGradientTo: string
  indicatorBgColor: string
  indicatorTextColor: string
  indicatorGradient: boolean
  indicatorGradientFrom: string
  indicatorGradientTo: string
}

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  theme: "custom",
  showNames: true,
  showPoints: true,
  showSets: true,
  showServer: true,
  showCountry: true,
  countryAs: "flag",
  hideSameCountry: false,
  showAvatar: false,
  hideSameAvatar: true,
  playerNameFormat: "full",
  nameLines: "single",
  nameLineOrder: "first-top",
  nameCase: "as-is",
  nameSizeLinked: true,
  nameSizeFirst: 1,
  nameSizeLast: 1,
  nameWeightLinked: true,
  nameWeightFirst: "700",
  nameWeightLast: "700",
  showBreakPoint: true,
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

/** Merges a stored settings blob onto the defaults, dropping unknown keys. */
function normalizeSettings(raw: any): EditorSettings {
  const out = { ...DEFAULT_EDITOR_SETTINGS }
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(DEFAULT_EDITOR_SETTINGS) as (keyof EditorSettings)[]) {
      if (raw[key] !== undefined) (out as any)[key] = raw[key]
    }
  }
  return out
}

// --- Small presentational helpers ------------------------------------------

/** Swatch + color picker + hex text input, all bound to one value. */
function ColorRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center space-x-2">
        <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: value }} />
        <Input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-12 p-1 h-8" />
        <Input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
      </div>
    </div>
  )
}

/** Gradient on/off switch with the from/to color rows and a live preview. */
function GradientControls({
  idPrefix,
  label,
  fromLabel,
  toLabel,
  on,
  from,
  to,
  onToggle,
  onFrom,
  onTo,
}: {
  idPrefix: string
  label: string
  fromLabel: string
  toLabel: string
  on: boolean
  from: string
  to: string
  onToggle: (v: boolean) => void
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Label htmlFor={`${idPrefix}Gradient`}>{label}</Label>
        <Switch
          id={`${idPrefix}Gradient`}
          checked={on}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
        />
      </div>
      {on && (
        <>
          <ColorRow id={`${idPrefix}From`} label={fromLabel} value={from} onChange={onFrom} />
          <ColorRow id={`${idPrefix}To`} label={toLabel} value={to} onChange={onTo} />
          <div className="h-8 rounded" style={{ background: `linear-gradient(to bottom, ${from}, ${to})` }} />
        </>
      )}
    </>
  )
}

/** A labelled on/off switch row. */
function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id}>{label}</Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
      />
    </div>
  )
}

// --- The editor -------------------------------------------------------------

export interface VmixSettingsEditorProps {
  variant: VmixSettingsVariant
  /** Match id — required for the "overlay" variant (/vmix/[id] URLs). */
  matchId?: string
  /** Court number — required for the "court" variant (/court-vmix/[n] URLs). */
  courtNumber?: number
  /** Display title of the loaded match, shown in the header. */
  matchTitle?: string
}

export function VmixSettingsEditor({ variant, matchId, courtNumber, matchTitle }: VmixSettingsEditorProps) {
  const router = useRouter()
  const { t } = useLanguage()

  const [s, setS] = useState<EditorSettings>(() => ({
    ...DEFAULT_EDITOR_SETTINGS,
    // The court scoreboard historically defaults the country column off.
    showCountry: variant !== "court",
  }))
  const set = (patch: Partial<EditorSettings>) => setS((prev) => ({ ...prev, ...patch }))

  const [copying, setCopying] = useState(false)

  // Supabase preset storage.
  const [savedPresets, setSavedPresets] = useState<VmixSettings[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [presetIsDefault, setPresetIsDefault] = useState(false)
  const [savingToDb, setSavingToDb] = useState(false)

  // On mount: load saved settings (localStorage, then Supabase default if any).
  useEffect(() => {
    try {
      const stored = localStorage.getItem("vmix_settings")
      if (stored) setS(normalizeSettings(JSON.parse(stored)))
    } catch (error) {
      logEvent("error", "vMix settings: failed to read localStorage", "vmix-settings-editor", error)
    }

    getAllVmixSettings()
      .then(setSavedPresets)
      .catch(() => {})

    getDefaultVmixSettings()
      .then((preset) => {
        if (preset?.settings) setS(normalizeSettings(preset.settings))
      })
      .catch(() => {})
  }, [])

  // --- URL generation -------------------------------------------------------

  const stripHash = (color: string) => color.replace("#", "")

  const generateScoreboardUrl = () => {
    const base = window.location.origin
    const path = variant === "court" ? `/court-vmix/${courtNumber}` : `/vmix/${matchId}`
    const url = new URL(`${base}${path}`)

    url.searchParams.set("theme", s.theme)
    url.searchParams.set("showNames", String(s.showNames))
    url.searchParams.set("showPoints", String(s.showPoints))
    url.searchParams.set("showSets", String(s.showSets))
    url.searchParams.set("showServer", String(s.showServer))
    url.searchParams.set("showCountry", String(s.showCountry))
    url.searchParams.set("countryAs", s.countryAs)
    url.searchParams.set("hideSameCountry", String(s.hideSameCountry))
    url.searchParams.set("showAvatar", String(s.showAvatar))
    url.searchParams.set("hideSameAvatar", String(s.hideSameAvatar))
    url.searchParams.set("nameAs", s.playerNameFormat)
    url.searchParams.set("nameLines", s.nameLines)
    url.searchParams.set("nameLineOrder", s.nameLineOrder)
    url.searchParams.set("nameCase", s.nameCase)
    url.searchParams.set("nameSizeLinked", String(s.nameSizeLinked))
    url.searchParams.set("nameSizeFirst", String(s.nameSizeFirst))
    url.searchParams.set("nameSizeLast", String(s.nameSizeLast))
    url.searchParams.set("nameWeightLinked", String(s.nameWeightLinked))
    url.searchParams.set("nameWeightFirst", s.nameWeightFirst)
    url.searchParams.set("nameWeightLast", s.nameWeightLast)
    url.searchParams.set("showBreakPoint", String(s.showBreakPoint))
    url.searchParams.set("fontSize", s.fontSize)
    url.searchParams.set("bgOpacity", String(s.bgOpacity))
    url.searchParams.set("textColor", stripHash(s.textColor))
    url.searchParams.set("accentColor", stripHash(s.accentColor))
    url.searchParams.set("playerNamesFontSize", String(s.playerNamesFontSize))

    // Colour/gradient params are meaningless for the transparent theme.
    if (s.theme !== "transparent") {
      url.searchParams.set("namesBgColor", stripHash(s.namesBgColor))
      url.searchParams.set("countryBgColor", stripHash(s.countryBgColor))
      url.searchParams.set("serveBgColor", stripHash(s.serveBgColor))
      url.searchParams.set("pointsBgColor", stripHash(s.pointsBgColor))
      url.searchParams.set("setsBgColor", stripHash(s.setsBgColor))
      url.searchParams.set("setsTextColor", stripHash(s.setsTextColor))
      url.searchParams.set("namesGradient", String(s.namesGradient))
      url.searchParams.set("namesGradientFrom", stripHash(s.namesGradientFrom))
      url.searchParams.set("namesGradientTo", stripHash(s.namesGradientTo))
      url.searchParams.set("countryGradient", String(s.countryGradient))
      url.searchParams.set("countryGradientFrom", stripHash(s.countryGradientFrom))
      url.searchParams.set("countryGradientTo", stripHash(s.countryGradientTo))
      url.searchParams.set("serveGradient", String(s.serveGradient))
      url.searchParams.set("serveGradientFrom", stripHash(s.serveGradientFrom))
      url.searchParams.set("serveGradientTo", stripHash(s.serveGradientTo))
      url.searchParams.set("pointsGradient", String(s.pointsGradient))
      url.searchParams.set("pointsGradientFrom", stripHash(s.pointsGradientFrom))
      url.searchParams.set("pointsGradientTo", stripHash(s.pointsGradientTo))
      url.searchParams.set("setsGradient", String(s.setsGradient))
      url.searchParams.set("setsGradientFrom", stripHash(s.setsGradientFrom))
      url.searchParams.set("setsGradientTo", stripHash(s.setsGradientTo))
      url.searchParams.set("indicatorBgColor", stripHash(s.indicatorBgColor))
      url.searchParams.set("indicatorTextColor", stripHash(s.indicatorTextColor))
      url.searchParams.set("indicatorGradient", String(s.indicatorGradient))
      url.searchParams.set("indicatorGradientFrom", stripHash(s.indicatorGradientFrom))
      url.searchParams.set("indicatorGradientTo", stripHash(s.indicatorGradientTo))
    }

    return url.toString()
  }

  const generateJsonUrl = () => {
    const base = window.location.origin
    const path = variant === "court" ? `/api/court/${courtNumber}` : `/api/vmix/${matchId}`
    // The JSON endpoint honours the same display params as the HTML scoreboard
    // (nameLines/nameCase/...), so the JSON fields match what the preview shows.
    const display = new URLSearchParams({
      nameAs: s.playerNameFormat,
      nameLines: s.nameLines,
      nameLineOrder: s.nameLineOrder,
      nameCase: s.nameCase,
      nameSizeLinked: String(s.nameSizeLinked),
      nameSizeFirst: String(s.nameSizeFirst),
      nameSizeLast: String(s.nameSizeLast),
      nameWeightLinked: String(s.nameWeightLinked),
      nameWeightFirst: s.nameWeightFirst,
      nameWeightLast: s.nameWeightLast,
      countryAs: s.countryAs,
      hideSameCountry: String(s.hideSameCountry),
      showAvatar: String(s.showAvatar),
    })
    return `${base}${path}?${display.toString()}`
  }

  // --- Actions --------------------------------------------------------------

  const copyToClipboard = async (text: string, description: string) => {
    try {
      setCopying(true)
      await navigator.clipboard.writeText(text)
      toast({ title: t("vmixSettings.urlCopied"), description })
    } catch {
      toast({ title: t("common.error"), description: t("vmixSettings.failedToCopyUrl"), variant: "destructive" })
    } finally {
      setCopying(false)
    }
  }

  const handlePreview = () => window.open(generateScoreboardUrl(), "vmix_preview", "width=800,height=400")
  const handleOpenNewWindow = () => window.open(generateScoreboardUrl(), "_blank")
  const handleOpenCurrentWindow = () => router.push(generateScoreboardUrl())

  const saveToLocalStorage = () => {
    try {
      localStorage.setItem("vmix_settings", JSON.stringify(s))
      toast({ title: t("vmixSettings.settingsSaved"), description: t("common.success") })
      logEvent("info", "vMix settings saved to localStorage", "vmix-settings-editor")
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("vmixSettings.errorSavingSettings"),
        variant: "destructive",
      })
      logEvent("error", "vMix settings: failed to save to localStorage", "vmix-settings-editor", error)
    }
  }

  const saveToDatabase = async () => {
    try {
      setSavingToDb(true)
      const result = await saveVmixSettings({
        name: presetName || t("vmixSettings.saveSettings"),
        settings: s,
        is_default: presetIsDefault,
      })
      if (result) {
        toast({ title: t("vmixSettings.settingsSaved"), description: presetName })
        getAllVmixSettings().then(setSavedPresets).catch(() => {})
        setShowSaveDialog(false)
      } else {
        toast({ title: t("common.error"), description: t("vmixSettings.errorSavingSettings"), variant: "destructive" })
      }
    } catch (error) {
      toast({ title: t("common.error"), description: t("vmixSettings.errorSavingSettings"), variant: "destructive" })
      logEvent("error", "vMix settings: failed to save to database", "vmix-settings-editor", error)
    } finally {
      setSavingToDb(false)
    }
  }

  const loadPreset = (id: string) => {
    const preset = savedPresets.find((p) => p.id === id)
    if (preset?.settings) {
      setS(normalizeSettings(preset.settings))
      toast({ title: t("vmixSettings.settingsSaved"), description: preset.name })
    }
  }

  const transparent = s.theme === "transparent"

  return (
    <div className="container mx-auto p-4">
      <Button onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("vmixSettings.backToMatch")}
      </Button>

      <h1 className="text-2xl font-bold mb-1">{t("vmixSettings.title")}</h1>
      {matchTitle && <p className="text-muted-foreground mb-4">{matchTitle}</p>}

      <Tabs defaultValue="settings">
        <TabsList className="mb-4">
          <TabsTrigger value="settings">{t("vmixSettings.displaySettings")}</TabsTrigger>
          <TabsTrigger value="api">{t("vmixSettings.apiForVmix")}</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column — basic settings */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("vmixSettings.basicSettings")}</CardTitle>
                  <CardDescription>{t("vmixSettings.configureBasicParams")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">{t("vmixSettings.theme")}</Label>
                    <Select value={s.theme} onValueChange={(v) => set({ theme: v })}>
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
                    <Select value={s.fontSize} onValueChange={(v) => set({ fontSize: v })}>
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
                      {t("vmixSettings.playerNamesFontSize")}: {s.playerNamesFontSize}em
                    </Label>
                    <Slider
                      id="playerNamesFontSize"
                      min={0.6}
                      max={2.0}
                      step={0.1}
                      value={[s.playerNamesFontSize]}
                      onValueChange={(v) => set({ playerNamesFontSize: v[0] })}
                    />
                  </div>

                  {!transparent && (
                    <div className="space-y-2">
                      <Label htmlFor="bgOpacity">
                        {t("vmixSettings.backgroundOpacity")}: {Math.round(s.bgOpacity * 100)}%
                      </Label>
                      <Slider
                        id="bgOpacity"
                        min={0}
                        max={1}
                        step={0.05}
                        value={[s.bgOpacity]}
                        onValueChange={(v) => set({ bgOpacity: v[0] })}
                      />
                    </div>
                  )}

                  <ColorRow
                    id="textColor"
                    label={t("vmixSettings.textColor")}
                    value={s.textColor}
                    onChange={(v) => set({ textColor: v })}
                  />
                  <ColorRow
                    id="accentColor"
                    label={t("vmixSettings.accentColor")}
                    value={s.accentColor}
                    onChange={(v) => set({ accentColor: v })}
                  />

                  <Separator className="my-4" />

                  <div className="space-y-4">
                    <ToggleRow
                      id="showNames"
                      label={t("vmixSettings.showPlayerNames")}
                      checked={s.showNames}
                      onChange={(v) => set({ showNames: v })}
                    />
                    <ToggleRow
                      id="showPoints"
                      label={t("vmixSettings.showCurrentPoints")}
                      checked={s.showPoints}
                      onChange={(v) => set({ showPoints: v })}
                    />
                    <ToggleRow
                      id="showSets"
                      label={t("vmixSettings.showSetScore")}
                      checked={s.showSets}
                      onChange={(v) => set({ showSets: v })}
                    />
                    <ToggleRow
                      id="showServer"
                      label={t("vmixSettings.showServingPlayer")}
                      checked={s.showServer}
                      onChange={(v) => set({ showServer: v })}
                    />
                    <ToggleRow
                      id="showCountry"
                      label={t("vmixSettings.showCountries")}
                      checked={s.showCountry}
                      onChange={(v) => set({ showCountry: v })}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="nameAs">{t("vmixSettings.nameAs")}</Label>
                      <Select value={s.playerNameFormat} onValueChange={(v: "full" | "first" | "last") => set({ playerNameFormat: v })}>
                        <SelectTrigger id="nameAs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">{t("vmixSettings.nameAsFull")}</SelectItem>
                          <SelectItem value="first">{t("vmixSettings.nameAsFirst")}</SelectItem>
                          <SelectItem value="last">{t("vmixSettings.nameAsLast")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {s.playerNameFormat === "full" && (
                      <div className="space-y-3 border rounded-md p-3">
                        <div className="space-y-2">
                          <Label htmlFor="nameLines">{t("vmixSettings.nameLines")}</Label>
                          <Select value={s.nameLines} onValueChange={(v: "single" | "two") => set({ nameLines: v })}>
                            <SelectTrigger id="nameLines">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">{t("vmixSettings.nameLinesSingle")}</SelectItem>
                              <SelectItem value="two">{t("vmixSettings.nameLinesTwo")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="nameLineOrder">
                            {s.nameLines === "two" ? t("vmixSettings.nameLineOrderTwo") : t("vmixSettings.nameLineOrderSingle")}
                          </Label>
                          <Select value={s.nameLineOrder} onValueChange={(v: "first-top" | "last-top") => set({ nameLineOrder: v })}>
                            <SelectTrigger id="nameLineOrder">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="first-top">
                                {s.nameLines === "two" ? t("vmixSettings.nameTopFirst") : t("vmixSettings.nameOrderFirstLast")}
                              </SelectItem>
                              <SelectItem value="last-top">
                                {s.nameLines === "two" ? t("vmixSettings.nameTopLast") : t("vmixSettings.nameOrderLastFirst")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="nameCase">{t("vmixSettings.nameCase")}</Label>
                          <Select value={s.nameCase} onValueChange={(v: "as-is" | "upper" | "lower" | "capitalize") => set({ nameCase: v })}>
                            <SelectTrigger id="nameCase">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="as-is">{t("vmixSettings.nameCaseAsIs")}</SelectItem>
                              <SelectItem value="upper">{t("vmixSettings.nameCaseUpper")}</SelectItem>
                              <SelectItem value="lower">{t("vmixSettings.nameCaseLower")}</SelectItem>
                              <SelectItem value="capitalize">{t("vmixSettings.nameCaseCapitalize")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <ToggleRow
                          id="nameStyleLinked"
                          label={t("vmixSettings.nameStyleLinked")}
                          checked={s.nameSizeLinked && s.nameWeightLinked}
                          onChange={(v) => set({ nameSizeLinked: v, nameWeightLinked: v })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label htmlFor="nameSizeFirst">{t("vmixSettings.nameSizeFirst")}</Label>
                            <Input
                              id="nameSizeFirst"
                              type="number"
                              step="0.1"
                              min="0.3"
                              value={s.nameSizeFirst}
                              onChange={(e) => set({ nameSizeFirst: Number.parseFloat(e.target.value) || 1 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nameWeightFirst">{t("vmixSettings.nameWeightFirst")}</Label>
                            <Select value={s.nameWeightFirst} onValueChange={(v) => set({ nameWeightFirst: v })}>
                              <SelectTrigger id="nameWeightFirst">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="300">Light</SelectItem>
                                <SelectItem value="400">Regular</SelectItem>
                                <SelectItem value="600">SemiBold</SelectItem>
                                <SelectItem value="700">Bold</SelectItem>
                                <SelectItem value="800">ExtraBold</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {!s.nameSizeLinked && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                              <Label htmlFor="nameSizeLast">{t("vmixSettings.nameSizeLast")}</Label>
                              <Input
                                id="nameSizeLast"
                                type="number"
                                step="0.1"
                                min="0.3"
                                value={s.nameSizeLast}
                                onChange={(e) => set({ nameSizeLast: Number.parseFloat(e.target.value) || 1 })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="nameWeightLast">{t("vmixSettings.nameWeightLast")}</Label>
                              <Select value={s.nameWeightLast} onValueChange={(v) => set({ nameWeightLast: v })}>
                              <SelectTrigger id="nameWeightLast">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="300">Light</SelectItem>
                                <SelectItem value="400">Regular</SelectItem>
                                <SelectItem value="600">SemiBold</SelectItem>
                                <SelectItem value="700">Bold</SelectItem>
                                <SelectItem value="800">ExtraBold</SelectItem>
                              </SelectContent>
                            </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <ToggleRow
                      id="showAvatar"
                      label={t("vmixSettings.showAvatars")}
                      checked={s.showAvatar}
                      onChange={(v) => set({ showAvatar: v })}
                    />
                    {s.showAvatar && (
                      <ToggleRow
                        id="hideSameAvatar"
                        label={t("vmixSettings.hideSameAvatar")}
                        checked={s.hideSameAvatar}
                        onChange={(v) => set({ hideSameAvatar: v })}
                      />
                    )}
                    {s.showCountry && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="countryAs">{t("vmixSettings.countryAs")}</Label>
                          <Select value={s.countryAs} onValueChange={(v: "flag" | "code" | "name") => set({ countryAs: v })}>
                            <SelectTrigger id="countryAs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="flag">{t("vmixSettings.countryAsFlag")}</SelectItem>
                              <SelectItem value="code">{t("vmixSettings.countryAsCode")}</SelectItem>
                              <SelectItem value="name">{t("vmixSettings.countryAsName")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <ToggleRow
                          id="hideSameCountry"
                          label={t("vmixSettings.hideSameCountry")}
                          checked={s.hideSameCountry}
                          onChange={(v) => set({ hideSameCountry: v })}
                        />
                      </>
                    )}
                    <ToggleRow
                      id="showBreakPoint"
                      label={t("vmixSettings.showBreakPoint")}
                      checked={s.showBreakPoint}
                      onChange={(v) => set({ showBreakPoint: v })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
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
                  <Button onClick={handleOpenNewWindow} className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("vmixSettings.openInNewWindow")}
                  </Button>
                  <Button onClick={handleOpenCurrentWindow} className="w-full">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {t("vmixSettings.openInCurrentWindow")}
                  </Button>
                  <Button
                    onClick={() => copyToClipboard(generateScoreboardUrl(), t("vmixSettings.vmixUrlCopied"))}
                    className="w-full"
                    disabled={copying}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {copying ? t("vmixSettings.copying") : t("vmixSettings.copyUrl")}
                  </Button>
                  <Button onClick={saveToLocalStorage} className="w-full" variant="secondary">
                    <Save className="mr-2 h-4 w-4" />
                    {t("vmixSettings.saveSettings")}
                  </Button>
                  <Button
                    onClick={() => {
                      setPresetName("")
                      setPresetIsDefault(false)
                      setShowSaveDialog(true)
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    <Database className="mr-2 h-4 w-4" />
                    {t("vmixSettings.saveToDatabase")}
                  </Button>

                  {savedPresets.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <Label>{t("vmixSettings.savedSettings")}</Label>
                      <Select onValueChange={loadPreset}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("vmixSettings.selectSettings")} />
                        </SelectTrigger>
                        <SelectContent>
                          {savedPresets.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id as string}>
                              {preset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column — colours and gradients */}
            <div className="space-y-6">
              {transparent ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("vmixSettings.colorsAndGradients")}</CardTitle>
                    <CardDescription>{t("vmixSettings.transparentTheme")}</CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("vmixSettings.colorsAndGradients")}</CardTitle>
                    <CardDescription>{t("vmixSettings.configureColorsAndGradients")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Player names */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("vmixSettings.playerNameBlock")}</h3>
                      <ColorRow
                        id="namesBgColor"
                        label={t("vmixSettings.playerNameBgColor")}
                        value={s.namesBgColor}
                        onChange={(v) => set({ namesBgColor: v })}
                      />
                      <GradientControls
                        idPrefix="names"
                        label={t("vmixSettings.useGradientForNames")}
                        fromLabel={t("vmixSettings.nameGradientStartColor")}
                        toLabel={t("vmixSettings.nameGradientEndColor")}
                        on={s.namesGradient}
                        from={s.namesGradientFrom}
                        to={s.namesGradientTo}
                        onToggle={(v) => set({ namesGradient: v })}
                        onFrom={(v) => set({ namesGradientFrom: v })}
                        onTo={(v) => set({ namesGradientTo: v })}
                      />
                    </div>

                    {/* Player countries */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("vmixSettings.playerCountryBlock")}</h3>
                      <ColorRow
                        id="countryBgColor"
                        label={t("vmixSettings.playerCountryBgColor")}
                        value={s.countryBgColor}
                        onChange={(v) => set({ countryBgColor: v })}
                      />
                      <GradientControls
                        idPrefix="country"
                        label={t("vmixSettings.useGradientForCountries")}
                        fromLabel={t("vmixSettings.countryGradientStartColor")}
                        toLabel={t("vmixSettings.countryGradientEndColor")}
                        on={s.countryGradient}
                        from={s.countryGradientFrom}
                        to={s.countryGradientTo}
                        onToggle={(v) => set({ countryGradient: v })}
                        onFrom={(v) => set({ countryGradientFrom: v })}
                        onTo={(v) => set({ countryGradientTo: v })}
                      />
                    </div>

                    {/* Serving indicator */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("vmixSettings.servingIndicatorBlock")}</h3>
                      <ColorRow
                        id="serveBgColor"
                        label={t("vmixSettings.servingIndicatorBgColor")}
                        value={s.serveBgColor}
                        onChange={(v) => set({ serveBgColor: v })}
                      />
                      <ColorRow
                        id="serveAccentColor"
                        label={t("vmixSettings.servingIndicatorColor")}
                        value={s.accentColor}
                        onChange={(v) => set({ accentColor: v })}
                      />
                      <GradientControls
                        idPrefix="serve"
                        label={t("vmixSettings.useGradientForServingIndicator")}
                        fromLabel={t("vmixSettings.servingIndicatorGradientStartColor")}
                        toLabel={t("vmixSettings.servingIndicatorGradientEndColor")}
                        on={s.serveGradient}
                        from={s.serveGradientFrom}
                        to={s.serveGradientTo}
                        onToggle={(v) => set({ serveGradient: v })}
                        onFrom={(v) => set({ serveGradientFrom: v })}
                        onTo={(v) => set({ serveGradientTo: v })}
                      />
                      <div className="flex items-center space-x-2 pt-1">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center"
                          style={{
                            color: s.accentColor,
                            background: s.serveGradient
                              ? `linear-gradient(to bottom, ${s.serveGradientFrom}, ${s.serveGradientTo})`
                              : s.serveBgColor,
                          }}
                        >
                          <span style={{ fontSize: "2em", lineHeight: "0.5" }}>&bull;</span>
                        </div>
                        <span className="text-sm">{t("vmixSettings.servingIndicatorExample")}</span>
                      </div>
                    </div>

                    {/* Current score */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("vmixSettings.currentScoreBlock")}</h3>
                      <ColorRow
                        id="pointsBgColor"
                        label={t("vmixSettings.currentScoreBgColor")}
                        value={s.pointsBgColor}
                        onChange={(v) => set({ pointsBgColor: v })}
                      />
                      <GradientControls
                        idPrefix="points"
                        label={t("vmixSettings.useGradientForScore")}
                        fromLabel={t("vmixSettings.scoreGradientStartColor")}
                        toLabel={t("vmixSettings.scoreGradientEndColor")}
                        on={s.pointsGradient}
                        from={s.pointsGradientFrom}
                        to={s.pointsGradientTo}
                        onToggle={(v) => set({ pointsGradient: v })}
                        onFrom={(v) => set({ pointsGradientFrom: v })}
                        onTo={(v) => set({ pointsGradientTo: v })}
                      />
                    </div>

                    {/* Set score */}
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="font-medium">{t("vmixSettings.setScoreBlock")}</h3>
                      <ColorRow
                        id="setsBgColor"
                        label={t("vmixSettings.setScoreBgColor")}
                        value={s.setsBgColor}
                        onChange={(v) => set({ setsBgColor: v })}
                      />
                      <ColorRow
                        id="setsTextColor"
                        label={t("vmixSettings.setScoreTextColor")}
                        value={s.setsTextColor}
                        onChange={(v) => set({ setsTextColor: v })}
                      />
                      <GradientControls
                        idPrefix="sets"
                        label={t("vmixSettings.useGradientForSetScore")}
                        fromLabel={t("vmixSettings.setScoreGradientStartColor")}
                        toLabel={t("vmixSettings.setScoreGradientEndColor")}
                        on={s.setsGradient}
                        from={s.setsGradientFrom}
                        to={s.setsGradientTo}
                        onToggle={(v) => set({ setsGradient: v })}
                        onFrom={(v) => set({ setsGradientFrom: v })}
                        onTo={(v) => set({ setsGradientTo: v })}
                      />
                    </div>

                    {/* Important-moment indicator */}
                    <div className="space-y-4">
                      <h3 className="font-medium">{t("vmixSettings.importantMomentIndicator")}</h3>
                      <ColorRow
                        id="indicatorBgColor"
                        label={t("vmixSettings.indicatorBgColor")}
                        value={s.indicatorBgColor}
                        onChange={(v) => set({ indicatorBgColor: v })}
                      />
                      <ColorRow
                        id="indicatorTextColor"
                        label={t("vmixSettings.indicatorTextColor")}
                        value={s.indicatorTextColor}
                        onChange={(v) => set({ indicatorTextColor: v })}
                      />
                      <GradientControls
                        idPrefix="indicator"
                        label={t("vmixSettings.useGradientForIndicator")}
                        fromLabel={t("vmixSettings.indicatorGradientStartColor")}
                        toLabel={t("vmixSettings.indicatorGradientEndColor")}
                        on={s.indicatorGradient}
                        from={s.indicatorGradientFrom}
                        to={s.indicatorGradientTo}
                        onToggle={(v) => set({ indicatorGradient: v })}
                        onFrom={(v) => set({ indicatorGradientFrom: v })}
                        onTo={(v) => set({ indicatorGradientTo: v })}
                      />
                      <div
                        className="rounded text-center py-1 px-2 font-bold"
                        style={{
                          color: s.indicatorTextColor,
                          background: s.indicatorGradient
                            ? `linear-gradient(to bottom, ${s.indicatorGradientFrom}, ${s.indicatorGradientTo})`
                            : s.indicatorBgColor,
                        }}
                      >
                        MATCH POINT
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                  <Input readOnly value={typeof window !== "undefined" ? generateJsonUrl() : ""} />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(generateJsonUrl(), t("vmixSettings.jsonApiUrlCopied"))}
                    disabled={copying}
                  >
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
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => copyToClipboard(generateJsonUrl(), t("vmixSettings.jsonApiUrlCopied"))}
                className="w-full"
                disabled={copying}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t("vmixSettings.copyJsonApiUrl")}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save-to-database dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{t("vmixSettings.saveSettingsDialog")}</CardTitle>
              <CardDescription>{t("vmixSettings.saveSettingsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="presetName">{t("vmixSettings.settingsName")}</Label>
                <Input
                  id="presetName"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder={t("vmixSettings.settingsNamePlaceholder")}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="presetIsDefault"
                  checked={presetIsDefault}
                  onCheckedChange={(c) => setPresetIsDefault(c === true)}
                />
                <Label htmlFor="presetIsDefault">{t("vmixSettings.useAsDefault")}</Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                {t("vmixSettings.cancelButton")}
              </Button>
              <Button onClick={saveToDatabase} disabled={savingToDb}>
                {savingToDb ? t("vmixSettings.savingButton") : t("vmixSettings.saveButton")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
