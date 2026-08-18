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
import { getMatchFromServer } from "@/lib/server-match-storage"
import { logEvent } from "@/lib/error-logger"
import { createServerSupabaseClient } from "@/lib/supabase"
import { matchFromRow, matchToRow } from "@/lib/match-supabase"
import { applyRemoteCommand, RemoteCommandError, stableOperationUuid } from "@/lib/remote-commands"

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
          revision: existing.data.result_revision,
          match: current.data ? matchFromRow(current.data) : null,
        })
      }
    }

    const match = await getMatchFromServer(matchId)
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }

    // Apply through the shared engine (throws RemoteCommandError on bad input).
    let updated: any
    try {
      updated = applyRemoteCommand(match, command, body?.args ?? {})
    } catch (cmdError) {
      if (cmdError instanceof RemoteCommandError) {
        return NextResponse.json(
          { error: cmdError.message, code: cmdError.code },
          { status: cmdError.status },
        )
      }
      throw cmdError
    }

    const baseRevision = typeof match.revision === "number" ? match.revision : 0
    const resultRevision = baseRevision + 1
    const row = matchToRow(updated)

    // Optimistic-concurrency write: only succeeds while the server is still at
    // the revision this command was based on.
    const write = await supabase
      .from("matches")
      .update({ ...row, revision: resultRevision })
      .eq("id", matchId)
      .eq("revision", baseRevision)
      .select()

    if (write.error) {
      logEvent("error", `Command API revisioned update failed: ${write.error.message}`, "command-api")
      return NextResponse.json({ error: write.error.message }, { status: 500 })
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
      return NextResponse.json({
        status: "ok",
        idempotent: false,
        revision: resultRevision,
        match: matchFromRow(write.data[0]),
      })
    }

    // 0 rows — classify: deleted, legacy (null revision), or genuine conflict.
    const current = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle()
    if (current.error || !current.data) {
      return NextResponse.json({ status: "conflict", reason: "match_deleted" }, { status: 409 })
    }
    const serverRevision = current.data.revision
    if (serverRevision === null || serverRevision === undefined) {
      // Legacy row without a revision — adopt it and retry the write.
      const adopt = await supabase
        .from("matches")
        .update({ ...row, revision: resultRevision })
        .eq("id", matchId)
        .select()
      return NextResponse.json({
        status: "ok",
        idempotent: false,
        revision: resultRevision,
        match: matchFromRow(adopt.data?.[0] ?? current.data),
      })
    }
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
