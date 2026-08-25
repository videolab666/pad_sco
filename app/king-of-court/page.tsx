"use client"

// King of Court (§12): страница турнира с иерархией кортов.
// Победители ↑ King Court, проигравшие ↓.

import { useEffect, useMemo, useState } from "react"
import { Crown, Loader2, Play, Plus, RefreshCw, Search, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  applyKingResult, getKingRanking, initKingOfCourt, isRoundComplete, nextKingRound, type KingState,
} from "@/lib/king-of-court"

interface Player { id: string; name: string }

export default function KingOfCourtPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<KingState | null>(null)
  const [submitting, setSubmitting] = useState<number | null>(null)

  useEffect(() => {
    void fetch("/api/players")
      .then(r => r.json())
      .then(d => {
        setPlayers(d.players ?? d ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const togglePlayer = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const start = () => {
    const chosen = players.filter(p => selected.has(p.id))
    if (chosen.length < 8 || chosen.length % 4 !== 0) return
    const courts = chosen.length / 4
    setState(initKingOfCourt(
      chosen.map(p => ({ playerId: p.id, name: p.name, rating: 25 })),
      courts,
    ))
  }

  const submitScore = async (matchIndex: number, scoreA: number, scoreB: number) => {
    if (!state) return
    setSubmitting(matchIndex)
    const updated = applyKingResult(state, matchIndex, scoreA, scoreB)
    setState(updated)
    setSubmitting(null)
  }

  const nextRound = () => {
    if (!state) return
    setState(nextKingRound(state))
  }

  const ranking = useMemo(() => state ? getKingRanking(state) : [], [state])
  const canStart = selected.size >= 8 && selected.size % 4 === 0
  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  // ─── Выбор игроков ────────────────────────────────────────────────────
  if (!state) {
    return (
      <main className="container max-w-3xl mx-auto px-3 py-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Crown className="h-6 w-6 text-yellow-400" />
          King of the Court
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          Победители поднимаются на King Court, проигравшие опускаются
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" /> Игроки
            </CardTitle>
            <CardDescription>
              {selected.size} выбрано · {(selected.size / 4) || 0} кортов
              {selected.size > 0 && selected.size % 4 !== 0 && (
                <span className="text-amber-500"> — нужно кратно 4</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4 max-h-60 overflow-y-auto">
              {loading ? (
                <div className="col-span-2 flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                      selected.has(p.id)
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400 font-medium"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
            <Button className="w-full" size="lg" disabled={!canStart} onClick={start}>
              <Play className="h-5 w-5 mr-2" />
              Начать King of Court ({selected.size} игроков)
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  // ─── Активный турнир ─────────────────────────────────────────────────
  const roundDone = isRoundComplete(state)

  return (
    <main className="container max-w-4xl mx-auto px-3 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <button
            onClick={() => { setState(null); setSelected(new Set()) }}
            className="text-sm text-muted-foreground hover:underline mb-1"
          >
            ← Новый турнир
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-400" />
            Round {state.currentRound + 1}
          </h1>
        </div>
        {roundDone && (
          <Button onClick={nextRound} size="lg">
            <Play className="h-4 w-4 mr-1" />
            Следующий раунд
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Матчи по кортам */}
        <div>
          {state.matches.map((match, i) => (
            <Card key={i} className={`mb-3 ${match.courtLevel === 0 ? "border-yellow-400/40" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant={match.courtLevel === 0 ? "default" : "outline"}
                    className={match.courtLevel === 0 ? "bg-yellow-400 text-black" : ""}
                  >
                    {match.courtLevel === 0 ? "👑 King Court" : `Court ${match.courtLevel + 1}`}
                  </Badge>
                  {match.winner && (
                    <span className="text-xs text-white/40">
                      {match.scoreA}:{match.scoreB}
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium mb-3">
                  {match.teamA.map(p => p.name).join(" / ")}
                  <span className="mx-2 text-white/30">vs</span>
                  {match.teamB.map(p => p.name).join(" / ")}
                </div>
                {!match.winner && (
                  <ScoreInput
                    onSubmit={(a, b) => void submitScore(i, a, b)}
                    disabled={submitting === i}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Рейтинг */}
        <div>
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-white/5">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-400" />
                Рейтинг
              </h3>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {ranking.map((p, i) => (
                  <tr key={p.playerId} className={`border-b border-white/5 ${p.position === 0 ? "bg-yellow-400/10" : ""}`}>
                    <td className="px-3 py-2 font-mono text-white/40">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      {p.name}
                      {p.position === 0 && <span className="ml-1">👑</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-white/40">
                      {p.position === 0 ? "King" : `Court ${p.position + 1}`}
                    </td>
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

function ScoreInput({ onSubmit, disabled }: { onSubmit: (a: number, b: number) => void; disabled: boolean }) {
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const submit = () => {
    const na = parseInt(a, 10), nb = parseInt(b, 10)
    if (Number.isInteger(na) && Number.isInteger(nb) && na >= 0 && nb >= 0 && (na > 0 || nb > 0)) {
      onSubmit(na, nb)
      setA(""); setB("")
    }
  }
  return (
    <div className="flex items-center gap-2">
      <Input type="number" min="0" max="99" placeholder="0" value={a}
        onChange={e => setA(e.target.value)}
        className="w-16 h-8 text-center font-mono" />
      <span className="text-white/30 text-xs">:</span>
      <Input type="number" min="0" max="99" placeholder="0" value={b}
        onChange={e => setB(e.target.value)}
        className="w-16 h-8 text-center font-mono" />
      <Button size="sm" onClick={submit} disabled={disabled || !a || !b}>
        {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "OK"}
      </Button>
    </div>
  )
}
