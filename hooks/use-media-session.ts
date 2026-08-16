"use client"

// Media (ads) session for a scoreboard screen. Polls the public
// GET /api/media/state?court=N every 10 s (the server runs the trigger
// reducer there), follows media_state over Realtime for instant manual
// starts, and hides locally the moment a score change / new match / loop
// limit says so — without waiting for the next poll. Local hides are sticky
// per session (keyed by startedAt) so the overlay never flickers back until
// the server actually flips the session.

import { useCallback, useEffect, useRef, useState } from "react"
import { createClientSupabaseClient } from "@/lib/supabase"
import { logEvent } from "@/lib/error-logger"
import type { MediaTriggers } from "@/lib/media-core"

const POLL_MS = 10_000

export interface MediaEntryWire {
  id: string
  title: string
  kind: "image" | "video"
  url: string
  /** Blurred backdrop for vertical videos (photo or same-video). */
  bgUrl?: string | null
  durationSec: number
  isBumper: boolean
  width: number | null
  height: number | null
}

interface StateResponse {
  court: number
  isPlaying: boolean
  source: string | null
  startedAt: number | null
  triggers: MediaTriggers | null
  entries: MediaEntryWire[]
}

/** Everything visible about the court that the stop conditions react to. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function matchFingerprint(match: any): string {
  if (!match) return "none"
  const s = match.score ?? {}
  return [
    match.id ?? "",
    match.isCompleted ? "Y" : "N",
    (s.sets ?? []).length,
    s.currentSet?.teamA ?? 0,
    s.currentSet?.teamB ?? 0,
    JSON.stringify(s.currentSet?.currentGame ?? null),
  ].join("|")
}

export function useMediaSession(courtNumber: number, // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any,
) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [source, setSource] = useState<string | null>(null)
  const [entries, setEntries] = useState<MediaEntryWire[]>([])
  const [triggers, setTriggers] = useState<MediaTriggers | null>(null)

  // Sticky local stop: the startedAt of the session this screen killed itself.
  const hiddenForRef = useRef<number | null>(null)
  const stateRef = useRef<StateResponse | null>(null)
  const fingerprintRef = useRef<string>("init")

  const stopLocally = useCallback(() => {
    const startedAt = stateRef.current?.startedAt ?? null
    if (startedAt != null) {
      hiddenForRef.current = startedAt
      setIsPlaying(false)
      setEntries([])
    }
  }, [])

  const applyState = useCallback((data: StateResponse) => {
    const prev = stateRef.current
    stateRef.current = data

    // A new session (or a stop) clears the sticky local hide.
    if (hiddenForRef.current != null && (!data.isPlaying || data.startedAt !== hiddenForRef.current)) {
      hiddenForRef.current = null
    }

    const effective = data.isPlaying && data.startedAt !== hiddenForRef.current && data.entries.length > 0
    const changed =
      !prev ||
      prev.isPlaying !== data.isPlaying ||
      prev.source !== data.source ||
      prev.startedAt !== data.startedAt ||
      JSON.stringify(prev.entries) !== JSON.stringify(data.entries)

    if (changed || effective !== isPlaying) {
      setIsPlaying(effective)
      setSource(effective ? data.source : null)
      setEntries(effective ? data.entries : [])
    }
    if (data.triggers) setTriggers(data.triggers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/media/state?court=${courtNumber}`, { cache: "no-store" })
      if (!res.ok) return
      applyState(await res.json())
    } catch {
      /* offline → keep last state */
    }
  }, [courtNumber, applyState])

  // Poll + realtime subscription on media_state.
  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)

    const supabase = createClientSupabaseClient()
    let channel: unknown = null
    if (supabase?.channel) {
      channel = supabase
        .channel(`media-state-${courtNumber}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "media_state", filter: `court_number=eq.${courtNumber}` },
          () => refresh(),
        )
        .subscribe()
    }

    return () => {
      clearInterval(timer)
      // Same removal path as lib/match-storage.ts: channels are detached via
      // the client, not the channel object.
      if (channel) supabase.removeChannel(channel)
    }
  }, [courtNumber, refresh])

  // Instant reaction to score changes / match switches between polls.
  useEffect(() => {
    const fp = matchFingerprint(match)
    const prev = fingerprintRef.current
    fingerprintRef.current = fp
    if (prev === "init" || prev === fp) return

    const state = stateRef.current
    if (!state?.isPlaying || state.startedAt == null) return
    if (hiddenForRef.current === state.startedAt) return

    const t = state.triggers
    const newMatch = prev.split("|")[0] !== fp.split("|")[0] && fp !== "none"
    if ((t?.stopOnAnyScore !== false && !newMatch) || (t?.stopOnNewMatch !== false && newMatch)) {
      stopLocally()
      logEvent("info", `media: local stop on ${newMatch ? "new match" : "score change"}`, "use-media-session", {
        court: courtNumber,
      })
    }
  }, [match, stopLocally, courtNumber])

  return { isPlaying, source, entries, triggers, stopLocally, refresh }
}
