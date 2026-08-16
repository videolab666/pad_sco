"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLanguage } from "@/contexts/language-context"
import type { MatchEvent, MatchEventType } from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
}

const FILTERS: { key: "all" | MatchEventType; labelKey: "historyAll" | "historyPoints" | "historyEdits" | "historyTimer" | "historyTimeouts" | "historyConduct" | "historyRally" | "historyUndo" }[] = [
  { key: "all", labelKey: "historyAll" },
  { key: "point", labelKey: "historyPoints" },
  { key: "manual-score-edit", labelKey: "historyEdits" },
  { key: "timer", labelKey: "historyTimer" },
  { key: "timeout", labelKey: "historyTimeouts" },
  { key: "conduct", labelKey: "historyConduct" },
  { key: "rally-stat", labelKey: "historyRally" },
  { key: "undo", labelKey: "historyUndo" },
]

/**
 * Read-only audit log over the events journal. Filterable by type.
 * Renders newest first to match the operator's mental model.
 */
export function MatchHistoryPanel({ match }: Props) {
  const { t } = useLanguage()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all")
  const events: MatchEvent[] = useMemo(() => {
    const list: MatchEvent[] = match?.events ?? []
    const filtered = filter === "all" ? list : list.filter((e) => e.type === filter)
    return [...filtered].reverse()
  }, [match?.events, filter])

  if (!match) return null

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
            >
              {t(`extras.${f.labelKey}`)}
            </Button>
          ))}
        </div>

        <ScrollArea className="h-[260px] pr-2">
          <ul className="space-y-1 text-sm">
            {events.length === 0 && (
              <li className="text-xs text-muted-foreground">{t("extras.historyEmpty")}</li>
            )}
            {events.map((e) => (
              <li key={e.id} className="border-b border-muted/40 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] uppercase">{e.type}</Badge>
                    {e.actor && <Badge variant="secondary" className="text-[10px]">{e.actor}</Badge>}
                    <span className="truncate text-xs text-muted-foreground">
                      {t("extras.historyLocation", { set: e.setIndex + 1, game: e.gameIndex + 1 })}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {formatTime(e.at)}
                  </span>
                </div>
                {summary(e) && (
                  <div className="text-xs text-muted-foreground pl-1">{summary(e)}</div>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return iso
  }
}

function summary(e: MatchEvent): string | null {
  const p: any = e.payload
  if (!p) return null
  switch (e.type) {
    case "manual-score-edit":
      return p.action ? String(p.action) : null
    case "timer":
      return p.timerType ? `${p.action ?? "start"} · ${p.timerType}` : p.action
    case "conduct":
      return p.penalty ? `penalty: ${p.penalty}` : null
    case "appeal":
      return p.decision ? `decision: ${p.decision}` : null
    case "rally-stat":
      return [p.kind, p.racketSide].filter(Boolean).join(" · ") || null
    case "power-play":
      return [p.action, p.outcome].filter(Boolean).join(" · ") || null
    case "end-match-manual":
      return p.reason ? `reason: ${p.reason}` : null
    default:
      return null
  }
}
