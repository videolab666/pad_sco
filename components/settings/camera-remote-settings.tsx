"use client"

// Панель «Удалённые настройки камер» (plan 2026-09-02 remote-camera-settings).
//
// Desired-state: PUT /api/video/sources/{key}/settings → камера применяет в
// течение ≤10с (heartbeat) и подтверждает версию → pending гаснет.
//
// UX-контракт (баг-репорт 2026-09-02):
//  - список камер панель тянет САМА и держит последний непустой — рефреш
//    родителя и мигания сетки не размонтируют карточки;
//  - поля формы гидратуются ОДИН раз при открытии; опрос каждые 5с
//    обновляет только статус (pending/версии) и НЕ трогает несохранённые
//    правки; «Обновить значения» — осознанный сброс из desired.

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, ChevronDown, Loader2, RefreshCw, RotateCcw, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CameraSettingsState {
  pending: boolean
  version: number
  device: { version?: number; localSeq?: number } | null
  caps: Record<string, number | boolean> | null
  cameras: Array<{ id: string; facing: string; focal35mm: number | null; logical: boolean; physicalIds?: string[]; pixelArray: string }>
  activeCameraId: string | null
  sceneFlicker: string | null
  desired: { camera?: Record<string, unknown>; stream?: Record<string, unknown> }
}

const EXPOSURE_MODES: Array<{ value: string; label: string }> = [
  { value: "auto", label: "Авто (ISO + выдержка)" },
  { value: "manualShutter", label: "Приоритет выдержки (авто-ISO)" },
  { value: "manualIso", label: "Приоритет ISO (авто-выдержка)" },
  { value: "manual", label: "Полный мануал" },
]

const PROC_PROFILES: Array<{ value: string; label: string; hint: string }> = [
  {
    value: "standard",
    label: "Standard Camera2",
    hint: "Дефолтный видео-пайплайн (как было).",
  },
  {
    value: "highlight",
    label: "Защита светов",
    hint: "Замер экспозиции как в стоковой камере (vendor metering=1) — света не выжигаются.",
  },
  {
    value: "oplus",
    label: "Oplus/Stock (эксперимент)",
    hint: "Сток-рецепт: metering=1 + Oplus APS-профиль. Если HAL отвергнет vendor-ключи — автооткат на «Защиту светов».",
  },
]

function cameraLabel(c: { id: string; facing: string; focal35mm: number | null; logical: boolean; physicalIds?: string[] }): string {
  if (c.facing !== "back") return `${c.id} · фронтальная`
  if (c.logical) return `${c.id} · логическая мульти-камера${c.physicalIds?.length ? ` (${c.physicalIds.join("+")})` : ""} — как сток`
  const mm = c.focal35mm
  if (mm != null && mm <= 16) return `${c.id} · ультраширик ~${Math.round(mm)}мм`
  if (mm != null && mm >= 60) return `${c.id} · теле ~${Math.round(mm)}мм`
  return `${c.id} · широкоугольная${mm != null ? ` ~${Math.round(mm)}мм` : ""}`
}

const SHUTTER_PRESETS = [
  { label: "1/25", ns: 40_000_000 },
  { label: "1/50", ns: 20_000_000 },
  { label: "1/60", ns: 16_666_667 },
  { label: "1/100", ns: 10_000_000 },
  { label: "1/120", ns: 8_333_333 },
]

const EV_STEP_FALLBACK = 1 / 6

const ANTIBANDING_MODES: Array<{ value: string; label: string }> = [
  { value: "50hz", label: "50 Гц" },
  { value: "60hz", label: "60 Гц" },
  { value: "auto", label: "Авто-детект" },
  { value: "off", label: "Выкл" },
]

