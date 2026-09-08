"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLanguage } from "@/contexts/language-context"
import { applyTiebreakChoice } from "@/lib/tiebreak-format"
import type { PendingTiebreakChoice } from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

/**
 * Auto-renders when match.pendingTiebreakChoice is set (receiver-select tiebreak
 * formats). The receiver picks +1, +2 or +3 — we apply it via the canonical
 * helper which raises tiebreakLength accordingly.
 */
export function TiebreakChoiceDialog({ match, updateMatch }: Props) {
  const { t } = useLanguage()
  const pending: PendingTiebreakChoice | undefined = match?.pendingTiebreakChoice
  const open = Boolean(pending)

  const receiverName = useMemo(() => {
    if (!pending) return ""
    const team = pending.receiverTeam
    return match?.[team]?.players?.[0]?.name ?? (team === "teamA" ? t("extras.teamA") : t("extras.teamB"))
  }, [match, pending, t])

  if (!pending) return null

  const onPick = (offset: number) => {
    if (!updateMatch) return
    updateMatch(applyTiebreakChoice(match, offset), {
      command: "tiebreak-choice",
      args: { offset },
      clientId: "tiebreak-choice",
    })
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("extras.tiebreakChoiceTitle")}</DialogTitle>
          <DialogDescription>
            {t("extras.tiebreakChoiceDescription", { name: receiverName, base: pending.baseTarget })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {pending.options.map((o) => (
            <Button key={o} onClick={() => onPick(o)}>
              {t("extras.tiebreakChoiceOption", { offset: o, target: pending.baseTarget + o })}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
