"use client"

// Вкладка «Видео» в /settings — управление камерами, записями, клипами.
//
// Дизайн-паттерны из анализа конкурентов:
//   Clutch: тёмные статусные карточки камер (🟢 REC / ⚪ IDLE), chip-кнопки
//   Veo: список записей с inline-действиями (VOD / Клипы / Reel)
//   Hudl: health-метрики на карточке камеры (fps, битрейт, температура)
//
// Наш дизайн-язык: #0A0F0A фон, #A4FB23 акцент, Card-based layout.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity, Calendar as CalendarIcon, Camera, ChevronLeft, ChevronRight,
  Clapperboard, Film, Loader2, Monitor, Play,
  Radio, RefreshCw, Square, X, Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// ─── Типы (соответствуют API) ──────────────────────────────────────────────

interface VideoSource {
  id: string
  name: string
  streamKey: string
  status: "offline" | "online" | "recording"
  health: Record<string, unknown>
  lastSeenAt: string | null
  courtId: string | null
}

interface RecordingSession {
  id: string
  courtId: string | null
  sourceId: string | null
  status: string
  startedAt: string
  endedAt: string | null
  metadata: Record<string, unknown>
}

interface ClipRequest {
  id: string
  status: string
  variant: string
  durationMs: number
  fileName: string | null
  thumbName: string | null
}

interface HighlightReel {
  id: string
  status: string
  topN: number
  durationMs: number | null
  fileName: string | null
}

interface CourtInfo {
  id: string
  name: string
  shortCode: string
  number: number | null
}

interface CalendarDay {
  count: number
  courts: Array<{ id: string; name: string; shortCode: string }>
  totalDurationMs: number
  hasActive: boolean
}

// ─── Компонент ─────────────────────────────────────────────────────────────

const MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

