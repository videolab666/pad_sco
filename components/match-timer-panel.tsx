"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BellRing, ChevronLeft, HeartPulse, Pause, Play, Square, Timer as TimerIcon } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import {
  DEFAULT_TIMER_SECONDS,
  computeRemainingSec,
  isTimerExpired,
  pauseMatchTimer,
  resumeMatchTimer,
  startMatchTimer,
  stopMatchTimer,
} from "@/lib/match-timers"
import { recordTimeout } from "@/lib/timeouts"
import { formatDurationMs, getCurrentGameDurationMs, getCurrentSetDurationMs, getMatchDurationMs } from "@/lib/match-timing"
import type { MatchTimerType, TeamKey } from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

type Submenu = "none" | "injury" | "timeout"

type LabelKey =
  | "timerWarmup"
  | "timerPauseFirst"
  | "timerPause"
  | "timerTowel"
  | "timerInjurySelf"
  | "timerInjuryBlood"
  | "timerInjuryContributed"
  | "timerInjuryOpponent"
  | "timerTimeout"

const TIMER_LABEL: Record<MatchTimerType, LabelKey> = {
  warmup: "timerWarmup",
  "pause-before-first-game": "timerPauseFirst",
  "pause-between-games": "timerPause",
  "self-inflicted-injury": "timerInjurySelf",
  "self-inflicted-blood-injury": "timerInjuryBlood",
  "contributed-injury": "timerInjuryContributed",
  "opponent-inflicted-injury": "timerInjuryOpponent",
  "toweling-down": "timerTowel",
  timeout: "timerTimeout",
}

/**
 * Full match timer panel + global durations.
 *
 * - Match / current set / current game durations tick every 1s while the match runs.
 * - The active timer is computed from `startedAt` + `durationSec`; the same
 *   tick re-renders the countdown.
 * - All 9 APK timer types are available: quick buttons for the common ones,
 *   submenus for the 4 injury variants and the per-team timeout.
 * - When a running (non-paused) countdown reaches 00:00 the row turns red and
 *   a short beep plays once until the operator stops the timer.
 */
