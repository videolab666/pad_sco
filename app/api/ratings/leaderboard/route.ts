// GET /api/ratings/leaderboard?rating_type=club — рейтинг клуба (§33).
// Сортировка по conservative_rating (mu - 3σ) — чем увереннее игрок,
// тем выше (§64: rating confidence).

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { conservativeRating, ratingToDisplay } from "@/lib/rating-service"

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const ratingType = url.searchParams.get("rating_type") ?? "club"
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200)

  try {
    const supabase = createServerSupabaseClient()

    // Club ID
    const { data: clubs } = await supabase.from("clubs").select("id").limit(1)
    const clubId = clubs?.[0]?.id
    if (!clubId) {
      return NextResponse.json({ leaderboard: [] })
    }

    const { data, error } = await supabase
      .from("player_ratings")
      .select(`
        player_id, mu, sigma, matches_played, wins, losses, last_match_at,
        players!inner(name)
      `)
      .eq("club_id", clubId)
      .eq("rating_type", ratingType)
      .order("conservative_rating", { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leaderboard = (data ?? []).map((row: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = Array.isArray(row.players) ? row.players[0] : row.players
      return {
        playerId: row.player_id,
        playerName: player?.name ?? "—",
        mu: row.mu,
        sigma: row.sigma,
        conservativeRating: conservativeRating(row.mu, row.sigma),
        displayRating: ratingToDisplay(row.mu, row.sigma),
        matchesPlayed: row.matches_played ?? 0,
        wins: row.wins ?? 0,
        losses: row.losses ?? 0,
        lastMatchAt: row.last_match_at ?? null,
      }
    })

    return NextResponse.json({ leaderboard }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    return NextResponse.json({ error: "leaderboard_failed", message: (err as Error).message }, { status: 500 })
  }
}
