"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect, useRef } from "react"
import { LockOpenIcon } from "lucide-react"
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
  getSetsToWin,
  shouldStartMatchTiebreakAfterSet,
} from "@/lib/match-format-rules"
import { normalizeMatchState, restartCurrentSet } from "@/lib/scoring-logic"
import { classifyRuleChange } from "@/lib/match-rule-change"

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

export function MatchSettings({ match, updateMatch, type, settings, onChange }: MatchSettingsProps) {
  const { t } = useLanguage()
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
  const [gamesPerSetOverrides, setGamesPerSetOverrides] = useState<Record<number, string>>(
    match?.settings?.gamesPerSetOverrides ? Object.fromEntries(
      Object.entries(match.settings.gamesPerSetOverrides).map(([k, v]) => [k, String(v)])
    ) : {}
  )
  const [showPerSetGames, setShowPerSetGames] = useState(false)
  const [goldenGame, setGoldenGame] = useState(match?.settings?.goldenGame || false)
  const [windbreak, setWindbreak] = useState(match?.settings?.windbreak || false)

  const [editSetIndex, setEditSetIndex] = useState(null)
  const [editSetScoreA, setEditSetScoreA] = useState(0)
  const [editSetScoreB, setEditSetScoreB] = useState(0)

  // Task 5: a rule edit awaiting a scope decision ({ updatedMatch, classification }).
  const [pendingRuleChange, setPendingRuleChange] = useState<any>(null)
  // True while the pending dialog is being closed by an explicit action button,
  // so the close handler does not also treat it as a cancel.
  const ruleChangeHandledRef = useRef(false)

  // Pushes match.settings into the local form state.
  const syncLocalSettings = (s: any) => {
    if (!s) return
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

  // Bug #9 fix: sync local state when match.settings changes externally
  useEffect(() => {
    syncLocalSettings(match?.settings)
  }, [
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

  const handleChange = (key: string, value: any) => {
    if (onChange && settings) {
      onChange({ ...settings, [key]: value })
    }
  }

  // Task 4: every rule change repairs already-started game/set state for the
  // new rules and stamps a rule revision so the scoreboard can drop its stale
  // click/history buffers. Returns a new match — the input is not used after.
  const commitRuleChange = (updatedMatch: any) => {
    updatedMatch.history = []
    const normalized = normalizeMatchState(updatedMatch)
    normalized.ruleRevision = (typeof updatedMatch.ruleRevision === "number" ? updatedMatch.ruleRevision : 0) + 1
    normalized.lastRuleChangeAt = new Date().toISOString()
    return normalized
  }

  // Persists a rule change, with the legacy storage-quota fallback.
  const doCommit = (updatedMatch: any) => {
    try {
      updateMatch(commitRuleChange(updatedMatch))
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
      updateMatch(commitRuleChange(minimalMatch))
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
      setPendingRuleChange({ updatedMatch, classification })
    }
  }

  // Dialog actions for a pending rule change.
  const applyPendingNow = () => {
    ruleChangeHandledRef.current = true
    if (pendingRuleChange) doCommit(pendingRuleChange.updatedMatch)
    setPendingRuleChange(null)
  }
  const applyPendingRestart = () => {
    ruleChangeHandledRef.current = true
    if (pendingRuleChange) doCommit(restartCurrentSet(pendingRuleChange.updatedMatch))
    setPendingRuleChange(null)
  }
  const cancelPendingRuleChange = () => {
    setPendingRuleChange(null)
    // Revert the form controls to the still-saved settings.
    syncLocalSettings(match?.settings)
  }

  // Bug #10 fix: auto-apply settings on every change
  const applySettingsAuto = (overrides: Record<string, any> = {}) => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }
    updatedMatch.history = []

    updatedMatch.settings = {
      ...updatedMatch.settings,
      tiebreakEnabled: overrides.tiebreakEnabled !== undefined ? overrides.tiebreakEnabled : tiebreakEnabled,
      tiebreakFormat: overrides.tiebreakFormat !== undefined ? overrides.tiebreakFormat : tiebreakFormat,
      tiebreakLength: overrides.tiebreakLength !== undefined ? overrides.tiebreakLength : Number.parseInt(tiebreakLength),
      tiebreakAt: overrides.tiebreakAt !== undefined ? overrides.tiebreakAt : tiebreakAt,
      finalSetTiebreak: overrides.finalSetTiebreak !== undefined ? overrides.finalSetTiebreak : finalSetTiebreak,
      finalSetFinish: overrides.finalSetFinish !== undefined ? overrides.finalSetFinish : finalSetFinish,
      finalSetTiebreakLength: overrides.finalSetTiebreakLength !== undefined ? overrides.finalSetTiebreakLength : Number.parseInt(finalSetTiebreakLength),
      scoringSystem: overrides.scoringSystem !== undefined ? overrides.scoringSystem : scoringSystem,
      goldenPointFormat: overrides.goldenPointFormat !== undefined ? overrides.goldenPointFormat : goldenPointFormat,
      gamesPerSet: overrides.gamesPerSet !== undefined ? overrides.gamesPerSet : Number.parseInt(gamesPerSet),
      gamesPerSetOverrides: overrides.gamesPerSetOverrides !== undefined ? overrides.gamesPerSetOverrides : Object.fromEntries(
        Object.entries(gamesPerSetOverrides).map(([k, v]) => [k, Number.parseInt(v as string)])
      ),
      goldenGame: overrides.goldenGame !== undefined ? overrides.goldenGame : goldenGame,
      windbreak: overrides.windbreak !== undefined ? overrides.windbreak : windbreak,
    }

    requestRuleChange(updatedMatch)
  }

  const startTiebreak = () => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }
    updatedMatch.history = []

    updatedMatch.score.currentSet.isTiebreak = true
    updatedMatch.score.currentSet.currentGame = {
      teamA: 0,
      teamB: 0,
    }

    try {
      updateMatch(updatedMatch)
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
      updateMatch(minimalMatch)
    }
  }

  // Bug #7 fix: save tiebreak score when ending tiebreak manually
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const endTiebreak = (winner: any) => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }
    updatedMatch.history = []

    const tiebreakScore = {
      teamA: updatedMatch.score.currentSet.currentGame.teamA,
      teamB: updatedMatch.score.currentSet.currentGame.teamB,
    }

    updatedMatch.score.currentSet[winner]++
    updatedMatch.score.currentSet.tiebreak = tiebreakScore
    updatedMatch.score.currentSet.isTiebreak = false

    winSetInSettings(winner, updatedMatch)
  }

  // Bug #5 fix: single winSet implementation with tiebreak score saving
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const winSetInSettings = (team: any, updatedMatch: any) => {
    if (!match || !updateMatch) return

    updatedMatch.score[team]++

    const setToSave: any = {
      teamA: updatedMatch.score.currentSet.teamA,
      teamB: updatedMatch.score.currentSet.teamB,
      winner: team,
    }

    // Bug #7 fix: save tiebreak score
    if (updatedMatch.score.currentSet.tiebreak) {
      setToSave.tiebreak = { ...updatedMatch.score.currentSet.tiebreak }
    }

    updatedMatch.score.sets.push(setToSave)

    const setsToWin = getSetsToWin(updatedMatch.settings)
    if (updatedMatch.score[team] >= setsToWin) {
      if (confirm(`Команда ${team === "teamA" ? "A" : "B"} выиграла матч! Завершить матч?`)) {
        updatedMatch.isCompleted = true
        updatedMatch.winner = team
        updateMatch(updatedMatch)
        return
      }
    }

    const nextCurrentSet: any = {
      teamA: 0,
      teamB: 0,
      games: [],
      currentGame: {
        teamA: 0,
        teamB: 0,
      },
      isTiebreak: false,
    }
    if (shouldStartMatchTiebreakAfterSet(updatedMatch.settings, updatedMatch.score)) {
      nextCurrentSet.isTiebreak = true
      nextCurrentSet.isSuperTiebreak = true
    }
    updatedMatch.score.currentSet = nextCurrentSet

    updateMatch(updatedMatch)
  }

  // Bug #6 fix: handle draw properly in endMatch
  const endMatch = () => {
    if (!match || !updateMatch) return

    console.log("endMatch function called")

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
        if (ga > gb) {
          updatedMatch.winner = "teamA"
        } else if (gb > ga) {
          updatedMatch.winner = "teamB"
        } else {
          updatedMatch.winner = null
        }
      }
    }

    console.log("Updating match with:", updatedMatch)
    updateMatch(updatedMatch)
  }

  const unlockMatch = () => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }
    updatedMatch.isCompleted = false
    updatedMatch.history = []
    updateMatch(updatedMatch)
  }

  // Bug #8 fix: recalculate isCompleted and winner after set score edit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateSetScore = (index: any, team: any, delta: any) => {
    if (!match || !updateMatch) return

    const updatedMatch = { ...match }
    updatedMatch.history = []

    if (index === match.score.sets.length) {
      if (delta > 0 || updatedMatch.score.currentSet[team] > 0) {
        updatedMatch.score.currentSet[team] += delta
        if (updatedMatch.score.currentSet[team] < 0) {
          updatedMatch.score.currentSet[team] = 0
        }
      }
    } else if (index < match.score.sets.length) {
      if (delta > 0 || updatedMatch.score.sets[index][team] > 0) {
        updatedMatch.score.sets[index][team] += delta
        if (updatedMatch.score.sets[index][team] < 0) {
          updatedMatch.score.sets[index][team] = 0
        }
      }

      const set = updatedMatch.score.sets[index]
      if (set.teamA > set.teamB) {
        set.winner = "teamA"
      } else if (set.teamB > set.teamA) {
        set.winner = "teamB"
      } else {
        set.winner = null
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedMatch.score.teamA = updatedMatch.score.sets.filter((s: any) => s.winner === "teamA").length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedMatch.score.teamB = updatedMatch.score.sets.filter((s: any) => s.winner === "teamB").length

      // Bug #8 fix: recalculate isCompleted and winner
      const setsToWin = getSetsToWin(updatedMatch.settings)
      if (updatedMatch.score.teamA >= setsToWin) {
        updatedMatch.isCompleted = true
        updatedMatch.winner = "teamA"
      } else if (updatedMatch.score.teamB >= setsToWin) {
        updatedMatch.isCompleted = true
        updatedMatch.winner = "teamB"
      } else {
        updatedMatch.isCompleted = false
        updatedMatch.winner = null
      }
    }

    updateMatch(updatedMatch)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startEditSet = (index: any) => {
    if (!match) return

    if (index < match.score.sets.length) {
      const set = match.score.sets[index]
      setEditSetScoreA(set.teamA)
      setEditSetScoreB(set.teamB)
      setEditSetIndex(index)
    } else if (index === match.score.sets.length) {
      setEditSetScoreA(match.score.currentSet.teamA)
      setEditSetScoreB(match.score.currentSet.teamB)
      setEditSetIndex(index)
    }
  }

  const saveSetScore = () => {
    if (editSetIndex === null || !match || !updateMatch) return

    const updatedMatch = { ...match }
    updatedMatch.history = []

    if (editSetIndex < match.score.sets.length) {
      updatedMatch.score.sets[editSetIndex].teamA = editSetScoreA
      updatedMatch.score.sets[editSetIndex].teamB = editSetScoreB

      if (editSetScoreA > editSetScoreB) {
        updatedMatch.score.sets[editSetIndex].winner = "teamA"
      } else if (editSetScoreB > editSetScoreA) {
        updatedMatch.score.sets[editSetIndex].winner = "teamB"
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedMatch.score.teamA = updatedMatch.score.sets.filter((set: any) => set.winner === "teamA").length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedMatch.score.teamB = updatedMatch.score.sets.filter((set: any) => set.winner === "teamB").length

      // Recalculate isCompleted/winner
      const setsToWin = getSetsToWin(updatedMatch.settings)
      if (updatedMatch.score.teamA >= setsToWin) {
        updatedMatch.isCompleted = true
        updatedMatch.winner = "teamA"
      } else if (updatedMatch.score.teamB >= setsToWin) {
        updatedMatch.isCompleted = true
        updatedMatch.winner = "teamB"
      } else {
        updatedMatch.isCompleted = false
        updatedMatch.winner = null
      }
    } else if (editSetIndex === match.score.sets.length) {
      updatedMatch.score.currentSet.teamA = editSetScoreA
      updatedMatch.score.currentSet.teamB = editSetScoreB
    }

    updateMatch(updatedMatch)
    setEditSetIndex(null)
  }

  const totalSets = match?.settings?.sets || 3
  const allSetsArray = []

  if (match && match.score && match.score.sets) {
    for (let i = 0; i < match.score.sets.length; i++) {
      allSetsArray.push({
        index: i,
        isCompleted: true,
        isCurrent: false,
        teamA: match.score.sets[i].teamA,
        teamB: match.score.sets[i].teamB,
      })
    }

    allSetsArray.push({
      index: match.score.sets.length,
      isCompleted: false,
      isCurrent: true,
      teamA: match.score.currentSet.teamA,
      teamB: match.score.currentSet.teamB,
    })

    for (let i = match.score.sets.length + 1; i < totalSets; i++) {
      allSetsArray.push({
        index: i,
        isCompleted: false,
        isCurrent: false,
        teamA: 0,
        teamB: 0,
      })
    }
  }

  if (!match && settings && onChange) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-medium mb-2">{t("newMatch.matchSettings")}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sets">{t("newMatch.sets")}</Label>
            <Select
              value={settings.sets.toString()}
              onValueChange={(value) => handleChange("sets", Number.parseInt(value))}
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
              onValueChange={(value) => handleChange("games", Number.parseInt(value))}
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
              onCheckedChange={(checked) => handleChange("tiebreak", checked)}
            />
            <Label htmlFor="tiebreak">{t("newMatch.tiebreak")}</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="finalSetTiebreak"
              checked={settings.finalSetTiebreak}
              onCheckedChange={(checked) => handleChange("finalSetTiebreak", checked)}
            />
            <Label htmlFor="finalSetTiebreak">{t("newMatch.finalSetTiebreak")}</Label>
          </div>
        </div>

        <div className="space-y-4">
          <Label>{t("newMatch.servingSide")}</Label>
          <RadioGroup
            value={settings.servingSide}
            onValueChange={(value) => handleChange("servingSide", value)}
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
            onValueChange={(value) => handleChange("servingTeam", Number.parseInt(value) as 1 | 2)}
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
            onValueChange={(value) => handleChange("servingPlayer", Number.parseInt(value) as 1 | 2 | 3 | 4)}
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => teamIdentifiers.includes(p.team) || teamIdentifiers.includes(p.teamId),
      )

      if (teamPlayers.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return teamPlayers
          .map((p: any) => p.name || p.firstName || p.lastName || "")
          .filter(Boolean)
          .join(", ")
      }
    }

    const playersKey = `${teamKey}Players`
    if (match[playersKey] && Array.isArray(match[playersKey])) {
      return match[playersKey]
        .map((p) => p.name || p.firstName || p.lastName || "")
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

    if (playerNames.length > 0) {
      return playerNames.join(", ")
    }

    if (teamKey === "teamA") {
      return "Игрок 1, Игрок 2"
    } else {
      return "Игрок 3, Игрок 4"
    }
  }

  const teamAPlayerNames = getTeamPlayerNames("teamA")
  const teamBPlayerNames = getTeamPlayerNames("teamB")

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
                ? "Изменение нельзя применить без потерь"
                : "Изменение влияет на текущий сет"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRuleChange?.classification?.reason
                ? `${pendingRuleChange.classification.reason}. `
                : ""}
              Выберите, как применить это изменение правил.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction onClick={applyPendingNow}>Применить сейчас</AlertDialogAction>
            {pendingRuleChange?.classification?.scope === "restart-required" && (
              <AlertDialogAction onClick={applyPendingRestart}>
                Перезапустить текущий сет с 0:0
              </AlertDialogAction>
            )}
            <AlertDialogCancel>Отмена</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Score Editing Card */}
      <Card className="w-full mb-4 bg-gradient-to-b from-[#019fe3] to-[#00336d]">
        <CardHeader>
          <CardTitle className="text-white">{t("match.scoreEditing")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-800 px-[3px]">
          <div className="p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-center">
            {t("match.matchCode")}: <span className="font-bold">{match.code || match.id}</span>
          </div>

          <div className="py-4 px-[3px] bg-blue-50 border border-blue-200 rounded-md mt-4">
            <h3 className="font-medium text-center mb-3">{t("match.editSets") || "Edit Set Scores"}</h3>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border-b-2 border-gray-300"></th>
                    <th className="p-2 border-b-2 border-gray-300 text-center">
                      <div className="font-bold">
                        {match.teamA?.name || match.teamAName || t("match.teamA") || "Команда A"}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{teamAPlayerNames}</div>
                    </th>
                    <th className="p-2 border-b-2 border-gray-300 text-center">
                      <div className="font-bold">
                        {match.teamB?.name || match.teamBName || t("match.teamB") || "Команда B"}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{teamBPlayerNames}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allSetsArray.map((set, idx) => (
                    <tr key={idx} className={set.isCurrent ? "bg-blue-100" : ""}>
                      <td className="p-2 border-r border-gray-300 text-[13px] text-center" style={{ fontSize: "13px" }}>
                        <span className="font-bold">{t("match.set")}</span> {idx + 1}
                      </td>
                      <td className="p-2 border-r border-gray-300">
                        <div className="flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateSetScore(set.index, "teamA", -1)}
                            disabled={match.isCompleted}
                          >
                            -
                          </Button>
                          <span className="mx-3 font-bold text-lg">{set.teamA}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateSetScore(set.index, "teamA", 1)}
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
                            onClick={() => updateSetScore(set.index, "teamB", -1)}
                            disabled={match.isCompleted}
                          >
                            -
                          </Button>
                          <span className="mx-3 font-bold text-lg">{set.teamB}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateSetScore(set.index, "teamB", 1)}
                            disabled={match.isCompleted}
                          >
                            +
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            {/* Sets selection */}
            <div className="border rounded-md py-3 px-[3px] bg-[#f8fdf9] shadow-md">
              <Label>{t("newMatch.sets")}</Label>
              <Select
                value={match.settings?.isSuperSet ? "super" : (match.settings?.sets?.toString() || "3")}
                onValueChange={(value) => {
                  const updatedMatch = { ...match }
                  if (value === "super") {
                    updatedMatch.settings.isSuperSet = true
                    updatedMatch.settings.superSetTarget = 8
                    updatedMatch.settings.superSetTiebreakAt = 8
                    updatedMatch.settings.sets = 1
                    updatedMatch.settings.tiebreakEnabled = true
                    updatedMatch.settings.tiebreakAt = "8-8"
                    updatedMatch.settings.finalSetTiebreak = false
                    updatedMatch.settings.finalSetFinish = "standard-7"
                    setFinalSetTiebreak(false)
                    setFinalSetFinish("standard-7")
                  } else {
                    updatedMatch.settings.isSuperSet = false
                    updatedMatch.settings.sets = Number.parseInt(value)
                    updatedMatch.settings.finalSetTiebreak = getDefaultFinalSetTiebreakForSelection(value)
                    updatedMatch.settings.finalSetFinish = getDefaultFinalSetFinishForSelection(value)
                    setFinalSetTiebreak(updatedMatch.settings.finalSetTiebreak)
                    setFinalSetFinish(updatedMatch.settings.finalSetFinish)
                  }
                  requestRuleChange(updatedMatch)
                }}
                disabled={match.isCompleted}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("newMatch.sets")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — normal</SelectItem>
                  <SelectItem value="2">2 + tiebreak</SelectItem>
                  <SelectItem value="3">3 — normal</SelectItem>
                  <SelectItem value="4">4 + tiebreak</SelectItem>
                  <SelectItem value="5">5 — normal</SelectItem>
                  <SelectItem value="6">6 + tiebreak</SelectItem>
                  <SelectItem value="7">7 — normal</SelectItem>
                  <SelectItem value="super">
                    <div>
                      <span className="font-medium">{t("newMatch.superSet")}</span>
                      <p className="text-xs text-muted-foreground">{t("newMatch.superSetDescription")}</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Final Set Tiebreak — auto-apply on change */}
            <div className="border border-green-200 rounded-md py-3 px-[3px] bg-green-50 shadow-md mt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>{t("newMatch.finalSetTiebreak")}</Label>
                <Switch
                  id="final-set-tiebreak"
                  checked={finalSetTiebreak}
                  onCheckedChange={(checked) => {
                    setFinalSetTiebreak(checked)
                    if (!match.settings?.isSuperSet) {
                      const num = match.settings?.sets || 3
                      if (checked && num % 2 !== 0) {
                        const updatedMatch = { ...match }
                        const nextFinish = getDefaultFinalSetFinishForSelection((num - 1).toString())
                        updatedMatch.settings = { ...updatedMatch.settings, sets: num - 1, finalSetTiebreak: checked, finalSetFinish: nextFinish }
                        setFinalSetFinish(nextFinish)
                        requestRuleChange(updatedMatch)
                        return
                      } else if (!checked && num % 2 === 0) {
                        const updatedMatch = { ...match }
                        const nextFinish = getDefaultFinalSetFinishForSelection((num + 1).toString())
                        updatedMatch.settings = { ...updatedMatch.settings, sets: num + 1, finalSetTiebreak: checked, finalSetFinish: nextFinish }
                        setFinalSetFinish(nextFinish)
                        requestRuleChange(updatedMatch)
                        return
                      }
                    }
                    applySettingsAuto({ finalSetTiebreak: checked })
                  }}
                  disabled={match.isCompleted}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                />
              </div>

              {finalSetTiebreak && (
                <div className="space-y-2">
                  <Label>Final set finish</Label>
                  <Select
                    value={finalSetFinish}
                    onValueChange={(value) => {
                      setFinalSetFinish(value)
                      const nextLength = value.endsWith("-7") ? 7 : value.endsWith("-10") ? 10 : Number.parseInt(finalSetTiebreakLength)
                      if (value.endsWith("-7")) setFinalSetTiebreakLength("7")
                      if (value.endsWith("-10")) setFinalSetTiebreakLength("10")
                      applySettingsAuto({ finalSetFinish: value, finalSetTiebreakLength: nextLength })
                    }}
                    disabled={match.isCompleted}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard-7">Games as normal - tiebreak to 7</SelectItem>
                      <SelectItem value="standard-10">Games as normal - tiebreak to 10</SelectItem>
                      <SelectItem value="match-tiebreak-7">No games - match tiebreak to 7</SelectItem>
                      <SelectItem value="match-tiebreak-10">No games - match tiebreak to 10</SelectItem>
                      <SelectItem value="games-to-12-7">Games to 12 - tiebreak to 7</SelectItem>
                      <SelectItem value="games-to-12-10">Games to 12 - tiebreak to 10</SelectItem>
                      <SelectItem value="no-tiebreak">No tiebreak</SelectItem>
                    </SelectContent>
                  </Select>

                  <Label>{t("newMatch.finalSetTiebreakLength")}</Label>
                  <Select
                    value={finalSetTiebreakLength}
                    onValueChange={(value) => {
                      setFinalSetTiebreakLength(value)
                      applySettingsAuto({ finalSetTiebreakLength: Number.parseInt(value) })
                    }}
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

            {/* Scoring System — auto-apply on change */}
            <div className="border rounded-md py-3 px-[3px] bg-[#f8fdf9] shadow-md">
              <Label>{t("match.scoringSystem")}</Label>
              <Select
                value={scoringSystem}
                onValueChange={(value) => {
                  setScoringSystem(value)
                  const nextGoldenPoint = getDefaultGoldenPointForScoringSystem(value)
                  setGoldenPointFormat(nextGoldenPoint)
                  if (value === "fast4") {
                    setGamesPerSet("4")
                    applySettingsAuto({ scoringSystem: value, gamesPerSet: 4, goldenPointFormat: nextGoldenPoint })
                  } else {
                    applySettingsAuto({ scoringSystem: value, goldenPointFormat: nextGoldenPoint })
                  }
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
                  <Label>Golden Point</Label>
                  <Select
                    value={goldenPointFormat}
                    onValueChange={(value) => {
                      setGoldenPointFormat(value)
                      applySettingsAuto({ goldenPointFormat: value })
                    }}
                    disabled={match.isCompleted}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Off</SelectItem>
                      <SelectItem value="first-deuce">Pro - first deuce</SelectItem>
                      <SelectItem value="second-deuce">Amateur - second deuce</SelectItem>
                      <SelectItem value="third-deuce">Star - third deuce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Games per set — auto-apply on change */}
            <div className="border rounded-md py-3 px-[3px] bg-[#f0f4ff] shadow-md">
              <Label className="text-base font-medium">Кількість геймів у сеті</Label>
              <Select
                value={gamesPerSet}
                onValueChange={(value) => {
                  setGamesPerSet(value)
                  if (value === "4") {
                    setScoringSystem("fast4")
                  }
                  applySettingsAuto({ gamesPerSet: Number.parseInt(value) })
                }}
                disabled={match.isCompleted}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} гейм{n === 1 ? "" : n < 5 ? "и" : "ів"}{n === 6 ? " (стандарт)" : ""}{n === 4 ? " (Fast4)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!match.settings?.isSuperSet && (() => {
                const totalSets = match.settings?.sets || 3
                if (!totalSets || totalSets < 2) return null
                return (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                      onClick={() => setShowPerSetGames(!showPerSetGames)}
                    >
                      {showPerSetGames ? "Сховати налаштування для кожного сету" : "Налаштувати для кожного сету окремо"}
                    </button>

                    {showPerSetGames && (
                      <div className="mt-2 space-y-2">
                        {Array.from({ length: totalSets }, (_, i) => i).map((setIdx) => (
                          <div key={setIdx} className="flex items-center gap-2">
                            <span className="text-sm font-medium w-20 shrink-0">Сет {setIdx + 1}:</span>
                            <Select
                              value={gamesPerSetOverrides[setIdx] || gamesPerSet}
                              onValueChange={(v) => {
                                setGamesPerSetOverrides((prev) => {
                                  const next = { ...prev }
                                  if (v === gamesPerSet) {
                                    delete next[setIdx]
                                  } else {
                                    next[setIdx] = v
                                  }
                                  return next
                                })
                                const updatedOverrides = { ...gamesPerSetOverrides }
                                if (v === gamesPerSet) {
                                  delete updatedOverrides[setIdx]
                                } else {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  ; (updatedOverrides as any)[setIdx] = Number.parseInt(v)
                                }
                                applySettingsAuto({ gamesPerSetOverrides: updatedOverrides })
                              }}
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

            {/* Tiebreak settings — auto-apply on change */}
            <div className="border rounded-md py-4 px-[3px] bg-[#f3f5f7] shadow-md">
              <div className="flex items-center justify-between mb-4">
                <Label>{t("newMatch.tiebreak")}</Label>
                <Switch
                  id="tiebreak-enabled"
                  checked={tiebreakEnabled}
                  onCheckedChange={(checked) => {
                    setTiebreakEnabled(checked)
                    applySettingsAuto({ tiebreakEnabled: checked })
                  }}
                  disabled={match.isCompleted}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                />
              </div>

              {tiebreakEnabled && (
                <>
                  <div>
                    <Label>{t("match.tiebreakType") || "Кількість очків тай-брейку"}</Label>
                    <Select
                      value={tiebreakFormat}
                      onValueChange={(value) => {
                        setTiebreakFormat(value)
                        applySettingsAuto({ tiebreakFormat: value })
                      }}
                      disabled={match.isCompleted}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="two-clear">Two clear points</SelectItem>
                        <SelectItem value="receiver-select-1-or-2">Receiver selects 1 or 2</SelectItem>
                        <SelectItem value="receiver-select-1-2-or-3">Receiver selects 1, 2 or 3</SelectItem>
                        <SelectItem value="receiver-select-1-or-3">Receiver selects 1 or 3</SelectItem>
                        <SelectItem value="sudden-death">Sudden death</SelectItem>
                      </SelectContent>
                    </Select>

                    <Label className="mt-4 block">Tiebreak points</Label>
                    <Select
                      value={tiebreakLength}
                      onValueChange={(value) => {
                        setTiebreakLength(value)
                        applySettingsAuto({ tiebreakLength: Number.parseInt(value) })
                      }}
                      disabled={match.isCompleted}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            До {n} очків{n === 7 ? " (стандарт)" : ""}{n === 10 ? " (чемпіонський)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Number.parseInt(tiebreakLength) > 1 ? "З різницею в 2 очки" : ""}
                    </p>
                  </div>

                  <div className="mt-4">
                    <Label>{t("match.tiebreakAt")}</Label>
                    <Select
                      value={tiebreakAt}
                      onValueChange={(value) => {
                        setTiebreakAt(value)
                        applySettingsAuto({ tiebreakAt: value })
                      }}
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

            {/* Additional settings — auto-apply on change */}
            <div className="border rounded-md py-4 px-[3px] bg-[#f8fdf9] shadow-md">
              <Label className="text-base font-medium">{t("match.additional")}</Label>
              <div className="space-y-2 mt-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="golden-game"
                    checked={goldenGame}
                    onCheckedChange={(checked) => {
                      setGoldenGame(checked as boolean)
                      applySettingsAuto({ goldenGame: checked })
                    }}
                    disabled={match.isCompleted}
                  />
                  <Label htmlFor="golden-game" className="text-sm">
                    {t("match.goldenGame")}
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="windbreak"
                    checked={windbreak}
                    onCheckedChange={(checked) => {
                      setWindbreak(checked as boolean)
                      applySettingsAuto({ windbreak: checked })
                    }}
                    disabled={match.isCompleted}
                  />
                  <Label htmlFor="windbreak" className="text-sm">
                    {t("match.windbreak")}
                  </Label>
                </div>
              </div>
            </div>
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
                  if (confirm(t("match.confirmEndMatch"))) {
                    endMatch()
                  }
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
