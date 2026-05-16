"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { getTournaments } from "@/lib/dy/dy-client"
import { filterActiveTournaments, groupByCountry, isRunningNow } from "@/lib/dy/dy-normalize"
import type { DyFeedType, DyTournament } from "@/lib/dy/dy-types"
import { FeedTournamentItem } from "./feed-tournament-item"

interface StepSelectTournamentProps {
  platform: DyFeedType
  onSelect: (tournament: DyTournament) => void
}

export function StepSelectTournament({ platform, onSelect }: StepSelectTournamentProps) {
  const { t } = useLanguage()
  const [tournaments, setTournaments] = useState<DyTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const list = await getTournaments(platform)
      setTournaments(filterActiveTournaments(list, platform.isLeague))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [platform])

  useEffect(() => {
    load()
  }, [load])

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? tournaments.filter((tt) =>
          [tt.Name, tt.Country, tt.Region].some((v) => v?.toLowerCase().includes(q)),
        )
      : tournaments
    return groupByCountry(filtered)
  }, [tournaments, search])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
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

  const countries = Object.keys(groups).sort()
  if (countries.length === 0) {
    return <p className="py-6 text-center text-muted-foreground">{t("feedImport.noTournaments")}</p>
  }

  // expand groups that contain a running tournament
  const defaultOpen = countries.filter((c) => groups[c].some(isRunningNow))

  return (
    <div className="space-y-3">
      <Input
        placeholder={t("feedImport.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Accordion type="multiple" defaultValue={defaultOpen.length ? defaultOpen : [countries[0]]}>
        {countries.map((country) => (
          <AccordionItem key={country} value={country}>
            <AccordionTrigger>
              {country} ({groups[country].length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {groups[country].map((tt, i) => (
                  <FeedTournamentItem key={`${tt.FeedMatches}-${i}`} tournament={tt} onSelect={onSelect} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
