// POST /api/court-sessions/auto-close — закрытие зависших сессий (§23).
//
// Вызывается cron'ом (или вручную). Правила:
//   1. recording_sessions со status=recording дольше 90 мин → finalizing→ready
//   2. court_sessions со status=active дольше 120 мин → completed
//   3. Никогда не трогаем сессии, которые активны < 60 мин (§23.3)
//
// Auth: X-API-Key (машина/cron) или staff.

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { logEvent } from "@/lib/error-logger"

const RECORDING_TIMEOUT_MIN = 90
const SESSION_TIMEOUT_MIN = 120
const MIN_AGE_MIN = 60 // §23.3: не закрывать раньше 60 мин

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const now = new Date()
  const closed = { recordings: 0, sessions: 0 }

  try {
    // ─── 1. Зависшие записи (recording_sessions) ───────────────────────
    const { data: oldRecordings } = await supabase
      .from("recording_sessions")
      .select("id, started_at, status")
      .eq("status", "recording")
      .lt("started_at", new Date(now.getTime() - RECORDING_TIMEOUT_MIN * 60_000).toISOString())
      .gt("started_at", new Date(now.getTime() - 24 * 60 * 60_000).toISOString()) // не старше 24ч

    for (const rec of oldRecordings ?? []) {
      const ageMin = Math.round((now.getTime() - Date.parse(rec.started_at)) / 60_000)
      await supabase
        .from("recording_sessions")
        .update({ status: "ready", ended_at: now.toISOString() })
        .eq("id", rec.id)
      closed.recordings++
      logEvent("info", `auto-close: запись ${rec.id.slice(0, 8)} закрыта (${ageMin} мин)`, "auto-close")
    }

    // ─── 2. Зависшие court_sessions ────────────────────────────────────
    const { data: oldSessions } = await supabase
      .from("court_sessions")
      .select("id, started_at, status")
      .in("status", ["active", "preparing"])
      .lt("started_at", new Date(now.getTime() - SESSION_TIMEOUT_MIN * 60_000).toISOString())
      .gt("started_at", new Date(now.getTime() - 24 * 60 * 60_000).toISOString())

    for (const sess of oldSessions ?? []) {
      const ageMin = Math.round((now.getTime() - Date.parse(sess.started_at)) / 60_000)
      await supabase
        .from("court_sessions")
        .update({ status: "completed", ended_at: now.toISOString() })
        .eq("id", sess.id)
      closed.sessions++
      logEvent("info", `auto-close: сессия ${sess.id.slice(0, 8)} закрыта (${ageMin} мин)`, "auto-close")
    }

    return NextResponse.json({
      status: "ok",
      closed,
      checkedAt: now.toISOString(),
    })
  } catch (error) {
    logEvent("error", `auto-close: ${(error as Error).message}`, "auto-close", error)
    return NextResponse.json({ error: "auto_close_failed", message: (error as Error).message }, { status: 500 })
  }
}
