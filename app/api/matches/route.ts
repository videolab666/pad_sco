// Match directory for external drivers (Phase 2).
//
// GET /api/matches?limit=20&court=5&active=true
//
// Public like the other read endpoints (vMix compatibility). Returns the
// most recently updated matches with everything a driver needs to pick one:
// id (UUID for the command API), court, status, team player names.

import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

const names = (team: any): string[] =>
  Array.isArray(team?.players) ? team.players.map((p: any) => p?.name).filter(Boolean) : []

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "20", 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20
    const courtRaw = Number.parseInt(url.searchParams.get("court") ?? "", 10)
    const court = Number.isFinite(courtRaw) ? courtRaw : null
    const active = url.searchParams.get("active") === "true"

    const supabase = createServerSupabaseClient()
    let query = supabase
      .from("matches")
      .select("id, type, format, court_number, is_completed, winner, updated_at, revision, team_a, team_b")
      .order("updated_at", { ascending: false })
      .limit(limit)
    if (court !== null) query = query.eq("court_number", court)
    if (active) query = query.eq("is_completed", false)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const headers = new Headers()
    headers.set("Cache-Control", "no-store")
    headers.set("Access-Control-Allow-Origin", "*")

    return new NextResponse(
      JSON.stringify(
        (data ?? []).map((row: any) => ({
          id: row.id,
          type: row.type,
          format: row.format,
          courtNumber: row.court_number ?? null,
          isCompleted: !!row.is_completed,
          winner: row.winner ?? null,
          updatedAt: row.updated_at,
          revision: row.revision ?? 0,
          teamA: names(row.team_a),
          teamB: names(row.team_b),
        })),
      ),
      { status: 200, headers },
    )
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
