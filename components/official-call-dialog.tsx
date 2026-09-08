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
import { Gavel } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import {
  applyConductPenalty,
  recordOfficialCall,
} from "@/lib/match-official-calls"
import type {
  AppealDecision,
  ConductPenalty,
  OfficialCallType,
  TeamKey,
} from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

const CALL_TYPES: { key: OfficialCallType; labelKey: "callConduct" | "callAppeal" | "callBroken" }[] = [
  { key: "conduct", labelKey: "callConduct" },
  { key: "appeal", labelKey: "callAppeal" },
  { key: "broken-equipment", labelKey: "callBroken" },
]
const CONDUCT_PENALTIES: ConductPenalty[] = ["warning", "stroke", "game", "match"]
const APPEAL_DECISIONS: AppealDecision[] = ["let", "no-let", "yes-let", "stroke"]
const EQUIPMENT: ("racket" | "string" | "ball" | "other")[] = ["racket", "string", "ball", "other"]

export function OfficialCallDialog({ match, updateMatch }: Props) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<OfficialCallType | null>(null)
  const [team, setTeam] = useState<TeamKey | null>(null)
  const [conduct, setConduct] = useState<ConductPenalty | null>(null)
  const [decision, setDecision] = useState<AppealDecision | null>(null)
  const [equipment, setEquipment] = useState<"racket" | "string" | "ball" | "other" | null>(null)

  const reset = () => {
    setType(null)
    setTeam(null)
    setConduct(null)
    setDecision(null)
    setEquipment(null)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const teamAName = match?.teamA?.players?.[0]?.name ?? t("extras.teamA")
  const teamBName = match?.teamB?.players?.[0]?.name ?? t("extras.teamB")

  const apply = () => {
    if (!type || !team || !updateMatch) return
    if (type === "conduct" && conduct) {
      updateMatch(applyConductPenalty(match, team, conduct), {
        command: "official-call",
        args: { type, team, penalty: conduct },
        clientId: "official-call",
      })
    } else if (type === "appeal") {
      updateMatch(recordOfficialCall(match, { type: "appeal", team, decision: decision ?? undefined }), {
        command: "official-call",
        args: { type, team, decision: decision ?? undefined },
        clientId: "official-call",
      })
    } else if (type === "broken-equipment") {
      updateMatch(recordOfficialCall(match, { type: "broken-equipment", team, equipment: equipment ?? undefined }), {
        command: "official-call",
        args: { type, team, equipment: equipment ?? undefined },
        clientId: "official-call",
      })
    }
    setOpen(false)
    reset()
  }

  const canApply = type && team && (
    type === "conduct" ? !!conduct
    : type === "appeal" ? !!decision
    : type === "broken-equipment" ? !!equipment
    : false
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={match?.isCompleted}>
          <Gavel className="h-4 w-4 mr-1" />
          {t("extras.call")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("extras.callTitle")}</DialogTitle>
          <DialogDescription>{t("extras.callDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t("extras.callType")}</div>
            <div className="flex flex-wrap gap-1">
              {CALL_TYPES.map((c) => (
                <Button key={c.key} size="sm" variant={type === c.key ? "default" : "outline"} onClick={() => { setType(c.key); setConduct(null); setDecision(null); setEquipment(null) }}>
                  {t(`extras.${c.labelKey}`)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">{t("extras.callTeam")}</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={team === "teamA" ? "default" : "outline"} onClick={() => setTeam("teamA")}>{teamAName}</Button>
              <Button variant={team === "teamB" ? "default" : "outline"} onClick={() => setTeam("teamB")}>{teamBName}</Button>
            </div>
          </div>

          {type === "conduct" && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t("extras.callPenalty")}</div>
              <div className="flex flex-wrap gap-1">
                {CONDUCT_PENALTIES.map((p) => (
                  <Button key={p} size="sm" variant={conduct === p ? "default" : "outline"} onClick={() => setConduct(p)}>
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {type === "appeal" && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t("extras.callDecision")}</div>
              <div className="flex flex-wrap gap-1">
                {APPEAL_DECISIONS.map((d) => (
                  <Button key={d} size="sm" variant={decision === d ? "default" : "outline"} onClick={() => setDecision(d)}>
                    {d}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {type === "broken-equipment" && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t("extras.callEquipment")}</div>
              <div className="flex flex-wrap gap-1">
                {EQUIPMENT.map((e) => (
                  <Button key={e} size="sm" variant={equipment === e ? "default" : "outline"} onClick={() => setEquipment(e)}>
                    {e}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t("extras.cancel")}</Button>
          <Button onClick={apply} disabled={!canApply}>{t("extras.apply")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
