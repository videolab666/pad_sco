"use client"

// C3 — single owner of the canonical match state.
//
// Encapsulates everything the match page used to do inline: initial load,
// realtime subscription, the `match-updated` window event, optimistic updates
// and the storage-quota fallback. Components consume `match` + `updateMatch`
// and never own a competing copy of the canonical state.

import { useCallback, useContext, useEffect, useRef, useState } from "react"
import {
  getMatch,
  subscribeToMatchUpdates,
  updateMatch as persistMatch,
} from "@/lib/match-storage"
import { LanguageContext } from "@/contexts/language-context"
import { translations } from "@/lib/translations"
import { getMatchDisplaySnapshot, syncMatchCommand } from "@/lib/match-sync"

export interface MatchUpdateOptions {
  localOnly?: boolean
  command?: string
  args?: Record<string, unknown>
  clientId?: string
}

export interface UseMatchResult {
  /** The canonical match, or null until the first load completes. */
  match: any
  loading: boolean
  /** A fatal error message (match not found, load failed, …). */
  error: string
  /** A soft, transient message (e.g. the storage-quota fallback fired). */
  notice: string
  /** Optimistically applies and persists a match update. */
  updateMatch: (updatedMatch: any, opts?: MatchUpdateOptions) => Promise<void>
}

export function useMatch(matchId: string): UseMatchResult {
  const languageContext = useContext(LanguageContext)
  const language = languageContext?.language || "ru"
  const t: any = translations[language as keyof typeof translations] || translations.ru

  const [match, setMatch] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const canonicalId = useRef(matchId)

  useEffect(() => {
    // Guards against a setState after the hook unmounts mid-load.
    let cancelled = false
    canonicalId.current = matchId

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
          canonicalId.current = matchData.id
          // Убедимся, что структура матча полная
          if (!matchData.score.sets) matchData.score.sets = []
          setMatch((prev: any) => prev?.revision > matchData.revision ? prev : matchData)
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
        const view = getMatchDisplaySnapshot(updatedMatch)

        // Failure mode #6: never let a late, stale snapshot overwrite a newer
        // local/optimistic state — ignore a payload whose revision is behind.
        setMatch((prev: any) => {
          // Pending commands are already projected over the server snapshot.
          if (
            prev &&
            typeof prev.revision === "number" &&
            typeof updatedMatch.revision === "number" &&
            view.revision < prev.revision
          ) {
            return prev
          }
          return view
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

    const handleAuthoritativeUpdate = (event: Event) => {
      const serverMatch = (event as CustomEvent)?.detail?.match
      if (!serverMatch || serverMatch.id !== canonicalId.current) return
      setMatch((prev: any) => {
        if (
          prev &&
          typeof prev.revision === "number" &&
          typeof serverMatch.revision === "number" &&
          serverMatch.revision < prev.revision
        ) {
          return prev
        }
        return serverMatch
      })
      void persistMatch(serverMatch, { localOnly: true })
      setError("")
    }
    window.addEventListener("match-authoritative-update", handleAuthoritativeUpdate)

    return () => {
      cancelled = true
      if (unsubscribe) unsubscribe()
      window.removeEventListener("match-updated", handleMatchUpdated)
      window.removeEventListener("match-authoritative-update", handleAuthoritativeUpdate)
    }
  }, [matchId, language])

  const updateMatch = useCallback(
    async (updatedMatch: any, opts?: MatchUpdateOptions) => {
      try {
        // Отключаем undo-историю для экономии места.
        updatedMatch.history = []
        // Only legacy snapshot writes carry a proposed revision. Commands keep
        // the authoritative revision until the server acknowledges them.
        const isCommand = typeof opts?.command === "string" && opts.command.length > 0
        if (!opts?.localOnly && !isCommand) {
          const prevRevision =
            typeof updatedMatch.revision === "number" ? updatedMatch.revision : 0
          updatedMatch.revision = prevRevision + 1
        }
        // Оптимистичное обновление — предотвращает мерцание.
        setMatch(updatedMatch)
        // Store the intent before the optional UI cache: a quota failure must
        // neither lose a point nor enqueue it twice in the fallback below.
        if (isCommand) {
          syncMatchCommand(updatedMatch, opts!.command!, opts?.args ?? {}, opts?.clientId ?? "match-page")
        }
        // Фикс 2026-09-04: opts раньше МОЛЧА отбрасывался — localOnly из
        // score-board не доходил до persistMatch, и каждый клик очков
        // дублировался снапшот-пушем поверх point-команды (лишние 409 и
        // гонки двух писателей).
        await persistMatch(updatedMatch, { localOnly: Boolean(opts?.localOnly || isCommand) })
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
          const isCommand = typeof opts?.command === "string" && opts.command.length > 0
          await persistMatch(minimalMatch, { localOnly: Boolean(opts?.localOnly || isCommand) })
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
