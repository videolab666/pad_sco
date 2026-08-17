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
import { Label } from "@/components/ui/label"
import { Pencil, RotateCcw, Undo2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { adjustCurrentGame, adjustCurrentSet, adjustCurrentServer } from "@/lib/match-adjust"
import { reseedJournal, undoBackOneGame, undoBackOneSet, verifyJournal } from "@/lib/match-undo"
import type { TeamKey } from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

const GAME_OPTIONS: { value: 0 | 1 | 2 | 3 | "Ad"; label: string }[] = [
  { value: 0, label: "0" },
  { value: 1, label: "15" },
  { value: 2, label: "30" },
  { value: 3, label: "40" },
  { value: "Ad", label: "Ad" },
]

export function AdjustScoreDialog({ match, updateMatch }: Props) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  const cs = match?.score?.currentSet
  const cg = cs?.currentGame ?? { teamA: 0, teamB: 0 }
  const [gameA, setGameA] = useState<0 | 1 | 2 | 3 | "Ad">(toPointIndex(cg.teamA))
  const [gameB, setGameB] = useState<0 | 1 | 2 | 3 | "Ad">(toPointIndex(cg.teamB))
  const [setA, setSetA] = useState<number>(cs?.teamA ?? 0)
  const [setB, setSetB] = useState<number>(cs?.teamB ?? 0)

  // Journal-based undo availability (same cheap probe the scoreboard uses;
  // integrity is fully verified at click time by verifyJournal).
  const canUndo = verifyJournal(match).canUndo

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setGameA(toPointIndex(cg.teamA))
      setGameB(toPointIndex(cg.teamB))
      setSetA(cs?.teamA ?? 0)
      setSetB(cs?.teamB ?? 0)
    }
  }

  const apply = () => {
    if (!updateMatch || !match) return
    let next = adjustCurrentGame(match, { teamA: gameA, teamB: gameB })
    next = adjustCurrentSet(next, { teamA: setA, teamB: setB })
    updateMatch(next)
    setOpen(false)
  }

  const setServer = (team: TeamKey) => {
    if (!updateMatch || !match) return
    updateMatch(adjustCurrentServer(match, team, 0))
  }

  // Undo game/set: the replayed snapshot carries the SEED's revision, so bump
  // it above the live one — otherwise the optimistic-state guard rejects it.
  const undoWithRevision = (undone: any) => {
    if (!undone || undone === match) return
    undone.revision = (typeof match?.revision === "number" ? match.revision : 0) + 1
    updateMatch(undone)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={match?.isCompleted}>
          <Pencil className="h-4 w-4 mr-1" />
          {t("extras.adjust")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("extras.adjustTitle")}</DialogTitle>
          <DialogDescription>{t("extras.adjustDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t("extras.adjustGamePoints")}</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <PointSelect value={gameA} onChange={setGameA} label={t("extras.teamA")} />
              <PointSelect value={gameB} onChange={setGameB} label={t("extras.teamB")} />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t("extras.adjustSetGames")}</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <NumberSpinner value={setA} onChange={setSetA} label={t("extras.teamA")} />
              <NumberSpinner value={setB} onChange={setSetB} label={t("extras.teamB")} />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t("extras.adjustServingTeam")}</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button variant={match?.currentServer?.team === "teamA" ? "default" : "outline"} onClick={() => setServer("teamA")}>{t("extras.teamA")}</Button>
              <Button variant={match?.currentServer?.team === "teamB" ? "default" : "outline"} onClick={() => setServer("teamB")}>{t("extras.teamB")}</Button>
            </div>
          </div>

          {/* Откаты целого гейма/сета — открывают предыдущий гейм/сет на реальном счёте */}
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs">{t("extras.undoSection")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="flex-1 py-2 px-2 bg-gradient-to-br from-blue-800 to-blue-950 hover:from-blue-700 hover:to-blue-900 active:from-blue-600 active:to-blue-800 text-white border border-blue-700 rounded-md text-sm font-medium flex items-center justify-center transition-all shadow-md transform active:scale-95 active:translate-y-1 active:shadow-inner disabled:opacity-50 disabled:pointer-events-none"
                disabled={!canUndo || match?.isCompleted}
                title={!canUndo ? t("match.undoUnavailable") : undefined}
                onClick={() => undoWithRevision(undoBackOneGame(match))}
              >
                <Undo2 className="h-4 w-4 mr-1" />
                {t("match.undoGame")}
              </Button>
              <Button
                className="flex-1 py-2 px-2 bg-gradient-to-br from-blue-800 to-blue-950 hover:from-blue-700 hover:to-blue-900 active:from-blue-600 active:to-blue-800 text-white border border-blue-700 rounded-md text-sm font-medium flex items-center justify-center transition-all shadow-md transform active:scale-95 active:translate-y-1 active:shadow-inner disabled:opacity-50 disabled:pointer-events-none"
                disabled={!canUndo || match?.isCompleted}
                title={!canUndo ? t("match.undoUnavailable") : undefined}
                onClick={() => undoWithRevision(undoBackOneSet(match))}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                {t("match.undoSet")}
              </Button>
            </div>
            {!canUndo && !match?.isCompleted && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => undoWithRevision(reseedJournal(match))}>
                <Undo2 className="h-3 w-3 mr-1" />
                {t("extras.undoRepair")}
              </Button>
            )}
            <p className="text-[11px] leading-snug text-muted-foreground">
              {t("extras.undoHint")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t("extras.cancel")}</Button>
          <Button onClick={apply}>{t("extras.apply")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PointSelect({ value, onChange, label }: { value: 0 | 1 | 2 | 3 | "Ad"; onChange: (v: 0 | 1 | 2 | 3 | "Ad") => void; label: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {GAME_OPTIONS.map((o) => (
          <Button key={String(o.value)} variant={value === o.value ? "default" : "outline"} size="sm" onClick={() => onChange(o.value)}>
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function NumberSpinner({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onChange(Math.max(0, value - 1))}>−</Button>
        <span className="w-6 text-center font-mono">{value}</span>
        <Button variant="outline" size="sm" onClick={() => onChange(value + 1)}>+</Button>
      </div>
    </div>
  )
}

function toPointIndex(v: unknown): 0 | 1 | 2 | 3 | "Ad" {
  if (v === "Ad") return "Ad"
  if (v === 15) return 1
  if (v === 30) return 2
  if (v === 40) return 3
  return 0
}
