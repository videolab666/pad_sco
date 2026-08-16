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
import { AlertOctagon, Flag, HeartPulse, Timer } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { endMatchManually } from "@/lib/match-end-reason"
import type { EndMatchReason, TeamKey } from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

type ReasonOption = {
  key: Exclude<EndMatchReason, "completed">
  labelKey: "endMatchRetired" | "endMatchConduct" | "endMatchTime"
  descKey: "endMatchRetiredDesc" | "endMatchConductDesc" | "endMatchTimeDesc"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
}

const REASONS: ReasonOption[] = [
  { key: "retired-injury", labelKey: "endMatchRetired", descKey: "endMatchRetiredDesc", icon: HeartPulse },
  { key: "conduct", labelKey: "endMatchConduct", descKey: "endMatchConductDesc", icon: AlertOctagon },
  { key: "time-up", labelKey: "endMatchTime", descKey: "endMatchTimeDesc", icon: Timer },
]

export function EndMatchDialog({ match, updateMatch }: Props) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReasonOption["key"] | null>(null)

  const teamAName = match?.teamA?.players?.[0]?.name ?? t("extras.teamA")
  const teamBName = match?.teamB?.players?.[0]?.name ?? t("extras.teamB")

  const onWinner = (winner: TeamKey) => {
    if (!reason || !updateMatch) return
    updateMatch(endMatchManually(match, reason, winner))
    setOpen(false)
    setReason(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setReason(null) }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={match?.isCompleted}>
          <Flag className="h-4 w-4 mr-1" />
          {t("extras.endMatch")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("extras.endMatchTitle")}</DialogTitle>
          <DialogDescription>
            {!reason ? t("extras.endMatchPickReason") : t("extras.endMatchWhoWins")}
          </DialogDescription>
        </DialogHeader>

        {!reason && (
          <div className="grid grid-cols-1 gap-2">
            {REASONS.map((r) => {
              const Icon = r.icon
              return (
                <Button key={r.key} variant="outline" className="justify-start" onClick={() => setReason(r.key)}>
                  <Icon className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">{t(`extras.${r.labelKey}`)}</div>
                    <div className="text-xs text-muted-foreground">{t(`extras.${r.descKey}`)}</div>
                  </div>
                </Button>
              )
            })}
          </div>
        )}

        {reason && (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onWinner("teamA")}>{t("extras.tossWins", { name: teamAName })}</Button>
            <Button onClick={() => onWinner("teamB")}>{t("extras.tossWins", { name: teamBName })}</Button>
          </div>
        )}

        <DialogFooter>
          {reason && (
            <Button variant="ghost" size="sm" onClick={() => setReason(null)}>
              {t("extras.back")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
