// GET /api/v1/dashboard — Multi-court Dashboard (plan-4 §46), публичный.
//
// Один ответ на всё состояние клуба: каждый корт реестра + активный матч
// (сводка через ту же проекцию, что и vMix JSON) + активная Court Session.
// Читают: страница /dashboard, будущие spectator wall (§113) и PWA.

import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { matchFromRow } from "@/lib/match-supabase"
import { ensureCourtSchema, listCourts } from "@/lib/court-registry"
import { ensureSessionSchema, listSessions } from "@/lib/court-session"
import { buildDashboardCourtCard } from "@/lib/dashboard-summary"
import { logEvent } from "@/lib/error-logger"

export async function GET() {
  if (!(await ensureCourtSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  try {
    const supabase = createServerSupabaseClient()
    const courts = await listCourts(false)

    // Активные сессии одним запросом.
    let sessionsByCourt = new Map<string, { type: string; status: string; startedAt: string }>()
    if (await ensureSessionSchema()) {
      try {
        const sessions = await listSessions({ active: true, limit: 200 })
        sessionsByCourt = new Map(
          sessions
            .filter((s) => s.courtId)
            .map((s) => [s.courtId as string, { type: s.type, status: s.status, startedAt: s.startedAt }]),
        )
      } catch (err) {
        logEvent("warn", `dashboard: сессии недоступны: ${(err as Error).message}`, "dashboard-api")
      }
    }

    // Все незавершённые матчи одним запросом; на корт — самый свежий
    // (по court_id, fallback на legacy court_number).
    const { data: activeRows, error } = await supabase
      .from("matches")
      .select("*")
      .eq("is_completed", false)
      .order("created_at", { ascending: false })
      .limit(100)
    if (error) throw new Error(`matches: ${error.message}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchByCourtId = new Map<string, any>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchByLegacy = new Map<number, any>()
    for (const row of activeRows ?? []) {
      if (row.court_id && !matchByCourtId.has(row.court_id)) matchByCourtId.set(row.court_id, row)
      if (row.court_number != null && !matchByLegacy.has(row.court_number)) {
        matchByLegacy.set(row.court_number, row)
      }
    }

    const cards = courts.map((court) => {
      const row = matchByCourtId.get(court.id) ?? (court.legacyNumber !== null ? matchByLegacy.get(court.legacyNumber) : undefined)
      const match = row ? matchFromRow(row) : null
      return buildDashboardCourtCard(court, match, sessionsByCourt.get(court.id) ?? null)
    })

    return NextResponse.json(
      { courts: cards, generatedAt: new Date().toISOString() },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    )
  } catch (error) {
    logEvent("error", `dashboard: ${(error as Error).message}`, "dashboard-api", error)
    return NextResponse.json({ error: "internal_error", message: (error as Error).message }, { status: 500 })
  }
}
