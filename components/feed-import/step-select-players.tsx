"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { getTournamentPlayers } from "@/lib/dy/dy-client"
import { importPlayers, type ImportedPlayer } from "@/lib/dy/dy-import"
import { hasCyrillic, transliterate } from "@/lib/dy/translit"
import type { DyPlayerRow, DyPlayersResponse, DyTournament } from "@/lib/dy/dy-types"

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
  const [translit, setTranslit] = useState(true)
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

  // Rows come pre-split from the client: doubles feeds (e.g. rankedin) list
  // one entry per pair, but each player must be imported individually.
  const players: DyPlayerRow[] = category ? resp[category] ?? [] : []

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allSelected = players.length > 0 && players.every((_, i) => selected.has(String(i)))

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) players.forEach((_, i) => next.delete(String(i)))
      else players.forEach((_, i) => next.add(String(i)))
      return next
    })

  const handleImport = async () => {
    setImporting(true)
    try {
      const chosen = players.filter((_, i) => selected.has(String(i)))
      const result = await importPlayers(
        chosen.map((p) => ({ name: p.name, dyId: p.dyId, country: p.country })),
        { transliterate: translit },
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
        <div className="max-h-[45vh] overflow-y-auto pr-2">
          <div className="space-y-1">
            {players.map((p, i) => {
              const id = String(i)
              return (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted"
                >
                  <Checkbox checked={selected.has(id)} onCheckedChange={() => toggle(id)} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {translit && hasCyrillic(p.name) && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      → {transliterate(p.name)}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted">
        <Checkbox checked={translit} onCheckedChange={(v) => setTranslit(v === true)} />
        <span className="text-sm">{t("feedImport.translitNames")}</span>
      </label>

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
