"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useMemo, useRef, useState } from "react"
import { Check, CircleAlert, Loader2, LockOpenIcon, RotateCcw, Undo2 } from "lucide-react"
import { reseedJournal, undoBackOneGame, undoBackOneSet, verifyJournal } from "@/lib/match-undo"
import { getPlayers } from "@/lib/player-storage"
import { getOccupiedCourts } from "@/lib/court-utils"
import { appendStateOverrideEvent, scoreStateOf } from "@/lib/match-events"
import { UserCog, UserRoundSearch, X } from "lucide-react"
import { CountryCombobox } from "@/components/country-combobox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useLanguage } from "@/contexts/language-context"
import {
  getDefaultFinalSetFinishForSelection,
  getDefaultFinalSetTiebreakForSelection,
  getDefaultGoldenPointForScoringSystem,
} from "@/lib/match-format-rules"
import { commitSetWin, normalizeMatchState, recomputeMatchCompletion, restartCurrentSet } from "@/lib/scoring-logic"
import { applyScoreEditRows, buildScoreEditRows, reopenSetAt, unlockMatchForPlay } from "@/lib/match-adjust"
import { classifyRuleChange } from "@/lib/match-rule-change"
import { HandicapEditor } from "@/components/handicap-editor"
import { ResultPosterSettings } from "@/components/result-poster-settings"

type MatchSettingsProps = {
  match?: any
  updateMatch?: any
  type?: string
  settings?: {
    sets: number
    games: number
    tiebreak: boolean
    finalSetTiebreak: boolean
    servingSide: "left" | "right"
    servingTeam: 1 | 2
    servingPlayer: 1 | 2 | 3 | 4
  }
  onChange?: (settings: any) => void
}

const COURT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/**
 * Apply-bar shown at the bottom of each draft section: clean / dirty / saved
 * indicator + the "Apply" button. The section is "dirty" when any draft value
 * differs from the persisted snapshot; on Apply we commit the whole section in
 * one updateMatch call so the user knows their changes were sent.
 */
function SectionApplyBar({
  isDirty,
  savedAt,
  onApply,
  disabled,
  applyLabel,
  savedLabel,
  unsavedLabel,
  savedAtLabel,
}: {
  isDirty: boolean
  savedAt: number | null
  onApply: () => void
  disabled?: boolean
  applyLabel: string
  savedLabel: string
  unsavedLabel: string
  savedAtLabel: (time: string) => string
}) {
  const timeStr = savedAt ? new Date(savedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : ""
  return (
    <div className="mt-3 flex items-center justify-between gap-2 rounded-md border bg-white/60 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        {isDirty ? (
          <>
            <CircleAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <span className="font-medium text-amber-700">{unsavedLabel}</span>
          </>
        ) : savedAt ? (
          <>
            <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
            <span className="text-green-700">{savedAtLabel(timeStr)}</span>
          </>
        ) : (
          <>
            <Check className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">{savedLabel}</span>
          </>
        )}
      </div>
      <Button
        size="sm"
        onClick={onApply}
        disabled={disabled || !isDirty}
        className="bg-[#019fe3] text-white hover:bg-[#00336d] disabled:opacity-50"
      >
        {applyLabel}
      </Button>
    </div>
  )
}

