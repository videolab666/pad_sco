"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getGameScoreDisplay, getImportantEventType, getServeSide as getServeSideView, isPlayerServing } from "@/lib/match-view"
import { useState, useEffect, useRef } from "react"
import { undoLastScoringEvent, verifyJournal } from "@/lib/match-undo"
import { appendStateOverrideEvent, scoreStateOf } from "@/lib/match-events"
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
import { Trophy } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CircleDot } from "lucide-react"
import { switchServer, swapCourtSides } from "@/lib/scoring-logic"
import { applyPointWithExtras } from "@/lib/apply-point"
import { sendMatchCommand, type SendCommandResult } from "@/lib/match-command-client"
import { syncMatchToServer } from "@/lib/match-sync"
import { postResultIfConfigured } from "@/lib/result-poster"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ScoreBoard({ match, updateMatch }: { match: any; updateMatch: any }) {
  const [showMatchEndDialog, setShowMatchEndDialog] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingMatchUpdate, setPendingMatchUpdate] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previousMatchState, setPreviousMatchState] = useState<any>(null)
  const [fixedSides, setFixedSides] = useState(false)

  // Always force 'fixed players' as default on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("fixedSidesPreference")
      setFixedSides(false)
    }
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [matchHistory, setMatchHistory] = useState<any[]>([])
  // Shown when an undo button was used but neither the journal nor the
  // in-memory fallback could serve it.
  const [undoNotice, setUndoNotice] = useState(false)
  // Cheap availability probe for the journal-based undo (integrity is fully
  // verified at click time — verifyJournal — before anything is applied).
  const hasUndoableJournal =
    !!match?.seedSnapshot &&
    (match?.events ?? []).some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e: any) => e?.type === "point" || e?.type === "manual-score-edit" || e?.type === "toss",
    )
  // Task 4: a rule edit changes match.settings. Tracking the settings content
  // (not ruleRevision) keeps the buffer-reset correct across devices, because
  // settings round-trip through Supabase while ruleRevision does not.
  const settingsSignature = JSON.stringify(match?.settings ?? null)
  const [settingsSeen, setSettingsSeen] = useState(settingsSignature)
  const { t } = useLanguage()

  const [swappedTeamA, setSwappedTeamA] = useState(false)
  const [swappedTeamB, setSwappedTeamB] = useState(false)

  // Add state to track if a score button click is being processed
  // Track which team's score is being processed for visual feedback
  const [processingTeam, setProcessingTeam] = useState(null)

  // Add local state to keep track of our current scores during rapid clicks
  // This helps prevent flickering when receiving real-time updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localMatchState, setLocalMatchState] = useState<any>(null)

  // Track absolutely latest state perfectly for rapid clicks
  const latestMatchRef = useRef<any>(null)

  // Промис финальной point-команды (диалог завершения): «Продолжить» обязан
  // дождаться её, прежде чем слать unlock-match — иначе гонка порядков
  // завершает матч на сервере ПОСЛЕ анлока, и все дальнейшие очки
  // оператора отвергаются 400-м (фикс 2026-09-04 №2).
  const finalPointInFlightRef = useRef<Promise<SendCommandResult> | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fixedSidesPreference", fixedSides.toString())
    }
  }, [fixedSides])

  // Keep localMatchState in sync with match — но НЕ затираем оптимистичный
  // локальный счёт устаревшим снапшотом. Если у нас локально более высокая
  // ревизия (мы только что кликнули и оптимистично обновили), а приходящий
  // `match` отстаёт (задержавшийся realtime-эхо или отстающий канонический
  // стейт), игнорируем его — иначе следующий клик возьмёт стейл-базу из
  // `latestMatchRef.current` и счёт «прыгнет назад» (slow-network flicker).
  useEffect(() => {
    if (!match) return
    const localRev =
      typeof latestMatchRef.current?.revision === "number"
        ? latestMatchRef.current.revision
        : -Infinity
    const incomingRev = typeof match.revision === "number" ? match.revision : -Infinity
    if (latestMatchRef.current && incomingRev <= localRev) return
    setLocalMatchState(match)
    latestMatchRef.current = match
  }, [match])

  // Task 4, Step 3: when a rule edit lands (match.settings changed) drop the
  // stale click/history buffers and the pending match-end confirmation, then
  // refresh the scoreboard from the canonical match.
  useEffect(() => {
    if (settingsSignature === settingsSeen) return
    setSettingsSeen(settingsSignature)
    setMatchHistory([])
    setLocalMatchState(match)
    latestMatchRef.current = match
    setPendingMatchUpdate(null)
    setPreviousMatchState(null)
    setShowMatchEndDialog(false)
  }, [settingsSignature])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleStorageChange = (e: any) => {
      if (e.key === "fixedSidesPreference") {
        setFixedSides(e.newValue === "true")
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTeamSwapChange = (e: any) => {
      if (e.detail && e.detail.team === "teamA") {
        setSwappedTeamA(e.detail.swapped)
      } else if (e.detail && e.detail.team === "teamB") {
        setSwappedTeamB(e.detail.swapped)
      }
    }

    window.addEventListener("teamPlayersSwapped", handleTeamSwapChange)
    return () => window.removeEventListener("teamPlayersSwapped", handleTeamSwapChange)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleCourtSidesSwapped = (e: any) => {
      if (!updateMatch || match.isCompleted) return

      // Save the current match state before any changes
      const previousState = JSON.parse(JSON.stringify(match))
      // Save to history
      setMatchHistory((prev) => [...prev, previousState])

      // Create a copy of the match
      const updatedMatch = { ...match }

      // Update court sides with the new sides from the event
      if (e.detail && e.detail.newSides) {
        // In fixed players mode, we still update the match data
        // but the display will continue to show Team A on left and Team B on right
        updatedMatch.courtSides = e.detail.newSides

        // Update match
        updateMatch(updatedMatch)
      }
    }

    window.addEventListener("courtSidesSwapped", handleCourtSidesSwapped)
    return () => window.removeEventListener("courtSidesSwapped", handleCourtSidesSwapped)
  }, [match, updateMatch])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleSwitchServer = (e: any) => {
      if (!updateMatch || match.isCompleted) return

      // Save the current match state before any changes
      const previousState = JSON.parse(JSON.stringify(match))
      // Save to history
      setMatchHistory((prev) => [...prev, previousState])

      // Create a copy of the match
      const updatedMatch = { ...match }

      // Switch server
      switchServer(updatedMatch)

      // Update match (journaled so replay-undo stays in sync)
      updateMatch(appendStateOverrideEvent(updatedMatch, "switch-server", scoreStateOf(match)))
    }

    window.addEventListener("switchServer", handleSwitchServer)
    return () => window.removeEventListener("switchServer", handleSwitchServer)
  }, [match, updateMatch])

  // Use localMatchState if available for more responsive UI
  const displayMatch = localMatchState || match

  // B2 fix: guard before destructuring — otherwise a null match crashes here
  // and the check below is dead code.
  if (!displayMatch || !displayMatch.score || !displayMatch.score.currentSet) return null

  // Extract values from match data
  const { teamA, teamB } = displayMatch
  const currentSet = displayMatch.score.currentSet

  // Оптимизируем обработчик нажатия на счет для более быстрой работы
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleScoreClick = (team: any) => {
    const activeMatchState = latestMatchRef.current || displayMatch
    if (!updateMatch || activeMatchState.isCompleted) {
      console.log("Cannot update: updateMatch function missing or match completed")
      return
    }

    // Set which team is being processed for visual feedback
    setProcessingTeam(team)
    setTimeout(() => {
      setProcessingTeam(null)
    }, 100)

    // Save the current match state before any changes
    const previousState = JSON.parse(JSON.stringify(activeMatchState))
    // Save to history
    setMatchHistory((prev) => [...prev, previousState])

    // Deep copy to avoid mutating state
    const updatedMatch = JSON.parse(JSON.stringify(activeMatchState))

    // Apply score using the orchestrator that wraps the engine — this also
    // appends a `point` event to the journal, ticks game-timing windows,
    // applies handicap to the next game, consumes Power Play and stages
    // a pending tiebreak choice when needed.
    const resultMatch = applyPointWithExtras(updatedMatch, team)
    // Ревизию бампит ЕДИНСТВЕННО useMatch.updateMatch (см. ниже) — двойной
    // бамп (здесь + там) уходил на +2 за клик вперёд сервера НАВСЕГДА, и
    // ревизионный гард потом отвергал ЛЮБЫЕ серверные обновления (чужие
    // очки, анлоки) — страница замирала в своей оптимистике (фикс
    // 2026-09-04 №2: «нажимаю, а счёт не всегда меняется»).

    // If the engine completed the match, show confirmation dialog
    if (resultMatch.isCompleted && !activeMatchState.isCompleted) {
      // Здесь updateMatch НЕ вызывается — ревизию бампим сами.
      resultMatch.revision = (typeof updatedMatch.revision === "number" ? updatedMatch.revision : 0) + 1
      setPendingMatchUpdate(resultMatch)
      setPreviousMatchState(previousState)
      setLocalMatchState(resultMatch)
      latestMatchRef.current = resultMatch
      setShowMatchEndDialog(true)
      // Финальное очко уходит на сервер той же командой — матч завершится
      // и там; подтверждение оператора — чисто UI-действие (§99). Промис
      // храним: «Продолжить» должен дождаться его перед unlock-match.
      finalPointInFlightRef.current = sendMatchCommand(
        activeMatchState.id,
        "point",
        { team },
        { clientId: "score-board" },
      ).then((res) => {
        selfHealOnFailure(res)
        return res
      })
      return
    }

    latestMatchRef.current = resultMatch
    setLocalMatchState(resultMatch)
    // Шаг 3 (§99): снапшот — только локально; на сервер ушла КОМАНДА.
    updateMatch(resultMatch, { localOnly: true })
    void sendMatchCommand(activeMatchState.id, "point", { team }, { clientId: "score-board" }).then(
      selfHealOnFailure,
    )
  }

  /**
   * Самолечение потерянной команды (фикс 2026-09-04 №2): если point-команда
   * упала (сеть/5xx/400), очко существует только в оптимистике — сервер
   * никогда его не узнает, а на других экранах счёт «не всегда меняется».
   * Пушим текущий локальный снапшот через sync-очередь: revision-guard на
   * PUT сам разрулит конкуренцию, сервер сойдётся с тем, что видит оператор.
   */
  const selfHealOnFailure = (res: SendCommandResult) => {
    if (res.status === "failed" && latestMatchRef.current && !latestMatchRef.current.isCompleted) {
      syncMatchToServer(latestMatchRef.current)
    }
    reconcileOnConflict(res)
  }

  /**
   * 409-реконсиляция (§99): сервер опередил нашу оптимистику — его снапшот
   * авторитетен. Переписываем локальное состояние (localOnly: снапшот-пуш
   * мёртв под RLS Шага 3 и только забивает sync-очередь). Редкий путь:
   * sendMatchCommand сам ретраит 409 — сюда попадаем только при упорном
   * параллельном писателе.
   */
  const reconcileOnConflict = (res: SendCommandResult) => {
    if (res.status === "conflict" && res.match) {
      latestMatchRef.current = res.match
      setLocalMatchState(res.match)
      void updateMatch(res.match, { localOnly: true })
    }
  }

  // Обработчик уменьшения счета
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleScoreDecrease = (team: any) => {
    const activeMatchState = latestMatchRef.current || displayMatch
    if (!updateMatch || activeMatchState.isCompleted) {
      console.log("Cannot update: updateMatch function missing or match completed")
      return
    }

    // Set which team is being processed for visual feedback
    setProcessingTeam(team)
    setTimeout(() => {
      setProcessingTeam(null)
    }, 100)

    // Save the current match state before any changes
    const previousState = JSON.parse(JSON.stringify(activeMatchState))
    // Save to history
    setMatchHistory((prev) => [...prev, previousState])

    // Deep copy to avoid mutating state
    const updatedMatch = JSON.parse(JSON.stringify(activeMatchState))

    const currentSet = updatedMatch.score.currentSet
    const currentGame = currentSet.currentGame
    let scoreDecreased = false

    if (currentSet.isTiebreak) {
      if (currentGame[team] > 0) {
        currentGame[team]--
        scoreDecreased = true
      }
    } else {
      const currentScore = currentGame[team]

      if (currentScore > 0) {
        switch (currentScore) {
          case 15:
            currentGame[team] = 0
            scoreDecreased = true
            break
          case 30:
            currentGame[team] = 15
            scoreDecreased = true
            break
          case 40:
            currentGame[team] = 30
            scoreDecreased = true
            break
        }
      } else if (currentScore === "Ad") {
        currentGame[team] = 40
        scoreDecreased = true
      }
    }

    if (scoreDecreased) {
      // Journal the manual correction so replay-undo stays in sync.
      const journaled = appendStateOverrideEvent(updatedMatch, "score-decrease", scoreStateOf(activeMatchState))
      // Ревизию бампит useMatch.updateMatch — без ручного бампа (иначе
      // двойной +1 за клик уводит страницу впереди сервера навсегда).
      latestMatchRef.current = journaled
      setLocalMatchState(journaled)

      // Шаг 3 (§99): вне тайбрейка коррекция уходит командой adjust-game
      // (абсолютные индексы очков). В тайбрейке adjust-game не принимает
      // числа > 3 — редкий путь остаётся на снапшоте.
      if (!currentSet.isTiebreak) {
        const toIndex = (v: unknown): 0 | 1 | 2 | 3 | "Ad" =>
          v === "Ad" ? "Ad" : v === 40 ? 3 : v === 30 ? 2 : v === 15 ? 1 : 0
        updateMatch(journaled, { localOnly: true })
        void sendMatchCommand(
          activeMatchState.id,
          "adjust-game",
          { teamA: toIndex(journaled.score.currentSet.currentGame.teamA), teamB: toIndex(journaled.score.currentSet.currentGame.teamB) },
          { clientId: "score-board" },
        ).then(reconcileOnConflict)
      } else {
        updateMatch(journaled)
      }
    }
  }

  // ─── Journal-based undo (survives page reloads) ─────────────────────────────
  // Integrity is verified at click time: a diverged journal never produces a
  // wrong state — the button reports unavailability instead.

  const flashUndoNotice = () => {
    setUndoNotice(true)
    setTimeout(() => setUndoNotice(false), 5000)
  }

  // Applies an undo result the same way handleScoreClick applies a point:
  // bump the revision above the live one (a replayed match carries the SEED's
  // revision, which the optimistic-state guard would reject as stale) and
  // refresh the optimistic layer so the scoreboard updates immediately.
  const applyUndoneMatch = (undone: any, viaCommand = false) => {
    // База — самый свежий оптимистичный стейт (ref), а не опоздавший prop:
    // replay-снапшот несёт ревизию Сида (ниже live) — выравниваем на live,
    // единственный +1 добавит useMatch.updateMatch. Ручной +1 сверх того
    // (как раньше) накапливал отставание сервера и навсегда закрывал
    // ревизионный гард для чужих обновлений (фикс 2026-09-04 №2).
    const base = latestMatchRef.current ?? match
    const liveRev = typeof base?.revision === "number" ? base.revision : 0
    undone.revision = liveRev
    latestMatchRef.current = undone
    setLocalMatchState(undone)
    // Шаг 3 (§99): undo с рабочим журналом уходит командой (localOnly);
    // fallback-ветка (снапшот из истории) остаётся снапшот-пушем.
    updateMatch(undone, { localOnly: viaCommand })
    if (viaCommand) {
      void sendMatchCommand(undone.id, "undo-point", {}, { clientId: "score-board" }).then(reconcileOnConflict)
    }
  }

  const handleUndoPoint = () => {
    setUndoNotice(false)
    if (verifyJournal(match).canUndo) {
      applyUndoneMatch(undoLastScoringEvent(match), true)
      // Keep the in-memory fallback stack roughly in sync with the rollback.
      setMatchHistory((prev) => prev.slice(0, -1))
    } else if (matchHistory.length > 0) {
      // Journal not usable — fall back to the session snapshot stack.
      applyUndoneMatch(matchHistory[matchHistory.length - 1])
      setMatchHistory((prev) => prev.slice(0, -1))
    } else {
      flashUndoNotice()
    }
  }

  const handleCompleteMatch = () => {
    if (pendingMatchUpdate) {
      const finalMatch = { ...pendingMatchUpdate }
      finalMatch.isCompleted = true
      finalMatch.winner = pendingMatchUpdate.winner

      // Фикс 2026-09-04: снапшот-пуш больше не сохраняет матч на сервере
      // (RLS Шага 3 закрыл anon-UPDATE на matches) — локально как раньше,
      // а на сервер завершение уходит КОМАНДОЙ конвейера.
      updateMatch(appendStateOverrideEvent(finalMatch, "complete-match", scoreStateOf(match)), { localOnly: true })
      void sendMatchCommand(finalMatch.id, "finish", {}, { clientId: "score-board" }).then(reconcileOnConflict)

      // Task 16: fire-and-forget auto-post when configured. The orchestrator
      // returns a new snapshot with the result-poster event appended; we
      // updateMatch again with that audit trail. Failures live in the event
      // payload (outcome=dead-letter) — we never throw at the operator.
      postResultIfConfigured(finalMatch)
        .then((withAudit) => {
          if (withAudit !== finalMatch) updateMatch(withAudit, { localOnly: true })
        })
        .catch(() => {
          /* network errors are already captured in postWithRetry — ignore */
        })

      setPendingMatchUpdate(null)
      setPreviousMatchState(null)
    }

    setShowMatchEndDialog(false)
  }

  const handleCancelMatchCompletion = () => {
    // Revert to the previous state if available (journaled — the restored
    // snapshot carries the events that produced it, so the journal stays
    // replayable).
    if (previousMatchState) {
      // Финальное очко уже завершило матч НА СЕРВЕРЕ (point-команда ушла до
      // диалога) — отмена обязана вернуть его в игру КОМАНДОЙ unlock-match,
      // иначе снапшот-пуш (мёртв под RLS) ничего не меняет и realtime-эхо
      // тут же «завершает» матч обратно (фикс 2026-09-04).
      const restored = appendStateOverrideEvent(previousMatchState, "cancel-completion", scoreStateOf(match))
      const baseRev = typeof latestMatchRef.current?.revision === "number" ? latestMatchRef.current.revision : 0
      restored.revision = baseRev + 1
      latestMatchRef.current = restored
      setLocalMatchState(restored)
      updateMatch(restored, { localOnly: true })

      // Сначала ждём финальную point-команду (она завершает матч на
      // сервере), затем unlock; после ACK — контрольный unlock: если point
      // прилетел ПОСЛЕ первого unlock, он завершил матч повторно, и второй
      // unlock это чинит. unlock-match идемпотентен (no-op на активном).
      const finalPoint = finalPointInFlightRef.current
      const unlock = () =>
        sendMatchCommand(restored.id, "unlock-match", {}, { clientId: "score-board" })
      void (finalPoint ? finalPoint.catch(() => {}) : Promise.resolve())
        .then(unlock)
        .then(async (res) => {
          if (res.status === "ok") {
            await unlock().then(reconcileOnConflict)
          } else {
            reconcileOnConflict(res)
          }
        })
        .catch(() => {})
      finalPointInFlightRef.current = null
    }

    // Reset the pending state
    setPendingMatchUpdate(null)
    setPreviousMatchState(null)

    // Close the dialog
    setShowMatchEndDialog(false)
  }

  // Stage 3 / B4: switchServer теперь единый — импортируется из движка.

  // Текст важного события — из общего проектора lib/match-view.
  const getImportantEventText = () => getImportantEventType(match, t("matchPage.matchIsOver"))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isServing = (team: any, playerIndex: any) => isPlayerServing(match, team, playerIndex)

  // Stage 2: сторона подачи берётся из общего проектора (lib/match-view).
  const getServeSide = () => getServeSideView(match)

  const manualSwitchServer = () => {
    if (!updateMatch || match.isCompleted) return

    // Save the current match state before any changes
    const previousState = JSON.parse(JSON.stringify(match))
    // Save to history
    setMatchHistory((prev) => [...prev, previousState])

    // Create a copy of the match
    const updatedMatch = { ...match }

    // Switch server
    switchServer(updatedMatch)

    // Update match (§99): команда set-server, снапшот — локально
    updateMatch(updatedMatch, { localOnly: true })
    void sendMatchCommand(
      match.id,
      "set-server",
      { team: updatedMatch.currentServer.team, playerIndex: updatedMatch.currentServer.playerIndex },
      { clientId: "score-board" },
    ).then(reconcileOnConflict)
  }

  const manualSwitchSides = () => {
    if (!updateMatch || match.isCompleted) return

    // Save the current match state before any changes
    const previousState = JSON.parse(JSON.stringify(match))
    // Save to history
    setMatchHistory((prev) => [...prev, previousState])

    // Create a copy of the match
    const updatedMatch = { ...match }

    // Switch sides
    updatedMatch.courtSides = swapCourtSides(updatedMatch.courtSides)

    // Update match (§99): команда switch-sides, снапшот — локально
    updateMatch(updatedMatch, { localOnly: true })
    void sendMatchCommand(match.id, "switch-sides", {}, { clientId: "score-board" }).then(
      reconcileOnConflict,
    )
  }

  // Stage 2: текущий счёт гейма берётся из общего проектора (lib/match-view),
  // чтобы scoreboard и JSON всегда показывали одно и то же.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCurrentGameScore = (team: any) => getGameScoreDisplay(displayMatch, team)

  // Определяем общее количество сетов в матче
  const totalSets = match.settings.sets
  const currentSetIndex = match.score.sets.length
  // B5 fix: после завершения матча показываем номер последнего сыгранного сета,
  // а не несуществующий следующий.
  const displaySetNumber = match.isCompleted ? Math.max(1, currentSetIndex) : currentSetIndex + 1

  // Создаем массив всех сетов (включая будущие)
  const allSets = []

  // Добавляем прошедшие сеты
  for (let i = 0; i < match.score.sets.length; i++) {
    allSets.push(match.score.sets[i])
  }

  // Добавляем текущий сет, если матч не завершен
  if (!match.isCompleted && currentSet) {
    allSets.push({
      teamA: currentSet.teamA,
      teamB: currentSet.teamB,
      isCurrent: true,
    })
  }

  // Добавляем будущие сеты
  while (allSets.length < totalSets) {
    allSets.push({ teamA: "-", teamB: "-", isFuture: true })
  }

  return (
    <>
      <AlertDialog open={showMatchEndDialog} onOpenChange={setShowMatchEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("match.finishMatch")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMatchUpdate &&
                t("match.teamWonMatch").replace(
                  "{team}",
                  pendingMatchUpdate.winner === "teamA"
                    ? pendingMatchUpdate.teamA.players.map((p: any) => p.name).join(" & ")
                    : pendingMatchUpdate.teamB.players.map((p: any) => p.name).join(" & ")
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelMatchCompletion}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelMatchCompletion}>{t("common.continue")}</AlertDialogAction>
            <AlertDialogAction onClick={handleCompleteMatch}>{t("match.finishMatch")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-center mb-4 w-full">
        <Tabs
          defaultValue={fixedSides ? "sides" : "players"}
          value={fixedSides ? "sides" : "players"}
          onValueChange={(value) => {
            const newValue = value === "sides"
            setFixedSides(newValue)
            // Генерируем пользовательское событие для синхронизации с другими компонентами
            const event = new CustomEvent("fixedSidesChanged", {
              detail: { value: newValue },
            })
            window.dispatchEvent(event)
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 bg-[#f5fef3] shadow-md">
            <TabsTrigger
              value="sides"
              className="data-[state=active]:bg-[#c5f87e] data-[state=inactive]:bg-[#f5fef3] flex items-center justify-center gap-1 px-3 py-1 text-xs sm:text-sm"
            >
              {fixedSides && <CircleDot className="h-3 w-3 text-green-700" />}
              {t("match.fixedSides")}
            </TabsTrigger>
            <TabsTrigger
              value="players"
              className="data-[state=active]:bg-[#c5f87e] data-[state=inactive]:bg-[#f5fef3] flex items-center justify-center gap-1 px-3 py-1 text-xs sm:text-sm"
            >
              {!fixedSides && <CircleDot className="h-3 w-3 text-green-700" />}
              {t("match.fixedPlayers")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-0 items-center w-full">
        <div className="text-right space-y-1 pr-3 border-r border-gray-200">
          {fixedSides && <div className="text-sm text-muted-foreground mb-1 text-right">{t("match.leftSide")}</div>}
          {!fixedSides && (
            <div className="text-xs text-green-600 font-medium">
              {match.courtSides?.teamA === "left" ? t("match.leftSide") : t("match.rightSide")}
            </div>
          )}
          {fixedSides
            ? match.courtSides?.teamA === "left"
              ? // Команда A на левой стороне
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              teamA.players.map((player: any, idx: any) => {
                // Учитываем смену игроков
                const actualIdx = swappedTeamA ? (idx === 0 ? 1 : 0) : idx
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-end w-full ${isServing("teamA", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                  >
                    {isServing("teamA", actualIdx) && (
                      <Badge
                        variant="outline"
                        className="mr-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                        style={{ width: "14.4px", height: "14.4px" }}
                      >
                        <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                      </Badge>
                    )}
                    <div className="w-full overflow-hidden max-w-full">
                      <p className="font-medium text-right truncate text-[10px] sm:text-[14px] md:text-[16px]">
                        {teamA.players[actualIdx].name}
                      </p>
                    </div>
                  </div>
                )
              })
              : // Команда B на левой стороне
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              teamB.players.map((player: any, idx: any) => {
                // Учитываем смену игроков
                const actualIdx = swappedTeamB ? (idx === 0 ? 1 : 0) : idx
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-end w-full ${isServing("teamB", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                  >
                    {isServing("teamB", actualIdx) && (
                      <Badge
                        variant="outline"
                        className="mr-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                        style={{ width: "14.4px", height: "14.4px" }}
                      >
                        <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                      </Badge>
                    )}
                    <div className="w-full overflow-hidden max-w-full">
                      <p className="font-medium text-right truncate text-[10px] sm:text-[14px] md:text-[16px]">
                        {teamB.players[actualIdx].name}
                      </p>
                    </div>
                  </div>
                )
              })
            : // Fixed players mode - always show Team A on left
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            teamA.players.map((player: any, idx: any) => {
              // Учитываем смену игроков
              const actualIdx = swappedTeamA ? (idx === 0 ? 1 : 0) : idx
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-end w-full ${isServing("teamA", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                >
                  {isServing("teamA", actualIdx) && (
                    <Badge
                      variant="outline"
                      className="mr-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                      style={{ width: "14.4px", height: "14.4px" }}
                    >
                      <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                    </Badge>
                  )}
                  <div className="w-full overflow-hidden max-w-full">
                    <p className="font-medium text-right truncate text-[10px] sm:text-[14px] md:text-[16px]">
                      {teamA.players[actualIdx].name}
                    </p>
                  </div>
                </div>
              )
            })}
        </div>
        <div className="text-left space-y-1 pl-3">
          {fixedSides && <div className="text-sm text-muted-foreground mb-1 text-left">{t("match.rightSide")}</div>}
          {!fixedSides && (
            <div className="text-xs text-green-600 font-medium">
              {match.courtSides?.teamB === "left" ? t("match.leftSide") : t("match.rightSide")}
            </div>
          )}
          {fixedSides
            ? match.courtSides?.teamA === "right"
              ? // Команда A на правой стороне
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              teamA.players.map((player: any, idx: any) => {
                // Учитываем смену игроков
                const actualIdx = swappedTeamA ? (idx === 0 ? 1 : 0) : idx
                return (
                  <div
                    key={idx}
                    className={`flex items-center w-full ${isServing("teamA", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                  >
                    <div className="w-full overflow-hidden max-w-full">
                      <p className="font-medium text-left truncate text-[10px] sm:text-[14px] md:text-[16px]">
                        {teamA.players[actualIdx].name}
                      </p>
                    </div>
                    {isServing("teamA", actualIdx) && (
                      <Badge
                        variant="outline"
                        className="ml-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                        style={{ width: "14.4px", height: "14.4px" }}
                      >
                        <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                      </Badge>
                    )}
                  </div>
                )
              })
              : // Команда B на правой стороне
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              teamB.players.map((player: any, idx: any) => {
                // Учитываем смену игроков
                const actualIdx = swappedTeamB ? (idx === 0 ? 1 : 0) : idx
                return (
                  <div
                    key={idx}
                    className={`flex items-center w-full ${isServing("teamB", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                  >
                    <div className="w-full overflow-hidden max-w-full">
                      <p className="font-medium text-left truncate text-[10px] sm:text-[14px] md:text-[16px]">
                        {teamB.players[actualIdx].name}
                      </p>
                    </div>
                    {isServing("teamB", actualIdx) && (
                      <Badge
                        variant="outline"
                        className="ml-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                        style={{ width: "14.4px", height: "14.4px" }}
                      >
                        <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                      </Badge>
                    )}
                  </div>
                )
              })
            : // Fixed players mode - always show Team B on right
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            teamB.players.map((player: any, idx: any) => {
              // Учитываем смену игроков
              const actualIdx = swappedTeamB ? (idx === 0 ? 1 : 0) : idx
              return (
                <div
                  key={idx}
                  className={`flex items-center w-full ${isServing("teamB", actualIdx) ? "bg-lime-100 rounded-md" : ""}`}
                >
                  <div className="w-full overflow-hidden max-w-full">
                    <p className="font-medium text-left truncate text-[10px] sm:text-[14px] md:text-[16px]">
                      {teamB.players[actualIdx].name}
                    </p>
                  </div>
                  {isServing("teamB", actualIdx) && (
                    <Badge
                      variant="outline"
                      className="ml-2 rounded-full bg-lime-400 border-lime-600 p-0 flex items-center justify-center flex-shrink-0"
                      style={{ width: "14.4px", height: "14.4px" }}
                    >
                      <span className="text-[10.88px] font-bold text-lime-800">{getServeSide()}</span>
                    </Badge>
                  )}
                </div>
              )
            })}
        </div>
      </div>

      <Card>
        <CardContent className="p-3 shadow-md rounded-lg">
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="text-center flex flex-col items-center gap-2">
              <button
                className={`text-6xl font-bold px-8 py-4 rounded-md transition-all transform active:scale-95 active:translate-y-1 active:shadow-inner shadow-md scale-110 ${processingTeam === (fixedSides ? (displayMatch.courtSides?.teamA === "left" ? "teamA" : "teamB") : "teamA")
                  ? "bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse opacity-75"
                  : currentSet.isTiebreak
                    ? "bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 active:from-red-200 active:to-red-300"
                    : "bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 active:from-blue-200 active:to-blue-300"
                  }`}
                onClick={() =>
                  handleScoreClick(fixedSides ? (displayMatch.courtSides?.teamA === "left" ? "teamA" : "teamB") : "teamA")
                }
              >
                {fixedSides
                  ? match.courtSides?.teamA === "left"
                    ? getCurrentGameScore("teamA")
                    : getCurrentGameScore("teamB")
                  : getCurrentGameScore("teamA")}
              </button>
              <button
                className={`text-sm font-medium px-4 py-1 rounded-md transition-all transform active:scale-95 shadow-sm bg-red-100 hover:bg-red-200 active:bg-red-300`}
                onClick={() =>
                  handleScoreDecrease(fixedSides ? (displayMatch.courtSides?.teamA === "left" ? "teamA" : "teamB") : "teamA")
                }
              >
                -1
              </button>
            </div>
            <div className="text-center flex flex-col items-center gap-2">
              <button
                className={`text-6xl font-bold px-8 py-4 rounded-md transition-all transform active:scale-95 active:translate-y-1 active:shadow-inner shadow-md scale-110 ${processingTeam === (fixedSides ? (displayMatch.courtSides?.teamA === "right" ? "teamA" : "teamB") : "teamB")
                  ? "bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse opacity-75"
                  : currentSet.isTiebreak
                    ? "bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 active:from-red-200 active:to-red-300"
                    : "bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 active:from-blue-200 active:to-blue-300"
                  }`}
                onClick={() =>
                  handleScoreClick(fixedSides ? (displayMatch.courtSides?.teamA === "right" ? "teamA" : "teamB") : "teamB")
                }
              >
                {fixedSides
                  ? match.courtSides?.teamA === "right"
                    ? getCurrentGameScore("teamA")
                    : getCurrentGameScore("teamB")
                  : getCurrentGameScore("teamB")}
              </button>
              <button
                className={`text-sm font-medium px-4 py-1 rounded-md transition-all transform active:scale-95 shadow-sm bg-red-100 hover:bg-red-200 active:bg-red-300`}
                onClick={() =>
                  handleScoreDecrease(fixedSides ? (displayMatch.courtSides?.teamA === "right" ? "teamA" : "teamB") : "teamB")
                }
              >
                -1
              </button>
            </div>
          </div>

          {/* Кнопки отмены: очко / гейм / сет (журнал + fallback на снапшоты сессии) */}
          <div className="mt-4">
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 px-2 bg-gradient-to-br from-blue-800 to-blue-950 hover:from-blue-700 hover:to-blue-900 active:from-blue-600 active:to-blue-800 text-white border border-blue-700 rounded-md text-sm font-medium flex items-center justify-center transition-all shadow-md transform active:scale-95 active:translate-y-1 active:shadow-inner disabled:opacity-50 disabled:pointer-events-none"
                onClick={handleUndoPoint}
                disabled={!hasUndoableJournal && matchHistory.length === 0}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1"
                >
                  <path d="M3 7v6h6"></path>
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
                </svg>
                {t("match.undoPoint")}
              </button>
            </div>
            {undoNotice && (
              <p className="mt-2 text-xs text-amber-600 text-center">{t("match.undoUnavailable")}</p>
            )}

            {/* Индикатор важных событий */}
            {getImportantEventText() && (
              <div
                className="mt-2 py-0.5 px-2 bg-red-700 text-white font-bold text-center rounded-md shadow-md text-[9px]"
                style={{
                  opacity: getImportantEventText() ? 1 : 0,
                  transition: "opacity 0.3s ease",
                }}
              >
                {getImportantEventText()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
        <div className="text-center">
          <span className="text-xl font-bold">
            {fixedSides ? (match.courtSides?.teamA === "left" ? currentSet.teamA : currentSet.teamB) : currentSet.teamA}
            {match.isCompleted &&
              match.winner === (fixedSides ? (match.courtSides?.teamA === "left" ? "teamA" : "teamB") : "teamA") && (
                <Trophy size={20} className="ml-1 text-yellow-500 inline-block" />
              )}
          </span>
        </div>
        <div className="text-center text-muted-foreground">
          {`${t("match.set")} ${displaySetNumber} ${t("match.of")} ${totalSets}`}
          {currentSet.isTiebreak && currentSet.isSuperTiebreak && (
            <span className="ml-2 text-red-600 font-medium">{t("matchPage.finalTiebreak")}</span>
          )}
        </div>
        <div className="text-center">
          <span className="text-xl font-bold">
            {fixedSides
              ? match.courtSides?.teamA === "right"
                ? currentSet.teamA
                : currentSet.teamB
              : currentSet.teamB}
            {match.isCompleted &&
              match.winner === (fixedSides ? (match.courtSides?.teamA === "right" ? "teamA" : "teamB") : "teamB") && (
                <Trophy size={20} className="ml-1 text-yellow-500 inline-block" />
              )}
          </span>
        </div>
      </div>

      {allSets.length > 0 && (
        <div className="mt-2">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-sm leading-tight">
            <div></div>
            <div className="text-center">
              <div className="font-medium -mt-1 mb-0">{t("match.teamA")}</div>
              <div className="flex h-full w-full flex-col justify-around py-1">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {teamA.players.map((player: any, idx: any) => (
                  <div key={idx} className="flex h-1/2 w-full items-center text-xs text-gray-500 truncate">
                    {player.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium -mt-1 mb-0">{t("match.teamB")}</div>
              <div className="flex h-full w-full flex-col justify-around py-1">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {teamB.players.map((player: any, idx: any) => (
                  <div key={idx} className="flex h-1/2 w-full items-center text-xs text-gray-500 truncate">
                    {player.name}
                  </div>
                ))}
              </div>
            </div>

            {allSets.map((set, index) => {
              // Skip rendering the current set if the match is completed
              if (match.isCompleted && set.isCurrent) {
                return null
              }

              return (
                <div key={index} className="contents">
                  <div className="font-medium flex items-center">
                    {t("match.setX").replace("{{number}}", (index + 1).toString())}
                    {set.isCurrent && (
                      <Badge variant="outline" className="ml-1 bg-blue-100 text-blue-800 text-[10px] px-1 py-0">
                        {t("match.current")}
                      </Badge>
                    )}
                  </div>
                  <div className={`text-center ${set.isFuture ? "text-muted-foreground" : ""}`}>{set.teamA}</div>
                  <div className={`text-center ${set.isFuture ? "text-muted-foreground" : ""}`}>{set.teamB}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
