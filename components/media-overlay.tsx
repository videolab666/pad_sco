"use client"

// Full-screen ad layer for the scoreboard. Plays the playlist entries the
// server resolved (photos are timed, videos run muted end-to-end), weaves in
// nothing itself — bumpers already come expanded from the server. Vertical
// media on a horizontal screen gets a blurred, scaled backdrop (an assigned
// bg photo when present, otherwise the media itself). A compact score-bug
// strip keeps the live score readable while ads run.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMediaSession, type MediaEntryWire } from "@/hooks/use-media-session"

interface CourtMediaLayerProps {
  courtNumber: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
}

const isVertical = (e: MediaEntryWire) => !!e.width && !!e.height && e.height > e.width

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoreBug(courtNumber: number, match: any) {
  const names = (side: "teamA" | "teamB") =>
    Array.isArray(match?.[side])
      ? match[side]
          .map((p: any) => (typeof p === "string" ? p : p?.name) ?? "")
          .filter(Boolean)
          .join(" / ")
      : ""

  const sets = Array.isArray(match?.score?.sets) ? match.score.sets : []
  const setScores = sets.map((s: any) => `${s.teamA ?? 0}-${s.teamB ?? 0}`).join("  ")
  const game = match?.score?.currentSet?.currentGame
  const gameScore = game ? `${game.teamA ?? 0} : ${game.teamB ?? 0}` : ""

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center p-3">
      <div className="flex max-w-[95vw] items-center gap-4 rounded-xl bg-black/75 px-6 py-2.5 text-white shadow-lg backdrop-blur-sm">
        <span className="rounded-lg bg-white/15 px-3 py-1 text-xl font-bold">Корт {courtNumber}</span>
        {match ? (
          <span className="truncate text-lg font-semibold">
            {names("teamA")} <span className="text-white/60">vs</span> {names("teamB")}
          </span>
        ) : null}
        {match ? (
          <span className="shrink-0 text-2xl font-bold tabular-nums tracking-wider">
            {setScores} {gameScore && <span className="text-emerald-300">({gameScore})</span>}
          </span>
        ) : null}
        {match?.isCompleted ? <span className="shrink-0 text-lg text-amber-300">MATCH OVER</span> : null}
      </div>
    </div>
  )
}

function MediaEntryView({ entry, onEnded }: { entry: MediaEntryWire; onEnded: () => void }) {
  const vertical = isVertical(entry)
  // Blurred backdrop for vertical media: the assigned bg photo when present,
  // otherwise the media itself (a photo stays an <img>, a video a <video>).
  const backdrop = vertical ? (entry.bgUrl ?? null) : null

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {backdrop && <img src={backdrop} alt="" className="absolute inset-0 h-full w-full scale-[1.4] object-cover opacity-60 blur-3xl" aria-hidden />}
      {vertical && !backdrop && entry.kind === "video" && (
        <video
          src={entry.url}
          className="absolute inset-0 h-full w-full scale-[1.4] object-cover opacity-60 blur-3xl"
          muted
          autoPlay
          playsInline
          aria-hidden
        />
      )}
      {vertical && !backdrop && entry.kind === "image" && (
        <img src={entry.url} alt="" className="absolute inset-0 h-full w-full scale-[1.4] object-cover opacity-60 blur-3xl" aria-hidden />
      )}
      {entry.kind === "video" ? (
        <video
          key={entry.url}
          src={entry.url}
          className={`relative h-full w-full ${vertical ? "object-contain" : "object-cover"}`}
          muted
          autoPlay
          playsInline
          onEnded={onEnded}
          onError={onEnded}
        />
      ) : (
        <img
          key={entry.url}
          src={entry.url}
          alt={entry.title}
          className={`relative h-full w-full ${vertical ? "object-contain" : "object-cover"}`}
        />
      )}
    </div>
  )
}

export function CourtMediaLayer({ courtNumber, match }: CourtMediaLayerProps) {
  const { isPlaying, entries, triggers, stopLocally } = useMediaSession(courtNumber, match)
  const [index, setIndex] = useState(0)
  const [loops, setLoops] = useState(0)
  const sessionKey = useMemo(() => entries.map((e) => e.id).join(","), [entries])

  // New session content → start from the top.
  const sessionKeyRef = useRef("")
  useEffect(() => {
    if (sessionKeyRef.current !== sessionKey) {
      sessionKeyRef.current = sessionKey
      setIndex(0)
      setLoops(0)
    }
  }, [sessionKey])

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < entries.length) return i + 1
      const nextLoops = loops + 1
      const limit = triggers?.loopsLimit ?? 0
      if (limit > 0 && nextLoops >= limit) {
        stopLocally()
        return i
      }
      setLoops(nextLoops)
      return 0
    })
  }, [entries.length, loops, triggers?.loopsLimit, stopLocally])

  const current = entries[index]
  const visible = isPlaying && !!current

  // Photo timing.
  useEffect(() => {
    if (!visible || current.kind !== "image") return
    const t = setTimeout(advance, Math.max(1, current.durationSec) * 1000)
    return () => clearTimeout(t)
  }, [visible, current, advance])

  // Preload the next entry for a smooth switch.
  useEffect(() => {
    const next = entries[index + 1]
    if (!next) return
    if (next.kind === "image") {
      new Image().src = next.url
    }
  }, [entries, index])

  if (!visible) return null

  return (
    <div className="absolute inset-0 z-40 bg-black" aria-hidden={false}>
      <MediaEntryView entry={current} onEnded={advance} />
      {scoreBug(courtNumber, match)}
    </div>
  )
}
