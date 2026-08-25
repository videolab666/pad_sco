"use client"

// Leagues (§81): таблица, fixtures, результаты.
// MVP: одна лига, один дивизион, round-robin.

import { useEffect, useMemo, useState } from "react"
import { ChevronRight, Loader2, Plus, Search, Swords, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  applyFixtureResult, computeStandings, generateRoundRobin, type Fixture, type Standing,
} from "@/lib/league-engine"

interface Player { id: string; name: string }

export default function LeaguesPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [leagueName, setLeagueName] = useState("Club League")

  // League state (MVP: client-side)
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [results, setResults] = useState<Map<string, { a: number; b: number }>>(new Map())

  useEffect(() => {
    void fetch("/api/players")
      .then(r => r.json())
      .then(d => { setPlayers(d.players ?? d ?? []); setLoading(false) })
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

  const createLeague = () => {
    const chosen = players.filter(p => selected.has(p.id))
    if (chosen.length < 3) return
    const f = generateRoundRobin(chosen.map(p => p.id))
    setFixtures(f)
    setStandings(chosen.map(p => ({
      playerId: p.id, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, points: 0,
    })))
    setResults(new Map())
  }

  const submitResult = (fixture: Fixture, setsA: number, setsB: number) => {
    const key = `${fixture.round}-${fixture.playerAId}-${fixture.playerBId}`
    const updated = applyFixtureResult(standings, fixture.playerAId, fixture.playerBId, setsA, setsB)
    setStandings(updated)
    setResults(prev => new Map(prev).set(key, { a: setsA, b: setsB }))
  }

  const sortedStandings = useMemo(() => computeStandings(standings), [standings])
  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? "—"
  const totalRounds = fixtures.length > 0 ? Math.max(...fixtures.map(f => f.round)) + 1 : 0

  // Group fixtures by round
  const fixturesByRound = useMemo(() => {
    const map = new Map<number, Fixture[]>()
    for (const f of fixtures) {
      if (!map.has(f.round)) map.set(f.round, [])
      map.get(f.round)!.push(f)
    }
    return map
  }, [fixtures])

  const canCreate = selected.size >= 3
  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  // ─── Выбор игроков ────────────────────────────────────────────────────
  if (fixtures.length === 0) {
    return (
      <main className="container max-w-3xl mx-auto px-3 py-6">
        <h1 className="text-2xl font-bold mb-1">Лига</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Каждый играет с каждым, таблица по очкам
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" /> Создать лигу
            </CardTitle>
            <CardDescription>{selected.size} игроков выбрано</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Название лиги"
              value={leagueName}
              onChange={e => setLeagueName(e.target.value)}
              className="mb-3"
            />
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск…"
                value={search}
                onChange={e => setSearch(e.target.value)}
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
                        ? "border-[#A4FB23] bg-[#A4FB23]/10 text-[#A4FB23] font-medium"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
            <Button className="w-full" size="lg" disabled={!canCreate} onClick={createLeague}>
              <Swords className="h-5 w-5 mr-2" />
              Создать лигу ({selected.size} игроков, {selected.size - 1} раундов)
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  // ─── Активная лига ───────────────────────────────────────────────────
  return (
    <main className="container max-w-4xl mx-auto px-3 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <button
            onClick={() => { setFixtures([]); setSelected(new Set()) }}
            className="text-sm text-muted-foreground hover:underline mb-1"
          >
            ← Новая лига
          </button>
          <h1 className="text-2xl font-bold">{leagueName}</h1>
          <p className="text-sm text-muted-foreground">
            {totalRounds} раундов · {fixtures.length} матчей
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fixtures по раундам */}
        <div>
          {[...fixturesByRound.entries()].map(([round, roundFixtures]) => (
            <Card key={round} className="mb-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-white/60">Раунд {round + 1}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {roundFixtures.map((f, i) => {
                  const key = `${f.round}-${f.playerAId}-${f.playerBId}`
                  const result = results.get(key)
                  return (
                    <div key={i} className={`rounded-lg border p-2 text-sm ${
                      result ? "border-white/5 opacity-60" : "border-[#A4FB23]/20"
                    }`}>
                      <div className="font-medium">
                        {playerName(f.playerAId)}
                        <span className="mx-1.5 text-white/30">vs</span>
                        {playerName(f.playerBId)}
                      </div>
                      {result ? (
                        <div className="mt-1 text-xs text-[#A4FB23]">
                          {result.a}:{result.b} — {result.a > result.b ? playerName(f.playerAId) : playerName(f.playerBId)}
                        </div>
                      ) : (
                        <SetsInput onSubmit={(a, b) => submitResult(f, a, b)} />
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Таблица */}
        <div>
          <Card className="p-0 overflow-hidden sticky top-4">
            <div className="px-4 py-3 border-b bg-white/5 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[#A4FB23]" />
              <h3 className="text-sm font-semibold">Таблица</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-white/5 text-xs text-white/40">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Игрок</th>
                  <th className="px-2 py-2 text-center">И</th>
                  <th className="px-2 py-2 text-center">В</th>
                  <th className="px-2 py-2 text-center">Сеты</th>
                  <th className="px-2 py-2 text-center">Очки</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandings.map((s: Standing, i: number) => (
                  <tr key={s.playerId} className={`border-b border-white/5 ${i === 0 ? "bg-[#A4FB23]/10" : ""}`}>
                    <td className="px-3 py-2 font-mono text-white/40">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{playerName(s.playerId)}</td>
                    <td className="px-2 py-2 text-center text-white/50">{s.played}</td>
                    <td className="px-2 py-2 text-center font-bold text-[#A4FB23]">{s.won}</td>
                    <td className="px-2 py-2 text-center text-white/50">{s.setsWon}:{s.setsLost}</td>
                    <td className="px-2 py-2 text-center font-bold">{s.points}</td>
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

function SetsInput({ onSubmit }: { onSubmit: (a: number, b: number) => void }) {
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const submit = () => {
    const na = parseInt(a, 10), nb = parseInt(b, 10)
    if (Number.isInteger(na) && Number.isInteger(nb) && na >= 0 && nb >= 0 && na !== nb) {
      onSubmit(na, nb)
    }
  }
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <Input type="number" min="0" max="3" placeholder="0" value={a}
        onChange={e => setA(e.target.value)}
        className="w-12 h-7 text-center text-xs font-mono" />
      <span className="text-white/30 text-[10px]">:</span>
      <Input type="number" min="0" max="3" placeholder="0" value={b}
        onChange={e => setB(e.target.value)}
        className="w-12 h-7 text-center text-xs font-mono" />
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={submit} disabled={!a || !b}>
        OK
      </Button>
    </div>
  )
}