export function CameraRemoteSettings() {
  // Последний непустой список держим: пустой ответ/мигание сети не роняют карточки
  const [cameras, setCameras] = useState<Array<{ id: string; streamKey: string; status: string }>>([])
  const camerasRef = useRef(cameras)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const loadCameras = useCallback(async () => {
    try {
      const res = await fetch("/api/video/sources", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      const list: Array<{ id: string; streamKey: string; status: string }> = (data.sources ?? []).map(
        (s: { id: string; streamKey: string; status: string }) => ({
          id: s.id,
          streamKey: s.streamKey,
          status: s.status,
        }),
      )
      if (list.length > 0) {
        camerasRef.current = list
        setCameras(list)
      }
    } catch {
      /* тишина — держим прежний список */
    }
  }, [])

  useEffect(() => {
    void loadCameras()
    const t = setInterval(() => void loadCameras(), 15_000)
    return () => clearInterval(t)
  }, [loadCameras])

  if (cameras.length === 0) return null

  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        Удалённые настройки камер
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Применяются на телефоне автоматически в течение ~10 секунд (через heartbeat).
        Локальные правки на телефоне также попадают сюда.
      </p>
      <div className="space-y-2">
        {cameras.map(src => (
          <CameraRow
            key={src.streamKey}
            source={src}
            open={openKey === src.streamKey}
            onToggle={() => setOpenKey(openKey === src.streamKey ? null : src.streamKey)}
          />
        ))}
      </div>
    </section>
  )
}

