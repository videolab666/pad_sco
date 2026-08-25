"use client"

// Balanced Teams Panel (§32): подсказка оптимального разбиения команд.
// Показывается в /americano при выборе игроков (4+) и в /new-match.

import { useMemo, useState } from "react"
import { ArrowLeftRight, Scale, Users, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { suggestBalancedTeams, type RatedPlayer } from "@/lib/balanced-teams"

interface PlayerWithRating { id: string; name: string; rating?: number }

export function BalancedTeamsPanel({ players, onApply }: {
  players: PlayerWithRating[]
  onApply?: (teamA: string[], teamB: string[]) => void
}) {
  const [visible, setVisible] = useState(false)

  const suggestion = useMemo(() => {
    if (players.length < 4) return null
    const rated: RatedPlayer[] = players.map(p => ({
      playerId: p.id,
      name: p.name,
      rating: p.rating ?? 25, // дефолт OpenSkill mu
    }))
    return suggestBalancedTeams(rated)
  }, [players])

  if (!suggestion) return null

  return (
    <Card className="border-[#A4FB23]/20 bg-[#A4FB23]/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Scale className="h-4 w-4 text-[#A4FB23]" />
            Равные команды
          </CardTitle>
          <Badge variant="secondary" className="bg-[#A4FB23]/20 text-[#A4FB23]">
            {suggestion.balancePercent}% баланс
          </Badge>
        </div>
        <CardDescription>
          Разница рейтингов: {suggestion.difference.toFixed(1)} pts
        </CardDescription>
      </CardHeader>
      {visible && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/50">
                <Users className="h-3 w-3" /> Команда A
              </div>
              {suggestion.teamA.map(p => (
                <div key={p.playerId} className="text-sm font-medium text-[#A4FB23]">{p.name}</div>
              ))}
              <div className="mt-2 text-xs text-white/40">
                Рейтинг: {suggestion.teamARating.toFixed(1)}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/50">
                <Users className="h-3 w-3" /> Команда B
              </div>
              {suggestion.teamB.map(p => (
                <div key={p.playerId} className="text-sm font-medium text-white/70">{p.name}</div>
              ))}
              <div className="mt-2 text-xs text-white/40">
                Рейтинг: {suggestion.teamBRating.toFixed(1)}
              </div>
            </div>
          </div>
          {onApply && (
            <Button
              size="sm" className="mt-3 w-full"
              onClick={() => onApply(
                suggestion.teamA.map(p => p.playerId),
                suggestion.teamB.map(p => p.playerId),
              )}
            >
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              Применить состав
            </Button>
          )}
        </CardContent>
      )}
      <CardContent className="pt-0">
        <Button
          variant="ghost" size="sm" className="w-full text-xs"
          onClick={() => setVisible(!visible)}
        >
          <Zap className="h-3 w-3 mr-1 text-[#A4FB23]" />
          {visible ? "Скрыть" : "Показать подсказку"}
        </Button>
      </CardContent>
    </Card>
  )
}
