import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import {
  DEFAULT_TIMER_SECONDS,
  computeRemainingSec,
  getTimerDurationSec,
  isTimerExpired,
  pauseMatchTimer,
  resumeMatchTimer,
  startMatchTimer,
  stopMatchTimer,
} from "../lib/match-timers"

const baseMatch = (overrides: any = {}) =>
  backfillExtendedMatchState({
    id: "m",
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
    ...overrides,
  })

describe("Task 4 — defaults and overrides", () => {
  it("DEFAULT_TIMER_SECONDS matches APK warmup=240 and timeout=60", () => {
    expect(DEFAULT_TIMER_SECONDS.warmup).toBe(240)
    expect(DEFAULT_TIMER_SECONDS.timeout).toBe(60)
    expect(DEFAULT_TIMER_SECONDS["self-inflicted-injury"]).toBe(180)
    expect(DEFAULT_TIMER_SECONDS["self-inflicted-blood-injury"]).toBe(300)
    expect(DEFAULT_TIMER_SECONDS["contributed-injury"]).toBe(900)
  })

  it("getTimerDurationSec honours per-match override", () => {
    const m = baseMatch({ settings: { timerSeconds: { warmup: 60 } } })
    expect(getTimerDurationSec(m, "warmup")).toBe(60)
    expect(getTimerDurationSec(m, "timeout")).toBe(60) // default since not overridden
  })

  it("ignores non-positive overrides", () => {
    const m = baseMatch({ settings: { timerSeconds: { warmup: -10 } } })
    expect(getTimerDurationSec(m, "warmup")).toBe(240)
  })
})

describe("Task 4 — start / stop", () => {
  it("startMatchTimer attaches an activeTimer and emits a timer event", () => {
    const start = new Date("2026-05-27T10:00:00Z")
    const m = startMatchTimer(baseMatch(), "warmup", undefined, start)
    expect(m.timing.activeTimer).toMatchObject({ type: "warmup", durationSec: 240, startedAt: start.toISOString() })
    expect(m.events[m.events.length - 1]).toMatchObject({ type: "timer", payload: { action: "start", timerType: "warmup" } })
  })

  it("stopMatchTimer clears the active timer", () => {
    let m = startMatchTimer(baseMatch(), "timeout", "teamA", new Date("2026-05-27T10:00:00Z"))
    m = stopMatchTimer(m, new Date("2026-05-27T10:00:30Z"))
    expect(m.timing.activeTimer).toBeUndefined()
    expect(m.events[m.events.length - 1].payload.action).toBe("stop")
  })

  it("stop is a no-op when there is no active timer", () => {
    const m = baseMatch()
    const after = stopMatchTimer(m)
    expect(after).toBe(m)
  })
})

describe("Task 4 — pause / resume preserve elapsed time across devices", () => {
  it("pause records remainingSec at the pause instant", () => {
    let m = startMatchTimer(baseMatch(), "timeout", "teamA", new Date("2026-05-27T10:00:00Z"))
    m = pauseMatchTimer(m, new Date("2026-05-27T10:00:20Z"))
    expect(m.timing.activeTimer.remainingSec).toBe(40) // 60 - 20
    expect(m.timing.activeTimer.pausedAt).toBe("2026-05-27T10:00:20.000Z")
  })

  it("resume rolls startedAt forward so countdown picks up where it left off", () => {
    let m = startMatchTimer(baseMatch(), "timeout", "teamA", new Date("2026-05-27T10:00:00Z"))
    m = pauseMatchTimer(m, new Date("2026-05-27T10:00:20Z"))
    m = resumeMatchTimer(m, new Date("2026-05-27T10:05:00Z"))
    // At resume the timer has 40s remaining out of 60s, so startedAt = now - 20s
    expect(new Date(m.timing.activeTimer.startedAt).toISOString()).toBe("2026-05-27T10:04:40.000Z")
    expect(m.timing.activeTimer.pausedAt).toBeUndefined()
    // 5s later → 35s remaining
    expect(computeRemainingSec(m.timing.activeTimer, new Date("2026-05-27T10:05:05Z"))).toBe(35)
  })

  it("pause is idempotent (a second pause does not move remainingSec)", () => {
    let m = startMatchTimer(baseMatch(), "timeout", "teamA", new Date("2026-05-27T10:00:00Z"))
    m = pauseMatchTimer(m, new Date("2026-05-27T10:00:20Z"))
    const remaining = m.timing.activeTimer.remainingSec
    m = pauseMatchTimer(m, new Date("2026-05-27T10:00:40Z"))
    expect(m.timing.activeTimer.remainingSec).toBe(remaining)
  })
})

describe("Task 4 — remaining / expired helpers", () => {
  it("isTimerExpired reflects countdown reaching zero", () => {
    const m = startMatchTimer(baseMatch(), "timeout", undefined, new Date("2026-05-27T10:00:00Z"))
    expect(isTimerExpired(m.timing.activeTimer, new Date("2026-05-27T10:00:30Z"))).toBe(false)
    expect(isTimerExpired(m.timing.activeTimer, new Date("2026-05-27T10:01:00Z"))).toBe(true)
    expect(isTimerExpired(m.timing.activeTimer, new Date("2026-05-27T10:05:00Z"))).toBe(true)
  })
})
