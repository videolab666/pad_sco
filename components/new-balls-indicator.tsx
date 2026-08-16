"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CircleDot } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { isNewBallsDueNow, markNewBallsChanged, newBallsInXGames } from "@/lib/new-balls"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

/**
 * Compact indicator + "Balls changed" action button.
 *  - Renders nothing when newBallsInXGames returns null (mode "off" / mid-game / completed).
 *  - Shows "NEW BALLS" (yellow) when due now; click marks the change.
 *  - Shows "Balls in N" (subtle) when due in N>0 games.
 */
export function NewBallsIndicator({ match, updateMatch }: Props) {
  const { t } = useLanguage()
  const remaining = newBallsInXGames(match)
  if (remaining === null || remaining === -1) return null

  const dueNow = isNewBallsDueNow(match)

  const onChanged = () => {
    if (!updateMatch) return
    updateMatch(markNewBallsChanged(match))
  }

  if (dueNow) {
    return (
      <Button
        variant="default"
        size="sm"
        className="bg-yellow-400 text-black hover:bg-yellow-500"
        onClick={onChanged}
        disabled={match?.isCompleted}
      >
        <CircleDot className="h-4 w-4 mr-1" />
        {t("extras.newBalls")}
      </Button>
    )
  }

  return (
    <Badge variant="outline" className="text-xs">
      <CircleDot className="h-3 w-3 mr-1 opacity-60" />
      {t("extras.newBallsIn", { count: remaining })}
    </Badge>
  )
}
