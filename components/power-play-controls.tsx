"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Zap, ZapOff } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { powerPlayBudgetLeft, toggleNextRallyPowerPlay } from "@/lib/power-play"
import type { TeamKey } from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

/**
 * Power Play activator with budget display. The hook will:
 *  - Refuse activation on game-ball / golden-point (engine constraint).
 *  - Refuse activation when budget is exhausted.
 * Both refusals are silent in v1 — the operator can see the disabled button.
 */
export function PowerPlayControls({ match, updateMatch }: Props) {
  const { t } = useLanguage()
  if (!match) return null

  const teamAActive = match?.powerPlay?.activeFor?.includes("teamA") ?? false
  const teamBActive = match?.powerPlay?.activeFor?.includes("teamB") ?? false

  const onToggle = (team: TeamKey) => {
    if (!updateMatch) return
    const r = toggleNextRallyPowerPlay(match, team)
    if (!r.refused) {
      updateMatch(r.match, {
        command: "toggle-power-play",
        args: { team },
        clientId: "power-play",
      })
    }
  }

  const renderTeam = (team: TeamKey, active: boolean) => {
    const left = powerPlayBudgetLeft(match, team)
    const teamName = match?.[team]?.players?.[0]?.name ?? (team === "teamA" ? "A" : "B")
    return (
      <Button
        key={team}
        size="sm"
        variant={active ? "default" : "outline"}
        className={active ? "bg-amber-500 hover:bg-amber-600 text-black" : ""}
        onClick={() => onToggle(team)}
        disabled={match.isCompleted || (!active && left === 0)}
      >
        {active ? <Zap className="h-4 w-4 mr-1" /> : <ZapOff className="h-4 w-4 mr-1" />}
        {teamName}
        <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">{left}</Badge>
      </Button>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{t("extras.powerPlay")}</span>
        <div className="flex gap-1">
          {renderTeam("teamA", teamAActive)}
          {renderTeam("teamB", teamBActive)}
        </div>
      </CardContent>
    </Card>
  )
}
