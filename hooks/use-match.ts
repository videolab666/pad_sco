"use client"

// C3 — single owner of the canonical match state.
//
// Encapsulates everything the match page used to do inline: initial load,
// realtime subscription, the `match-updated` window event, optimistic updates
// and the storage-quota fallback. Components consume `match` + `updateMatch`
// and never own a competing copy of the canonical state.

import { useCallback, useContext, useEffect, useState } from "react"
import {
  getMatch,
  subscribeToMatchUpdates,
  updateMatch as persistMatch,
} from "@/lib/match-storage"
import { LanguageContext } from "@/contexts/language-context"
import { translations } from "@/lib/translations"
import { getMatchSyncState } from "@/lib/match-sync"

export interface UseMatchResult {
  /** The canonical match, or null until the first load completes. */
  match: any
  loading: boolean
  /** A fatal error message (match not found, load failed, …). */
  error: string
  /** A soft, transient message (e.g. the storage-quota fallback fired). */
  notice: string
  /** Optimistically applies and persists a match update. */
  updateMatch: (updatedMatch: any) => Promise<void>
}

export function useMatch(matchId: string): UseMatchResult {
  const languageContext = useContext(LanguageContext)
  const language = languageContext?.language || "ru"
  const t: any = translations[language as keyof typeof translations] || translations.ru

  const [match, setMatch] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    // Guards against a setState after the hook unmounts mid-load.
    let cancelled = false

    const loadMatch = async () => {
      try {
        if (!matchId || matchId === "[object%20Promise]") {
          setError(t.matchPage.invalidMatchId)
          setLoading(false)
          return
        }

        const matchData = await getMatch(matchId)
        if (cancelled) return
        if (matchData) {
          // Убедимся, что структура матча полная
          if (!matchData.score.sets) matchData.score.sets = []
          setMatch(matchData)
          setError("")
        } else {
          setError(t.matchPage.matchNotFound)
        }
      } catch (err) {
        if (!cancelled) setError(t.matchPage.errorLoadingMatch)
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMatch()

    // Подписываемся на обновления матча в реальном времени.
    const unsubscribe = subscribeToMatchUpdates(matchId, (updatedMatch: any) => {
      if (updatedMatch) {
        // Загружаем состояние синхронизации (синхронно).
        let hasPendingOperations = false
        try {
          const syncState = getMatchSyncState(matchId)
          hasPendingOperations = syncState && syncState.pendingCount > 0
        } catch (e) {
          console.error("Ошибка при получении состояния синхронизации:", e)
        }

        // Failure mode #6: never let a late, stale snapshot overwrite a newer
        // local/optimistic state — ignore a payload whose revision is behind.
        setMatch((prev: any) => {
          // Игнорируем websocket-эхо, пока у нас есть свои локальные
          // (оптимистичные) операции в очереди (предотвращает мерцание).
          if (hasPendingOperations) return prev
          if (
            prev &&
            typeof prev.revision === "number" &&
            typeof updatedMatch.revision === "number" &&
            updatedMatch.revision <= prev.revision
          ) {
            return prev
          }
          return updatedMatch
        })
        setError("")
      } else {
        // Матч был удалён.
        setError(t.matchPage.matchNotFoundOrDeleted)
      }
    })

    // Событие match-updated → перезагрузка матча.
    const handleMatchUpdated = async (event: any) => {
      if (event.detail && event.detail.id === matchId) {
        const matchData = await getMatch(matchId)
        if (matchData) {
          setMatch((prev: any) => {
            if (
              prev &&
              typeof prev.revision === "number" &&
              typeof matchData.revision === "number" &&
              matchData.revision < prev.revision
            ) {
              return prev
            }
            return matchData
          })
          setError("")
        }
      }
    }

    window.addEventListener("match-updated", handleMatchUpdated)

    return () => {
      cancelled = true
      if (unsubscribe) unsubscribe()
      window.removeEventListener("match-updated", handleMatchUpdated)
    }
  }, [matchId, language])

  const updateMatch = useCallback(
    async (updatedMatch: any) => {
      try {
        // Отключаем undo-историю для экономии места.
        updatedMatch.history = []
        // Оптимистичное обновление — предотвращает мерцание.
        setMatch(updatedMatch)
        await persistMatch(updatedMatch)
      } catch (err) {
        console.error("Ошибка обновления матча:", err)
        // Storage-quota fallback: упрощаем объект матча и пробуем снова.
        try {
          const minimalMatch = { ...updatedMatch, history: [] }
          if (minimalMatch.score && minimalMatch.score.currentSet) {
            minimalMatch.score.currentSet.games = []
          }
          if (minimalMatch.score && minimalMatch.score.sets) {
            minimalMatch.score.sets = minimalMatch.score.sets.map((set: any) => ({
              teamA: set.teamA,
              teamB: set.teamB,
              winner: set.winner,
            }))
          }
          await persistMatch(minimalMatch)
          setMatch(minimalMatch)
          setNotice(t.matchPage.matchDataSimplified)
          // Авто-сброс, чтобы повторная ошибка снова поднимала уведомление.
          setTimeout(() => setNotice(""), 4000)
        } catch (innerErr) {
          console.error("Критическая ошибка обновления матча:", innerErr)
          setError(t.matchPage.matchUpdateFailed)
        }
      }
    },
    [t],
  )

  return { match, loading, error, notice, updateMatch }
}
