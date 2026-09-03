"use client"

// Личный кабинет игрока — PWA (plan-4 §44, §84)
//
// Дизайн: премиальный тёмный + градиенты + glass-morphism + анимации.
// Разделы: Hero (аватар + рейтинг + W/L) → Статистика → История → Достижения.

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Activity, Award, ChevronRight, Clock, Flame, Heart, Loader2,
  Medal, Percent, Search, Shield, Swords, Trophy, Users,
} from "lucide-react"
import { PlayerAuthPanel, useMeProfile } from "@/components/auth/player-auth-panel"
import { MyRecordings } from "@/components/me/my-recordings"

// ─── Типы ───────────────────────────────────────────────────────────────────

interface PlayerData {
  player: { id: string; name: string; memberSince: string }
  profile: { bio?: string; avatarUrl?: string; preferredSide?: string } | null
  rating: {
    display: string; mu: number; sigma: number
    matchesPlayed: number; wins: number; losses: number; winRate: number
  } | null
  history: Array<{
    id: string; date: string; won: boolean; partner: string
    opponents: string; score: string; court: string
  }>
  achievements: Array<{
    achievement_type: string; title: string; description: string; icon: string
  }>
  frequentPartners: Array<{ name: string; count: number }>
  stats: { totalMatches: number; wins: number; losses: number; winRate: number }
}

interface Player { id: string; name: string }

// ─── Страница ───────────────────────────────────────────────────────────────

// useSearchParams требует Suspense-границы при статической генерации (Next.js),
// поэтому контент вынесен в отдельный компонент под <Suspense>.
export default function PlayerDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0A0F0A] via-[#0D1A0D] to-[#0A0F0A]">
          <Loader2 className="h-10 w-10 animate-spin text-[#A4FB23]" />
        </div>
      }
    >
      <PlayerDashboardContent />
    </Suspense>
  )
}

function PlayerDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [playerId, setPlayerId] = useState<string | null>(searchParams.get("player_id"))
  const [data, setData] = useState<PlayerData | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const { profile } = useMeProfile()

  // Залогинен → сразу свой профиль (URL-параметр больше не нужен, Task 4)
  useEffect(() => {
    if (profile.player && !playerId) setPlayerId(profile.player.id)
  }, [profile.player, playerId])

  // Загрузка списка игроков (для выбора)
  const loadPlayers = useCallback(async () => {
    try {
      const res = await fetch("/api/players", { cache: "no-store" })
      const d = await res.json()
      setPlayers(d.players ?? d ?? [])
    } catch { /* ignore */ }
  }, [])

  // Загрузка данных игрока
  const loadPlayer = useCallback(async (id: string) => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/players/me?player_id=${id}`, { cache: "no-store" })
      if (!res.ok) {
        setError("Игрок не найден")
        setData(null)
        return
      }
      setData(await res.json())
    } catch {
      setError("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPlayers()
    if (playerId) void loadPlayer(playerId)
    else setLoading(false)
  }, [playerId, loadPlayer, loadPlayers])

  // ─── Выбор игрока ────────────────────────────────────────────────────
  if (!playerId) {
    const filtered = players.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0F0A] via-[#0D1A0D] to-[#0A0F0A] text-white">
        <div className="mx-auto max-w-md px-4 py-8">
          <div className="mb-4">
            <PlayerAuthPanel />
          </div>
          <PlayerSelect
            players={filtered}
            search={search}
            setSearch={setSearch}
            onSelect={(id) => {
              setPlayerId(id)
              router.replace(`/me?player_id=${id}`, { scroll: false })
            }}
          />
        </div>
      </div>
    )
  }

  // ─── Загрузка ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0A0F0A] via-[#0D1A0D] to-[#0A0F0A]">
        <Loader2 className="h-10 w-10 animate-spin text-[#A4FB23]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0A0F0A] via-[#0D1A0D] to-[#0A0F0A] p-6">
        <p className="text-white/60">{error || "Данные не найдены"}</p>
        <button
          onClick={() => { setPlayerId(null); router.replace("/me") }}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/70 hover:border-white/40"
        >
          ← Выбрать другого игрока
        </button>
      </div>
    )
  }

  const { player, rating, history, achievements, frequentPartners, stats } = data

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0F0A] via-[#0D1A0D] to-[#0A0F0A] text-white">
      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden px-6 pt-10 pb-8">
        {/* Декоративные градиенты */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#A4FB23]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-2xl">
          <button
            onClick={() => { setPlayerId(null); router.replace("/me") }}
            className="mb-4 text-xs text-white/40 hover:text-white/70"
          >
            ← Сменить игрока
          </button>

          <div className="flex items-center gap-5">
            {/* Аватар */}
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A4FB23]/30 to-emerald-600/20 text-3xl font-black text-[#A4FB23] ring-2 ring-[#A4FB23]/30 backdrop-blur-sm">
                {player.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              {/* Рейтинг-бейдж */}
              <div className="absolute -bottom-2 -right-2 rounded-lg bg-[#A4FB23] px-2 py-0.5 text-sm font-bold text-black shadow-lg">
                {rating?.display ?? "—"}
              </div>
            </div>

            {/* Имя + инфо */}
            <div className="flex-1">
              <h1 className="text-2xl font-black tracking-tight">{player.name}</h1>
              <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {data.profile?.preferredSide === "left" ? "Левая" : data.profile?.preferredSide === "right" ? "Правая" : "Обе стороны"}
                </span>
                <span>с {new Date(player.memberSince).toLocaleDateString("ru-RU", { month: "short", year: "numeric" })}</span>
              </div>
            </div>
          </div>

          {/* W/L бар */}
          <div className="mt-6">
            <WinLossBar wins={stats.wins} losses={stats.losses} />
          </div>

          {/* Auth-панель: залогинен → свои записи, гость → вход (plan 2026-09-02) */}
          <div className="mt-6">
            <PlayerAuthPanel />
          </div>
        </div>
      </header>

      {/* ─── МОИ ВИДЕО (plan 2026-09-02, Task 6) ─────────────────────────── */}
      <MyRecordings visible={!!profile.player} />

      {/* ─── STAT CARDS ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-2xl px-6">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Swords className="h-4 w-4" />}
            label="Матчи"
            value={stats.totalMatches.toString()}
          />
          <StatCard
            icon={<Percent className="h-4 w-4" />}
            label="Win Rate"
            value={`${stats.winRate}%`}
            accent={stats.winRate >= 50}
          />
          <StatCard
            icon={<Trophy className="h-4 w-4" />}
            label="Победы"
            value={stats.wins.toString()}
            accent
          />
        </div>
      </section>

      {/* ─── ДОСТИЖЕНИЯ ─────────────────────────────────────────────────── */}
      {achievements.length > 0 && (
        <section className="mx-auto max-w-2xl px-6 mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/50">
            <Award className="h-4 w-4 text-[#A4FB23]" />
            Достижения
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {achievements.map((a, i) => (
              <AchievementCard key={i} {...a} />
            ))}
          </div>
        </section>
      )}

      {/* ─── ИСТОРИЯ МАТЧЕЙ ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-2xl px-6 mt-8 pb-12">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/50">
          <Clock className="h-4 w-4" />
          История матчей
        </h2>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-white/10 p-8 text-center">
            <Activity className="mx-auto mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">Матчей пока нет</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((match) => (
              <MatchCard key={match.id} {...match} />
            ))}
          </div>
        )}
      </section>

      {/* ─── ПАРТНЁРЫ ───────────────────────────────────────────────────── */}
      {frequentPartners.length > 0 && (
        <section className="mx-auto max-w-2xl px-6 pb-12">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/50">
            <Users className="h-4 w-4" />
            Частые партнёры
          </h2>
          <div className="flex flex-wrap gap-2">
            {frequentPartners.map((p) => (
              <div
                key={p.name}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
              >
                {p.name}
                <span className="ml-2 text-xs text-white/40">{p.count} матчей</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Компоненты ─────────────────────────────────────────────────────────────

function WinLossBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses
  if (total === 0) return null
  const winPct = Math.round((wins / total) * 100)

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
        <span className="text-[#A4FB23]">{wins} побед</span>
        <span>{losses} поражений</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#A4FB23] to-emerald-400 transition-all duration-700"
          style={{ width: `${winPct}%` }}
        />
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 backdrop-blur-sm transition-all hover:scale-[1.02] ${
      accent ? "border-[#A4FB23]/30 bg-[#A4FB23]/5" : "border-white/10 bg-white/5"
    }`}>
      <div className={`mb-2 ${accent ? "text-[#A4FB23]" : "text-white/40"}`}>{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs text-white/40">{label}</div>
    </div>
  )
}

function AchievementCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex min-w-[140px] flex-col items-center gap-2 rounded-2xl border border-[#A4FB23]/20 bg-gradient-to-b from-[#A4FB23]/10 to-transparent p-4 text-center">
      <span className="text-3xl">{icon || "🏆"}</span>
      <div className="text-sm font-bold text-[#A4FB23]">{title}</div>
      <div className="text-[10px] text-white/40">{description}</div>
    </div>
  )
}

function MatchCard({ date, won, partner, opponents, score, court }: {
  date: string; won: boolean; partner: string; opponents: string; score: string; court: string
}) {
  return (
    <div className={`rounded-2xl border p-4 transition-all hover:scale-[1.01] ${
      won ? "border-[#A4FB23]/20 bg-gradient-to-r from-[#A4FB23]/5 to-transparent" : "border-white/10 bg-white/5"
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2 ${won ? "bg-[#A4FB23]/15" : "bg-red-500/10"}`}>
            {won ? <Trophy className="h-4 w-4 text-[#A4FB23]" /> : <Medal className="h-4 w-4 text-red-400/60" />}
          </div>
          <div>
            <div className="text-sm font-semibold">
              {partner && <span className="text-white/60">с {partner}</span>}
              <span className="mx-1.5 text-white/30">vs</span>
              <span className="text-white/80">{opponents}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
              <span>{new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
              {court && <span>· {court}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-lg font-bold ${won ? "text-[#A4FB23]" : "text-white/50"}`}>
            {score || "—"}
          </div>
          <div className={`text-[10px] font-bold uppercase ${won ? "text-[#A4FB23]" : "text-red-400/50"}`}>
            {won ? "Win" : "Loss"}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Экран выбора игрока ────────────────────────────────────────────────────

function PlayerSelect({ players, search, setSearch, onSelect }: {
  players: Player[]
  search: string
  setSearch: (s: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0F0A] via-[#0D1A0D] to-[#0A0F0A] p-6">
      <div className="mx-auto max-w-md pt-16">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A4FB23]/30 to-emerald-600/20">
            <Flame className="h-8 w-8 text-[#A4FB23]" />
          </div>
          <h1 className="text-2xl font-black text-white">Мой профиль</h1>
          <p className="mt-1 text-sm text-white/40">Выберите игрока для просмотра</p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Поиск по имени…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[#A4FB23]/50 focus:outline-none focus:ring-1 focus:ring-[#A4FB23]/30 backdrop-blur-sm"
          />
        </div>

        <div className="space-y-2">
          {players.slice(0, 20).map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="group flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-[#A4FB23]/30 hover:bg-[#A4FB23]/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/5 text-sm font-bold text-white/60">
                  {p.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <span className="font-medium text-white/90">{p.name}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-[#A4FB23]" />
            </button>
          ))}
          {players.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/30">
              Игроков не найдено
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
