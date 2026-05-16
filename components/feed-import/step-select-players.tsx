"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { getTournamentPlayers } from "@/lib/dy/dy-client"
import { importPlayers, type ImportedPlayer } from "@/lib/dy/dy-import"
import type { DyPlayer, DyPlayersResponse, DyTournament } from "@/lib/dy/dy-types"

interface StepSelectPlayersProps {
  tournament: DyTournament
  onImported: (players: ImportedPlayer[]) => void
}

export function StepSelectPlayers({ tournament, onImported }: StepSelectPlayersProps) {
  const { t } = useLanguage()
  const [resp, setResp] = useState<DyPlayersResponse>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setResp(await getTournamentPlayers(tournament))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [tournament])

  useEffect(() => {
    load()
  }, [load])

  const categories = useMemo(
    () => Object.keys(resp).filter((k) => Array.isArray(resp[k])),
    [resp],
  )

  const players: DyPlayer[] = category ? resp[category] ?? [] : []

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allSelected = players.length > 0 && players.every((p) => selected.has(String(p.id)))

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) players.forEach((p) => next.delete(String(p.id)))
      else players.forEach((p) => next.add(String(p.id)))
      return next
    })

  const handleImport = async () => {
    setImporting(true)
    try {
      const chosen = players.filter((p) => selected.has(String(p.id)))
      const result = await importPlayers(
        chosen.map((p) => ({ name: p.name, dyId: String(p.id) })),
      )
      onImported(result)
    } finally {
      setImporting(false)
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
    return <p className="py-6 text-center text-muted-foreground">{t("feedImport.noPlayers")}</p>
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
            onClick={() => {
              setCategory(c)
              setSelected(new Set())
            }}
          >
            {c} ({(resp[c] ?? []).length})
          </Button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setCategory(null)}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          {category}
        </Button>
        {players.length > 0 && (
          <Button variant="link" size="sm" onClick={toggleAll}>
            {t("feedImport.selectAll")}
          </Button>
        )}
      </div>

      {players.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">{t("feedImport.noPlayers")}</p>
      ) : (
        <ScrollArea className="max-h-[45vh] pr-2">
          <div className="space-y-1">
            {players.map((p) => {
              const id = String(p.id)
              return (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted"
                >
                  <Checkbox checked={selected.has(id)} onCheckedChange={() => toggle(id)} />
                  <span>{p.name}</span>
                </label>
              )
            })}
          </div>
        </ScrollArea>
      )}

      <Button
        className="w-full"
        disabled={selected.size === 0 || importing}
        onClick={handleImport}
      >
        {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("feedImport.import")}
      </Button>
    </div>
  )
}