function CameraRow({ source, open, onToggle }: { source: { streamKey: string; status: string }; open: boolean; onToggle: () => void }) {
  const [state, setState] = useState<CameraSettingsState | null>(null)
  const [mode, setMode] = useState("auto")
  const [shutterNs, setShutterNs] = useState(20_000_000)
  const [iso, setIso] = useState(400)
  const [evSteps, setEvSteps] = useState(0)
  const [antibanding, setAntibanding] = useState("50hz")
  const [cameraSel, setCameraSel] = useState("auto")
  const [profile, setProfile] = useState("standard")
  const [zoom, setZoom] = useState(1)
  const [saturation, setSaturation] = useState(0)
  const [contrast, setContrast] = useState(1)
  const [gamma, setGamma] = useState(1)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const hydrated = useRef(false)

  // Статус: pending/версии/caps — на каждый опрос;
  // ФОРМА (mode/shutter/iso/ev) — только при первом успехе или по кнопке
  const load = useCallback(
    async (hydrateForm: boolean) => {
      try {
        const res = await fetch(`/api/video/sources/${source.streamKey}/settings`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as CameraSettingsState
        setState(data)
        if (hydrateForm || !hydrated.current) {
          const cam = data.desired.camera ?? {}
          if (typeof cam.camera_exposure_mode === "string") setMode(cam.camera_exposure_mode)
          if (typeof cam.camera_exposure_ns === "number") setShutterNs(cam.camera_exposure_ns)
          if (typeof cam.camera_iso === "number") setIso(cam.camera_iso)
          if (typeof cam.camera_exposure_compensation_steps === "number") {
            setEvSteps(cam.camera_exposure_compensation_steps)
          }
          if (typeof cam.camera_antibanding === "string") setAntibanding(cam.camera_antibanding)
          if (typeof cam.camera_zoom_ratio === "number" && cam.camera_zoom_ratio > 0) setZoom(cam.camera_zoom_ratio)
          if (typeof cam.camera_saturation === "number") setSaturation(cam.camera_saturation)
          if (typeof cam.camera_contrast === "number" && cam.camera_contrast > 0) setContrast(cam.camera_contrast)
          if (typeof cam.camera_gamma === "number" && cam.camera_gamma > 0) setGamma(cam.camera_gamma)
          if (typeof cam.camera_proc_profile === "string" && PROC_PROFILES.some(p => p.value === cam.camera_proc_profile)) {
            setProfile(cam.camera_proc_profile)
          }
          const st = data.desired.stream ?? {}
          if (typeof st.cameraId === "string") setCameraSel(st.cameraId)
          hydrated.current = true
        }
      } catch {
        /* тихо */
      }
    },
    [source.streamKey],
  )

  useEffect(() => {
    if (!open) return
    void load(false)
    const t = setInterval(() => void load(false), 5000)
    return () => clearInterval(t)
  }, [open, load])

  const put = useCallback(
    async (camera: Record<string, unknown>, noteText: string, stream?: Record<string, unknown>) => {
      setBusy(true)
      setNote("")
      try {
        const res = await fetch(`/api/video/sources/${source.streamKey}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stream ? { camera, stream } : { camera }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setNote(body?.message ?? "Не удалось сохранить")
        } else {
          setNote(noteText)
          await load(false)
        }
      } catch {
        setNote("Нет связи с сервером")
      } finally {
        setBusy(false)
      }
    },
    [source.streamKey, load],
  )

  const evStep = Number(state?.caps?.evStepEv) > 0 ? Number(state?.caps?.evStepEv) : EV_STEP_FALLBACK
  const evMin = Number(state?.caps?.evMin ?? -18)
  const evMax = Number(state?.caps?.evMax ?? 18)
  const isoMin = Number(state?.caps?.isoMin ?? 100)
  const isoMax = Number(state?.caps?.isoMax ?? 6400)

  return (
    <Card className="overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/40">
        <span className="flex items-center gap-2 text-sm">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono">{source.streamKey}</span>
          {state?.pending && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">ждёт применения</Badge>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <CardContent className="space-y-4 border-t pt-4">
          {/* Камера: каталог с устройства; активная подсвечена */}
          <div className="space-y-2">
            <Label className="text-xs">
              Камера
              {state?.activeCameraId && (
                <Badge className="ml-2 bg-emerald-500/15 text-emerald-300 border-emerald-500/30" variant="outline">
                  активна: {state.activeCameraId}
                </Badge>
              )}
            </Label>
            <div className="grid gap-1.5">
              <button
                onClick={() => setCameraSel("auto")}
                disabled={busy}
                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  cameraSel === "auto"
                    ? "border-[#A4FB23]/60 bg-[#A4FB23]/10 text-[#A4FB23]"
                    : "border-border text-muted-foreground hover:border-[#A4FB23]/30"
                }`}
              >
                <span className="font-medium">auto</span>
                <span className="ml-2 opacity-70">— авто-выбор (ультраширик с макс. разрешением)</span>
              </button>
              {(state?.cameras ?? []).map(c => (
                <button
                  key={c.id}
                  onClick={() => setCameraSel(c.id)}
                  disabled={busy}
                  className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                    cameraSel === c.id
                      ? "border-[#A4FB23]/60 bg-[#A4FB23]/10 text-[#A4FB23]"
                      : "border-border text-muted-foreground hover:border-[#A4FB23]/30"
                  }`}
                >
                  <span className="font-medium">{cameraLabel(c)}</span>
                  <span className="ml-2 opacity-60 font-mono">{c.pixelArray}</span>
                  {state?.activeCameraId === c.id && (
                    <Badge className="ml-2 bg-emerald-500/15 text-emerald-300 border-emerald-500/30" variant="outline">
                      активна
                    </Badge>
                  )}
                </button>
              ))}
              {/* id может отсутствовать в каталоге (прошивка/модель) — ручной ввод */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={cameraSel === "auto" ? "" : cameraSel}
                  placeholder="ручной id, напр. 5"
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2)
                    setCameraSel(v || "auto")
                  }}
                  className="h-7 w-32 text-xs font-mono"
                />
                <span className="text-[11px] text-muted-foreground">невалидный id откатится на auto</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Zoom: {zoom.toFixed(2)}× {zoom <= 0.7 ? "(ультраширик)" : zoom >= 0.95 && zoom <= 1.05 ? "(основной сенсор)" : ""}
              </Label>
              <input
                type="range"
                min={Number(state?.caps?.zoomMin) > 0 ? Number(state?.caps?.zoomMin) : 0.66}
                max={Math.min(Number(state?.caps?.zoomMax) > 1 ? Number(state?.caps?.zoomMax) : 8, 8)}
                step={0.01}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="w-full accent-[#A4FB23]"
              />
              <p className="text-[11px] text-muted-foreground">
                На логической камере 0.66× = ультраширик (как сток), 1× = основной сенсор (максимум качества)
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Смена камеры перезапускает трансляцию (~10–15 секунд)
            </p>
          </div>

          {/* Профиль обработки */}
          <div className="space-y-2">
            <Label className="text-xs">Профиль обработки (динамический диапазон)</Label>
            <div className="grid gap-2">
              {PROC_PROFILES.map(p => (
                <button
                  key={p.value}
                  onClick={() => setProfile(p.value)}
                  disabled={busy}
                  className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                    profile === p.value
                      ? "border-[#A4FB23]/60 bg-[#A4FB23]/10 text-[#A4FB23]"
                      : "border-border text-muted-foreground hover:border-[#A4FB23]/30"
                  }`}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="mt-0.5 block text-[11px] opacity-70">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Изображение: насыщенность/контраст/гамма (нейтраль = чистый путь без GL-фильтров) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Изображение
                {(saturation !== 0 || contrast !== 1 || gamma !== 1) && (
                  <Badge className="ml-2 bg-violet-500/15 text-violet-300 border-violet-500/30" variant="outline">
                    фильтры активны
                  </Badge>
                )}
              </Label>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || (saturation === 0 && contrast === 1 && gamma === 1)}
                onClick={() => {
                  setSaturation(0)
                  setContrast(1)
                  setGamma(1)
                  void put(
                    { camera_saturation: 0, camera_contrast: 1, camera_gamma: 1 },
                    "Сброс картинки отправлен — чистый путь без фильтров",
                  )
                }}
                title="Немедленно вернуть нейтральные значения и применить на камеру"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Сброс
              </Button>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">
                Насыщенность: {saturation > 0 ? "+" : ""}{saturation.toFixed(2)}
                {saturation === 0 && <span className="ml-1 opacity-60">(нейтрально)</span>}
              </Label>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={saturation}
                onChange={e => setSaturation(Number(e.target.value))}
                className="w-full accent-[#A4FB23]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">
                Контраст: {contrast.toFixed(2)}×{contrast === 1 && <span className="ml-1 opacity-60">(нейтрально)</span>}
              </Label>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={contrast}
                onChange={e => setContrast(Number(e.target.value))}
                className="w-full accent-[#A4FB23]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">
                Гамма: {gamma.toFixed(2)}{gamma === 1 && <span className="ml-1 opacity-60">(нейтрально)</span>}
              </Label>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={gamma}
                onChange={e => setGamma(Number(e.target.value))}
                className="w-full accent-[#A4FB23]"
              />
              <p className="text-[11px] text-muted-foreground">
                &lt;1 — светлее тени, &gt;1 — темнее. Все значения нейтральны → стрим идёт без GL-фильтров (макс. качество);
                первая правка ставит фильтры (рестарт ~10–15с), дальнейшие правки применяются сразу.
              </p>
            </div>
          </div>

          {/* Режим экспозиции */}
          <div className="space-y-2">
            <Label className="text-xs">Режим экспозиции</Label>
            <div className="grid grid-cols-2 gap-2">
              {EXPOSURE_MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  disabled={busy}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    mode === m.value
                      ? "border-[#A4FB23]/60 bg-[#A4FB23]/10 text-[#A4FB23]"
                      : "border-border text-muted-foreground hover:border-[#A4FB23]/30"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Анти-бэндинг (кратность выдержек частоте сети) */}
          <div className='space-y-2'>
            <Label className='text-xs'>
              Анти-бэндинг (выдержки, кратные частоте света)
              {state?.sceneFlicker && (
                <Badge className='ml-2 bg-sky-500/15 text-sky-300 border-sky-500/30' variant='outline'>
                  сеть: {state.sceneFlicker === '50hz' ? '50 Гц' : state.sceneFlicker === '60hz' ? '60 Гц' : state.sceneFlicker}
                </Badge>
              )}
            </Label>
            <div className='flex flex-wrap gap-2'>
              {ANTIBANDING_MODES.map(ab => (
                <button
                  key={ab.value}
                  onClick={() => setAntibanding(ab.value)}
                  disabled={busy}
                  className={`rounded-md border px-2.5 py-1 text-xs ${
                    antibanding === ab.value
                      ? "border-[#A4FB23]/60 bg-[#A4FB23]/10 text-[#A4FB23]"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {ab.label}
                </button>
              ))}
            </div>
            <p className='text-[11px] text-muted-foreground'>
              В «Авто» держит выдержки, кратные сети (1/100, 1/50 при 50 Гц) — полосы от света не появляются
            </p>
          </div>

          {/* Выдержка: актуальна в manualShutter и manual */}
          {(mode === "manualShutter" || mode === "manual") && (
            <div className="space-y-2">
              <Label className="text-xs">
                Выдержка {mode === "manualShutter" ? "(ISO — авто)" : ""} · {(shutterNs / 1e6).toFixed(1)} мс
              </Label>
              <div className="flex flex-wrap gap-2">
                {SHUTTER_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setShutterNs(p.ns)}
                    disabled={busy}
                    className={`rounded-md border px-2.5 py-1 text-xs font-mono ${
                      Math.abs(shutterNs - p.ns) < 1_000_000
                        ? "border-[#A4FB23]/60 bg-[#A4FB23]/10 text-[#A4FB23]"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <Input
                  type="number"
                  value={shutterNs}
                  onChange={e => setShutterNs(Number(e.target.value) || 0)}
                  className="h-7 w-28 text-xs font-mono"
                  title="Наносекунды"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">1/50 и 1/100 убирают полосы от света 50 Гц</p>
            </div>
          )}

          {/* ISO: ручное в manual и manualIso */}
          {(mode === "manual" || mode === "manualIso") && (
            <div className="space-y-1">
              <Label className="text-xs">
                ISO ({isoMin}–{isoMax})
              </Label>
              <Input
                type="number"
                value={iso}
                min={isoMin}
                max={isoMax}
                onChange={e => setIso(Number(e.target.value) || isoMin)}
                className="h-8 w-28 text-xs font-mono"
              />
            </div>
          )}

          {/* EV: везде кроме полного мануала */}
          {mode !== "manual" && (
            <div className="space-y-1">
              <Label className="text-xs">
                Коррекция экспозиции: {(evSteps * evStep).toFixed(2)} EV (шаг {evStep.toFixed(3)})
              </Label>
              <input
                type="range"
                min={evMin}
                max={evMax}
                value={evSteps}
                onChange={e => setEvSteps(Number(e.target.value))}
                className="w-full accent-[#A4FB23]"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() =>
                void put(
                  {
                    camera_exposure_mode: mode,
                    ...(mode === "manualShutter" || mode === "manual" ? { camera_exposure_ns: shutterNs } : {}),
                    ...(mode === "manual" || mode === "manualIso" ? { camera_iso: iso } : {}),
                    ...(mode !== "manual" ? { camera_exposure_compensation_steps: evSteps } : {}),
                    camera_antibanding: antibanding,
                    camera_zoom_ratio: zoom,
                    camera_proc_profile: profile,
                    camera_saturation: saturation,
                    camera_contrast: contrast,
                    camera_gamma: gamma,
                  },
                  "Отправлено — ждём подтверждения с камеры",
                  { cameraId: cameraSel },
                )
              }
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Применить на камеру
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void put({ camera_exposure_mode: "auto" }, "Сброс к авто отправлен")}
              disabled={busy}
            >
              <RotateCcw className="mr-1 h-4 w-4" /> Сбросить к авто
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void load(true)}
              disabled={busy}
              title="Заменить несохранённые правки текущим желаемым конфигом"
            >
              <RefreshCw className="mr-1 h-4 w-4" /> Обновить значения
            </Button>
            {state && (
              <span className="text-xs text-muted-foreground">
                desired v{state.version} · камера v{state.device?.version ?? 0}
                {state.pending ? " · применяется…" : " · синхронизировано"}
              </span>
            )}
          </div>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </CardContent>
      )}
    </Card>
  )
}
