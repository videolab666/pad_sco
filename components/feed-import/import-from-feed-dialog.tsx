"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, Home, ListChecks, Swords } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import type { DyFeedType, DyTournament } from "@/lib/dy/dy-types"
import type { ImportedPlayer } from "@/lib/dy/dy-import"
import { StepSelectPlatform } from "./step-select-platform"
import { StepSelectTournament } from "./step-select-tournament"
import { StepSelectMatch, type PickedMatch } from "./step-select-match"
import { StepSelectPlayers } from "./step-select-players"

type Step = "platform" | "tournament" | "mode" | "match" | "players"

const STORAGE_KEY = "dy-last-selection"

interface SavedSelection {
  platform: DyFeedType
  tournament: DyTournament
}

function loadSaved(): SavedSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.platform?.key && parsed?.tournament?.FeedMatches) {
      return parsed as SavedSelection
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null
}

function saveSelection(platform: DyFeedType, tournament: DyTournament) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ platform, tournament }))
  } catch {
    /* ignore quota errors */
  }
}

interface ImportFromFeedDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Result for the "match" mode — pre-fills the new-match form. */
  onPickMatch?: (data: PickedMatch) => void
  /** Result for the "players" mode — players added to the local pool. */
  onImportPlayers?: (players: ImportedPlayer[]) => void
  /** When true, only the "import players" flow is offered (skips the mode step). */
  playersOnly?: boolean
}

export function ImportFromFeedDialog({
  open,
  onOpenChange,
  onPickMatch,
  onImportPlayers,
  playersOnly = false,
}: ImportFromFeedDialogProps) {
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>("platform")
  const [platform, setPlatform] = useState<DyFeedType | null>(null)
  const [tournament, setTournament] = useState<DyTournament | null>(null)
  const [restored, setRestored] = useState(false)

  // On open: jump straight to the last selected tournament if one is stored.
  useEffect(() => {
    if (!open) {
      setRestored(false)
      return
    }
    if (restored) return
    const saved = loadSaved()
    if (saved) {
      setPlatform(saved.platform)
      setTournament(saved.tournament)
      setStep(playersOnly ? "players" : "mode")
    } else {
      setPlatform(null)
      setTournament(null)
      setStep("platform")
    }
    setRestored(true)
  }, [open, restored, playersOnly])

  const close = () => onOpenChange(false)

  // Full restart — back to the platform list.
  const goHome = () => {
    setStep("platform")
    setPlatform(null)
    setTournament(null)
  }

  const goBack = () => {
    if (step === "tournament") setStep("platform")
    else if (step === "mode") setStep("tournament")
    else if (step === "match" || step === "players")
      setStep(playersOnly ? "tournament" : "mode")
  }

  const title: Record<Step, string> = {
    platform: t("feedImport.selectPlatform"),
    tournament: platform?.isLeague
      ? t("feedImport.selectLeague")
      : t("feedImport.selectTournament"),
    mode: t("feedImport.selectMode"),
    match: t("feedImport.selectMatch"),
    players: t("feedImport.modePlayers"),
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== "platform" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={goBack}
                aria-label={t("common.back")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <span className="flex-1 truncate">{title[step]}</span>
            {step !== "platform" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={goHome}
                aria-label={t("feedImport.startOver")}
                title={t("feedImport.startOver")}
              >
                <Home className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === "platform" && (
          <StepSelectPlatform
            onSelect={(p) => {
              setPlatform(p)
              setStep("tournament")
            }}
          />
        )}

        {step === "tournament" && platform && (
          <StepSelectTournament
            platform={platform}
            onSelect={(tt) => {
              setTournament(tt)
              saveSelection(platform, tt)
              setStep(playersOnly ? "players" : "mode")
            }}
          />
        )}

        {step === "mode" && (
          <div className="space-y-3 py-2">
            {tournament && (
              <div className="rounded-md border bg-muted/40 p-2">
                <div className="text-sm font-medium">{tournament.Name}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep("tournament")}>
                    <ChevronLeft className="mr-1 h-3 w-3" />
                    {t("feedImport.changeTournament")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={goHome}>
                    <Home className="mr-1 h-3 w-3" />
                    {t("feedImport.changePlatform")}
                  </Button>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              className="h-auto w-full justify-start py-4"
              onClick={() => setStep("match")}
            >
              <Swords className="mr-3 h-5 w-5" />
              {t("feedImport.modeMatch")}
            </Button>
            <Button
              variant="outline"
              className="h-auto w-full justify-start py-4"
              onClick={() => setStep("players")}
            >
              <ListChecks className="mr-3 h-5 w-5" />
              {t("feedImport.modePlayers")}
            </Button>
          </div>
        )}

        {step === "match" && tournament && (
          <StepSelectMatch
            tournament={tournament}
            onPickMatch={(data) => {
              onPickMatch?.(data)
              close()
            }}
          />
        )}

        {step === "players" && tournament && (
          <StepSelectPlayers
            tournament={tournament}
            onImported={(players) => {
              onImportPlayers?.(players)
              close()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
