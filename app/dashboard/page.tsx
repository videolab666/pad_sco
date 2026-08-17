"use client"

// Multi-court Dashboard (plan-4 §46) — состояние всех кортов клуба одним
// экраном. Публичные данные (те же, что на табло и в vMix JSON), опрос
// /api/v1/dashboard каждые 10 секунд + при возврате на вкладку.
//
// Клиент по карточке → /c/{short_code} (вечная ссылка корта). Бизнес-логики
// нет — только отображение; состояние корта считает сервер.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"

interface CourtCard {
  courtId: string
  name: string
  shortCode: string
  number: number | null
  scoreboardUrl: string
  state: "live" | "session_only" | "available"
  session: { type: string; status: string; startedAt: string } | null
  match: {
    id: string
    teamAName: string
    teamBName: string
    setsWonA: number
    setsWonB: number
    setsSummary: string
    currentSet: string
    currentGame: string
    isTiebreak: boolean
    duration: string
    isCompleted: boolean
    winner: string
  } | null
}

const SESSION_LABELS: Record<string, string> = {
  training: "ТРЕНИРОВКА",
  open_play: "OPEN PLAY",
  americano: "AMERICANO",
  mexicano: "MEXICANO",
  king_of_court: "KING OF THE COURT",
  group_session: "ГРУППА",
  tournament: "ТУРНИР",
}

export default function DashboardPage() {
  const [courts, setCourts] = useState<CourtCard[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<string>("")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/dashboard", { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setCourts(data.courts ?? [])
      setError("")
      setUpdatedAt(new Date().toLocaleTimeString("ru-RU"))
    } catch {
      setError("Нет связи с сервером — показаны последние данные")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 10_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load])

  const live = courts.filter((c) => c.state === "live").length

  return (
    <main className="min-h-screen bg-[#0a0f0a] p-4 sm:p-8 text-white">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          КОРТЫ КЛУБА
          <span className="ml-3 align-middle text-sm font-normal text-white/50">
            {live > 0 ? `${live} в игре` : "нет живых матчей"}
          </span>
        </h1>
        <div className="flex items-center gap-2 text-xs text-white/40">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {error ? <span className="text-amber-400">{error}</span> : <span>обновлено {updatedAt}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {courts.map((court) => (
          <Link
            key={court.courtId}
            href={court.scoreboardUrl}
            target="_blank"
            className={`group block rounded-xl border p-5 transition-colors ${
              court.state === "live"
                ? "border-[#a4fb23]/40 bg-gradient-to-b from-[#11240e] to-[#0a1208] hover:border-[#a4fb23]"
                : court.state === "session_only"
                  ? "border-sky-400/30 bg-[#0b1420] hover:border-sky-400/70"
                  : "border-white/10 bg-[#0d130d] hover:border-white/30"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xl font-extrabold tracking-wide">
                {court.number !== null ? `Корт ${court.name}` : court.name}
              </div>
              {court.state === "live" && court.match && (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#a4fb23] opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#a4fb23]" />
                  </span>
                  <span className="font-mono text-sm text-[#a4fb23]">{court.match.duration}</span>
                </div>
              )}
              {court.state === "session_only" && court.session && (
                <span className="rounded bg-sky-400/15 px-2 py-0.5 text-xs font-bold tracking-widest text-sky-300">
                  {SESSION_LABELS[court.session.type] ?? court.session.type.toUpperCase()}
                </span>
              )}
              {court.state === "available" && <span className="text-xs text-white/35">СВОБОДЕН</span>}
            </div>

            {court.match ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 truncate text-sm font-semibold text-white/90">{court.match.teamAName}</div>
                  <div className="shrink-0 font-mono text-lg font-black">{court.match.setsWonA}</div>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 truncate text-sm font-semibold text-white/90">{court.match.teamBName}</div>
                  <div className="shrink-0 font-mono text-lg font-black">{court.match.setsWonB}</div>
                </div>
                <div className="pt-1 font-mono text-xs text-white/50">
                  {court.match.setsSummary}
                  {court.match.currentSet && ` · ${court.match.currentSet}`}
                  {court.match.currentGame && ` · ${court.match.currentGame}${court.match.isTiebreak ? " TB" : ""}`}
                </div>
              </div>
            ) : court.session ? (
              <div className="text-sm text-white/50">
                {SESSION_LABELS[court.session.type] ?? court.session.type} · с{" "}
                {new Date(court.session.startedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </div>
            ) : (
              <div className="text-sm text-white/30">Нет активного матча</div>
            )}

            <div className="mt-3 font-mono text-[10px] text-white/25 group-hover:text-white/45">
              /c/{court.shortCode}
            </div>
          </Link>
        ))}

        {!loading && courts.length === 0 && (
          <div className="col-span-full rounded-xl border border-white/10 p-8 text-center text-white/40">
            Кортов нет — добавьте их в /settings → «Корты»
          </div>
        )}
      </div>
    </main>
  )
}
