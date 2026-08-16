"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { getMatches } from "@/lib/dy/dy-client"
import { matchCategories, splitSide } from "@/lib/dy/dy-normalize"
import { ensureLocalPlayer, type ImportedPlayer } from "@/lib/dy/dy-import"
import type { DyMatch, DyMatchesResponse, DyTournament } from "@/lib/dy/dy-types"

export interface PickedMatch {
  teamA: ImportedPlayer[]
  teamB: ImportedPlayer[]
  format: "singles" | "doubles"
  round?: string
  court?: string
  sourceMatchId: string
  tournamentName: string
}

interface StepSelectMatchProps {
  tournament: DyTournament
  onPickMatch: (data: PickedMatch) => void
}

const hasRealDate = (m: DyMatch) => !!m.date && !m.date.startsWith("0001-01-01")

export function StepSelectMatch({ tournament, onPickMatch }: StepSelectMatchProps) {
  const { t } = useLanguage()
  const [resp, setResp] = useState<DyMatchesResponse>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [translit, setTranslit] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setResp(await getMatches(tournament))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [tournament])

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(() => matchCategories(resp), [resp])

  const handlePick = async (m: DyMatch) => {
    setBusyId(String(m.id))
    try {
      const a = splitSide(m.A)
      const b = splitSide(m.B)
      // Sequentially: concurrent ensureLocalPlayer calls race on localStorage
      // and one player's record gets overwritten by the other.
      const teamA: ImportedPlayer[] = []
      for (const p of a) teamA.push(await ensureLocalPlayer(p, { transliterate: translit }))
      const teamB: ImportedPlayer[] = []
      for (const p of b) teamB.push(await ensureLocalPlayer(p, { transliterate: translit }))
      const format: "singles" | "doubles" =
        teamA.length === 2 || teamB.length === 2 ? "doubles" : "singles"
      onPickMatch({
        teamA,
        teamB,
        format,
        round: m.round,
        court: m.court,
        sourceMatchId: String(m.id),
        tournamentName: tournament.Name,
      })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-2">
          <span>{t("feedImport.loadError")}</span>
          <Button size="sm" variant="outline" onClick={load}>
            {t("feedImport.refresh")}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (categories.length === 0) {
    return <p className="py-6 text-center text-muted-foreground">{t("feedImport.noMatches")}</p>
  }

  if (!category) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("feedImport.selectCategory")}</p>
        {categories.map((c) => (
          <Button
            key={c}
            variant="outline"
            className="w-full justify-start"
            onClick={() => setCategory(c)}
          >
            {c} ({(resp[c] as DyMatch[]).length})
          </Button>
        ))}
      </div>
    )
  }

  const matches = (resp[category] as DyMatch[]) ?? []

  return (
    <div className="space-y-2">
      <Button variant="ghost" size="sm" onClick={() => setCategory(null)}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        {category}
      </Button>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted">
        <Checkbox checked={translit} onCheckedChange={(v) => setTranslit(v === true)} />
        <span className="text-sm">{t("feedImport.translitNames")}</span>
      </label>
      {matches.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">{t("feedImport.noMatches")}</p>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto pr-2">
          <div className="space-y-2">
            {matches.map((m) => (
              <button
                key={String(m.id)}
                type="button"
                disabled={busyId !== null}
                onClick={() => handlePick(m)}
                className="flex w-full items-center gap-2 rounded-md border p-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {m.A.name} <span className="text-muted-foreground">vs</span> {m.B.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[hasRealDate(m) ? m.time : "", m.court].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {busyId === String(m.id) && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
