"use client"

// Quick Play по QR корта (plan-4 §15): /c/{code}/play.
//
// Игрок сканирует QR → «Быстрая игра» → 4 слота (игрок из базы по имени
// или гость) → START: создаётся Court Session (публичный API) и матч
// (createMatch, как в /new-match) с courtId/sessionId → редирект на
// вечную ссылку /c/{code}, где включается табло.
//
// Формат v1 фиксированный: стандартный падел (3 сета, классика,
// golden point по настройкам клуба — как дефолты /new-match).

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Shuffle, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getPlayers } from "@/lib/player-storage"
import { createMatch } from "@/lib/match-storage"

interface CourtInfo {
  id: string
  name: string
  shortCode: string
  number: number | null
}

interface Slot {
  key: string
  /** Введённое имя: совпадение с базой → игрок, иначе гость. */
  value: string
}

const emptySlot = (n: number): Slot => ({ key: `slot-${n}`, value: "" })

export default function QuickPlayPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()

  const [court, setCourt] = useState<CourtInfo | null>(null)
  const [courtError, setCourtError] = useState("")
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([])
  const [slots, setSlots] = useState<Slot[]>([emptySlot(1), emptySlot(2), emptySlot(3), emptySlot(4)])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/v1/courts/${code}`, { cache: "no-store" })
        if (!res.ok) {
          setCourtError("Корт не найден — проверьте QR-код")
          return
        }
        const data = await res.json()
        setCourt(data.court)
      } catch {
        setCourtError("Нет связи с сервером")
      }
    })()
    void getPlayers()
      .then((list) => setPlayers((list ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))))
      .catch(() => setPlayers([]))
  }, [code])

  const setSlot = (i: number, value: string) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, value } : s)))

  const filled = slots.map((s) => s.value.trim()).filter(Boolean)
  const canStart = court && filled.length === 4 && !busy

  const shuffle = () =>
    setSlots((prev) => {
      const values = prev.map((s) => s.value).sort(() => Math.random() - 0.5)
      return prev.map((s, i) => ({ ...s, value: values[i] }))
    })

  /** Игрок базы по имени (то, что ввёл пользователь) или гость. */
  const resolveSlot = useCallback(
    (name: string, guestIndex: number) => {
      const pool = players.find((p) => p.name.toLowerCase() === name.toLowerCase())
      if (pool) return { id: pool.id, name: pool.name }
      return { id: `qp-guest-${guestIndex}`, name }
    },
    [players],
  )

  const start = async () => {
    if (!court || !canStart) return
    setBusy(true)
    setError("")
    try {
      // 1. Court Session (§5): участники — 4 имени с playerId при наличии.
      const participants = filled.map((name, i) => {
        const pool = players.find((p) => p.name.toLowerCase() === name.toLowerCase())
        return pool ? { playerId: pool.id, name: pool.name } : { name }
      })
      const sessionRes = await fetch(`/api/v1/courts/${code}/quick-play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "match", participants }),
      })
      const sessionData = await sessionRes.json()
      if (!sessionRes.ok) {
        setError(sessionData?.message ?? "Не удалось создать сессию")
        return
      }
      const sessionId: string = sessionData.session.id

      // 2. Матч — та же форма, что создаёт /new-match.
      const numericId = () =>
        Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("")
      const match = {
        id: numericId(),
        type: "quick-play",
        format: "doubles",
        createdAt: new Date().toISOString(),
        settings: {
          sets: 3,
          scoringSystem: "classic",
          gamesPerSet: 6,
          gamesPerSetOverrides: {},
          tiebreakEnabled: true,
          tiebreakFormat: "two-clear",
          tiebreakLength: 7,
          tiebreakAt: "6-6",
          finalSetTiebreak: true,
          finalSetFinish: "match-tiebreak-10",
          finalSetTiebreakLength: 10,
          goldenPointFormat: "none",
          goldenGame: false,
          windbreak: false,
        },
        teamA: {
          players: [resolveSlot(filled[0], 1), resolveSlot(filled[1], 2)],
          isServing: true,
        },
        teamB: {
          players: [resolveSlot(filled[2], 3), resolveSlot(filled[3], 4)],
          isServing: false,
        },
        score: {
          teamA: 0,
          teamB: 0,
          sets: [],
          currentSet: {
            teamA: 0,
            teamB: 0,
            games: [],
            currentGame: { teamA: 0, teamB: 0 },
          },
          isTiebreak: false,
        },
        currentServer: { team: "teamA", playerIndex: 0 },
        courtSides: { teamA: "left", teamB: "right" },
        shouldChangeSides: false,
        history: [],
        isCompleted: false,
        courtNumber: court.number,
        courtId: court.id,
        sessionId,
        created_via_quick_play: true,
      }

      await createMatch(match)
      router.push(`/c/${code}`)
    } catch (err) {
      setError((err as Error).message || "Не удалось создать матч")
    } finally {
      setBusy(false)
    }
  }

  const datalistId = useMemo(() => "qp-players", [])
  const teamLabels = ["Команда A", "Команда A", "Команда B", "Команда B"]

  return (
    <main className="container max-w-xl mx-auto px-3 py-6">
      <datalist id={datalistId}>
        {players.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

      <div className="mb-4 flex items-center justify-between">
        <Link href={`/c/${code}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" /> К табло корта
        </Link>
        {court && <span className="text-sm text-muted-foreground">/c/{court.shortCode}</span>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Быстрая игра{court ? ` · ${court.number !== null ? `Корт ${court.name}` : court.name}` : ""}
          </CardTitle>
          <CardDescription>
            Введите имена четверых: совпадение с базой подтянет игрока, новое имя станет гостем.
            Формат — стандартный (3 сета).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {courtError && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {courtError}
            </div>
          )}
          {slots.map((slot, i) => (
            <div key={slot.key} className="space-y-1">
              <Label htmlFor={slot.key}>
                {teamLabels[i]} · игрок {i % 2 === 0 ? 1 : 2}
              </Label>
              <Input
                id={slot.key}
                list={datalistId}
                placeholder="Имя (начните вводить для поиска)"
                value={slot.value}
                onChange={(e) => setSlot(i, e.target.value)}
                autoComplete="off"
              />
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={shuffle} disabled={filled.length < 2}>
              <Shuffle className="mr-1 h-4 w-4" /> Перемешать
            </Button>
            <Button onClick={() => void start()} disabled={!canStart}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Начать игру
            </Button>
          </div>
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
