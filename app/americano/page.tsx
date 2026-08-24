"use client"

// Americano Tournament Page (plan-4 §10-12)
//
// Сценарий:
//   1. Выбрать игроков из базы (4–32, кратно 4)
//   2. Создать → Whist-расписание генерируется автоматически
//   3. Live: матчи текущего раунда + ввод счёта + таблица
//   4. Завершение → финальная таблица + рейтинги OpenSkill
//
// Дизайн: тёмная тема + лайм-акцент (как дашборд и видео-кабинет).

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Award, ChevronRight, Loader2, Play, Plus, RefreshCw, Search,
  Swords, Trophy, Users, Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// ─── Типы ───────────────────────────────────────────────────────────────────

interface Player { id: string; name: string }
interface Participant {
  playerId: string; playerName: string; seat: number | null
  totalPoints: number; gamesPlayed: number; gamesWon: number; gamesLost: number; pointsDiff: number
}
interface AmericanoEvent {
  id: string; name: string; format: string; status: string
  playerCount: number; courtCount: number; pointsPerRound: number
  totalRounds: number; currentRound: number
  participants: Participant[]
}
interface Match {
  id: string; courtNumber: number
  teamAPlayers: string[]; teamBPlayers: string[]
  scoreA: number | null; scoreB: number | null; winner: string | null
}
interface Round { roundNumber: number; status: string; matches: Match[] }

// ─── Страница ───────────────────────────────────────────────────────────────

