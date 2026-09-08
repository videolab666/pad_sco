// POST /api/matches/create — создание матча через сервер (Шаг 3, §99).
//
// Заменяет прямой INSERT с anon-ключа (lib/match-storage.ts createMatch) —
// после снятия pre-step3 политик это ЕДИНСТВЕННЫЙ способ создать матч.
// Auth: Origin браузера или X-API-Key (машины).

import { NextResponse, type NextRequest } from "next/server"
import { isAuthorizedMatchCommandRequest } from "@/lib/api-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { matchToRow } from "@/lib/match-supabase"
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const match = body?.match as any
  if (!match?.id || !match?.type || !match?.score || !match?.teamA || !match?.teamB) {
    return NextResponse.json(
      { error: "validation", message: "match должен содержать id, type, score, teamA, teamB" },
      { status: 400 },
    )
  }

  try {
    const supabase = createServerSupabaseClient()
    const row = matchToRow(match)

    // Prevent the normal UI/API path from creating two live matches on one
    // court. This check covers both legacy numeric and registry UUID bindings.
    if (row.is_completed === false && (row.court_number != null || row.court_id != null)) {
      const filters: string[] = []
      if (row.court_id != null) filters.push(`court_id.eq.${row.court_id}`)
      if (row.court_number != null) filters.push(`court_number.eq.${row.court_number}`)
      const { data: occupied, error: occupiedError } = await supabase
        .from("matches")
        .select("id")
        .eq("is_completed", false)
        .or(filters.join(","))
        .limit(1)
        .maybeSingle()
      if (occupiedError) {
        return NextResponse.json({ error: "court_check_failed", message: occupiedError.message }, { status: 500 })
      }
      if (occupied) {
        if (occupied.id === match.id) {
          return NextResponse.json({ status: "ok", idempotent: true, id: match.id })
        }
        return NextResponse.json(
          { error: "court_occupied", matchId: occupied.id },
          { status: 409 },
        )
      }
    }

    const { data, error } = await supabase
      .from("matches")
      .insert({ ...row, revision: 0 })
      .select("*")
      .single()

    if (error) {
      if (error.message?.includes("court_occupied")) {
        return NextResponse.json({ error: "court_occupied" }, { status: 409 })
      }
      // Дубликат — матч уже существует (повтор после таймаута)
      if (/duplicate key/i.test(error.message)) {
        const existing = await supabase.from("matches").select("id").eq("id", match.id).maybeSingle()
        if (existing.data) return NextResponse.json({ status: "ok", idempotent: true, id: match.id })
      }
      logEvent("error", `Create match: ${error.message}`, "create-match-api", error)
      return NextResponse.json({ error: "create_failed", message: error.message }, { status: 500 })
    }

    logEvent("info", `Match created via API: ${match.id}`, "create-match-api")
    return NextResponse.json({ status: "ok", id: data?.id ?? match.id }, { status: 201 })
  } catch (err) {
    logEvent("error", `Create match: ${(err as Error).message}`, "create-match-api", err)
    return NextResponse.json({ error: "create_failed", message: (err as Error).message }, { status: 500 })
  }
}
