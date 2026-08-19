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
    const { data, error } = await supabase
      .from("matches")
      .insert({ ...row, revision: 0 })
      .select("*")
      .single()

    if (error) {
      // Дубликат — матч уже существует (повтор после таймаута)
      if (/duplicate key/i.test(error.message)) {
        return NextResponse.json({ status: "ok", idempotent: true, id: match.id })
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
