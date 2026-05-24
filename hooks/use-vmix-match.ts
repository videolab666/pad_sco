"use client"

// useVmixMatch — match loading + realtime subscription for the vMix display
// screens (Этап E of vmix-scoreboard-unification.md).
//
// It removes the duplicated load/subscribe code that /court-vmix/[number] and
// /vmix/[id] each carried. The fullscreen scoreboard keeps its own loader: it
// is an interactive scoring surface (it writes the match, guards on revision,
// preserves a local "completed" state), so a read-only display hook is a poor
// fit for it.

import { useState, useEffect, useRef } from "react"
import { getMatchByCourtNumber } from "@/lib/court-utils"
import { isMatchOnCourt } from "@/lib/court-match-guard"
import { getMatch, subscribeToMatchUpdates } from "@/lib/match-storage"
import { logEvent } from "@/lib/error-logger"
import { decompressFromUTF16 } from "lz-string"

/** Where a vMix screen gets its match from: a court number or a match id. */
export type VmixMatchSource =
  | { kind: "court"; courtNumber: number }
  | { kind: "id"; id: string }

export interface VmixMatchState {
  match: any
  loading: boolean
  error: string
}

const safeParseJSON = (data: string | null) => {
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/** Reads a localStorage value, transparently handling lz-string compression. */
function safeGetLocalStorageItem(key: string) {
  try {
    const item = localStorage.getItem(key)
    if (!item) return null
    try {
      const parsed = safeParseJSON(decompressFromUTF16(item))
      if (parsed) return parsed
    } catch {
      /* not compressed — fall through to plain JSON */
    }
    return safeParseJSON(item)
  } catch (error) {
    logEvent("error", `vMix: localStorage read failed: ${key}`, "use-vmix-match", error)
    return null
  }
}

/** Loads a match for a given id — localStorage first (direct key, then the
 *  shared list), then the storage layer. Mirrors the old /vmix/[id] loader. */
async function loadMatchById(id: string): Promise<any> {
  if (typeof window !== "undefined" && window.localStorage) {
    const direct = safeGetLocalStorageItem(`match_${id}`)
    if (direct) return direct
    const list = safeGetLocalStorageItem("tennis_padel_matches")
    if (Array.isArray(list)) {
      const found = list.find((m: any) => m.id === id)
      if (found) return found
    }
  }
  return getMatch(id)
}

/**
 * Loads a vMix match and keeps it live: an initial fetch, a realtime
 * subscription to score updates, and — for the court source — a 10-second
 * poll that swaps in a new match when one appears on the court (or clears the
 * board when the match leaves it).
 */
export function useVmixMatch(source: VmixMatchSource): VmixMatchState {
  const isCourt = source.kind === "court"
  const courtNumber = isCourt ? source.courtNumber : null
  const id = !isCourt ? source.id : null

  const [match, setMatch] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Current match id, kept in a ref so the court poll can compare without
  // re-subscribing every time the match object changes.
  const matchIdRef = useRef<string | null>(null)
  useEffect(() => {
    matchIdRef.current = match?.id ?? null
  }, [match?.id])

  // Initial load (+ court polling).
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        if (isCourt) {
          if (courtNumber == null || isNaN(courtNumber) || courtNumber < 1 || courtNumber > 10) {
            if (!cancelled) setError("Некорректный номер корта")
            return
          }
          const data = await getMatchByCourtNumber(courtNumber)
          if (cancelled) return
          if (data) {
            setMatch(data)
            setError("")
          } else {
            setError(`На корте ${courtNumber} нет активных матчей`)
          }
        } else {
          if (!id) {
            if (!cancelled) setError("Некорректный ID матча")
            return
          }
          const data = await loadMatchById(id)
          if (cancelled) return
          if (data) {
            setMatch(data)
            setError("")
          } else {
            setError("Матч не найден")
          }
        }
      } catch (err) {
        if (!cancelled) setError("Ошибка загрузки матча")
        logEvent("error", "vMix: ошибка загрузки матча", "use-vmix-match", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    // The court source polls for a fresh match (a court can change matches).
    if (isCourt && courtNumber != null) {
      const interval = setInterval(async () => {
        try {
          const fresh = await getMatchByCourtNumber(courtNumber)
          if (cancelled) return
          if (!fresh) {
            if (matchIdRef.current) {
              setMatch(null)
              setError(`На корте ${courtNumber} нет активных матчей`)
            }
            return
          }
          if (fresh.id !== matchIdRef.current) {
            setMatch(fresh)
            setError("")
          }
        } catch (err) {
          console.error("vMix: ошибка при проверке матча на корте:", err)
        }
      }, 10000)
      return () => {
        cancelled = true
        clearInterval(interval)
      }
    }

    return () => {
      cancelled = true
    }
  }, [isCourt, courtNumber, id])

  // Realtime subscription to the current match.
  useEffect(() => {
    if (!match?.id) return
    const unsubscribe = subscribeToMatchUpdates(match.id, (updatedMatch: any) => {
      if (!updatedMatch) return
      if (isCourt && courtNumber != null && !isMatchOnCourt(updatedMatch, courtNumber)) {
        setMatch(null)
        setError(`На корте ${courtNumber} нет активных матчей`)
        return
      }
      setMatch(updatedMatch)
      setError("")
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [isCourt, courtNumber, match?.id])

  return { match, loading, error }
}
