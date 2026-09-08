// Remote-control command endpoint (Phase 1 of the external API).
//
// POST /api/match/[id]/command
//   Headers: X-API-Key: <SCOREBOARD_API_KEY>
//   Body:    { operationId?: string, command: string, args?: object }
//
// Loads the match from Supabase, applies the command through the SAME pure
// engine functions the UI uses (lib/remote-commands.ts), and writes the result
// with the revision guard — identical discipline to PUT /api/match/[id]:
//   - a repeated `operationId` returns the stored result (idempotent),
//   - a concurrent writer wins → 409 with the authoritative snapshot,
//   - success pushes to every open UI via Supabase Realtime automatically.
//
// Responses: 200 { status, idempotent, revision, match } (camelCase match),
// 400 { error, code } for invalid commands, 401 without a valid API key,
// 404 for an unknown match, 409 on revision conflicts.

import { NextResponse } from "next/server"
import { isAuthorizedMatchCommandRequest } from "@/lib/api-auth"
import { autoMarkVideoEvents } from "@/lib/video-registry"
import { applyCompletionRatings } from "@/lib/rating-service"
import { logEvent } from "@/lib/error-logger"
import { createServerSupabaseClient } from "@/lib/supabase"
import { matchFromRow, matchToRow } from "@/lib/match-supabase"
import { applyRemoteCommand, RemoteCommandError, stableOperationUuid } from "@/lib/remote-commands"
import { appliedOperationIdsOf, hasAppliedOperationId, recordAppliedOperationId } from "@/lib/match-operation-id"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isAuthorizedMatchCommandRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const matchId = resolvedParams.id
    if (!matchId) {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const command = body?.command
    if (typeof command !== "string") {
      return NextResponse.json({ error: "Body must contain a command" }, { status: 400 })
    }
    const operationId: string | undefined =
      typeof body?.operationId === "string" && body.operationId.length > 0
        ? stableOperationUuid(body.operationId)
        : undefined

    const supabase = createServerSupabaseClient()

    // Idempotency: a previously applied operation returns its stored result.
    if (operationId) {
      const existing = await supabase
        .from("match_operations")
        .select("result_revision")
        .eq("operation_id", operationId)
        .maybeSingle()
      if (!existing.error && existing.data) {
        const current = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle()
        return NextResponse.json({
          status: "ok",
          idempotent: true,
          revision: current.data?.revision ?? existing.data.result_revision,
          match: current.data ? matchFromRow(current.data) : null,
        })
      }
    }

    const loaded = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle()
    if (loaded.error) {
      return NextResponse.json({ error: "match_load_failed" }, { status: 503 })
    }
    if (!loaded.data) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }
    const match = matchFromRow(loaded.data)
    if (operationId && hasAppliedOperationId(match, operationId)) {
      return NextResponse.json({
        status: "ok",
        idempotent: true,
        revision: match.revision ?? 0,
        match,
      })
    }

    // Apply through the shared engine (throws RemoteCommandError on bad input).
    let updated: any
    try {
      updated = applyRemoteCommand(match, command, body?.args ?? {})
      // Undo/replay rebuilds domain state from an older seed; it must not rewind
      // the transport's deduplication history.
      updated.appliedOperationIds = appliedOperationIdsOf(match)
      recordAppliedOperationId(updated, operationId)
    } catch (cmdError) {
      if (cmdError instanceof RemoteCommandError) {
        return NextResponse.json(
          { error: cmdError.message, code: cmdError.code, match, revision: match.revision },
          { status: cmdError.status },
        )
      }
      throw cmdError
    }

    const baseRevision = typeof match.revision === "number" ? match.revision : 0
    const resultRevision = baseRevision + 1
    const row = matchToRow(updated)
    row.extras = { ...(loaded.data.extras ?? {}), ...(row.extras ?? {}) }

    // Optimistic-concurrency write: only succeeds while the server is still at
    // the revision this command was based on.
    let writeQuery = supabase
      .from("matches")
      .update({ ...row, revision: resultRevision })
      .eq("id", matchId)
      .select()
    writeQuery = loaded.data.revision == null
      ? writeQuery.is("revision", null)
      : writeQuery.eq("revision", baseRevision)
    const write = await writeQuery

    if (write.error) {
      logEvent("error", `Command API revisioned update failed: ${write.error.message}`, "command-api")
      const courtOccupied = write.error.message?.includes("court_occupied")
      return NextResponse.json(
        { error: write.error.message, code: courtOccupied ? "court_occupied" : "write_failed", match },
        { status: courtOccupied ? 409 : 500 },
      )
    }

    if (write.data && write.data.length > 0) {
      if (operationId) {
        const op = await supabase.from("match_operations").insert({
          operation_id: operationId,
          match_id: matchId,
          base_revision: baseRevision,
          result_revision: resultRevision,
          kind: "remote-command",
          client_id: body?.clientId ?? null,
        })
        if (op.error) {
          // Audit insert failed — the command itself is applied; log loudly so
          // the idempotency gap is visible instead of silent.
          logEvent("error", `Command API operation insert failed: ${op.error.message}`, "command-api")
        }
      }

      // Шаг 3 slice C (§70): после успешной point-команды — автопривязка
      // видео-маркеров к активной записи (MATCH_POINT / SET_POINT / GAME_POINT).
      if (command === "point") {
        void autoMarkVideoEvents(updated)
      }

      // §31: при завершении матча — автоприменение OpenSkill рейтингов
      if (updated?.isCompleted && updated?.winner && !match.isCompleted) {
        void applyCompletionRatings(updated)
      }

      return NextResponse.json({
        status: "ok",
        idempotent: false,
        ...(command === "batch" ? { applied: body.args.commands.length } : {}),
        revision: resultRevision,
        match: matchFromRow(write.data[0]),
      })
    }

    // 0 rows — classify: deleted, legacy (null revision), or genuine conflict.
    const current = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle()
    if (current.error) return NextResponse.json({ error: "match_load_failed" }, { status: 503 })
    if (!current.data) {
      return NextResponse.json({ status: "conflict", reason: "match_deleted" }, { status: 409 })
    }
    const serverRevision = current.data.revision
    // Genuine conflict — hand back the authoritative snapshot for a rebase+retry.
    return NextResponse.json(
      {
        status: "conflict",
        reason: `server_ahead (server=${serverRevision})`,
        revision: serverRevision,
        match: matchFromRow(current.data),
      },
      { status: 409 },
    )
  } catch (error: any) {
    logEvent("error", "Command API internal error", "command-api", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
