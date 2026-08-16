"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Pause, Play, Square, Timer as TimerIcon } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import {
  DEFAULT_TIMER_SECONDS,
  computeRemainingSec,
  pauseMatchTimer,
  resumeMatchTimer,
  startMatchTimer,
  stopMatchTimer,
} from "@/lib/match-timers"
import { formatDurationMs, getCurrentGameDurationMs, getMatchDurationMs } from "@/lib/match-timing"
import type { MatchTimerType } from "@/lib/types"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateMatch: any
}

const TIMER_TYPES: { key: MatchTimerType; labelKey: "timerWarmup" | "timerPause" | "timerTimeout" | "timerInjury" | "timerTowel" }[] = [
  { key: "warmup", labelKey: "timerWarmup" },
  { key: "pause-between-games", labelKey: "timerPause" },
  { key: "timeout", labelKey: "timerTimeout" },
  { key: "self-inflicted-injury", labelKey: "timerInjury" },
  { key: "toweling-down", labelKey: "timerTowel" },
]

/**
 * Compact match timer + global durations.
 *
 * - Match duration / current game duration tick every 1s while the match runs.
 * - The active timer is computed from `startedAt` + `durationSec`; the same
 *   tick re-renders the countdown.
 * - Buttons start a new timer, or pause / resume / stop the active one.
 */
export function MatchTimerPanel({ match, updateMatch }: Props) {
  const [, setTick] = useState(0)
  const { t } = useLanguage()

  useEffect(() => {
    if (match?.isCompleted) return
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [match?.isCompleted])

  if (!match) return null

  const timer = match.timing?.activeTimer
  const matchDur = formatDurationMs(getMatchDurationMs(match))
  const gameDur = formatDurationMs(getCurrentGameDurationMs(match))

  const onStart = (type: MatchTimerType) => updateMatch?.(startMatchTimer(match, type))
  const onPause = () => updateMatch?.(pauseMatchTimer(match))
  const onResume = () => updateMatch?.(resumeMatchTimer(match))
  const onStop = () => updateMatch?.(stopMatchTimer(match))

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono">{t("extras.matchDuration")} {matchDur}</span>
          <span className="font-mono text-muted-foreground">{t("extras.gameDuration")} {gameDur}</span>
        </div>

        {timer ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TimerIcon className="h-4 w-4" />
              <span className="text-sm capitalize">{String(timer.type).replace(/-/g, " ")}</span>
              <span className="font-mono text-lg">
                {formatCountdown(computeRemainingSec(timer))}
              </span>
            </div>
            <div className="flex gap-1">
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
        ) : (
          <div className="flex flex-wrap gap-1">
            {TIMER_TYPES.map((entry) => {
              const label = t(`extras.${entry.labelKey}`)
              return (
                <Button
                  key={entry.key}
                  size="sm"
                  variant="outline"
                  disabled={match.isCompleted}
                  onClick={() => onStart(entry.key)}
                  title={`${label} — ${DEFAULT_TIMER_SECONDS[entry.key]}s`}
                >
                  {label}
                </Button>
              )
            })}
          </div>
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
