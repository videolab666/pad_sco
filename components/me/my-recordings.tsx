"use client"

// «Мои видео» в кабинете игрока (plan 2026-09-02, Task 6): готовые записи
// матчей с участием игрока — смотреть (VOD gateway) / скачать (прокси-роут).
// Показывается только залогиненным (панель решает, дёргать ли запрос).

import { useCallback, useEffect, useState } from "react"
import { Download, Film, Play } from "lucide-react"

interface MyRecording {
  id: string
  startedAt: string
  endedAt: string | null
  durationSec: number
  courtName: string
  vodUrl: string | null
  downloadUrl: string
}

const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

export function MyRecordings({ visible }: { visible: boolean }) {
  const [recordings, setRecordings] = useState<MyRecording[] | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/me/recordings", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setRecordings(data.recordings ?? [])
      } else {
        setRecordings([])
      }
    } catch {
      setRecordings([])
    }
  }, [])

  useEffect(() => {
    if (visible) void load()
  }, [visible, load])

  if (!visible || recordings === null) return null

  return (
    <section className="mx-auto max-w-2xl px-6 pb-12">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/50">
        <Film className="h-4 w-4" />
        Мои видео
      </h2>

      {recordings.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/40">
          Пока пусто. Записывайте матчи кнопкой «Записать матч» на QR-странице корта —
          готовые видео появятся здесь.
        </div>
      ) : (
        <div className="space-y-2">
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-white">
                  {rec.courtName} · {fmtDate(rec.startedAt)}
                </div>
                <div className="text-xs text-white/40">длительность {fmtDuration(rec.durationSec)}</div>
              </div>
              <div className="flex gap-2">
                {rec.vodUrl && (
                  <a
                    href={rec.vodUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 hover:border-[#A4FB23]/40 hover:text-[#A4FB23]"
                  >
                    <Play className="h-3.5 w-3.5" /> Смотреть
                  </a>
                )}
                <a
                  href={rec.downloadUrl}
                  className="flex items-center gap-1.5 rounded-lg bg-[#A4FB23]/15 px-3 py-1.5 text-xs font-semibold text-[#A4FB23] hover:bg-[#A4FB23]/25"
                  title="Файл останется у вас навсегда"
                >
                  <Download className="h-3.5 w-3.5" /> Скачать
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
