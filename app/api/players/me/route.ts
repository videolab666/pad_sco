// GET /api/players/me — личный кабинет игрока (§44, §84).
//
// Возвращает: профиль, рейтинг, историю матчей (последние 20),
// статистику (W/L, win rate, длительность), достижения, партнёров.
//
// Auth: player_id из query параметра (v1: QR-код/выбор игрока;
// позже — Supabase Auth привязка к player_id).

import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { conservativeRating, ratingToDisplay } from "@/lib/rating-service"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const playerId = url.searchParams.get("player_id")
  if (!playerId || !/^[0-9a-f-]{36}$/i.test(playerId)) {
    return NextResponse.json({ error: "player_id обязателен (UUID)" }, { status: 400 })
  }

  try {
    const supabase = createServerSupabaseClient()

    // ─── Игрок ────────────────────────────────────────────────────────
    const { data: player } = await supabase
      .from("players")
      .select("id, name, created_at")
      .eq("id", playerId)
      .single()

    if (!player) {
      return NextResponse.json({ error: "player_not_found" }, { status: 404 })
    }

    // Club ID
    const { data: clubs } = await supabase.from("clubs").select("id").limit(1)
    const clubId = clubs?.[0]?.id

    // ─── Профиль ──────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("player_profiles")
      .select("*")
      .eq("player_id", playerId)
      .single()

    // ─── Рейтинг ──────────────────────────────────────────────────────
    let rating: Record<string, unknown> | null = null
    if (clubId) {
      const { data: ratingRow } = await supabase
        .from("player_ratings")
        .select("mu, sigma, matches_played, wins, losses, last_match_at")
        .eq("club_id", clubId)
        .eq("player_id", playerId)
        .eq("rating_type", "club")
        .single()

      if (ratingRow) {
        rating = {
          mu: ratingRow.mu,
          sigma: ratingRow.sigma,
          display: ratingToDisplay(ratingRow.mu, ratingRow.sigma),
          conservative: conservativeRating(ratingRow.mu, ratingRow.sigma),
          matchesPlayed: ratingRow.matches_played,
          wins: ratingRow.wins,
          losses: ratingRow.losses,
          winRate: ratingRow.matches_played > 0
            ? Math.round((ratingRow.wins / ratingRow.matches_played) * 100)
            : 0,
          lastMatchAt: ratingRow.last_match_at,
        }
      }
    }

    // ─── История матчей (последние 20) ───────────────────────────────
    const { data: matchRows } = await supabase
      .from("matches")
      .select("id, is_completed, winner, created_at, settings, team_a, team_b, score, court_id, courts(name)")
      .eq("is_completed", true)
      .order("created_at", { ascending: false })
      .limit(100)

    // Фильтруем матчи с этим игроком
    const history = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (matchRows ?? []) as any[]) {
      const teamAPlayers = row.team_a?.players ?? []
      const teamBPlayers = row.team_b?.players ?? []
      const inA = teamAPlayers.some((p: { id?: string }) => p?.id === playerId)
      const inB = teamBPlayers.some((p: { id?: string }) => p?.id === playerId)
      if (!inA && !inB) continue

      const isWinner = (inA && row.winner === "teamA") || (inB && row.winner === "teamB")
      const partner = inA
        ? teamAPlayers.find((p: { id?: string }) => p?.id !== playerId)?.name
        : teamBPlayers.find((p: { id?: string }) => p?.id !== playerId)?.name
      const opponents = inA
        ? teamBPlayers.map((p: { name?: string }) => p?.name).filter(Boolean).join(" / ")
        : teamAPlayers.map((p: { name?: string }) => p?.name).filter(Boolean).join(" / ")

      // Счёт сетов
      const sets = (row.score?.sets ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any) => inA ? `${s.teamA}:${s.teamB}` : `${s.teamB}:${s.teamA}`)
        .join(" ")

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const court: any = Array.isArray(row.courts) ? row.courts[0] : row.courts

      history.push({
        id: row.id,
        date: row.created_at,
        won: isWinner,
        partner: partner ?? "",
        opponents,
        score: sets,
        court: court?.name ?? "",
        duration: row.settings?.timing?.matchDuration ?? null,
      })

      if (history.length >= 20) break
    }

    // ─── Достижения ───────────────────────────────────────────────────
    const { data: achievements } = await supabase
      .from("player_achievements")
      .select("achievement_type, title, description, icon, earned_at")
      .eq("player_id", playerId)
      .order("earned_at", { ascending: false })

    // ─── Партнёры (кто чаще всего играет с этим игроком) ─────────────
    const partnerCount = new Map<string, number>()
    for (const h of history) {
      if (h.partner) {
        partnerCount.set(h.partner, (partnerCount.get(h.partner) ?? 0) + 1)
      }
    }
    const frequentPartners = [...partnerCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // ─── Сборка ───────────────────────────────────────────────────────
    return NextResponse.json(
      {
        player: {
          id: player.id,
          name: player.name,
          memberSince: player.created_at,
        },
        profile: profile ? {
          bio: profile.bio,
          avatarUrl: profile.avatar_url,
          preferredSide: profile.preferred_side,
          publicRating: profile.public_rating,
          publicHistory: profile.public_history,
        } : null,
        rating,
        history,
        achievements: achievements ?? [],
        frequentPartners,
        stats: {
          totalMatches: rating?.matchesPlayed ?? 0,
          wins: rating?.wins ?? 0,
          losses: rating?.losses ?? 0,
          winRate: rating?.winRate ?? 0,
        },
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: "internal_error", message: (error as Error).message },
      { status: 500 },
    )
  }
}