export function MatchSettings({ match, updateMatch, type, settings, onChange }: MatchSettingsProps) {
  const { t } = useLanguage()

  // ─── Rules draft (local form state mirrors match.settings; commit on Apply) ─
  const [setsCount, setSetsCount] = useState<string>(
    match?.settings?.isSuperSet ? "super" : (match?.settings?.sets?.toString() || "3"),
  )
  const [tiebreakEnabled, setTiebreakEnabled] = useState(match?.settings?.tiebreakEnabled)
  const [tiebreakFormat, setTiebreakFormat] = useState(match?.settings?.tiebreakFormat || "two-clear")
  const [tiebreakLength, setTiebreakLength] = useState(match?.settings?.tiebreakLength?.toString() || "7")
  const [tiebreakAt, setTiebreakAt] = useState(match?.settings?.tiebreakAt)
  const [finalSetTiebreak, setFinalSetTiebreak] = useState(match?.settings?.finalSetTiebreak)
  const [finalSetFinish, setFinalSetFinish] = useState(match?.settings?.finalSetFinish || "standard-7")
  const [finalSetTiebreakLength, setFinalSetTiebreakLength] = useState(match?.settings?.finalSetTiebreakLength || "10")
  const [scoringSystem, setScoringSystem] = useState(match?.settings?.scoringSystem || "classic")
  const [goldenPointFormat, setGoldenPointFormat] = useState(match?.settings?.goldenPointFormat || "none")
  const [gamesPerSet, setGamesPerSet] = useState(match?.settings?.gamesPerSet?.toString() || "6")
  // games-per-set to restore when switching back from ПРО сет to a normal format
  const preSuperGamesRef = useRef<string | null>(null)
  // tiebreak state to restore when golden game goes back off
  const preGoldenTiebreakRef = useRef<boolean | null>(null)
  const [gamesPerSetOverrides, setGamesPerSetOverrides] = useState<Record<number, string>>(
    match?.settings?.gamesPerSetOverrides
      ? Object.fromEntries(
          Object.entries(match.settings.gamesPerSetOverrides).map(([k, v]) => [k, String(v)]),
        )
      : {},
  )
  const [showPerSetGames, setShowPerSetGames] = useState(false)
  const [goldenGame, setGoldenGame] = useState(match?.settings?.goldenGame || false)
  const [windbreak, setWindbreak] = useState(match?.settings?.windbreak || false)

  // ─── Court draft ────────────────────────────────────────────────────────────
  const [courtDraft, setCourtDraft] = useState<number | null>(match?.courtNumber ?? null)
  const [courtSavedAt, setCourtSavedAt] = useState<number | null>(null)
  // Керты, занятые ДРУГИМИ активными матчами: свой корт не считаем занятым,
  // иначе нельзя было бы даже сохранить текущее назначение.
  const [occupiedCourts, setOccupiedCourts] = useState<number[]>([])
  useEffect(() => {
    let alive = true
    getOccupiedCourts()
      .then((courts: number[]) => {
        if (alive) setOccupiedCourts(courts.filter((c) => c !== match?.courtNumber))
      })
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, match?.courtNumber])

  // ─── Score-editing draft (per-set teamA/teamB; index 0..N-1 = completed sets,
  //     index N = current set while the match is live) ────────────────────────
  type ScoreCell = { teamA: number; teamB: number }
  const [scoreDraft, setScoreDraft] = useState<ScoreCell[]>(() => buildScoreEditRows(match))
  const [scoreSavedAt, setScoreSavedAt] = useState<number | null>(null)
  // Index of the completed set pending the "reopen set" confirmation, or null.
  const [reopenSetIdx, setReopenSetIdx] = useState<number | null>(null)

  // ─── savedAt for rules ──────────────────────────────────────────────────────
  const [rulesSavedAt, setRulesSavedAt] = useState<number | null>(null)

  // Task 5 / A4: a rule edit awaiting a scope decision. Only the pending
  // `settings` are stored (plus the classification) — never a whole match
  // snapshot — so points scored while the dialog is open are not lost.
  const [pendingRuleChange, setPendingRuleChange] = useState<any>(null)
  // True while the pending dialog is being closed by an explicit action button,
  // so the close handler does not also treat it as a cancel.
  const ruleChangeHandledRef = useRef(false)

  // Pushes match.settings into the local form state.
  const syncLocalSettings = (s: any) => {
    if (!s) return
    setSetsCount(s.isSuperSet ? "super" : (s.sets?.toString() || "3"))
    setTiebreakEnabled(s.tiebreakEnabled)
    setTiebreakFormat(s.tiebreakFormat || "two-clear")
    setTiebreakLength(s.tiebreakLength?.toString() || "7")
    setTiebreakAt(s.tiebreakAt)
    setFinalSetTiebreak(s.finalSetTiebreak)
    setFinalSetFinish(s.finalSetFinish || "standard-7")
    setFinalSetTiebreakLength(s.finalSetTiebreakLength || "10")
    setScoringSystem(s.scoringSystem || "classic")
    setGoldenPointFormat(s.goldenPointFormat || "none")
    setGamesPerSet(s.gamesPerSet?.toString() || "6")
    setGamesPerSetOverrides(
      s.gamesPerSetOverrides
        ? Object.fromEntries(Object.entries(s.gamesPerSetOverrides).map(([k, v]) => [k, String(v)]))
        : {},
    )
    setGoldenGame(s.goldenGame || false)
    setWindbreak(s.windbreak || false)
  }

  // Re-sync rules form when match.settings changes externally (real-time sync
  // from another device, or after our own Apply commit). If the user has an
  // uncommitted draft, the sync overwrites it — accepted edge case for v1.
  useEffect(() => {
    syncLocalSettings(match?.settings)
  }, [
    match?.settings?.isSuperSet,
    match?.settings?.sets,
    match?.settings?.tiebreakEnabled,
    match?.settings?.tiebreakFormat,
    match?.settings?.tiebreakLength,
    match?.settings?.tiebreakAt,
    match?.settings?.finalSetTiebreak,
    match?.settings?.finalSetFinish,
    match?.settings?.finalSetTiebreakLength,
    match?.settings?.scoringSystem,
    match?.settings?.goldenPointFormat,
    match?.settings?.gamesPerSet,
    match?.settings?.gamesPerSetOverrides,
    match?.settings?.goldenGame,
    match?.settings?.windbreak,
  ])

  // Re-sync court draft when match.courtNumber changes externally / after Apply.
  useEffect(() => {
    setCourtDraft(match?.courtNumber ?? null)
  }, [match?.courtNumber])

  // Re-sync score draft when match.score changes externally / after Apply.
  // Building from the current match preserves the invariant that scoreDraft has
  // exactly (sets.length + 1) entries while the match is live, and exactly
  // sets.length entries once it is finished.
  useEffect(() => {
    setScoreDraft(buildScoreEditRows(match))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.isCompleted, match?.score?.sets?.length, match?.score?.currentSet?.teamA, match?.score?.currentSet?.teamB, JSON.stringify(match?.score?.sets)])

  // Build the settings object from the current draft (used by Apply for rules).
  const buildSettingsFromDraft = () => {
    const base = { ...(match?.settings || {}) }
    if (setsCount === "super") {
      base.isSuperSet = true
      base.superSetTarget = base.superSetTarget ?? 8
      base.superSetTiebreakAt = base.superSetTiebreakAt ?? 8
      base.sets = 1
      base.tiebreakEnabled = true
      base.tiebreakAt = "8-8"
      base.finalSetTiebreak = false
      base.finalSetFinish = "standard-7"
      base.gamesPerSet = 8 // ПРО сет plays to 8 — keep the stored games in sync
      base.gamesPerSetOverrides = {}
    } else {
      base.isSuperSet = false
      base.sets = Number.parseInt(setsCount)
      base.tiebreakEnabled = tiebreakEnabled
      base.tiebreakFormat = tiebreakFormat
      base.tiebreakLength = Number.parseInt(tiebreakLength)
      base.tiebreakAt = tiebreakAt
      base.finalSetTiebreak = finalSetTiebreak
      base.finalSetFinish = finalSetFinish
      base.finalSetTiebreakLength = Number.parseInt(finalSetTiebreakLength)
    }
    base.scoringSystem = scoringSystem
    base.goldenPointFormat = goldenPointFormat
    base.gamesPerSet = Number.parseInt(gamesPerSet)
    base.gamesPerSetOverrides = Object.fromEntries(
      Object.entries(gamesPerSetOverrides).map(([k, v]) => [k, Number.parseInt(v as string)]),
    )
    base.goldenGame = goldenGame
    base.windbreak = windbreak
    return base
  }

  // True when any draft-managed settings field differs from the saved value.
  // JSON.stringify per-key avoids key-order pitfalls of comparing whole objects.
  const isRulesDirty = useMemo(() => {
    if (!match?.settings) return false
    const draft = buildSettingsFromDraft()
    for (const key of Object.keys(draft)) {
      if (JSON.stringify(draft[key]) !== JSON.stringify((match.settings as any)[key])) return true
    }
    return false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    match?.settings,
    setsCount,
    tiebreakEnabled,
    tiebreakFormat,
    tiebreakLength,
    tiebreakAt,
    finalSetTiebreak,
    finalSetFinish,
    finalSetTiebreakLength,
    scoringSystem,
    goldenPointFormat,
    gamesPerSet,
    gamesPerSetOverrides,
    goldenGame,
    windbreak,
  ])

  const isCourtDirty = (match?.courtNumber ?? null) !== courtDraft

  const isScoreDirty = useMemo(() => {
    if (!match?.score) return false
    const current = buildScoreEditRows(match)
    if (current.length !== scoreDraft.length) return false
    for (let i = 0; i < current.length; i++) {
      if (current[i].teamA !== scoreDraft[i].teamA || current[i].teamB !== scoreDraft[i].teamB) return true
    }
    return false
  }, [scoreDraft, match])

  // Task 4: every rule change repairs already-started game/set state for the
  // new rules and stamps a rule revision so the scoreboard can drop its stale
  // click/history buffers. Returns a new match — the input is not used after.
  const commitRuleChange = (updatedMatch: any) => {
    updatedMatch.history = []
    const normalized = normalizeMatchState(updatedMatch)
    // A2 fix: a rule edit can change setsToWin — recompute the match outcome so
    // a finished match is not left running (and vice versa).
    const recomputed = recomputeMatchCompletion(normalized)
    recomputed.ruleRevision = (typeof updatedMatch.ruleRevision === "number" ? updatedMatch.ruleRevision : 0) + 1
    recomputed.lastRuleChangeAt = new Date().toISOString()
    return recomputed
  }

  // Journals a manual mutation so the replay-undo path stays in sync with
  // the live state (see lib/match-undo.ts verifyJournal).
  const journalChange = (m: any, action: string, opts?: { includeSettings?: boolean }) =>
    appendStateOverrideEvent(m, action, scoreStateOf(match), opts)

  // Persists a rule change, with the legacy storage-quota fallback. Sets the
  // saved-at timestamp so the Apply-bar flips to "✓ Saved at HH:MM".
  const doCommit = (updatedMatch: any, restart = false) => {
    try {
      const next = journalChange(commitRuleChange(updatedMatch), "rule-change", { includeSettings: true })
      updateMatch(next, {
        command: "set-rules",
        args: { rules: next.settings, restartCurrentSet: restart },
        clientId: "match-settings",
      })
      setRulesSavedAt(Date.now())
    } catch (error) {
      console.error("Ошибка при обновлении настроек:", error)
      const minimalMatch = { ...updatedMatch, history: [] }
      if (minimalMatch.score?.currentSet) minimalMatch.score.currentSet.games = []
      if (minimalMatch.score?.sets) {
        minimalMatch.score.sets = minimalMatch.score.sets.map((set: any) => ({
          teamA: set.teamA,
          teamB: set.teamB,
          winner: set.winner,
        }))
      }
      const next = journalChange(commitRuleChange(minimalMatch), "rule-change", { includeSettings: true })
      updateMatch(next, {
        command: "set-rules",
        args: { rules: next.settings, restartCurrentSet: restart },
        clientId: "match-settings",
      })
      setRulesSavedAt(Date.now())
    }
  }

  // Task 5: classifies a rule edit. Safe / future-only changes apply at once;
  // anything that touches the current point or set opens a scope dialog instead
  // of silently corrupting the live score.
  const requestRuleChange = (updatedMatch: any) => {
    const classification = classifyRuleChange(match.settings || {}, updatedMatch.settings || {}, match.score)
    if (classification.scope === "safe" || classification.scope === "future-only") {
      doCommit(updatedMatch)
    } else {
      ruleChangeHandledRef.current = false
      // A4 fix: keep only the pending settings — applied later onto the *current*
      // match, so concurrent score changes survive the dialog.
      setPendingRuleChange({ settings: updatedMatch.settings, classification })
    }
  }

  // A4 fix: overlay the pending settings onto the live match (not the snapshot
  // captured when the dialog opened) so points scored meanwhile are preserved.
  const buildPendingMatch = () => ({
    ...match,
    history: [],
    settings: { ...pendingRuleChange.settings },
  })

  // Dialog actions for a pending rule change.
  const applyPendingNow = () => {
    ruleChangeHandledRef.current = true
    if (pendingRuleChange) doCommit(buildPendingMatch())
    setPendingRuleChange(null)
  }
  const applyPendingRestart = () => {
    ruleChangeHandledRef.current = true
    if (pendingRuleChange) doCommit(restartCurrentSet(buildPendingMatch()), true)
    setPendingRuleChange(null)
  }
  const cancelPendingRuleChange = () => {
    setPendingRuleChange(null)
    // Revert the form controls to the still-saved settings.
    syncLocalSettings(match?.settings)
  }

  // ─── Apply handlers (one per section) ───────────────────────────────────────

  const applyCourt = () => {
    if (!match || !updateMatch) return
    if (!isCourtDirty) return
    updateMatch({ ...match, courtNumber: courtDraft, history: [] }, {
      command: "assign-court",
      args: { court: courtDraft },
      clientId: "match-settings",
    })
    setCourtSavedAt(Date.now())
  }

  const applyRules = () => {
    if (!match || !updateMatch) return
    if (!isRulesDirty) return
    const updatedMatch = { ...match, history: [], settings: buildSettingsFromDraft() }
    requestRuleChange(updatedMatch)
  }

  const applyScoreEdits = () => {
    if (!match || !updateMatch || !isScoreDirty) return
    // applyScoreEditRows journals the "score-edit" event itself (shared with
    // the remote API) — no extra wrapper here.
    const updatedMatch = applyScoreEditRows(match, scoreDraft)
    updatedMatch.history = []
    updateMatch(updatedMatch, {
      command: "set-set-scores",
      args: { rows: scoreDraft },
      clientId: "match-settings",
    })
    setScoreSavedAt(Date.now())
  }

  // ─── Reopen a completed set (score-editing card ↩ button) ───────────────────

  const confirmReopenSet = () => {
    if (!match || !updateMatch || reopenSetIdx === null) return
    const row = scoreDraft[reopenSetIdx]
    updateMatch(reopenSetAt(match, reopenSetIdx, row), {
      command: "reopen-set",
      args: { setIndex: reopenSetIdx, score: row },
      clientId: "match-settings",
    })
    setReopenSetIdx(null)
  }

  // ─── Tiebreak start/end + match end/unlock (instant, no draft) ──────────────

  const startTiebreak = () => {
    if (!match || !updateMatch) return
    const updatedMatch = { ...match }
    updatedMatch.history = []
    updatedMatch.score.currentSet.isTiebreak = true
    updatedMatch.score.currentSet.currentGame = { teamA: 0, teamB: 0 }
    try {
      updateMatch(journalChange(updatedMatch, "tiebreak-start"), {
        command: "start-tiebreak",
        args: {},
        clientId: "match-settings",
      })
    } catch (error) {
      console.error("Ошибка при запуске тай-брейка:", error)
      const minimalMatch = { ...updatedMatch, history: [] }
      if (minimalMatch.score?.currentSet) minimalMatch.score.currentSet.games = []
      if (minimalMatch.score?.sets) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        minimalMatch.score.sets = minimalMatch.score.sets.map((set: any) => ({
          teamA: set.teamA,
          teamB: set.teamB,
          winner: set.winner,
        }))
      }
      updateMatch(journalChange(minimalMatch, "tiebreak-start"), {
        command: "start-tiebreak",
        args: {},
        clientId: "match-settings",
      })
    }
  }

  // Manual tiebreak finish — score logging via the shared engine (commitSetWin).
  // confirm() stays UI: declining to end the match aborts the operation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const endTiebreak = (winner: any) => {
    if (!match || !updateMatch) return

    const prepared = JSON.parse(JSON.stringify(match))
    prepared.history = []

    const cs = prepared.score.currentSet
    cs.tiebreak = { teamA: cs.currentGame.teamA, teamB: cs.currentGame.teamB }
    cs[winner]++
    cs.isTiebreak = false

    const result = commitSetWin(prepared, winner)

    if (
      result.isCompleted &&
      !confirm(t("matchPage.teamWonConfirm", { team: winner === "teamA" ? "A" : "B" }))
    ) {
      return
    }

    updateMatch(journalChange(result, "tiebreak-end"), {
      command: "end-tiebreak",
      args: { winner },
      clientId: "match-settings",
    })
  }

  // Bug #6 fix: handle draw properly in endMatch
  const endMatch = () => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }
    updatedMatch.isCompleted = true
    updatedMatch.history = []

    if (updatedMatch.score.teamA > updatedMatch.score.teamB) {
      updatedMatch.winner = "teamA"
    } else if (updatedMatch.score.teamB > updatedMatch.score.teamA) {
      updatedMatch.winner = "teamB"
    } else {
      if (updatedMatch.score.currentSet.teamA > updatedMatch.score.currentSet.teamB) {
        updatedMatch.winner = "teamA"
      } else if (updatedMatch.score.currentSet.teamB > updatedMatch.score.currentSet.teamA) {
        updatedMatch.winner = "teamB"
      } else {
        const ga = typeof updatedMatch.score.currentSet.currentGame.teamA === "number"
          ? updatedMatch.score.currentSet.currentGame.teamA : 0
        const gb = typeof updatedMatch.score.currentSet.currentGame.teamB === "number"
          ? updatedMatch.score.currentSet.currentGame.teamB : 0
        if (ga > gb) updatedMatch.winner = "teamA"
        else if (gb > ga) updatedMatch.winner = "teamB"
        else updatedMatch.winner = null
      }
    }

    updateMatch(journalChange(updatedMatch, "end-match"), {
      command: "finish",
      args: updatedMatch.winner ? { winner: updatedMatch.winner } : {},
      clientId: "match-settings",
    })
  }

  const unlockMatch = () => {
    if (!match || !updateMatch) return
    // unlockMatchForPlay journals the "unlock-match" event itself (shared
    // with the remote API) — no extra wrapper here.
    updateMatch(unlockMatchForPlay(match), {
      command: "unlock-match",
      args: {},
      clientId: "match-settings",
    })
  }

  // ─── Score-editing helpers (now mutate scoreDraft instead of match) ─────────

  const bumpDraftScore = (index: number, team: "teamA" | "teamB", delta: number) => {
    setScoreDraft((prev) => {
      const next = prev.map((c) => ({ ...c }))
      if (index < 0 || index >= next.length) return prev
      const cur = next[index][team]
      const after = cur + delta
      next[index][team] = after < 0 ? 0 : after
      return next
    })
  }

  // ─── New-match preview branch (no live match supplied) ──────────────────────

  const handleNewMatchSettingChange = (key: string, value: any) => {
    if (onChange && settings) onChange({ ...settings, [key]: value })
  }

  // Откаты гейма/сета: replay-снимок несёт revision сида — поднимаем над live,
  // иначе optimistic-guard отвергнет его как устаревшее состояние.
  const canUndo = verifyJournal(match).canUndo
  const undoWithRevision = (undone: any, command: "undo-game" | "undo-set" | "repair-journal") => {
    if (!undone || undone === match || !updateMatch) return
    undone.revision = typeof match?.revision === "number" ? match.revision : 0
    updateMatch(undone, { command, args: {}, clientId: "match-settings" })
  }
  const handleUndoGame = () => undoWithRevision(undoBackOneGame(match), "undo-game")
  const handleJournalRepair = () => undoWithRevision(reseedJournal(match), "repair-journal")

  // ─── Игроки: замена из справочника / быстрая правка в матче ────────────────
  const [playerPool, setPlayerPool] = useState<any[]>([])
  const [replaceSlot, setReplaceSlot] = useState<string | null>(null) // "teamA:0"
  const [editSlot, setEditSlot] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({
    name: "", country: "", avatar: "", club: "", seed: "", abbreviation: "", color: "",
  })
  const [editGlobal, setEditGlobal] = useState(true)
  const [editSyncNote, setEditSyncNote] = useState("")

  useEffect(() => {
    if (!match) return
    getPlayers().then(setPlayerPool).catch(() => {})
  }, [match?.id])

  const slotPlayer = (slot: string) => {
    const [team, idx] = slot.split(":")
    return (match as any)?.[team]?.players?.[Number(idx)]
  }

  /** Write new players arrays to the match (journal + revision, as elsewhere). */
  const writePlayers = (updater: (m: any) => void) => {
    if (!updateMatch) return
    const next = JSON.parse(JSON.stringify(match))
    updater(next)
    // Players are absent from the undo fingerprint — journal the change as an
    // audit-only state-override so the log stays complete without diverging.
    const journaled = appendStateOverrideEvent(next, "player-edit", scoreStateOf(match))
    journaled.revision = typeof match?.revision === "number" ? match.revision : 0
    updateMatch(journaled, {
      command: "set-rosters",
      args: { teamA: journaled.teamA, teamB: journaled.teamB },
      clientId: "match-settings",
    })
    setReplaceSlot(null)
    setEditSlot(null)
  }

  const handleReplacePlayer = (slot: string, poolId: string) => {
    const pool = playerPool.find((p) => p.id === poolId)
    if (!pool) return
    const { local_expire_at: _e, dyId: _d, ...copy } = pool as any
    const [team, idx] = slot.split(":")
    writePlayers((m) => {
      const players = [...(m[team]?.players ?? [])]
      players[Number(idx)] = copy
      m[team].players = players
    })
  }

  const startEditSlot = (slot: string) => {
    const p = slotPlayer(slot) ?? {}
    setEditSlot(slot)
    setReplaceSlot(null)
    setEditSyncNote("")
    setEditDraft({
      name: p.name ?? "", country: p.country ?? "", avatar: p.avatar ?? "",
      club: p.club ?? "", seed: p.seed ?? "", abbreviation: p.abbreviation ?? "",
      color: p.color ?? "",
    })
  }

  const applyEditSlot = async () => {
    if (!editSlot || !editDraft.name.trim()) return
    const [team, idx] = editSlot.split(":")
    const fields = {
      name: editDraft.name.trim(),
      country: editDraft.country.trim().toUpperCase() || undefined,
      avatar: editDraft.avatar.trim() || undefined,
      club: editDraft.club.trim() || undefined,
      seed: editDraft.seed.trim() || undefined,
      abbreviation: editDraft.abbreviation.trim().toUpperCase() || undefined,
      color: editDraft.color.trim() || undefined,
    }
    writePlayers((m) => {
      const players = [...(m[team]?.players ?? [])]
      players[Number(idx)] = { ...players[Number(idx)], ...fields }
      m[team].players = players
    })

    // Глобальное применение: справочник + все остальные идущие матчи.
    const poolPlayer = playerPool.find((p) => String(p.id) === String(slotPlayer(editSlot)?.id))
    if (editGlobal && poolPlayer) {
      try {
        const { updatePlayer } = await import("@/lib/player-storage")
        const { getMatches, updateMatch } = await import("@/lib/match-storage")
        const { syncPlayerFields } = await import("@/lib/player-live-sync")
        await updatePlayer(poolPlayer.id, fields)
        const n = await syncPlayerFields(getMatches, updateMatch, poolPlayer.id, fields, match?.id)
        setEditSyncNote(n > 0 ? t("players.liveSynced", { n }) : t("match.editPlayerGlobalDone"))
      } catch (e) {
        console.error("global player edit failed", e)
      }
    }
  }
  const handleUndoSet = () => undoWithRevision(undoBackOneSet(match), "undo-set")

  if (!match && settings && onChange) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-medium mb-2">{t("newMatch.matchSettings")}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sets">{t("newMatch.sets")}</Label>
            <Select
              value={settings.sets.toString()}
              onValueChange={(value) => handleNewMatchSettingChange("sets", Number.parseInt(value))}
            >
              <SelectTrigger id="sets">
                <SelectValue placeholder={t("newMatch.sets")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="games">{t("newMatch.games")}</Label>
            <Select
              value={settings.games.toString()}
              onValueChange={(value) => handleNewMatchSettingChange("games", Number.parseInt(value))}
            >
              <SelectTrigger id="games">
                <SelectValue placeholder={t("newMatch.games")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="8">8</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="tiebreak"
              checked={settings.tiebreak}
              onCheckedChange={(checked) => handleNewMatchSettingChange("tiebreak", checked)}
            />
            <Label htmlFor="tiebreak">{t("newMatch.tiebreak")}</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="finalSetTiebreak"
              checked={settings.finalSetTiebreak}
              onCheckedChange={(checked) => handleNewMatchSettingChange("finalSetTiebreak", checked)}
            />
            <Label htmlFor="finalSetTiebreak">{t("newMatch.finalSetTiebreak")}</Label>
          </div>
        </div>

        <div className="space-y-4">
          <Label>{t("newMatch.servingSide")}</Label>
          <RadioGroup
            value={settings.servingSide}
            onValueChange={(value) => handleNewMatchSettingChange("servingSide", value)}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="left" id="left" />
              <Label htmlFor="left">{t("newMatch.left")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="right" id="right" />
              <Label htmlFor="right">{t("newMatch.right")}</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <Label>{t("newMatch.servingTeam")}</Label>
          <RadioGroup
            value={settings.servingTeam.toString()}
            onValueChange={(value) => handleNewMatchSettingChange("servingTeam", Number.parseInt(value) as 1 | 2)}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="1" id="team1" />
              <Label htmlFor="team1">1</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="2" id="team2" />
              <Label htmlFor="team2">2</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <Label>{t("newMatch.servingPlayer")}</Label>
          <RadioGroup
            value={settings.servingPlayer.toString()}
            onValueChange={(value) => handleNewMatchSettingChange("servingPlayer", Number.parseInt(value) as 1 | 2 | 3 | 4)}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="1" id="player1" />
              <Label htmlFor="player1">1</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="2" id="player2" />
              <Label htmlFor="player2">2</Label>
            </div>
            {type === "padel" && (
              <>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3" id="player3" />
                  <Label htmlFor="player3">3</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="4" id="player4" />
                  <Label htmlFor="player4">4</Label>
                </div>
              </>
            )}
          </RadioGroup>
        </div>
      </div>
    )
  }

  if (!match) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getTeamPlayerNames = (teamKey: any) => {
    if (match[teamKey]?.players && Array.isArray(match[teamKey].players)) {
      return match[teamKey].players
        .map((p: any) => p.name || p.firstName || p.lastName || "")
        .filter(Boolean)
        .join(", ")
    }

    if (match.players && Array.isArray(match.players)) {
      const teamIdentifiers = [
        teamKey,
        teamKey.replace("team", ""),
        teamKey === "teamA" ? "1" : "2",
        teamKey === "teamA" ? 1 : 2,
      ]

      const teamPlayers = match.players.filter(
        (p: any) => teamIdentifiers.includes(p.team) || teamIdentifiers.includes(p.teamId),
      )

      if (teamPlayers.length > 0) {
        return teamPlayers
          .map((p: any) => p.name || p.firstName || p.lastName || "")
          .filter(Boolean)
          .join(", ")
      }
    }

    const playersKey = `${teamKey}Players`
    if (match[playersKey] && Array.isArray(match[playersKey])) {
      return match[playersKey]
        .map((p: any) => p.name || p.firstName || p.lastName || "")
        .filter(Boolean)
        .join(", ")
    }

    const player1Key = `${teamKey}Player1`
    const player2Key = `${teamKey}Player2`

    const player1 = match[player1Key]
    const player2 = match[player2Key]

    const player1Name = typeof player1 === "string" ? player1 : player1?.name || player1?.firstName || ""
    const player2Name = typeof player2 === "string" ? player2 : player2?.name || player2?.firstName || ""

    const playerNames = [player1Name, player2Name].filter(Boolean)

    if (playerNames.length > 0) return playerNames.join(", ")

    return teamKey === "teamA" ? t("matchPage.playerFallbackTeamA") : t("matchPage.playerFallbackTeamB")
  }

  const teamAPlayerNames = getTeamPlayerNames("teamA")
  const teamBPlayerNames = getTeamPlayerNames("teamB")

  // Build the table rows directly from scoreDraft (which mirrors match.score
  // until the user edits a cell). Highlights cells that differ from saved.
  // A finished match has no current-set row — its last row is a completed set.
  const draftRows = scoreDraft.map((cell, i) => ({
    index: i,
    isCurrent: !match.isCompleted && i === scoreDraft.length - 1,
    teamA: cell.teamA,
    teamB: cell.teamB,
  }))

  // Padding rows for future (unplayed) sets — purely display, not editable.
  const totalSetsConfigured = match?.settings?.sets || 3
  const futureRows: Array<{ index: number; isCurrent: false; teamA: number; teamB: number }> = []
  for (let i = scoreDraft.length; i < totalSetsConfigured; i++) {
    futureRows.push({ index: i, isCurrent: false, teamA: 0, teamB: 0 })
  }

  const savedAtFormatter = (time: string) => t("match.savedAtTime", { time })
  const t_apply = t("match.apply")
  const t_saved = t("match.savedLabel")
  const t_unsaved = t("match.unsavedChanges")

  return (
    <>
      {/* Task 5: scope decision for a rule edit that touches live play */}
      <AlertDialog
        open={!!pendingRuleChange}
        onOpenChange={(open) => {
          if (open) return
          if (ruleChangeHandledRef.current) setPendingRuleChange(null)
          else cancelPendingRuleChange()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRuleChange?.classification?.scope === "restart-required"
                ? t("matchPage.ruleChangeNoRestart")
                : t("matchPage.ruleChangeAffectsSet")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRuleChange?.classification?.reason
                ? `${pendingRuleChange.classification.reason}. `
                : ""}
              {t("matchPage.ruleChangeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction onClick={applyPendingNow}>{t("matchPage.applyNow")}</AlertDialogAction>
            {pendingRuleChange?.classification?.scope === "restart-required" && (
              <AlertDialogAction onClick={applyPendingRestart}>{t("matchPage.restartSet")}</AlertDialogAction>
            )}
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation for the per-set ↩ "reopen set" button (score-editing card). */}
      <AlertDialog
        open={reopenSetIdx !== null}
        onOpenChange={(open) => {
          if (!open) setReopenSetIdx(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("match.reopenSetTitle", { n: String((reopenSetIdx ?? 0) + 1) })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("match.reopenSetDescription", { n: String((reopenSetIdx ?? 0) + 1) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction onClick={confirmReopenSet}>{t("match.reopenSetConfirm")}</AlertDialogAction>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Section 1: Court ──────────────────────────────────────────────── */}
      <Card className="w-full mb-4 bg-gradient-to-b from-[#019fe3] to-[#00336d]">
        <CardHeader>
          <CardTitle className="text-white">{t("match.court")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-gray-800 px-[3px]">
          <div className="border rounded-md py-3 px-[3px] bg-[#f8fdf9] shadow-md">
            <Label>{t("match.courtNumber")}</Label>
            <Select
              value={courtDraft === null ? "none" : String(courtDraft)}
              onValueChange={(value) => setCourtDraft(value === "none" ? null : Number.parseInt(value))}
              disabled={match.isCompleted}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t("match.selectCourt")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("match.noCourt")}</SelectItem>
                {COURT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)} disabled={occupiedCourts.includes(n)}>
                    {t("match.court")} {n}{occupiedCourts.includes(n) ? ` — ${t("newMatch.courtBusyShort")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {occupiedCourts.length > 0 && (
              <p className="mt-1 text-xs text-center text-gray-600">
                {t("newMatch.occupiedCourts")}: {occupiedCourts.slice().sort((a, b) => a - b).join(", ")}
              </p>
            )}
            <SectionApplyBar
              isDirty={isCourtDirty}
              savedAt={courtSavedAt}
              onApply={applyCourt}
              disabled={match.isCompleted}
              applyLabel={t_apply}
              savedLabel={t_saved}
              unsavedLabel={t_unsaved}
              savedAtLabel={savedAtFormatter}
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Section 2: Score Editing ──────────────────────────────────────── */}
      <Card className="w-full mb-4 bg-gradient-to-b from-[#019fe3] to-[#00336d]">
        <CardHeader>
          <CardTitle className="text-white">{t("match.scoreEditing")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-800 px-[3px]">
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-center">
            {t("match.matchCode")}: <span className="font-bold">{match.code || match.id}</span>
          </div>

          <div className="py-4 px-[3px] bg-blue-50 border border-blue-200 rounded-md mt-4">
            <h3 className="font-medium text-center mb-3">{t("match.editSets")}</h3>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border-b-2 border-gray-300"></th>
                    <th className="p-2 border-b-2 border-gray-300 text-center">
                      <div className="font-bold">
                        {match.teamA?.name || match.teamAName || t("match.teamA")}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{teamAPlayerNames}</div>
                    </th>
                    <th className="p-2 border-b-2 border-gray-300 text-center">
                      <div className="font-bold">
                        {match.teamB?.name || match.teamBName || t("match.teamB")}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{teamBPlayerNames}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draftRows.map((set, idx) => {
                    const saved = buildScoreEditRows(match)[set.index] ?? { teamA: 0, teamB: 0 }
                    const aDirty = saved.teamA !== set.teamA
                    const bDirty = saved.teamB !== set.teamB
                    return (
                      <tr key={idx} className={set.isCurrent ? "bg-blue-100" : ""}>
                        <td className="p-2 border-r border-gray-300 text-[13px] text-center" style={{ fontSize: "13px" }}>
                          <span className="font-bold">{t("match.set")}</span> {idx + 1}
                          {!set.isCurrent && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-1 h-7 w-7 p-0"
                              title={t("match.reopenSet")}
                              onClick={() => setReopenSetIdx(set.index)}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                        <td className="p-2 border-r border-gray-300">
                          <div className="flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => bumpDraftScore(set.index, "teamA", -1)}
                              disabled={match.isCompleted}
                            >
                              -
                            </Button>
                            <span className={`mx-3 font-bold text-lg ${aDirty ? "text-amber-600" : ""}`}>{set.teamA}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => bumpDraftScore(set.index, "teamA", 1)}
                              disabled={match.isCompleted}
                            >
                              +
                            </Button>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => bumpDraftScore(set.index, "teamB", -1)}
                              disabled={match.isCompleted}
                            >
                              -
                            </Button>
                            <span className={`mx-3 font-bold text-lg ${bDirty ? "text-amber-600" : ""}`}>{set.teamB}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => bumpDraftScore(set.index, "teamB", 1)}
                              disabled={match.isCompleted}
                            >
                              +
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {futureRows.map((set) => (
                    <tr key={`future-${set.index}`} className="opacity-50">
                      <td className="p-2 border-r border-gray-300 text-[13px] text-center" style={{ fontSize: "13px" }}>
                        <span className="font-bold">{t("match.set")}</span> {set.index + 1}
                      </td>
                      <td className="p-2 border-r border-gray-300 text-center">{set.teamA}</td>
                      <td className="p-2 text-center">{set.teamB}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SectionApplyBar
              isDirty={isScoreDirty}
              savedAt={scoreSavedAt}
              onApply={applyScoreEdits}
              disabled={match.isCompleted}
              applyLabel={t_apply}
              savedLabel={t_saved}
              unsavedLabel={t_unsaved}
              savedAtLabel={savedAtFormatter}
            />
          </div>

          {/* Откаты целого гейма/сета — открывают предыдущий гейм/сет на реальном счёте */}
          <div className="border rounded-md py-3 px-3 bg-[#f8fdf9] shadow-md space-y-2">
            <Label className="text-xs">{t("extras.undoSection")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="flex-1 py-2 px-2 bg-gradient-to-br from-blue-800 to-blue-950 hover:from-blue-700 hover:to-blue-900 active:from-blue-600 active:to-blue-800 text-white border border-blue-700 rounded-md text-sm font-medium flex items-center justify-center transition-all shadow-md transform active:scale-95 active:translate-y-1 active:shadow-inner disabled:opacity-50 disabled:pointer-events-none"
                disabled={!canUndo || match.isCompleted || !updateMatch}
                title={!canUndo ? t("match.undoUnavailable") : undefined}
                onClick={handleUndoGame}
              >
                <Undo2 className="h-4 w-4 mr-1" />
                {t("match.undoGame")}
              </Button>
              <Button
                className="flex-1 py-2 px-2 bg-gradient-to-br from-blue-800 to-blue-950 hover:from-blue-700 hover:to-blue-900 active:from-blue-600 active:to-blue-800 text-white border border-blue-700 rounded-md text-sm font-medium flex items-center justify-center transition-all shadow-md transform active:scale-95 active:translate-y-1 active:shadow-inner disabled:opacity-50 disabled:pointer-events-none"
                disabled={!canUndo || match.isCompleted || !updateMatch}
                title={!canUndo ? t("match.undoUnavailable") : undefined}
                onClick={handleUndoSet}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                {t("match.undoSet")}
              </Button>
            </div>
            {!canUndo && !match.isCompleted && updateMatch && (
              <Button variant="outline" size="sm" className="w-full" onClick={handleJournalRepair}>
                <Undo2 className="h-3 w-3 mr-1" />
                {t("extras.undoRepair")}
              </Button>
            )}
            <p className="text-[11px] leading-snug text-gray-600">{t("extras.undoHint")}</p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Section: Player Editing ───────────────────────────────────────── */}
      <Card className="w-full mb-4 bg-gradient-to-b from-[#019fe3] to-[#00336d]">
        <CardHeader>
          <CardTitle className="text-white">{t("match.playersCardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-800 px-[3px]">
          {/* ─── Игроки: замена / быстрая правка ─────────────────────────── */}
          <div className="py-3 px-3 bg-blue-50 border border-blue-200 rounded-md space-y-2">
            <h3 className="font-medium text-center">{t("match.playersCard")}</h3>
            <p className="text-[11px] leading-snug text-gray-600 text-center">{t("match.playersCardHint")}</p>
            {(["teamA", "teamB"] as const).map((team) => (
              <div key={team} className="space-y-1">
                <div className="text-xs font-medium text-gray-700 text-center">
                  {match[team]?.name || (team === "teamA" ? t("match.teamA") : t("match.teamB"))}
                </div>
                {(match[team]?.players ?? []).map((pl: any, idx: number) => {
                  const slot = `${team}:${idx}`
                  return (
                    <div key={slot} className="border rounded-md p-2 bg-white space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium truncate">
                          {pl.name}
                          {pl.country ? <span className="ml-1 text-xs text-gray-500">{pl.country}</span> : null}
                          {pl.seed ? <span className="ml-1 text-xs text-gray-500">[{pl.seed}]</span> : null}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => { setReplaceSlot(replaceSlot === slot ? null : slot); setEditSlot(null) }}>
                            <UserRoundSearch className="h-3 w-3 mr-1" />
                            {t("match.replacePlayer")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { replaceSlot === slot && setReplaceSlot(null); editSlot === slot ? setEditSlot(null) : startEditSlot(slot) }}>
                            <UserCog className="h-3 w-3 mr-1" />
                            {t("match.editPlayer")}
                          </Button>
                        </div>
                      </div>
                      {replaceSlot === slot && (
                        <div className="space-y-1">
                          <Select onValueChange={(v) => handleReplacePlayer(slot, v)}>
                            <SelectTrigger>
                              <SelectValue placeholder={t("match.pickPlayer")} />
                            </SelectTrigger>
                            <SelectContent>
                              {playerPool
                                .filter((p) => p.id !== pl.id)
                                .map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}{p.country ? ` (${p.country})` : ""}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {editSlot === slot && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={editDraft.name}
                              onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                              placeholder={t("players.name")}
                            />
                            <CountryCombobox
                              value={editDraft.country}
                              onChange={(code) => setEditDraft((d) => ({ ...d, country: code }))}
                            />
                            <Input
                              value={editDraft.club}
                              onChange={(e) => setEditDraft((d) => ({ ...d, club: e.target.value }))}
                              placeholder={t("players.club")} maxLength={40}
                            />
                            <Input
                              value={editDraft.seed}
                              onChange={(e) => setEditDraft((d) => ({ ...d, seed: e.target.value }))}
                              placeholder={t("players.seed")} maxLength={4}
                            />
                            <Input
                              value={editDraft.abbreviation}
                              onChange={(e) => setEditDraft((d) => ({ ...d, abbreviation: e.target.value.toUpperCase() }))}
                              placeholder={t("players.abbreviation")} maxLength={5}
                            />
                            <div className="flex gap-1">
                              <Input
                                type="color"
                                value={editDraft.color || "#1164a5"}
                                onChange={(e) => setEditDraft((d) => ({ ...d, color: e.target.value }))}
                                className="w-10 h-9 p-0.5"
                              />
                              <Input
                                value={editDraft.color}
                                onChange={(e) => setEditDraft((d) => ({ ...d, color: e.target.value }))}
                                placeholder="#1164a5"
                              />
                            </div>
                            <Input
                              value={editDraft.avatar}
                              onChange={(e) => setEditDraft((d) => ({ ...d, avatar: e.target.value }))}
                              placeholder={t("players.avatarUrl")} className="col-span-2"
                            />
                          </div>
                          <label className="flex items-center gap-2 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={editGlobal}
                              onChange={(e) => setEditGlobal(e.target.checked)}
                              disabled={!playerPool.find((p) => String(p.id) === String(pl.id))}
                            />
                            {t("match.editPlayerGlobal")}
                          </label>
                          <p className="text-[10px] text-gray-500">{t("match.editPlayerHint")}</p>
                          {editSyncNote && <p className="text-[11px] text-green-700">{editSyncNote}</p>}
                          <div className="flex gap-2">
                            <Button size="sm" onClick={applyEditSlot} disabled={!editDraft.name.trim()}>
                              <Check className="h-3 w-3 mr-1" />
                              {t_apply}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditSlot(null)}>
                              <X className="h-3 w-3 mr-1" />
                              {t("common.cancel")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

        </CardContent>
      </Card>

      {/* ─── Section 3: Match Rules ────────────────────────────────────────── */}
      <Card className="w-full mb-4 bg-gradient-to-b from-[#019fe3] to-[#00336d]">
        <CardHeader>
          <CardTitle className="text-white">{t("match.matchRules")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-800 px-[3px]">
          <div className="space-y-4">
            {/* Sets selection */}
            <div className="border rounded-md py-3 px-[3px] bg-[#f8fdf9] shadow-md">
              <Label>{t("newMatch.sets")}</Label>
              <Select
                value={setsCount}
                onValueChange={(value) => {
                  if (value === "super") {
                    setSetsCount("super")
                    // ПРО сет is fixed at 8 games — switch the field over and
                    // remember the previous value for when a normal format
                    // is picked again.
                    if (setsCount !== "super") preSuperGamesRef.current = gamesPerSet
                    setGamesPerSet("8")
                    setGamesPerSetOverrides({})
                    setGoldenGame(false) // ПРО сет ignores golden game in the engine
                    setFinalSetTiebreak(false)
                    setFinalSetFinish("standard-7")
                  } else {
                    setSetsCount(value)
                    if (setsCount === "super") {
                      setGamesPerSet(preSuperGamesRef.current ?? "6")
                      preSuperGamesRef.current = null
                    }
                    setFinalSetTiebreak(getDefaultFinalSetTiebreakForSelection(value))
                    setFinalSetFinish(getDefaultFinalSetFinishForSelection(value))
                  }
                }}
                disabled={match.isCompleted}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("newMatch.sets")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t("newMatch.setsNnormal", { n: "1" })}</SelectItem>
                  <SelectItem value="2">{t("newMatch.setsNplusTiebreak", { n: "2" })}</SelectItem>
                  <SelectItem value="3">{t("newMatch.setsNnormal", { n: "3" })}</SelectItem>
                  <SelectItem value="4">{t("newMatch.setsNplusTiebreak", { n: "4" })}</SelectItem>
                  <SelectItem value="5">{t("newMatch.setsNnormal", { n: "5" })}</SelectItem>
                  <SelectItem value="6">{t("newMatch.setsNplusTiebreak", { n: "6" })}</SelectItem>
                  <SelectItem value="7">{t("newMatch.setsNnormal", { n: "7" })}</SelectItem>
                  <SelectItem value="super">
                    <div>
                      <span className="font-medium">{t("newMatch.superSet")}</span>
                      <p className="text-xs text-muted-foreground">{t("newMatch.superSetDescription")}</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Final Set Tiebreak */}
            <div className="border border-green-200 rounded-md py-3 px-[3px] bg-green-50 shadow-md mt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>{t("newMatch.finalSetTiebreak")}</Label>
                <Switch
                  id="final-set-tiebreak"
                  checked={finalSetTiebreak}
                  onCheckedChange={(checked) => {
                    setFinalSetTiebreak(checked)
                    if (setsCount !== "super") {
                      const num = Number.parseInt(setsCount) || 3
                      if (checked && num % 2 !== 0) {
                        setSetsCount((num - 1).toString())
                        setFinalSetFinish(getDefaultFinalSetFinishForSelection((num - 1).toString()))
                      } else if (!checked && num % 2 === 0) {
                        setSetsCount((num + 1).toString())
                        setFinalSetFinish(getDefaultFinalSetFinishForSelection((num + 1).toString()))
                      }
                    }
                  }}
                  disabled={match.isCompleted}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                />
              </div>

              {finalSetTiebreak && (
                <div className="space-y-2">
                  <Label>{t("newMatch.finalSetFinishLabel")}</Label>
                  <Select
                    value={finalSetFinish}
                    onValueChange={(value) => {
                      setFinalSetFinish(value)
                      if (value.endsWith("-7")) setFinalSetTiebreakLength("7")
                      if (value.endsWith("-10")) setFinalSetTiebreakLength("10")
                    }}
                    disabled={match.isCompleted}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard-7">{t("newMatch.finalSetGamesTiebreak7")}</SelectItem>
                      <SelectItem value="standard-10">{t("newMatch.finalSetGamesTiebreak10")}</SelectItem>
                      <SelectItem value="match-tiebreak-7">{t("newMatch.finalSetMatchTiebreak7")}</SelectItem>
                      <SelectItem value="match-tiebreak-10">{t("newMatch.finalSetMatchTiebreak10")}</SelectItem>
                      <SelectItem value="games-to-12-7">{t("newMatch.finalSetGamesTo12Tiebreak7")}</SelectItem>
                      <SelectItem value="games-to-12-10">{t("newMatch.finalSetGamesTo12Tiebreak10")}</SelectItem>
                      <SelectItem value="no-tiebreak">{t("newMatch.finalSetNoTiebreak")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Label>{t("newMatch.finalSetTiebreakLength")}</Label>
                  <Select
                    value={finalSetTiebreakLength}
                    onValueChange={(value) => setFinalSetTiebreakLength(value)}
                    disabled={match.isCompleted}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("newMatch.selectTiebreakLength")} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-green-700 mt-1">
                    <p>{t("newMatch.finalSetTiebreakLengthDescription")}</p>
                    <p className="mt-1 font-medium">{t("newMatch.finalSetTiebreakNote")}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Scoring System */}
            <div className="border rounded-md py-3 px-[3px] bg-[#f8fdf9] shadow-md">
              <Label>{t("match.scoringSystem")}</Label>
              <Select
                value={scoringSystem}
                onValueChange={(value) => {
                  setScoringSystem(value)
                  setGoldenPointFormat(getDefaultGoldenPointForScoringSystem(value))
                  if (value === "fast4") setGamesPerSet("4")
                }}
                disabled={match.isCompleted}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("match.scoringSystem")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">{t("match.classicScoring")}</SelectItem>
                  <SelectItem value="no-ad">{t("match.noAdScoring")}</SelectItem>
                  <SelectItem value="fast4">{t("match.fast4Scoring")}</SelectItem>
                </SelectContent>
              </Select>

              {scoringSystem === "classic" && (
                <div className="mt-4 space-y-2">
                  <Label>{t("newMatch.goldenPoint")}</Label>
                  <Select
                    value={goldenPointFormat}
                    onValueChange={(value) => setGoldenPointFormat(value)}
                    disabled={match.isCompleted}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("newMatch.goldenPointOff")}</SelectItem>
                      <SelectItem value="first-deuce">{t("newMatch.goldenPointFirstDeuce")}</SelectItem>
                      <SelectItem value="second-deuce">{t("newMatch.goldenPointSecondDeuce")}</SelectItem>
                      <SelectItem value="third-deuce">{t("newMatch.goldenPointThirdDeuce")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("newMatch.goldenPointDescription")}
                  </p>
                </div>
              )}
            </div>

            {/* Games per set */}
            <div className="border rounded-md py-3 px-[3px] bg-[#f0f4ff] shadow-md">
              <Label className="text-base font-medium">{t("newMatch.gamesPerSet")}</Label>
              <Select
                value={gamesPerSet}
                onValueChange={(value) => {
                  setGamesPerSet(value)
                  if (value === "4") setScoringSystem("fast4")
                }}
                disabled={match.isCompleted || setsCount === "super"}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}{n === 6 ? ` ${t("newMatch.gamesStandard")}` : ""}{n === 4 ? ` ${t("newMatch.gamesFast4")}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {setsCount !== "super" && (() => {
                const totalSets = Number.parseInt(setsCount) || 3
                if (!totalSets || totalSets < 2) return null
                return (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                      onClick={() => setShowPerSetGames(!showPerSetGames)}
                    >
                      {showPerSetGames ? t("newMatch.hidePerSetSettings") : t("newMatch.showPerSetSettings")}
                    </button>

                    {showPerSetGames && (
                      <div className="mt-2 space-y-2">
                        {Array.from({ length: totalSets }, (_, i) => i).map((setIdx) => (
                          <div key={setIdx} className="flex items-center gap-2">
                            <span className="text-sm font-medium w-20 shrink-0">{t("newMatch.setNumber", { n: setIdx + 1 })}:</span>
                            <Select
                              value={gamesPerSetOverrides[setIdx] || gamesPerSet}
                              onValueChange={(v) =>
                                setGamesPerSetOverrides((prev) => {
                                  const next = { ...prev }
                                  if (v === gamesPerSet) delete next[setIdx]
                                  else next[setIdx] = v
                                  return next
                                })
                              }
                              disabled={match.isCompleted}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Tiebreak settings */}
            <div className="border rounded-md py-4 px-[3px] bg-[#f3f5f7] shadow-md">
              <div className="flex items-center justify-between mb-4">
                <Label>{t("newMatch.tiebreak")}</Label>
                <Switch
                  id="tiebreak-enabled"
                  checked={tiebreakEnabled}
                  onCheckedChange={(checked) => setTiebreakEnabled(checked)}
                  disabled={match.isCompleted || goldenGame}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                />
              </div>
              {goldenGame && (
                <p className="text-xs text-amber-600">
                  {t("match.goldenGameTiebreakOff")}
                </p>
              )}

              {tiebreakEnabled && (
                <>
                  <div>
                    <Label>{t("match.tiebreakType")}</Label>
                    <Select
                      value={tiebreakFormat}
                      onValueChange={(value) => setTiebreakFormat(value)}
                      disabled={match.isCompleted}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="two-clear">{t("newMatch.tiebreakTwoClear")}</SelectItem>
                        <SelectItem value="receiver-select-1-or-2">{t("newMatch.tiebreakReceiver12")}</SelectItem>
                        <SelectItem value="receiver-select-1-2-or-3">{t("newMatch.tiebreakReceiver123")}</SelectItem>
                        <SelectItem value="receiver-select-1-or-3">{t("newMatch.tiebreakReceiver13")}</SelectItem>
                        <SelectItem value="sudden-death">{t("newMatch.tiebreakSuddenDeath")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Label className="mt-4 block">{t("newMatch.tiebreakPoints")}</Label>
                    <Select
                      value={tiebreakLength}
                      onValueChange={(value) => setTiebreakLength(value)}
                      disabled={match.isCompleted}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n}{n === 7 ? ` ${t("newMatch.gamesStandard")}` : ""}{n === 10 ? ` (${t("newMatch.gamesStandard").replace("(", "").replace(")", "").trim()})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Number.parseInt(tiebreakLength) > 1 ? t("newMatch.tiebreakWith2Clear") : ""}
                    </p>
                  </div>

                  <div className="mt-4">
                    <Label>{t("match.tiebreakAt")}</Label>
                    <Select
                      value={tiebreakAt}
                      onValueChange={(value) => setTiebreakAt(value)}
                      disabled={match.isCompleted}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("match.selectTiebreakScore")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4-4">4:4</SelectItem>
                        <SelectItem value="5-5">5:5</SelectItem>
                        <SelectItem value="6-6">6:6</SelectItem>
                        <SelectItem value="7-7">7:7</SelectItem>
                        <SelectItem value="8-8">8:8</SelectItem>
                        <SelectItem value="9-9">9:9</SelectItem>
                        <SelectItem value="10-10">10:10</SelectItem>
                        <SelectItem value="11-11">11:11</SelectItem>
                        <SelectItem value="12-12">12:12</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            {/* Additional */}
            <div className="border rounded-md py-4 px-[3px] bg-[#f8fdf9] shadow-md">
              <Label className="text-base font-medium">{t("match.additional")}</Label>
              <div className="space-y-2 mt-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="golden-game"
                    checked={goldenGame}
                    onCheckedChange={(checked) => {
                      const on = checked === true
                      setGoldenGame(on)
                      // Golden game ends the set at 6:5, so a 6:6 tiebreak
                      // can never happen — turn the tiebreak off (and restore
                      // it when golden game goes back off).
                      if (on) {
                        preGoldenTiebreakRef.current = !!tiebreakEnabled
                        setTiebreakEnabled(false)
                      } else if (preGoldenTiebreakRef.current !== null) {
                        setTiebreakEnabled(preGoldenTiebreakRef.current)
                        preGoldenTiebreakRef.current = null
                      }
                    }}
                    disabled={match.isCompleted || setsCount === "super"}
                  />
                  <Label htmlFor="golden-game" className="text-sm">
                    {t("match.goldenGame")}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("match.goldenGameDescription")}
                </p>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="windbreak"
                    checked={windbreak}
                    onCheckedChange={(checked) => setWindbreak(checked as boolean)}
                    disabled={match.isCompleted}
                  />
                  <Label htmlFor="windbreak" className="text-sm">
                    {t("match.windbreak")}
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <SectionApplyBar
            isDirty={isRulesDirty}
            savedAt={rulesSavedAt}
            onApply={applyRules}
            disabled={match.isCompleted}
            applyLabel={t_apply}
            savedLabel={t_saved}
            unsavedLabel={t_unsaved}
            savedAtLabel={savedAtFormatter}
          />

          <div className="pt-3">
            <HandicapEditor match={match} updateMatch={updateMatch} />
          </div>

          <div className="pt-3">
            <ResultPosterSettings match={match} updateMatch={updateMatch} />
          </div>

          <div className="pt-2 border-t">
            {match.isCompleted ? (
              <Button
                variant="outline"
                className="w-full mt-2 shadow-md transition-all duration-200 active:scale-95 bg-gradient-to-b from-white to-[#f5f9fd] hover:from-[#f5f9fd] hover:to-[#e1e9f5] border-white text-[#00336d]"
                onClick={unlockMatch}
              >
                <LockOpenIcon className="mr-2 h-4 w-4" />
                {t("match.unlockMatch")}
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="w-full mt-2 shadow-md transition-all duration-200 active:scale-95 bg-gradient-to-b from-[#ff6b6b] to-[#dc3545] hover:from-[#ff8585] hover:to-[#ff6b6b] text-white"
                onClick={() => {
                  if (confirm(t("match.confirmEndMatch"))) endMatch()
                }}
              >
                {t("match.endMatch")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
