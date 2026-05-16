"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeftRightIcon, RepeatIcon } from "lucide-react"
import { useSoundEffects } from "@/hooks/use-sound-effects"
import { useLanguage } from "@/contexts/language-context"
import { useEffect, useState } from "react"
import CourtPreview from "@/components/court-svg-preview"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ScoreControls({ match, updateMatch }: { match: any; updateMatch: any }) {
  const { soundsEnabled, playSound, toggleSounds } = useSoundEffects()
  const { t } = useLanguage()

  const [localMatch, setLocalMatch] = useState<any>(match)
  const [fixedSides, setFixedSides] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fixedSidesPreference")
      return saved ? saved === "true" : true
    }
    return true
  })

  useEffect(() => {
    setLocalMatch(match)
  }, [match])

  useEffect(() => {
    if (localMatch?.shouldChangeSides) {
      changeSides()
    }
  }, [localMatch?.shouldChangeSides])

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

  if (!localMatch) return null

  const currentSet = localMatch.score.currentSet

  const changeSides = () => {
    const updatedMatch = { ...localMatch, history: [] }

    updatedMatch.courtSides = {
      teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
      teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
    }

    updatedMatch.shouldChangeSides = false

    setLocalMatch(updatedMatch)
    updateMatch(updatedMatch)
  }

  const manualSwitchSides = () => {
    const updatedMatch = { ...localMatch, history: [] }

    updatedMatch.courtSides = {
      teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
      teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
    }

    updatedMatch.shouldChangeSides = false

    setLocalMatch(updatedMatch)
    updateMatch(updatedMatch)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const switchServer = (updatedMatch: any) => {
    const currentTeam = updatedMatch.currentServer.team
    const otherTeam = currentTeam === "teamA" ? "teamB" : "teamA"

    if (localMatch.format === "singles") {
      updatedMatch.currentServer.team = otherTeam
      updatedMatch.currentServer.playerIndex = 0
    } else {
      if (currentTeam === "teamA") {
        updatedMatch.currentServer.team = "teamB"
      } else {
        updatedMatch.currentServer.team = "teamA"
        updatedMatch.currentServer.playerIndex = updatedMatch.currentServer.playerIndex === 0 ? 1 : 0
      }
    }

    return updatedMatch
  }

  const manualSwitchServer = () => {
    const updatedMatch = { ...localMatch }

    updatedMatch.history = []

    switchServer(updatedMatch)

    setLocalMatch(updatedMatch)
    updateMatch(updatedMatch)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderPlayerNames = (team: any) => {
    const players = team.players

    if (localMatch.format === "singles" || players.length === 1) {
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

  const isDecidingSet = localMatch.score.sets.length + 1 === localMatch.settings.sets
  const isTwoSetsMatch = localMatch.settings.sets === 2 && localMatch.score.teamA === 1 && localMatch.score.teamB === 1
  const isFinalSet = isDecidingSet || isTwoSetsMatch

  return (
    <div className="w-full">
      <CourtPreview match={localMatch} />
      <div className="flex gap-2 mt-2">
        <Button
          variant="outline"
          className="flex-1 text-xs sm:text-sm py-1 sm:py-2 score-button transition-all hover:bg-blue-50"
          onClick={manualSwitchServer}
          disabled={localMatch.isCompleted}
        >
          <RepeatIcon className="h-4 w-4 mr-1" />
          {t("match.switchServer")}
        </Button>

        <Button
          variant="outline"
          className="flex-1 text-xs sm:text-sm py-1 sm:py-2 score-button transition-all hover:bg-blue-50"
          onClick={manualSwitchSides}
          disabled={localMatch.isCompleted}
        >
          <ArrowLeftRightIcon className="h-4 w-4 mr-1" />
          {t("match.switchSides")}
        </Button>
      </div>
    </div>
  )
}
