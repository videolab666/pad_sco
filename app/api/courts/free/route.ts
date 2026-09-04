// POST /api/courts/free — завершение всех активных матчей на корте (Шаг 3).
//
// Заменяет прямой anon-PATCH из lib/court-utils.ts (freeUpCourt): после
// снятия pre-step3 write-политик (миграция 20260818030000) клиентский UPDATE
// по matches — тихий no-op (RLS пропускает 0 строк, ошибки нет), поэтому
// «Завершить» на корте «успешно» ничего не делал. Пишет service-ключ.
//
// Auth: Origin браузера того же сайта или X-API-Key (как /api/matches/create).
//
// Body: { courtNumber: number }
// Резолвит корт по legacy_number и завершает ВСЕ активные матчи по любой
// привязке — court_number (легаси) и court_id (именные/QR-корты), см. баг
// 2026-08-16: матч с court_id-привязкой висел на корте. Каждая строка
// пишется с revision-guard (оптимистичная конкуренция), court_number
// обнуляется, court_id сохраняется (история помнит корт).

import { NextResponse, type NextRequest } from "next/server"
import { isAuthorizedMatchCommandRequest } from "@/lib/api-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { logEvent } from "@/lib/error-logger"

export async function POST(request: NextRequest) {
  if (!isAuthorizedMatchCommandRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const courtNumber = Number.parseInt(String(body?.courtNumber), 10)
  if (!Number.isFinite(courtNumber) || courtNumber < 1) {
    return NextResponse.json({ error: "invalid_court_number" }, { status: 400 })
  }

  try {
    const supabase = createServerSupabaseClient()

    // Корт по legacy_number → court_id (может отсутствовать для числовых кортов).
    const { data: courtRow } = await supabase
      .from("courts")
      .select("id")
      .eq("legacy_number", courtNumber)
      .limit(1)
      .maybeSingle()
    const courtId: string | null = courtRow?.id ?? null

    // Активные матчи по любой из двух привязок.
    // PostgREST-грабли (2026-09-04): PATCH + or=(court_id...) даёт 400
    // «column matches.court_id does not exist», хотя тот же or на GET
    // работает — поэтому двухшагово: GET id → PATCH по id.in.(...).
    const { data: stale, error: selectError } = await supabase
      .from("matches")
      .select("id, revision")
      .eq("is_completed", false)
      .or(courtId ? `court_id.eq.${courtId},court_number.eq.${courtNumber}` : `court_number.eq.${courtNumber}`)
    if (selectError) {
      logEvent("error", `Free court API select failed: ${selectError.message}`, "free-court-api", selectError)
      return NextResponse.json({ error: "select_failed", message: selectError.message }, { status: 500 })
    }

    const rows = stale ?? []
    if (rows.length === 0) {
      return NextResponse.json({ status: "ok", completed: 0, matchIds: [] })
    }

    const completed: string[] = []
    for (const row of rows) {
      // Легаси-строка без revision: усыновляем с revision=1 (как command API).
      const update = { court_number: null, is_completed: true } as Record<string, unknown>
      if (typeof row.revision === "number") update.revision = row.revision + 1
      else update.revision = 1
      let query = supabase.from("matches").update(update).eq("id", row.id).select("id")
      query =
        typeof row.revision === "number" ? query.eq("revision", row.revision) : query.is("revision", null)
      const { data: updated, error } = await query
      if (error) {
        // Не валим весь запрос из-за одной строки — её подберёт повторный клик.
        logEvent("error", `Free court API update failed (${row.id}): ${error.message}`, "free-court-api", error)
        continue
      }
      if (updated && updated.length > 0) completed.push(row.id)
    }

    logEvent(
      "info",
      `Корт ${courtNumber} освобождён через API: завершено матчей — ${completed.length} из ${rows.length}`,
      "free-court-api",
    )
    return NextResponse.json({ status: "ok", completed: completed.length, total: rows.length, matchIds: completed })
  } catch (err) {
    logEvent("error", `Free court API internal error: ${(err as Error).message}`, "free-court-api", err)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