export default function AmericanoPage() {
  const router = useRouter()
  const [events, setEvents] = useState<AmericanoEvent[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [viewEvent, setViewEvent] = useState<string | null>(null)
  const [eventData, setEventData] = useState<AmericanoEvent | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [submitting, setSubmitting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [evRes, plRes] = await Promise.all([
        fetch("/api/americano", { cache: "no-store" }),
        fetch("/api/players", { cache: "no-store" }).catch(() => ({ json: async () => ({ players: [] }) })),
      ])
      if (evRes.status === 401) { router.push("/login"); return }
      const evData = await evRes.json()
      const plData = await plRes.json()
      setEvents(evData.events ?? [])
      setPlayers(plData.players ?? plData ?? [])
      setError("")
    } catch {
      setError("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void load() }, [load])

  // Загрузка активного события
  const loadEvent = useCallback(async (id: string) => {
    try {
      const [evRes, rRes] = await Promise.all([
        fetch(`/api/americano/${id}`, { cache: "no-store" }),
        fetch(`/api/americano/${id}/rounds`, { cache: "no-store" }),
      ])
      const evData = await evRes.json()
      const rData = await rRes.json()
      setEventData(evData.event ?? null)
      setRounds(rData.rounds ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (viewEvent) void loadEvent(viewEvent)
  }, [viewEvent, loadEvent])

  // Автообновление активного события
  useEffect(() => {
    if (!viewEvent || eventData?.status === "completed") return
    const t = setInterval(() => void loadEvent(viewEvent), 5_000)
    return () => clearInterval(t)
  }, [viewEvent, eventData?.status, loadEvent])

  const togglePlayer = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 32) next.add(id)
      return next
    })
  }

  const createEvent = async () => {
    if (selected.size < 4 || selected.size % 4 !== 0) return
    setCreating(true)
    setError("")
    try {
      const res = await fetch("/api/americano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: [...selected], format: "americano" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.message ?? "Ошибка создания")
        return
      }
      // Автостарт
      await fetch(`/api/americano/${data.event.id}/start`, { method: "POST" })
      setViewEvent(data.event.id)
      setSelected(new Set())
      await load()
    } catch {
      setError("Ошибка сети")
    } finally {
      setCreating(false)
    }
  }

  const submitScore = async (matchId: string, scoreA: number, scoreB: number) => {
    setSubmitting(matchId)
    try {
      await fetch(`/api/americano/matches/${matchId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreA, scoreB }),
      })
      if (viewEvent) await loadEvent(viewEvent)
    } finally {
      setSubmitting(null)
    }
  }

  const startEvent = async (id: string) => {
    await fetch(`/api/americano/${id}/start`, { method: "POST" })
    setViewEvent(id)
    await load()
  }

  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  const canCreate = selected.size >= 4 && selected.size % 4 === 0 && !creating

  // ─── Активное событие ─────────────────────────────────────────────────
  if (viewEvent && eventData) {
    const activeRound = rounds.find(r => r.status === "playing")
    const currentRoundNum = activeRound?.roundNumber ?? eventData.currentRound
    const leaderboard = [...eventData.participants].sort((a, b) =>
      b.totalPoints - a.totalPoints || b.gamesWon - a.gamesWon || b.pointsDiff - a.pointsDiff
    )

    return (
      <main className="container max-w-4xl mx-auto px-3 py-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={() => { setViewEvent(null); setEventData(null); void load() }}
              className="text-sm text-muted-foreground hover:underline mb-1"
            >
              ← Все турниры
            </button>
            <h1 className="text-2xl font-bold">{eventData.name}</h1>
            <p className="text-sm text-muted-foreground">
              Раунд {currentRoundNum + 1} из {eventData.totalRounds} · {eventData.status === "completed" ? "Завершён" : "Идёт"}
            </p>
          </div>
          <Badge
            variant={eventData.status === "completed" ? "default" : "secondary"}
            className={eventData.status !== "completed" ? "bg-[#A4FB23] text-black" : ""}
          >
            {eventData.status === "completed" ? <Trophy className="h-3 w-3 mr-1" /> : null}
            {eventData.status === "active" ? "LIVE" : eventData.status === "completed" ? "Финал" : eventData.status}
          </Badge>
        </div>

        {/* Прогресс-бар раундов */}
        <div className="mb-4 flex gap-1">
          {rounds.map(r => (
            <div
              key={r.roundNumber}
              className={`h-1.5 flex-1 rounded-full ${
                r.status === "completed" ? "bg-[#A4FB23]" :
                r.status === "playing" ? "bg-[#A4FB23]/50 animate-pulse" : "bg-white/10"
              }`}
              title={`Раунд ${r.roundNumber + 1}: ${r.status}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Матчи текущего раунда */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {activeRound ? `Раунд ${currentRoundNum + 1} — матчи` : "Матчи"}
            </h2>
            <div className="space-y-3">
              {(activeRound?.matches ?? rounds.find(r => r.roundNumber === eventData.currentRound)?.matches ?? []).map(m => (
                <Card key={m.id} className={`p-3 ${m.winner ? "opacity-60" : "border-[#A4FB23]/30"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">Корт {m.courtNumber + 1}</Badge>
                    {m.winner && (
                      <Badge variant="secondary" className="text-xs">
                        {m.scoreA}:{m.scoreB}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm font-medium mb-2">
                    {m.teamAPlayers.join(" / ")} <span className="text-muted-foreground">vs</span> {m.teamBPlayers.join(" / ")}
                  </div>
                  {!m.winner && (
                    <div className="flex items-center gap-2">
                      <ScoreInput onSubmit={(a, b) => void submitScore(m.id, a, b)} disabled={submitting === m.id} />
                    </div>
                  )}
                </Card>
              ))}
              {rounds.every(r => r.status === "completed") && (
                <Card className="p-6 text-center">
                  <Trophy className="mx-auto mb-2 h-10 w-10 text-[#A4FB23]" />
                  <p className="font-semibold">Турнир завершён!</p>
                </Card>
              )}
            </div>
          </div>

          {/* Live-таблица */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              <Users className="inline h-3.5 w-3.5 mr-1" />
              Таблица
            </h2>
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-white/5 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Игрок</th>
                    <th className="px-2 py-2 text-center">Очки</th>
                    <th className="px-2 py-2 text-center">В/П</th>
                    <th className="px-2 py-2 text-center">+/−</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p, i) => (
                    <tr key={p.playerId} className={`border-b border-white/5 ${i === 0 ? "bg-[#A4FB23]/10" : ""}`}>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{p.playerName}</td>
                      <td className="px-2 py-2 text-center font-bold text-[#A4FB23]">{p.totalPoints}</td>
                      <td className="px-2 py-2 text-center text-muted-foreground">{p.gamesWon}/{p.gamesLost}</td>
                      <td className="px-2 py-2 text-center text-muted-foreground">{p.pointsDiff > 0 ? `+${p.pointsDiff}` : p.pointsDiff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      </main>
    )
  }

  // ─── Список событий + создание ────────────────────────────────────────
  return (
    <main className="container max-w-3xl mx-auto px-3 py-6">
      <h1 className="text-2xl font-bold mb-1">Americano</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Турнир, где каждый играет с каждым в паре один раз
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Существующие события */}
      {events.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Турниры
          </h2>
          <div className="space-y-2">
            {events.map(ev => (
              <Card key={ev.id} className="p-3 cursor-pointer hover:border-[#A4FB23]/40" onClick={() => setViewEvent(ev.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Swords className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{ev.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ev.playerCount} игроков · {ev.courtCount} кортов · {ev.totalRounds} раундов
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ev.status === "active" ? "default" : ev.status === "completed" ? "secondary" : "outline"}
                      className={ev.status === "active" ? "bg-[#A4FB23] text-black" : ""}>
                      {ev.status === "active" ? "LIVE" : ev.status === "completed" ? "Финал" : ev.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                {ev.status === "creating" && (
                  <Button
                    size="sm" className="mt-2 w-full"
                    onClick={(e) => { e.stopPropagation(); void startEvent(ev.id) }}
                  >
                    <Play className="h-4 w-4 mr-1" /> Запустить
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Создание нового */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Новый Americano
          </CardTitle>
          <CardDescription>
            Выберите игроков (кратно 4): {selected.size} выбрано
            {selected.size > 0 && selected.size % 4 !== 0 && (
              <span className="text-amber-500"> — нужно ещё {4 - (selected.size % 4)}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Поиск */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск игрока…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Сетка игроков */}
          <div className="grid grid-cols-2 gap-2 mb-4 max-h-60 overflow-y-auto">
            {loading ? (
              <div className="col-span-2 flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="col-span-2 text-center py-4 text-sm text-muted-foreground">
                Игроков не найдено
              </div>
            ) : (
              filteredPlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                    selected.has(p.id)
                      ? "border-[#A4FB23] bg-[#A4FB23]/15 text-[#A4FB23] font-medium"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!canCreate}
            onClick={() => void createEvent()}
          >
            {creating ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Zap className="h-5 w-5 mr-2" />}
            Создать Americano ({selected.size} игроков)
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

// ─── Ввод счёта ─────────────────────────────────────────────────────────────

function ScoreInput({ onSubmit, disabled }: { onSubmit: (a: number, b: number) => void; disabled: boolean }) {
  const [a, setA] = useState("")
  const [b, setB] = useState("")

  const submit = () => {
    const na = parseInt(a, 10)
    const nb = parseInt(b, 10)
    if (Number.isInteger(na) && Number.isInteger(nb) && na >= 0 && nb >= 0 && (na > 0 || nb > 0)) {
      onSubmit(na, nb)
      setA(""); setB("")
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number" min="0" max="99" placeholder="0"
        value={a} onChange={(e) => setA(e.target.value)}
        className="w-16 h-8 text-center font-mono"
      />
      <span className="text-muted-foreground text-xs">:</span>
      <Input
        type="number" min="0" max="99" placeholder="0"
        value={b} onChange={(e) => setB(e.target.value)}
        className="w-16 h-8 text-center font-mono"
      />
      <Button size="sm" onClick={submit} disabled={disabled || !a || !b}>
        {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "OK"}
      </Button>
    </div>
  )
}
