"use client"

// Видео корта (plan-4 §146): /c/{code}/video.
//
// - LIVE: LL-HLS с venue gateway (hls.js, Apache-2.0)
// - Полный матч: VOD через playback API (gateway склеивает fMP4-сегменты)
// - Маркеры на таймлайне (§146): клик — seek в момент
// - Клипы: готовые mp4 с миниатюрами (§141)

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Hls from "hls.js"
import { ArrowLeft, Download, Film, Radio, Square, Zap } from "lucide-react"

interface Marker {
  id: string
  type: string
  positionMs: number
  importance: number
}
interface Clip {
  id: string
  durationMs: number
  fileUrl: string
  thumbUrl: string
}
interface Recording {
  id: string
  status: string
  startedAt: string
  endedAt: string | null
  durationSec: number
  vodUrl: string | null
  downloadUrl?: string | null
  markers: Marker[]
  clips: Clip[]
  reels: { id: string; durationMs: number; fileUrl: string; thumbUrl: string }[]
}
interface VideoOverview {
  court: { name: string; shortCode: string }
  live: { streamKey: string; status: string; hlsUrl: string } | null
  planAllowed?: boolean
  recordings: Recording[]
}

const MARKER_LABELS: Record<string, string> = {
  MATCH_POINT: "Матч-пойнт",
  SET_WON: "Сет",
  SET_POINT: "Сет-пойнт",
  BREAK_POINT: "Брейк-пойнт",
  GOLDEN_POINT: "Голден-пойнт",
  MATCH_WON: "Победа",
  MATCH_START: "Начало",
  MANUAL_HIGHLIGHT: "Хайлайт",
}

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`

export default function CourtVideoPage() {
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<VideoOverview | null>(null)
  const [error, setError] = useState("")
  const [liveOk, setLiveOk] = useState<boolean | null>(null)
  const [recBusy, setRecBusy] = useState(false)
  const [recError, setRecError] = useState("")
  const liveVideoRef = useRef<HTMLVideoElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/video/courts/${code}`, { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
      setError("")
    } catch {
      setError("Нет связи с сервером")
    }
  }, [code])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 15_000)
    return () => clearInterval(t)
  }, [load])

  // QR-gated recording (plan 2026-09-02): старт/стоп записи матча
  const isRecording = data?.recordings.some((r) => r.status === "recording") ?? false
  const toggleRecording = async () => {
    setRecBusy(true)
    setRecError("")
    try {
      const res = await fetch(`/api/v1/courts/${code}/recording`, {
        method: isRecording ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setRecError(body?.message ?? "Не получилось")
      }
    } catch {
      setRecError("Нет связи с сервером")
    } finally {
      setRecBusy(false)
      void load()
    }
  }

  // LL-HLS через hls.js (Safari играет HLS нативно)
  useEffect(() => {
    const video = liveVideoRef.current
    if (!video || !data?.live?.hlsUrl) return
    setLiveOk(null)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = data.live.hlsUrl
      setLiveOk(true)
      return
    }
    if (!Hls.isSupported()) {
      setLiveOk(false)
      return
    }
    const hls = new Hls({ lowLatencyMode: true })
    hls.loadSource(data.live.hlsUrl)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => setLiveOk(true))
    hls.on(Hls.Events.ERROR, (_e, d) => {
      if (d?.fatal) setLiveOk(false)
    })
    return () => hls.destroy()
  }, [data?.live?.hlsUrl])

  const seekTo = (video: HTMLVideoElement | null, ms: number) => {
    if (!video) return
    video.currentTime = ms / 1000
    void video.play().catch(() => {})
  }

  return (
    <main className="container max-w-3xl mx-auto px-3 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/c/${code}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" /> К табло корта
        </Link>
        {data && <span className="text-sm text-muted-foreground">{data.court.name}</span>}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* LIVE */}
      {data?.live && (
        <section className="mb-6 rounded-xl border border-[#a4fb23]/40 bg-[#11240e] p-4">
          <div className="mb-2 flex items-center gap-2 text-[#a4fb23]">
            <Radio className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-bold tracking-widest">
              LIVE {data.live.status === "recording" ? "· ИДЁТ ЗАПИСЬ" : ""}
            </span>
            {liveOk === false && <span className="text-xs text-amber-400">поток недоступен</span>}
          </div>
          <video ref={liveVideoRef} controls playsInline className="w-full rounded-lg bg-black" />
        </section>
      )}

      {/* Управление записью матча (QR-gate, plan 2026-09-02) */}
      {data?.planAllowed && data.live && (
        <section className="mb-6 rounded-xl border border-white/10 bg-[#0d130d] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-white/70">
              {isRecording ? (
                <>
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                  Матч пишется — остановится сам в конце игры (или по кнопке).
                </>
              ) : (
                "Записать текущий матч: VOD и скачивание появятся после стопа."
              )}
            </div>
            <button
              onClick={() => void toggleRecording()}
              disabled={recBusy}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                isRecording
                  ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                  : "bg-[#a4fb23]/20 text-[#a4fb23] hover:bg-[#a4fb23]/30"
              }`}
            >
              {isRecording ? (
                <span className="flex items-center gap-1.5">
                  <Square className="h-3.5 w-3.5" /> Стоп
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-current" /> Записать матч
                </span>
              )}
            </button>
          </div>
          {recError && <div className="mt-2 text-xs text-red-400">{recError}</div>}
        </section>
      )}

      {/* Записи */}
      {data?.recordings.map((rec) => (
        <section key={rec.id} className="mb-6 rounded-xl border border-white/10 bg-[#0d130d] p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-white/80">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-white/40" />
              <span className="font-semibold">
                {new Date(rec.startedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <span className="flex items-center gap-3 font-mono text-xs text-white/40">
              {fmt(rec.durationSec * 1000)} · {rec.status}
              {rec.downloadUrl && (
                <a
                  href={rec.downloadUrl}
                  className="flex items-center gap-1 rounded-md bg-white/5 px-2.5 py-1 font-sans font-semibold text-white/70 transition-colors hover:bg-white/10"
                  title="Скачать файл — останется у вас навсегда"
                >
                  <Download className="h-3.5 w-3.5" /> Скачать
                </a>
              )}
            </span>
          </div>

          {rec.vodUrl && (
            <>
              <video
                controls
                preload="none"
                playsInline
                src={rec.vodUrl}
                className="w-full rounded-lg bg-black"
                onLoadedMetadata={(e) => (e.currentTarget.currentTime = 0)}
              />
              {rec.markers.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-xs uppercase tracking-widest text-white/35">Моменты (§146)</div>
                  <div className="flex flex-wrap gap-2">
                    {rec.markers.map((m) => (
                      <button
                        key={m.id}
                        onClick={(e) =>
                          seekTo(
                            (e.currentTarget.closest("section")?.querySelector("video")) as HTMLVideoElement | null,
                            m.positionMs,
                          )
                        }
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                          m.importance >= 7
                            ? "bg-[#a4fb23]/20 text-[#a4fb23] hover:bg-[#a4fb23]/30"
                            : "bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                        title={`важность ${m.importance}`}
                      >
                        {MARKER_LABELS[m.type] ?? m.type} · {fmt(m.positionMs)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {rec.reels?.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1 text-xs uppercase tracking-widest text-[#a4fb23]/70">
                <Zap className="h-3 w-3" /> Highlight Reel — лучшие моменты
              </div>
              <div className="flex flex-wrap gap-3">
                {rec.reels.map((r) => (
                  <video
                    key={r.id}
                    controls
                    preload="none"
                    playsInline
                    poster={r.thumbUrl}
                    src={r.fileUrl}
                    className="h-64 rounded-lg bg-black"
                  />
                ))}
              </div>
            </div>
          )}

          {rec.clips.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1 text-xs uppercase tracking-widest text-white/35">
                <Zap className="h-3 w-3" /> Клипы
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {rec.clips.map((c) => (
                  <video
                    key={c.id}
                    controls
                    preload="none"
                    playsInline
                    poster={c.thumbUrl}
                    src={c.fileUrl}
                    className="w-full rounded-lg bg-black"
                  />
                ))}
              </div>
            </div>
          )}

          {rec.status === "recording" && (
            <p className="mt-2 text-xs text-white/40">Запись идёт — VOD будет доступен после завершения.</p>
          )}
        </section>
      ))}

      {data && !data.live && data.recordings.length === 0 && (
        <div className="rounded-xl border border-white/10 p-8 text-center text-white/40">
          Видео этого корта пока нет. Когда появится камера — здесь будут прямые эфиры и записи.
        </div>
      )}
    </main>
  )
}
