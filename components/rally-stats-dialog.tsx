"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { BarChart3 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { recordRallyStat } from "@/lib/rally-stats"
import type {
  BallDirection,
  BallTrajectory,
  RacketSide,
  RallyEndKind,
  StrikePosition,
  TeamKey,
} from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

const KINDS: RallyEndKind[] = ["winner", "error"]
const SIDES: RacketSide[] = ["forehand", "backhand"]
const POSITIONS: StrikePosition[] = ["front", "middle", "back"]
const DIRECTIONS: BallDirection[] = ["cross", "down-line", "middle"]
const TRAJECTORIES: BallTrajectory[] = ["drive", "lob", "drop", "volley", "smash"]

/**
 * Manual rally-stat recorder. The operator picks who scored and the rally
 * details; the engine wires the stat into rallyStats + the event log.
 *
 * (Full integration with applyScoreIncrement to auto-prompt after each point is
 * a future enhancement gated by settings.recordRallyStats.)
 */
export function RallyStatsDialog({ match, updateMatch }: Props) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [scoringTeam, setScoringTeam] = useState<TeamKey | null>(null)
  const [kind, setKind] = useState<RallyEndKind | null>(null)
  const [side, setSide] = useState<RacketSide | null>(null)
  const [position, setPosition] = useState<StrikePosition | null>(null)
  const [direction, setDirection] = useState<BallDirection | null>(null)
  const [trajectory, setTrajectory] = useState<BallTrajectory | null>(null)

  const reset = () => {
    setScoringTeam(null)
    setKind(null)
    setSide(null)
    setPosition(null)
    setDirection(null)
    setTrajectory(null)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const teamAName = match?.teamA?.players?.[0]?.name ?? t("extras.teamA")
  const teamBName = match?.teamB?.players?.[0]?.name ?? t("extras.teamB")

  const apply = () => {
    if (!scoringTeam || !kind || !updateMatch) return
    const creditedTeam: TeamKey = kind === "winner"
      ? scoringTeam
      : scoringTeam === "teamA" ? "teamB" : "teamA"
    updateMatch(
      recordRallyStat(match, {
        scoringTeam,
        creditedTeam,
        kind,
        racketSide: side ?? undefined,
        position: position ?? undefined,
        direction: direction ?? undefined,
        trajectory: trajectory ?? undefined,
      }),
    )
    setOpen(false)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={match?.isCompleted}>
          <BarChart3 className="h-4 w-4 mr-1" />
          {t("extras.rally")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("extras.rallyTitle")}</DialogTitle>
          <DialogDescription>{t("extras.rallyDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <PickerRow label={t("extras.rallyScoredBy")} value={scoringTeam} options={["teamA", "teamB"]} onPick={setScoringTeam}
                     formatter={(o) => (o === "teamA" ? teamAName : teamBName)} />
          <PickerRow label={t("extras.rallyKind")} value={kind} options={KINDS} onPick={setKind} />
          <PickerRow label={t("extras.rallyRacketSide")} value={side} options={SIDES} onPick={setSide} optionalSuffix={t("extras.rallyOptional")} />
          <PickerRow label={t("extras.rallyPosition")} value={position} options={POSITIONS} onPick={setPosition} optionalSuffix={t("extras.rallyOptional")} />
          <PickerRow label={t("extras.rallyDirection")} value={direction} options={DIRECTIONS} onPick={setDirection} optionalSuffix={t("extras.rallyOptional")} />
          <PickerRow label={t("extras.rallyTrajectory")} value={trajectory} options={TRAJECTORIES} onPick={setTrajectory} optionalSuffix={t("extras.rallyOptional")} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t("extras.cancel")}</Button>
          <Button onClick={apply} disabled={!scoringTeam || !kind}>{t("extras.rallyRecord")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PickerRow<T extends string>({
  label,
  value,
  options,
  onPick,
  optionalSuffix,
  formatter,
}: {
  label: string
  value: T | null
  options: readonly T[]
  onPick: (v: T) => void
  optionalSuffix?: string
  formatter?: (o: T) => string
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}{optionalSuffix ? ` ${optionalSuffix}` : ""}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <Button
            key={o}
            size="sm"
            variant={value === o ? "default" : "outline"}
            onClick={() => onPick(o)}
          >
            {formatter ? formatter(o) : String(o)}
          </Button>
        ))}
      </div>
    </div>
  )
}
