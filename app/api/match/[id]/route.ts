import { NextResponse } from "next/server"
import { getMatchFromServer } from "@/lib/server-match-storage"
import { logEvent } from "@/lib/error-logger"
import { buildCourtVmixPayload } from "@/lib/match-view"
import { parseScoreboardSettings } from "@/lib/scoreboard-settings"
import { createServerSupabaseClient } from "@/lib/supabase"
import { matchToRow, matchFromRow } from "@/lib/match-supabase"
import { isAuthorizedMatchCommandRequest } from "@/lib/api-auth"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const matchId = resolvedParams.id

    if (!matchId) {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 })
    }

    // Логируем запрос к API
    logEvent("info", `Match API: запрос данных матча: ${matchId}`, "match-api")

    // Пытаемся получить матч с несколькими попытками
    let match = null
    let attempts = 0
    const maxAttempts = 3

    while (!match && attempts < maxAttempts) {
      attempts++
      try {
        match = await getMatchFromServer(matchId)
        if (match) break
      } catch (retryError) {
        logEvent("warn", `Попытка ${attempts} получения матча не удалась`, "match-api", retryError)
        // Небольшая задержка перед следующей попыткой
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
    }

    if (!match) {
      logEvent("error", `Матч не найден после ${attempts} попыток: ${matchId}`, "match-api")
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }

    // Единый источник плоского payload для vMix — lib/match-view
    // (тот же билдер, что и у /api/court/[number]).
    const display = parseScoreboardSettings(new URL(request.url).searchParams)
    const flatMatchData = buildCourtVmixPayload(match, null, display)

    // Устанавливаем заголовки для предотвращения кэширования
    const headers = new Headers()
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    headers.set("Pragma", "no-cache")
    headers.set("Expires", "0")
    headers.set("Surrogate-Control", "no-store")
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET")
    headers.set("Access-Control-Allow-Headers", "Content-Type")

    // Возвращаем данные матча в том же формате, что и API корта
    return new NextResponse(JSON.stringify([flatMatchData]), {
      status: 200,
      headers: headers,
    })
  } catch (error: any) {
    logEvent("error", "Ошибка при обработке API запроса", "match-api", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── Idempotent, revisioned match write (Task 2, Step 3) ───────────────────────

// Snapshot (camelCase) → Supabase row — single source in lib/match-supabase.
const toMatchRow = (match: any): Record<string, any> => matchToRow(match)

/**
 * Applies a single match operation idempotently with optimistic concurrency.
 *
 * Body: { operation: { operationId, baseRevision, kind, clientId }, match: <snapshot> }
 *
 *  - A repeated `operationId` returns the stored result (never applied twice).
 *  - A stale `baseRevision` fails fast with 409 and the authoritative snapshot
 *    instead of overwriting newer server data.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Whole-snapshot writes mutate matches. Шаг 3: прямой anon-UPDATE на
    // matches закрыт RLS, поэтому снапшот-пуши sync-engine (drainMatch) идут
    // сюда — этот роут пишет service-ключом. Auth как у командного
    // конвейера: браузер того же сайта (Origin) или X-API-Key (машины) —
    // уровень доверия идентичен POST /api/match/[id]/command (§99).
    if (!isAuthorizedMatchCommandRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const matchId = resolvedParams.id
    if (!matchId) {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const operation = body?.operation
    const match = body?.match
    if (!operation?.operationId || typeof operation.baseRevision !== "number" || !match?.id) {
      return NextResponse.json({ error: "Invalid operation payload" }, { status: 400 })
    }
    if (match.id !== matchId) {
      return NextResponse.json({ error: "Match id mismatch" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Idempotency: a previously applied operation returns its stored result.
    const existing = await supabase
      .from("match_operations")
      .select("result_revision")
      .eq("operation_id", operation.operationId)
      .maybeSingle()

    if (!existing.error && existing.data) {
      const current = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle()
      return NextResponse.json(
        // camelCase-снапшот: ответ уходит в sync-engine/UI, а не в PostgREST.
        { status: "ok", idempotent: true, revision: existing.data.result_revision, match: current.data ? matchFromRow(current.data) : null },
        { status: 200 },
      )
    }

    const resultRevision = operation.baseRevision + 1
    const row = toMatchRow(match)

    // Optimistic-concurrency write: only succeeds when the server is still at
    // the revision the client based this operation on.
    const updated = await supabase
      .from("matches")
      .update({ ...row, revision: resultRevision })
      .eq("id", matchId)
      .eq("revision", operation.baseRevision)
      .select()

    if (updated.error) {
      logEvent("error", `Ошибка revisioned update: ${updated.error.message}`, "match-api")
      return NextResponse.json({ status: "error", error: updated.error.message }, { status: 500 })
    }

    if (updated.data && updated.data.length > 0) {
      await supabase.from("match_operations").insert({
        operation_id: operation.operationId,
        match_id: matchId,
        base_revision: operation.baseRevision,
        result_revision: resultRevision,
        kind: operation.kind || "snapshot",
        client_id: operation.clientId || null,
      })
      return NextResponse.json({ status: "ok", revision: resultRevision, match: matchFromRow(updated.data[0]) }, { status: 200 })
    }

    // 0 rows updated — inspect the current row to classify the outcome.
    const current = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle()
    if (current.error || !current.data) {
      return NextResponse.json({ status: "conflict", reason: "match_deleted", match: null }, { status: 409 })
    }

    const serverRevision = current.data.revision
    if (serverRevision === null || serverRevision === undefined) {
      // Legacy row without a revision — adopt it.
      const adopt = await supabase
        .from("matches")
        .update({ ...row, revision: resultRevision })
        .eq("id", matchId)
        .select()
      await supabase.from("match_operations").insert({
        operation_id: operation.operationId,
        match_id: matchId,
        base_revision: operation.baseRevision,
        result_revision: resultRevision,
        kind: operation.kind || "snapshot",
        client_id: operation.clientId || null,
      })
      return NextResponse.json(
        { status: "ok", revision: resultRevision, match: adopt.data?.[0] ? matchFromRow(adopt.data[0]) : current.data ? matchFromRow(current.data) : null },
        { status: 200 },
      )
    }

    // Genuine conflict — return the authoritative snapshot, never overwrite it.
    return NextResponse.json(
      { status: "conflict", reason: `server_ahead (server=${serverRevision})`, revision: serverRevision, match: matchFromRow(current.data) },
      { status: 409 },
    )
  } catch (error) {
    logEvent("error", "Ошибка при идемпотентной записи матча", "match-api", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
