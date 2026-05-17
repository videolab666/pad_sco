"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeftRightIcon, RepeatIcon } from "lucide-react"
import { useSoundEffects } from "@/hooks/use-sound-effects"
import { useLanguage } from "@/contexts/language-context"
import { useEffect, useState } from "react"
import CourtPreview from "@/components/court-svg-preview"
import { switchServer, swapCourtSides } from "@/lib/scoring-logic"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ScoreControls({ match, updateMatch }: { match: any; updateMatch: any }) {
  const { soundsEnabled, playSound, toggleSounds } = useSoundEffects()
  const { t } = useLanguage()

  // C3: no local copy of the match — `match` comes straight from the useMatch
  // hook (the single owner). updateMatch() applies optimistically there.
  const [fixedSides, setFixedSides] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fixedSidesPreference")
      return saved ? saved === "true" : true
    }
    return true
  })

  useEffect(() => {
    if (match?.shouldChangeSides) {
      changeSides()
    }
  }, [match?.shouldChangeSides])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fixedSidesPreference", fixedSides.toString())
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleFixedSidesChanged = (event: any) => {
      if (event.detail && event.detail.value !== undefined) {
        setFixedSides(event.detail.value)
      }
    }

    window.addEventListener("fixedSidesChanged", handleFixedSidesChanged)

    return () => {
      window.removeEventListener("fixedSidesChanged", handleFixedSidesChanged)
    }
  }, [fixedSides])

  if (!match) return null

  const currentSet = match.score.currentSet

  const changeSides = () => {
    const updatedMatch = { ...match, history: [] }

    updatedMatch.courtSides = swapCourtSides(updatedMatch.courtSides)

    updatedMatch.shouldChangeSides = false

    updateMatch(updatedMatch)
  }

  const manualSwitchSides = () => {
    const updatedMatch = { ...match, history: [] }

    updatedMatch.courtSides = swapCourtSides(updatedMatch.courtSides)

    updatedMatch.shouldChangeSides = false

    updateMatch(updatedMatch)
  }

  // Stage 3 / B4: switchServer теперь единый — импортируется из движка.

  const manualSwitchServer = () => {
    const updatedMatch = { ...match }

    updatedMatch.history = []

    switchServer(updatedMatch)

    updateMatch(updatedMatch)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderPlayerNames = (team: any) => {
    const players = team.players

    if (match.format === "singles" || players.length === 1) {
      return (
        <div className="text-sm text-muted-foreground text-center w-full overflow-hidden truncate">
          {players[0].name}
        </div>
      )
    }

    return (
      <div className="text-sm text-muted-foreground text-center w-full">
        <div className="truncate overflow-hidden">{players[0].name}</div>
        <div className="truncate overflow-hidden">{players[1].name}</div>
      </div>
    )
  }

  const isDecidingSet = match.score.sets.length + 1 === match.settings.sets
  const isTwoSetsMatch = match.settings.sets === 2 && match.score.teamA === 1 && match.score.teamB === 1
  const isFinalSet = isDecidingSet || isTwoSetsMatch

  return (
    <div className="w-full">
      <CourtPreview match={match} />
      <div className="flex gap-2 mt-2">
        <Button
          variant="outline"
          className="flex-1 text-xs sm:text-sm py-1 sm:py-2 score-button transition-all hover:bg-blue-50"
          onClick={manualSwitchServer}
          disabled={match.isCompleted}
        >
          <RepeatIcon className="h-4 w-4 mr-1" />
          {t("match.switchServer")}
        </Button>

        <Button
          variant="outline"
          className="flex-1 text-xs sm:text-sm py-1 sm:py-2 score-button transition-all hover:bg-blue-50"
          onClick={manualSwitchSides}
          disabled={match.isCompleted}
        >
          <ArrowLeftRightIcon className="h-4 w-4 mr-1" />
          {t("match.switchSides")}
        </Button>
      </div>
    </div>
  )
}
