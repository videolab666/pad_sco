// Task 4 — Match timers (warmup / pause / injury / timeout).
//
// APK timer durations (seconds), mirrored as the web defaults:
//   warmup                       240
//   pause-before-first-game       60
//   pause-between-games          120
//   self-inflicted-injury        180
//   self-inflicted-blood-injury  300
//   contributed-injury           900
//   opponent-inflicted-injury    900
//   toweling-down                 60
//   timeout                       60
//
// Multi-device semantics: `activeTimer.startedAt` is the absolute ISO at which
// the timer started; `durationSec` is the configured length. Pause/resume add
// events with `at` markers so any device can reconstruct the elapsed time
// from the same source of truth.

import { appendMatchEvent } from "./match-events"
import type { MatchTimer, MatchTimerType, TeamKey } from "./types"
import { safeUuid } from "./utils/safe-uuid"

export const DEFAULT_TIMER_SECONDS: Record<MatchTimerType, number> = {
  warmup: 240,
  "pause-before-first-game": 60,
  "pause-between-games": 120,
  "self-inflicted-injury": 180,
  "self-inflicted-blood-injury": 300,
  "contributed-injury": 900,
  "opponent-inflicted-injury": 900,
  "toweling-down": 60,
  timeout: 60,
}

function ensureTiming(match: any): void {
  if (!match.timing || typeof match.timing !== "object") match.timing = { games: [] }
  if (!Array.isArray(match.timing.games)) match.timing.games = []
}

/** Resolve the configured duration for a timer type, with per-match override. */
export function getTimerDurationSec(match: any, type: MatchTimerType): number {
  const override = match?.settings?.timerSeconds?.[type]
  if (typeof override === "number" && Number.isFinite(override) && override > 0) return Math.floor(override)
  return DEFAULT_TIMER_SECONDS[type]
}

/** Start a new timer, replacing any active one. */
export function startMatchTimer(
  match: any,
  type: MatchTimerType,
  team?: TeamKey,
  now: Date = new Date(),
): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  ensureTiming(next)
  const timer: MatchTimer = {
    id: safeUuid(),
    type,
    team,
    startedAt: now.toISOString(),
    durationSec: getTimerDurationSec(next, type),
  }
  next.timing.activeTimer = timer
  return appendMatchEvent(next, {
    type: "timer",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    actor: team,
    payload: { action: "start", timerType: type, timerId: timer.id, durationSec: timer.durationSec },
    at: timer.startedAt,
  })
}

/**
 * Pause the active timer. Records remainingSec so the next resume can offset
 * `startedAt` without losing time across devices.
 */
export function pauseMatchTimer(match: any, now: Date = new Date()): any {
  const timer: MatchTimer | undefined = match?.timing?.activeTimer
  if (!timer || timer.pausedAt) return match
  const next = JSON.parse(JSON.stringify(match))
  const remaining = computeRemainingSec(timer, now)
  next.timing.activeTimer = {
    ...timer,
    pausedAt: now.toISOString(),
    remainingSec: remaining,
  }
  return appendMatchEvent(next, {
    type: "timer",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    payload: { action: "pause", timerId: timer.id, remainingSec: remaining },
    at: now.toISOString(),
  })
}

/** Resume a paused timer — rolls `startedAt` forward so remainingSec matches. */
export function resumeMatchTimer(match: any, now: Date = new Date()): any {
  const timer: MatchTimer | undefined = match?.timing?.activeTimer
  if (!timer?.pausedAt) return match
  const next = JSON.parse(JSON.stringify(match))
  const remaining = typeof timer.remainingSec === "number" ? timer.remainingSec : timer.durationSec
  next.timing.activeTimer = {
    ...timer,
    startedAt: new Date(now.getTime() - (timer.durationSec - remaining) * 1000).toISOString(),
    pausedAt: undefined,
    remainingSec: undefined,
  }
  return appendMatchEvent(next, {
    type: "timer",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    payload: { action: "resume", timerId: timer.id, remainingSec: remaining },
    at: now.toISOString(),
  })
}

/** Stop the active timer (either expired or cancelled). */
export function stopMatchTimer(match: any, now: Date = new Date()): any {
  const timer: MatchTimer | undefined = match?.timing?.activeTimer
  if (!timer) return match
  const next = JSON.parse(JSON.stringify(match))
  next.timing.activeTimer = undefined
  return appendMatchEvent(next, {
    type: "timer",
    setIndex: next.score?.sets?.length ?? 0,
    gameIndex: next.score?.currentSet?.games?.length ?? 0,
    payload: { action: "stop", timerId: timer.id },
    at: now.toISOString(),
  })
}

/** Compute the remaining seconds for the given timer relative to `now`. */
export function computeRemainingSec(timer: MatchTimer, now: Date = new Date()): number {
  if (!timer?.startedAt) return 0
  if (timer.pausedAt) {
    if (typeof timer.remainingSec === "number") return Math.max(0, Math.floor(timer.remainingSec))
    return 0
  }
  const startedMs = new Date(timer.startedAt).getTime()
  const elapsed = Math.floor((now.getTime() - startedMs) / 1000)
  return Math.max(0, timer.durationSec - elapsed)
}

/** True when the timer's countdown has reached zero. */
export function isTimerExpired(timer: MatchTimer | undefined, now: Date = new Date()): boolean {
  if (!timer) return false
  return computeRemainingSec(timer, now) <= 0
}
