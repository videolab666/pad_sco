// Rating Engine (plan-4 §31-33) — OpenSkill.js адаптер.
//
// §244: RatingService → OpenSkillAdapter → openskill
// В БД сохраняются свои rating_events (лог) и player_ratings (проекция),
// а не структура библиотеки — движок заменяемый (§31).
//
// Pure helpers покрыты тестами; серверный CRUD — service role.

import { createServerSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"
import { checkAndAwardAchievements } from "./achievements"

// ─── Чистые хелперы ─────────────────────────────────────────────────────────

/** Дефолтный рейтинг OpenSkill: mu=25, sigma=25/3 (Weng-Lin). */
export const DEFAULT_MU = 25.0
export const DEFAULT_SIGMA = 25.0 / 3.0

/** Консервативная оценка: mu - k*sigma (§64: rating confidence). */
export function conservativeRating(mu: number, sigma: number, k = 3.0): number {
  return mu - k * sigma
}

/** Отображение рейтинга в «клубную шкалу» 1.0–5.0 для UI (§80). */
export function ratingToDisplay(mu: number, sigma: number): string {
  const conservative = conservativeRating(mu, sigma)
  // Приблизительное отображение: 25±8.33 → центр шкалы
  const clamped = Math.max(0, Math.min(50, conservative + 8.33))
  return (1.0 + (clamped / 50.0) * 4.0).toFixed(2)
}

export interface RatingInput {
  mu: number
  sigma: number
}

export interface RatingUpdate {
  muBefore: number
  sigmaBefore: number
  muAfter: number
  sigmaAfter: number
}

/**
 * Применение рейтингов после матча 2v2 (§31).
 * Возвращает обновления для 4 игроков.
 *
 * ВАЖНО: это чистая функция, использует openskill.js лениво
 * (динамический import в вызывающем коде — для тестов без БД).
 */
export function computeRatingUpdates(
  teamA: RatingInput[],
  teamB: RatingInput[],
  winner: "A" | "B" | "draw",
): RatingUpdate[][] {
  // Ленивый import: openskill.js — тяжёлая библиотека
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { rate, rating } = require("openskill") as {
    rate: (teams: number[][][], options?: Record<string, unknown>) => number[][][]
    rating: (opts?: { mu?: number; sigma?: number }) => { mu: number; sigma: number }
  }

  // Преобразуем в формат openskill: [[{mu,sigma}...], [{mu,sigma}...]]
  const teams = [
    teamA.map(r => rating({ mu: r.mu, sigma: r.sigma })),
    teamB.map(r => rating({ mu: r.mu, sigma: r.sigma })),
  ]

  // score: winner=1, loser=0, draw=0.5
  const score = winner === "A" ? [1, 0] : winner === "B" ? [0, 1] : [0.5, 0.5]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rated = rate(teams as any, { score }) as any

  // Возвращаем обновления
  return rated.map((team: Array<{ mu: number; sigma: number }>) =>
    team.map((r: { mu: number; sigma: number }) => ({
      muBefore: 0, // заполняется вызывающим кодом
      sigmaBefore: 0,
      muAfter: r.mu,
      sigmaAfter: r.sigma,
    })),
  )
}

// ─── Серверный CRUD (service role) ──────────────────────────────────────────

export interface PlayerRatingRecord {
  playerId: string
  playerName: string
  mu: number
  sigma: number
  conservativeRating: number
  displayRating: string
  matchesPlayed: number
  wins: number
  losses: number
}

/**
 * Применить рейтинги после завершения матча (§31-33).
 * Обновляет player_ratings и пишет rating_events.
 */
export async function applyMatchRatings(input: {
  clubId: string
  matchId: string
  teamAPlayerIds: string[]
  teamBPlayerIds: string[]
  winner: "teamA" | "teamB" | null // null = draw
  ratingType?: string
}): Promise<void> {
  const supabase = createServerSupabaseClient()
  const ratingType = input.ratingType ?? "club"
  const winner = input.winner === "teamA" ? "A" : input.winner === "teamB" ? "B" : "draw"

  // Текущие рейтинги (или дефолтные)
  const allIds = [...input.teamAPlayerIds, ...input.teamBPlayerIds]
  const { data: existing } = await supabase
    .from("player_ratings")
    .select("player_id, mu, sigma")
    .eq("club_id", input.clubId)
    .eq("rating_type", ratingType)
    .in("player_id", allIds)

  const ratingsMap = new Map<string, RatingInput>()
  for (const id of allIds) {
    const row = existing?.find((r: { player_id: string }) => r.player_id === id)
    ratingsMap.set(id, row ? { mu: row.mu, sigma: row.sigma } : { mu: DEFAULT_MU, sigma: DEFAULT_SIGMA })
  }

  const teamA = input.teamAPlayerIds.map(id => ratingsMap.get(id)!)
  const teamB = input.teamBPlayerIds.map(id => ratingsMap.get(id)!)

  // Вычисляем обновления
  const updates = computeRatingUpdates(teamA, teamB, winner as "A" | "B" | "draw")

  // Записываем
  const allUpdates = [
    ...input.teamAPlayerIds.map((id, i) => ({
      playerId: id,
      ...teamA[i],
      ...updates[0][i],
    })),
    ...input.teamBPlayerIds.map((id, i) => ({
      playerId: id,
      ...teamB[i],
      ...updates[1][i],
    })),
  ]

  for (const u of allUpdates) {
    // rating_events (лог)
    await supabase.from("rating_events").insert({
      club_id: input.clubId,
      player_id: u.playerId,
      match_id: input.matchId,
      mu_before: u.mu,
      sigma_before: u.sigma,
      mu_after: u.muAfter,
      sigma_after: u.sigmaAfter,
      rating_type: ratingType,
    })

    // player_ratings (upsert проекции)
    const isWinner =
      (winner === "A" && input.teamAPlayerIds.includes(u.playerId)) ||
      (winner === "B" && input.teamBPlayerIds.includes(u.playerId))
    const isLoser =
      (winner === "B" && input.teamAPlayerIds.includes(u.playerId)) ||
      (winner === "A" && input.teamBPlayerIds.includes(u.playerId))

    await supabase
      .from("player_ratings")
      .upsert(
        {
          club_id: input.clubId,
          player_id: u.playerId,
          rating_type: ratingType,
          mu: u.muAfter,
          sigma: u.sigmaAfter,
          matches_played: 1, // increment через SQL
          wins: isWinner ? 1 : 0,
          losses: isLoser ? 1 : 0,
          last_match_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "club_id,player_id,rating_type" },
      )

    // Инкремент счётчиков (upsert не суммирует — делаем update)
    await supabase.rpc("increment_rating_counters", {
      p_club_id: input.clubId,
      p_player_id: u.playerId,
      p_rating_type: ratingType,
      p_won: isWinner,
      p_lost: isLoser,
    }).then(({ error }: { error: { message: string } | null }) => {
      if (error && !error.message.includes("does not exist")) {
        logEvent("warn", `rating-service: increment: ${error.message}`, "applyMatchRatings")
      }
    })
  }

  logEvent("info", `rating-service: применены рейтинги для ${allIds.length} игроков (${input.matchId.slice(0, 8)}…)`, "applyMatchRatings")
}

/**
 * Club Leaderboard (§33): топ игроков по консервативному рейтингу.
 */
/**
 * §31: Автоприменение рейтингов при завершении матча.
 * Вызывается из командного роута когда матч стал isCompleted.
 * Извлекает player_id из teamA/teamB и применяет OpenSkill.
 */
export async function applyCompletionRatings(match: Record<string, unknown>): Promise<void> {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) return

    // Club ID
    const { data: clubs } = await supabase.from("clubs").select("id").limit(1)
    const clubId = clubs?.[0]?.id
    if (!clubId) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = match as any
    const teamAIds = (m?.teamA?.players ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => p?.id)
      .filter((id: unknown): id is string => typeof id === "string" && id.length > 10)
    const teamBIds = (m?.teamB?.players ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => p?.id)
      .filter((id: unknown): id is string => typeof id === "string" && id.length > 10)

    if (teamAIds.length === 0 || teamBIds.length === 0) return

    const winner = m?.winner === "teamA" ? "teamA" : m?.winner === "teamB" ? "teamB" : null

    await applyMatchRatings({
      clubId,
      matchId: m.id,
      teamAPlayerIds: teamAIds,
      teamBPlayerIds: teamBIds,
      winner,
      ratingType: m?.type === "quick-play" ? "americano" : "club",
    })

    logEvent("info", `rating: применены рейтинги после матча ${m.id?.slice(0, 8)} (${teamAIds.length}+${teamBIds.length} игроков)`, "applyCompletionRatings")

    // §34: проверяем и выдаём достижения для всех игроков
    for (const pid of [...teamAIds, ...teamBIds]) {
      void checkAndAwardAchievements(pid, clubId)
    }
  } catch (err) {
    // Тихо: рейтинги — опциональная функция, не ломают матч
    logEvent("warn", `applyCompletionRatings: ${(err as Error).message}`, "applyCompletionRatings")
  }
}

export async function getLeaderboard(clubId: string, ratingType = "club", limit = 50): Promise<PlayerRatingRecord[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("player_ratings")
    .select(`
      player_id, mu, sigma, matches_played, wins, losses,
      players!inner(name)
    `)
    .eq("club_id", clubId)
    .eq("rating_type", ratingType)
    .order("conservative_rating", { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getLeaderboard: ${error.message}`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    playerId: row.player_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    playerName: (Array.isArray(row.players) ? row.players[0] : row.players)?.name ?? "—",
    mu: row.mu,
    sigma: row.sigma,
    conservativeRating: conservativeRating(row.mu, row.sigma),
    displayRating: ratingToDisplay(row.mu, row.sigma),
    matchesPlayed: row.matches_played ?? 0,
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
  }))
}
