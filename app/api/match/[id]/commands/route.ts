// Batch remote-control endpoint (Phase 2).
//
// POST /api/match/[id]/commands
//   Headers: X-API-Key: <SCOREBOARD_API_KEY>
//   Body:    { operationId?: string, commands: [{ command, args? }] }
//
// Applies the whole sequence atomically against one loaded snapshot: either
// every command applies (single revision bump, one audit row) or nothing is
// written — a failing command aborts the batch with 400 and its index.
// Per-command `operationId`s are not recorded; idempotency works at the
// batch level via the outer `operationId`.

import { NextResponse } from "next/server"
import { isAuthorizedApiRequest } from "@/lib/api-auth"
import { getMatchFromServer } from "@/lib/server-match-storage"
import { logEvent } from "@/lib/error-logger"
import { createServerSupabaseClient } from "@/lib/supabase"
import { matchFromRow, matchToRow } from "@/lib/match-supabase"
import { applyRemoteBatch, RemoteCommandError, stableOperationUuid } from "@/lib/remote-commands"

const MAX_BATCH = 100

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isAuthorizedApiRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const matchId = resolvedParams.id
    if (!matchId) {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const commands = body?.commands
    if (!Array.isArray(commands) || commands.length === 0 || commands.length > MAX_BATCH) {
      return NextResponse.json({ error: `commands must be a non-empty array of at most ${MAX_BATCH}` }, { status: 400 })
    }

    const operationId: string | undefined =
      typeof body?.operationId === "string" && body.operationId.length > 0
        ? stableOperationUuid(body.operationId)
        : undefined

    const supabase = createServerSupabaseClient()

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

    let updated: any
    try {
      updated = applyRemoteBatch(match, commands)
    } catch (cmdError) {
      if (cmdError instanceof RemoteCommandError) {
        return NextResponse.json({ error: cmdError.message, code: cmdError.code }, { status: cmdError.status })
      }
      throw cmdError
    }

    const baseRevision = typeof match.revision === "number" ? match.revision : 0
    const resultRevision = baseRevision + 1
    const row = matchToRow(updated)

    const write = await supabase
      .from("matches")
      .update({ ...row, revision: resultRevision })
      .eq("id", matchId)
      .eq("revision", baseRevision)
      .select()

    if (write.error) {
      logEvent("error", `Batch API revisioned update failed: ${write.error.message}`, "command-api")
      return NextResponse.json({ error: write.error.message }, { status: 500 })
    }

    if (write.data && write.data.length > 0) {
      if (operationId) {
        const op = await supabase.from("match_operations").insert({
          operation_id: operationId,
          match_id: matchId,
          base_revision: baseRevision,
          result_revision: resultRevision,
          kind: "remote-batch",
          client_id: body?.clientId ?? null,
        })
        if (op.error) {
          logEvent("error", `Batch API operation insert failed: ${op.error.message}`, "command-api")
        }
      }
      return NextResponse.json({
        status: "ok",
        idempotent: false,
        applied: commands.length,
        revision: resultRevision,
        match: matchFromRow(write.data[0]),
      })
    }

    const current = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle()
    if (current.error || !current.data) {
      return NextResponse.json({ status: "conflict", reason: "match_deleted" }, { status: 409 })
    }
    const serverRevision = current.data.revision
    if (serverRevision === null || serverRevision === undefined) {
      const adopt = await supabase
        .from("matches")
        .update({ ...row, revision: resultRevision })
        .eq("id", matchId)
        .select()
      return NextResponse.json({
        status: "ok",
        idempotent: false,
        applied: commands.length,
        revision: resultRevision,
        match: matchFromRow(adopt.data?.[0] ?? current.data),
      })
    }
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
    logEvent("error", "Batch API internal error", "command-api", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
