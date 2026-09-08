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
import { Coins } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { commitToss, simulateToss } from "@/lib/toss"
import type { TeamKey, TossChoice } from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

type Step = "winner" | "choice" | "side"

/**
 * Multi-step toss UI that emits a SINGLE atomic write (commitToss). Reload
 * mid-flow is safe: nothing is written until the operator confirms the side.
 */
export function TossDialog({ match, updateMatch }: Props) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("winner")
  const [winner, setWinner] = useState<TeamKey | null>(null)
  const [choice, setChoice] = useState<TossChoice | null>(null)

  const teamAName = match?.teamA?.players?.[0]?.name ?? t("extras.teamA")
  const teamBName = match?.teamB?.players?.[0]?.name ?? t("extras.teamB")

  const reset = () => {
    setStep("winner")
    setWinner(null)
    setChoice(null)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const random = () => {
    const w = simulateToss()
    setWinner(w)
    setStep("choice")
  }

  const confirmSide = (teamOnLeft: TeamKey) => {
    if (!winner || !choice || !updateMatch) return
    updateMatch(commitToss(match, { winner, choice, teamOnLeft }), {
      command: "toss",
      args: { winner, choice, teamOnLeft },
      clientId: "toss-dialog",
    })
    setOpen(false)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={match?.isCompleted}>
          <Coins className="h-4 w-4 mr-1" />
          {t("extras.toss")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("extras.tossTitle")}</DialogTitle>
          <DialogDescription>
            {step === "winner" && t("extras.tossWhoWon")}
            {step === "choice" && t("extras.tossChose", { name: winner === "teamA" ? teamAName : teamBName })}
            {step === "side" && t("extras.tossWhichLeft")}
          </DialogDescription>
        </DialogHeader>

        {step === "winner" && (
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={() => { setWinner("teamA"); setStep("choice") }}>{t("extras.tossWins", { name: teamAName })}</Button>
            <Button onClick={() => { setWinner("teamB"); setStep("choice") }}>{t("extras.tossWins", { name: teamBName })}</Button>
            <Button variant="outline" onClick={random}>
              <Coins className="h-4 w-4 mr-1" />
              {t("extras.tossRandom")}
            </Button>
          </div>
        )}

        {step === "choice" && (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => { setChoice("serve"); setStep("side") }}>{t("extras.tossServe")}</Button>
            <Button onClick={() => { setChoice("receive"); setStep("side") }}>{t("extras.tossReceive")}</Button>
          </div>
        )}

        {step === "side" && (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => confirmSide("teamA")}>{t("extras.tossOnLeft", { name: teamAName })}</Button>
            <Button onClick={() => confirmSide("teamB")}>{t("extras.tossOnLeft", { name: teamBName })}</Button>
          </div>
        )}

        <DialogFooter className="text-xs text-muted-foreground">
          {step !== "winner" && (
            <Button variant="ghost" size="sm" onClick={reset}>
              {t("extras.tossRestart")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