export function VideoSettings() {
  const [sources, setSources] = useState<VideoSource[]>([])
  const [recordings, setRecordings] = useState<RecordingSession[]>([])
  const [clips, setClips] = useState<ClipRequest[]>([])
  const [reels, setReels] = useState<HighlightReel[]>([])
  const [courts, setCourts] = useState<CourtInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  // Календарь
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1) // 1-12
  const [calendarDays, setCalendarDays] = useState<Record<string, CalendarDay>>({})
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const monthKey = `${calYear}-${String(calMonth).padStart(2, "0")}`

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [srcRes, recRes, courtsRes, calRes] = await Promise.all([
        fetch("/api/video/sources", { cache: "no-store" }),
        fetch("/api/video/recordings?limit=50", { cache: "no-store" }),
        fetch("/api/v1/courts", { cache: "no-store" }),
        fetch(`/api/video/recordings/calendar?month=${monthKey}`, { cache: "no-store" }),
      ])
      if (srcRes.status === 401) { setError("Нет доступа — войдите заново"); return }
      const srcData = await srcRes.json()
      const recData = await recRes.json()
      const courtsData = await courtsRes.json()
      const calData = await calRes.json()
      setSources(srcData.sources ?? [])
      setRecordings(recData.recordings ?? [])
      setCourts(courtsData.courts ?? [])
      setCalendarDays(calData.days ?? {})

      // Клипы и reels — из записей
      const readyClips: ClipRequest[] = []
      const readyReels: HighlightReel[] = []
      for (const rec of (recData.recordings ?? []).slice(0, 10)) {
        try {
          const [clipRes, reelRes] = await Promise.all([
            fetch(`/api/video/clips?recording=${rec.id}`, { cache: "no-store" }),
            fetch(`/api/video/reels?recording=${rec.id}`, { cache: "no-store" }),
          ])
          const clipData = await clipRes.json()
          const reelData = await reelRes.json()
          readyClips.push(...(clipData.clips ?? []))
          readyReels.push(...(reelData.reels ?? []))
        } catch { /* пропускаем */ }
      }
      setClips(readyClips.filter(c => c.status === "ready"))
      setReels(readyReels.filter(r => r.status === "ready"))
    } catch {
      setError("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }, [monthKey])

  useEffect(() => { void load() }, [load])

  // Автообновление каждые 15с
  useEffect(() => {
    const t = setInterval(() => void load(), 15_000)
    return () => clearInterval(t)
  }, [load])

  const startRecording = async (streamKey: string) => {
    setBusy(streamKey)
    try {
      await fetch("/api/video/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamKey }),
      })
      await load()
    } finally { setBusy(null) }
  }

  const stopRecording = async (id: string) => {
    setBusy(id)
    try {
      // recording → finalizing → uploading → ready
      for (const st of ["finalizing", "uploading", "ready"]) {
        await fetch(`/api/video/recordings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: st }),
        })
      }
      await load()
    } finally { setBusy(null) }
  }

  const courtName = (courtId: string | null) =>
    courts.find(c => c.id === courtId)?.name ?? "—"

  const courtCode = (courtId: string | null) =>
    courts.find(c => c.id === courtId)?.shortCode

  const fmtDuration = (ms: number) => {
    const s = Math.floor(ms / 1000)
    return s >= 3600 ? `${Math.floor(s/3600)}ч ${Math.floor((s%3600)/60)}м` : `${Math.floor(s/60)}м ${s%60}с`
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

  const recSources = sources.filter(s => s.status === "recording").length
  const onlineSources = sources.filter(s => s.status !== "offline").length

  // Фильтр записей по дате (клик в календаре)
  const filteredRecordings = useMemo(() => {
    if (!selectedDate) return recordings
    return recordings.filter(r => r.startedAt.slice(0, 10) === selectedDate)
  }, [recordings, selectedDate])

  // Дни месяца для сетки календаря
  const calendarCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(calYear, calMonth - 1, 1))
    const daysInMonth = new Date(Date.UTC(calYear, calMonth, 0)).getUTCDate()
    // Пн=0..Вс=6 (JS getUTCDay: Вс=0)
    const startOffset = (firstDay.getUTCDay() + 6) % 7
    const cells: Array<{ day: number | null; dateKey: string | null }> = []
    for (let i = 0; i < startOffset; i++) cells.push({ day: null, dateKey: null })
    for (let d = 1; d <= daysInMonth; d++) {
      const dk = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      cells.push({ day: d, dateKey: dk })
    }
    return cells
  }, [calYear, calMonth])

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  return (
    <div className="space-y-6">
      {/* ─── Заголовок ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Видеостудия</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {onlineSources > 0
              ? `${onlineSources} камер(а) онлайн · ${recSources} пишут`
              : "Камер нет — запустите Camera Agent на телефоне"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ─── КАМЕРЫ (Clutch-style status cards) ───────────────────── */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Камеры
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
          </div>
        ) : sources.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <Camera className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Нет камер. Установите <strong>Padel Camera Agent</strong> на телефон
                и введите код корта — камера появится здесь автоматически.
              </p>
              <Link href="/c/play" className="text-xs text-[#A4FB23] hover:underline">
                Как подключить →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map(src => {
              const isRec = src.status === "recording"
              const isOnline = src.status !== "offline"
              const health = src.health as Record<string, number | string | boolean>
              return (
                <Card
                  key={src.id}
                  className={`relative overflow-hidden ${
                    isRec ? "border-[#A4FB23]/40" : isOnline ? "border-sky-400/30" : "border-white/10"
                  }`}
                >
                  {isRec && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A4FB23] to-transparent" />
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {isRec ? (
                          <Radio className="h-5 w-5 text-[#A4FB23] animate-pulse" />
                        ) : isOnline ? (
                          <Camera className="h-5 w-5 text-sky-400" />
                        ) : (
                          <Camera className="h-5 w-5 text-muted-foreground/50" />
                        )}
                        <div>
                          <div className="font-semibold text-sm">{courtName(src.courtId)}</div>
                          <div className="text-xs text-muted-foreground font-mono">{src.streamKey}</div>
                        </div>
                      </div>
                      <Badge
                        variant={isRec ? "default" : isOnline ? "secondary" : "outline"}
                        className={isRec ? "bg-[#A4FB23] text-black" : ""}
                      >
                        {isRec ? "REC" : isOnline ? "ONLINE" : "OFFLINE"}
                      </Badge>
                    </div>

                    {/* Health metrics (Hudl-style) */}
                    {isOnline && (
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <HealthMetric label="FPS" value={health.fps?.toString() ?? "—"} />
                        <HealthMetric label="Bitrate" value={health.bitrateKbps ? `${health.bitrateKbps}k` : health.bitrateBps ? `${Math.round(Number(health.bitrateBps)/1000)}k` : "—"} />
                        <HealthMetric label="Temp" value={health.batteryTempC ? `${health.batteryTempC}°` : "—"} />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {isRec ? (
                        <Button
                          size="sm" variant="destructive"
                          disabled={busy === src.id}
                          onClick={() => {
                            const rec = recordings.find(r => r.sourceId === src.id && r.status === "recording")
                            if (rec) void stopRecording(rec.id)
                          }}
                          className="flex-1"
                        >
                          {busy === src.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                          Стоп
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy === src.id || !isOnline}
                          onClick={() => void startRecording(src.streamKey)}
                          className="flex-1"
                        >
                          {busy === src.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          Запись
                        </Button>
                      )}
                      {courtCode(src.courtId) && (
                        <Link
                          href={`/c/${courtCode(src.courtId)}/video`}
                          target="_blank"
                          className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                        >
                          <Monitor className="h-3.5 w-3.5 inline mr-1" />
                          Live
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ─── КАЛЕНДАРЬ ЗАПИСЕЙ ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Календарь записей
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm"
              onClick={() => {
                const m = calMonth - 1
                if (m < 1) { setCalMonth(12); setCalYear(calYear - 1) } else setCalMonth(m)
                setSelectedDate(null)
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[120px] text-center">
              {MONTHS_RU[calMonth - 1]} {calYear}
            </span>
            <Button
              variant="ghost" size="sm"
              onClick={() => {
                const m = calMonth + 1
                if (m > 12) { setCalMonth(1); setCalYear(calYear + 1) } else setCalMonth(m)
                setSelectedDate(null)
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="p-3">
          {/* Дни недели */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS_RU.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold uppercase text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>
          {/* Сетка дней */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, i) => {
              if (!cell.day) return <div key={i} />
              const info = cell.dateKey ? calendarDays[cell.dateKey] : null
              const hasRec = info && info.count > 0
              const isSelected = cell.dateKey === selectedDate
              const isToday = cell.dateKey === todayKey
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(isSelected ? null : cell.dateKey)}
                  disabled={!hasRec}
                  className={`
                    relative aspect-square rounded-md text-xs font-medium transition-all
                    ${isSelected
                      ? "bg-[#A4FB23] text-black font-bold"
                      : hasRec
                        ? "bg-[#A4FB23]/15 text-[#A4FB23] hover:bg-[#A4FB23]/25 cursor-pointer"
                        : isToday
                          ? "border border-white/20 text-white/60"
                          : "text-muted-foreground/50"
                    }
                  `}
                  title={hasRec
                    ? `${info!.count} записей · ${info!.courts.map(c => c.name).join(", ")} · ${Math.round(info!.totalDurationMs / 60000)} мин`
                    : undefined
                  }
                >
                  {cell.day}
                  {hasRec && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {info!.hasActive && (
                        <span className="h-1 w-1 rounded-full bg-[#A4FB23] animate-pulse" />
                      )}
                      <span className="h-1 w-1 rounded-full bg-[#A4FB23]/60" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Фильтр по дате — бейдж с кнопкой сброса */}
        {selectedDate && (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <CalendarIcon className="h-3 w-3" />
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
              : {filteredRecordings.length} записей
            </Badge>
            <Button
              variant="ghost" size="sm"
              onClick={() => setSelectedDate(null)}
              className="h-6 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Сбросить
            </Button>
          </div>
        )}
      </section>

      {/* ─── ЗАПИСИ (Veo-style list with actions) ──────────────────── */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Записи
        </h3>
        {filteredRecordings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              <Film className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              {selectedDate
                ? `Нет записей за ${new Date(selectedDate + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
                : "Записей пока нет. Нажмите «Запись» на камере выше."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredRecordings.map(rec => {
              const isRec = rec.status === "recording"
              const endedMs = rec.endedAt ? Date.parse(rec.endedAt) - Date.parse(rec.startedAt) : 0
              const code = courtCode(rec.courtId)
              return (
                <Card key={rec.id} className={`p-3 ${isRec ? "border-[#A4FB23]/30" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`rounded-lg p-2 ${isRec ? "bg-[#A4FB23]/10" : "bg-white/5"}`}>
                        {isRec ? (
                          <Radio className="h-5 w-5 text-[#A4FB23] animate-pulse" />
                        ) : (
                          <Film className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {courtName(rec.courtId)}
                          <span className="ml-2 text-muted-foreground font-normal">
                            {fmtDate(rec.startedAt)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isRec ? `Пишет… ${Math.round((Date.now() - Date.parse(rec.startedAt)) / 60000)} мин` : fmtDuration(endedMs)}
                          {" · "}
                          <span className={isRec ? "text-[#A4FB23]" : ""}>{rec.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {code && (
                        <Link
                          href={`/c/${code}/video`}
                          target="_blank"
                          className="rounded-md border border-[#A4FB23]/30 bg-[#A4FB23]/10 px-2.5 py-1 text-xs font-semibold text-[#A4FB23] hover:bg-[#A4FB23]/20"
                        >
                          <Play className="h-3 w-3 inline mr-1" />
                          VOD
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ─── КЛИПЫ (grid with thumbnails) ──────────────────────────── */}
      {clips.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Клипы ({clips.length})
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {clips.map(clip => (
              <a
                key={clip.id}
                href={`/api/v1/video/clips/${clip.id}/file`}
                target="_blank"
                className="group relative overflow-hidden rounded-lg border border-white/10 hover:border-[#A4FB23]/50"
              >
                <div className={`bg-black/90 flex items-center justify-center ${
                  clip.variant === "vertical" ? "aspect-[9/16]" : "aspect-video"
                }`}>
                  <Clapperboard className="h-6 w-6 text-muted-foreground/40 group-hover:text-[#A4FB23] transition-colors" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                  <span className="text-[10px] font-mono text-white/80">
                    {Math.round(clip.durationMs / 1000)}с
                  </span>
                  {clip.variant === "vertical" && (
                    <span className="ml-1 text-[9px] text-[#A4FB23]">9:16</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ─── REELS ─────────────────────────────────────────────────── */}
      {reels.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Highlight Reels ({reels.length})
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {reels.map(reel => (
              <a
                key={reel.id}
                href={`/api/v1/video/reels/${reel.id}/file`}
                target="_blank"
                className="group relative overflow-hidden rounded-xl border border-[#A4FB23]/20 hover:border-[#A4FB23]/60"
              >
                <div className="aspect-[9/16] bg-gradient-to-b from-[#11240e] to-[#0A0F0A] flex items-center justify-center">
                  <Zap className="h-10 w-10 text-[#A4FB23]/60 group-hover:text-[#A4FB23] transition-colors" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                  <span className="text-xs font-mono text-white/90">
                    {fmtDuration(reel.durationMs ?? 0)}
                  </span>
                  <span className="block text-[10px] text-[#A4FB23]">
                    топ-{reel.topN} моментов
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ─── Пустое состояние ───────────────────────────────────────── */}
      {!loading && sources.length === 0 && recordings.length === 0 && clips.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Activity className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Видеостудия пуста. Подключите камеру (OnePlus + Camera Agent),
              запустите запись — здесь появятся live-статусы, записи,
              автоматические клипы и highlight reels.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Вспомогательные компоненты ─────────────────────────────────────────────

function HealthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 px-2 py-1 text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-xs font-mono font-semibold">{value}</div>
    </div>
  )
}
