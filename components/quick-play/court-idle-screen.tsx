"use client"

// Idle-экран корта (§15/§16): матча нет — предлагаем Quick Play по QR.
// Периодически refresh-им страницу: когда матч появится (например, с
// другого устройства) — экран сам сменится на табло.

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { RefreshCw, Zap } from "lucide-react"

export function CourtIdleScreen({
  courtName,
  code,
  session,
}: {
  courtName: string
  code: string
  session: { type: string; startedAt: string } | null
}) {
  const router = useRouter()

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10_000)
    return () => clearInterval(timer)
  }, [router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0a0f0a] p-8 text-white">
      <div className="text-sm uppercase tracking-widest text-white/40">Court</div>
      <h1 className="text-5xl font-black">{courtName}</h1>

      {session ? (
        <p className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-300">
          {session.type === "training" ? "Тренировка" : session.type === "open_play" ? "Open Play" : "Сессия"} · с{" "}
          {new Date(session.startedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </p>
      ) : (
        <p className="text-white/50">Матча нет</p>
      )}

      <Link
        href={`/c/${code}/play`}
        className="flex items-center gap-3 rounded-xl bg-[#a4fb23] px-8 py-4 text-lg font-extrabold text-black shadow-lg transition-transform hover:scale-[1.03]"
      >
        <Zap className="h-6 w-6" />
        Быстрая игра
      </Link>

      <div className="flex items-center gap-2 text-xs text-white/25">
        <RefreshCw className="h-3 w-3" />
        обновляется автоматически · /c/{code}
      </div>
    </main>
  )
}
