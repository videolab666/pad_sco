"use client"

import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/contexts/language-context"
import { formatDateRange, isRunningNow } from "@/lib/dy/dy-normalize"
import type { DyTournament } from "@/lib/dy/dy-types"

interface FeedTournamentItemProps {
  tournament: DyTournament
  onSelect: (tournament: DyTournament) => void
}

export function FeedTournamentItem({ tournament, onSelect }: FeedTournamentItemProps) {
  const { t } = useLanguage()
  const range = formatDateRange(tournament)
  const running = isRunningNow(tournament)

  return (
    <button
      type="button"
      onClick={() => onSelect(tournament)}
      className="flex w-full flex-col gap-1 rounded-md border p-2 text-left transition-colors hover:bg-muted"
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium">{tournament.Name}</span>
        {running && (
          <Badge className="shrink-0 bg-green-600 hover:bg-green-600">
            {t("feedImport.runningNow")}
          </Badge>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {[tournament.Region, tournament.Country, range].filter(Boolean).join(" · ")}
      </div>
    </button>
  )
}
