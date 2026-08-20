// GET /api/video/recordings/calendar?month=YYYY-MM — календарь записей (staff).
//
// Возвращает карту: день → количество записей + корты + суммарная длительность.
// UI рисует месячную сетку с подсветкой дней, клик → фильтр записей.

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const monthParam = url.searchParams.get("month") // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(monthParam ?? "")) {
    return NextResponse.json({ error: "validation", message: "month=YYYY-MM обязателен" }, { status: 400 })
  }

  const [year, mon] = monthParam!.split("-").map(Number)
  // Первый и последний день месяца (UTC, ISO)
  const start = new Date(Date.UTC(year, mon - 1, 1))
  const end = new Date(Date.UTC(year, mon, 0, 23, 59, 59))

  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from("recording_sessions")
      .select("id, started_at, ended_at, status, court_id, courts(name, short_code)")
      .gte("started_at", start.toISOString())
      .lte("started_at", end.toISOString())
      .order("started_at", { ascending: true })

    if (error) throw new Error(error.message)

    // Группировка по дню
    const days: Record<string, {
      count: number
      courts: Array<{ id: string; name: string; shortCode: string }>
      totalDurationMs: number
      hasActive: boolean
    }> = {}

    for (const row of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const court: any = row.courts
      const dayKey = row.started_at.slice(0, 10) // YYYY-MM-DD (UTC)
      if (!days[dayKey]) {
        days[dayKey] = { count: 0, courts: [], totalDurationMs: 0, hasActive: false }
      }
      days[dayKey].count++
      if (court?.id && !days[dayKey].courts.some(c => c.id === court.id)) {
        days[dayKey].courts.push({ id: court.id, name: court.name, shortCode: court.short_code })
      }
      if (row.ended_at) {
        days[dayKey].totalDurationMs += Date.parse(row.ended_at) - Date.parse(row.started_at)
      }
      if (row.status === "recording") days[dayKey].hasActive = true
    }

    return NextResponse.json(
      { month: monthParam, days },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    return NextResponse.json({ error: "calendar_failed", message: (err as Error).message }, { status: 500 })
  }
}