export function MatchTimerPanel({ match, updateMatch }: Props) {
  const [, setTick] = useState(0)
  const [submenu, setSubmenu] = useState<Submenu>("none")
  const beepedRef = useRef<string | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    if (match?.isCompleted) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [match?.isCompleted])

  if (!match) return null

  const timer = match.timing?.activeTimer
  const timerType = timer?.type as MatchTimerType | undefined
  const now = new Date()
  const matchDur = formatDurationMs(getMatchDurationMs(match, now))
  const setDur = formatDurationMs(getCurrentSetDurationMs(match, now))
  const gameDur = formatDurationMs(getCurrentGameDurationMs(match, now))
  const expired = isTimerExpired(timer, now)

  // Beep once per timer expiry (re-arms if a new timer starts and expires).
  if (timer && expired && !timer.pausedAt && beepedRef.current !== timer.id) {
    beepedRef.current = timer.id
    playBeep()
  }
  if (!timer) beepedRef.current = null

  const onStart = (type: MatchTimerType, team?: TeamKey) => {
    updateMatch?.(startMatchTimer(match, type, team), {
      command: "start-timer",
      args: { type, team },
      clientId: "match-timer",
    })
    setSubmenu("none")
  }
  const onTimeout = (team: TeamKey) => {
    updateMatch?.(recordTimeout(match, team), {
      command: "record-timeout",
      args: { team },
      clientId: "match-timer",
    })
    setSubmenu("none")
  }
  const onPause = () => updateMatch?.(pauseMatchTimer(match), { command: "pause-timer", args: {}, clientId: "match-timer" })
  const onResume = () => updateMatch?.(resumeMatchTimer(match), { command: "resume-timer", args: {}, clientId: "match-timer" })
  const onStop = () => updateMatch?.(stopMatchTimer(match), { command: "stop-timer", args: {}, clientId: "match-timer" })

  const teamAName = match?.teamA?.players?.[0]?.name ?? t("extras.teamA")
  const teamBName = match?.teamB?.players?.[0]?.name ?? t("extras.teamB")
  const teamName = (team?: TeamKey) => (team === "teamA" ? teamAName : team === "teamB" ? teamBName : undefined)

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono">{t("extras.matchDuration")} {matchDur}</span>
          <span className="font-mono text-muted-foreground">{t("extras.setDuration")} {setDur}</span>
          <span className="font-mono text-muted-foreground">{t("extras.gameDuration")} {gameDur}</span>
        </div>

        {timer ? (
          <div className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${expired && !timer.pausedAt ? "bg-destructive/10 animate-pulse" : ""}`}>
            <div className="flex items-center gap-2 min-w-0">
              <TimerIcon className="h-4 w-4 shrink-0" />
              <span className="text-sm truncate">
                {timerType ? t(`extras.${TIMER_LABEL[timerType]}`) : ""}
                {timer.team ? ` — ${teamName(timer.team)}` : ""}
              </span>
              <span className={`font-mono text-lg ${expired && !timer.pausedAt ? "text-destructive font-bold" : ""}`}>
                {formatCountdown(computeRemainingSec(timer, now))}
              </span>
            </div>
            <div className="flex gap-1 shrink-0">
              {timer.pausedAt ? (
                <Button size="sm" variant="outline" onClick={onResume} aria-label="Resume timer">
                  <Play className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={onPause} aria-label="Pause timer">
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onStop} aria-label="Stop timer">
                <Square className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : submenu === "injury" ? (
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => setSubmenu("none")}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t("extras.timerChooseInjury")}
            </Button>
            <div className="flex flex-wrap gap-1">
              {(["self-inflicted-injury", "self-inflicted-blood-injury", "contributed-injury", "opponent-inflicted-injury"] as MatchTimerType[]).map((type) => (
                <Button key={type} size="sm" variant="outline" disabled={match.isCompleted} onClick={() => onStart(type)} title={`${t(`extras.${TIMER_LABEL[type]}`)} — ${DEFAULT_TIMER_SECONDS[type]}s`}>
                  <HeartPulse className="h-3 w-3 mr-1" />
                  {t(`extras.${TIMER_LABEL[type]}`)}
                </Button>
              ))}
            </div>
          </div>
        ) : submenu === "timeout" ? (
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => setSubmenu("none")}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t("extras.timerChooseTeam")}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" disabled={match.isCompleted} onClick={() => onTimeout("teamA")}>{teamAName}</Button>
              <Button size="sm" disabled={match.isCompleted} onClick={() => onTimeout("teamB")}>{teamBName}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {(["warmup", "pause-before-first-game", "pause-between-games", "toweling-down"] as MatchTimerType[]).map((type) => (
              <Button
                key={type}
                size="sm"
                variant="outline"
                disabled={match.isCompleted}
                onClick={() => onStart(type)}
                title={`${t(`extras.${TIMER_LABEL[type]}`)} — ${DEFAULT_TIMER_SECONDS[type]}s`}
              >
                {t(`extras.${TIMER_LABEL[type]}`)}
              </Button>
            ))}
            <Button size="sm" variant="outline" disabled={match.isCompleted} onClick={() => setSubmenu("injury")}>
              <HeartPulse className="h-3 w-3 mr-1" />
              {t("extras.timerInjury")}
            </Button>
            <Button size="sm" variant="outline" disabled={match.isCompleted} onClick={() => setSubmenu("timeout")}>
              <BellRing className="h-3 w-3 mr-1" />
              {t("extras.timerTimeout")}
            </Button>
          </div>
        )}

        {timer && expired && !timer.pausedAt && (
          <div className="text-xs font-medium text-destructive">{t("extras.timerExpired")}</div>
        )}
      </CardContent>
    </Card>
  )
}

function formatCountdown(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`
}

/** Short triple beep via WebAudio — no asset needed, silent if blocked by the browser. */
function playBeep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35)
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.35 + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.35)
      osc.stop(ctx.currentTime + i * 0.35 + 0.32)
    }
  } catch {
    // Autoplay policy or missing API — visual alert still shows.
  }
}
