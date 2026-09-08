"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Trophy } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import {
  clearHandicap,
  pointIndexToTennisScore,
  setSameHandicap,
} from "@/lib/handicap"
import type { HandicapState } from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

const POINT_OPTIONS: { value: 0 | 1 | 2 | 3; label: string }[] = [
  { value: 0, label: "0" },
  { value: 1, label: "15" },
  { value: 2, label: "30" },
  { value: 3, label: "40" },
]

/**
 * Standalone handicap editor for the match-settings panel. v1 surfaces only
 * the most common case (same-for-all-games + none); per-game configuration
 * stays in the engine (`setPerGameHandicap`) for advanced setups.
 */
export function HandicapEditor({ match, updateMatch }: Props) {
  const { t } = useLanguage()
  const h: HandicapState | undefined = match?.handicap
  const initial = h?.format === "same-for-all-games" ? h.sameForAllGames ?? { teamA: 0, teamB: 0 } : { teamA: 0, teamB: 0 }
  const [teamA, setTeamA] = useState<0 | 1 | 2 | 3>(initial.teamA as 0 | 1 | 2 | 3)
  const [teamB, setTeamB] = useState<0 | 1 | 2 | 3>(initial.teamB as 0 | 1 | 2 | 3)

  const teamAName = match?.teamA?.players?.[0]?.name ?? t("extras.teamA")
  const teamBName = match?.teamB?.players?.[0]?.name ?? t("extras.teamB")

  const applySame = () => {
    if (!updateMatch) return
    updateMatch(setSameHandicap(match, teamA, teamB), {
      command: "set-handicap",
      args: { teamA, teamB },
      clientId: "handicap-editor",
    })
  }

  const clear = () => {
    if (!updateMatch) return
    updateMatch(clearHandicap(match), { command: "clear-handicap", args: {}, clientId: "handicap-editor" })
  }

  const formatLabel = h?.format ?? "none"

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            <span className="text-sm font-medium">{t("extras.handicap")}</span>
          </div>
          <span className="text-xs text-muted-foreground capitalize">{formatLabel.replace(/-/g, " ")}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{teamAName}</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {POINT_OPTIONS.map((o) => (
                <Button key={o.value} size="sm" variant={teamA === o.value ? "default" : "outline"} onClick={() => setTeamA(o.value)}>
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">{teamBName}</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {POINT_OPTIONS.map((o) => (
                <Button key={o.value} size="sm" variant={teamB === o.value ? "default" : "outline"} onClick={() => setTeamB(o.value)}>
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {t("extras.handicapNextGame", { a: pointIndexToTennisScore(teamA), b: pointIndexToTennisScore(teamB) })}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={clear}>{t("extras.handicapClear")}</Button>
          <Button size="sm" onClick={applySame}>{t("extras.handicapApplySame")}</Button>
        </div>
      </CardContent>
    </Card>
  )
}
