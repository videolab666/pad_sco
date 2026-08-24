// Achievements auto-award (plan-4 §34) — автоматическая выдача достижений.
//
// Вызывается после завершения матча (из rating-service applyCompletionRatings).
// Проверяет условия и выдаёт новые достижения.

import { createServerSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"

interface AchievementCondition {
  type: string
  title: string
  description: string
  icon: string
  // Условие: функция проверяет статистику игрока
  check: (stats: PlayerStats) => boolean
}

interface PlayerStats {
  matchesPlayed: number
  wins: number
  losses: number
  winStreak: number
  longestWinStreak: number
  tournamentsWon: number
  americanoWins: number
}

/** Каталог достижений (§34: «не превращать в обязательную часть ядра») */
const ACHIEVEMENTS: AchievementCondition[] = [
  {
    type: "first_match",
    title: "Первый матч",
    description: "Сыграл первый матч в клубе",
    icon: "🎯",
    check: (s) => s.matchesPlayed >= 1,
  },
  {
    type: "matches_10",
    title: "10 матчей",
    description: "Сыграл 10 матчей",
    icon: "⚔️",
    check: (s) => s.matchesPlayed >= 10,
  },
  {
    type: "matches_50",
    title: "50 матчей",
    description: "Сыграл 50 матчей — настоящий ветеран",
    icon: "🏅",
    check: (s) => s.matchesPlayed >= 50,
  },
  {
    type: "matches_100",
    title: "100 матчей",
    description: "100 матчей — легенда клуба!",
    icon: "💎",
    check: (s) => s.matchesPlayed >= 100,
  },
  {
    type: "win_streak_3",
    title: "Серия из 3",
    description: "3 победы подряд",
    icon: "🔥",
    check: (s) => s.longestWinStreak >= 3,
  },
  {
    type: "win_streak_5",
    title: "Серия из 5",
    description: "5 побед подряд — неудержим!",
    icon: "⚡",
    check: (s) => s.longestWinStreak >= 5,
  },
  {
    type: "wins_10",
    title: "10 побед",
    description: "10 побед в активе",
    icon: "🏆",
    check: (s) => s.wins >= 10,
  },
  {
    type: "wins_25",
    title: "25 побед",
    description: "25 побед — мастер корта",
    icon: "👑",
    check: (s) => s.wins >= 25,
  },
]

/**
 * Проверяет и выдаёт достижения после завершения матча.
 * Не бросает: ошибки логируются, матч не ломается.
 */
export async function checkAndAwardAchievements(playerId: string, clubId: string): Promise<void> {
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) return

    // Текущая статистика
    const { data: rating } = await supabase
      .from("player_ratings")
      .select("matches_played, wins, losses")
      .eq("club_id", clubId)
      .eq("player_id", playerId)
      .eq("rating_type", "club")
      .single()

    if (!rating) return

    // Win streak: считаем из последних матчей
    const { data: recentWins } = await supabase
      .from("rating_events")
      .select("mu_after, mu_before")
      .eq("club_id", clubId)
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(20)

    let currentStreak = 0
    let longestStreak = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ev of (recentWins ?? []) as any[]) {
      if (ev.mu_after > ev.mu_before) {
        currentStreak++
        longestStreak = Math.max(longestStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    }

    const stats: PlayerStats = {
      matchesPlayed: rating.matches_played ?? 0,
      wins: rating.wins ?? 0,
      losses: rating.losses ?? 0,
      winStreak: currentStreak,
      longestWinStreak: longestStreak,
      tournamentsWon: 0,
      americanoWins: 0,
    }

    // Уже выданные достижения
    const { data: existing } = await supabase
      .from("player_achievements")
      .select("achievement_type")
      .eq("club_id", clubId)
      .eq("player_id", playerId)

    const existingTypes = new Set((existing ?? []).map((e: { achievement_type: string }) => e.achievement_type))

    // Проверяем и выдаём
    for (const ach of ACHIEVEMENTS) {
      if (existingTypes.has(ach.type)) continue
      if (ach.check(stats)) {
        await supabase.from("player_achievements").insert({
          player_id: playerId,
          club_id: clubId,
          achievement_type: ach.type,
          title: ach.title,
          description: ach.description,
          icon: ach.icon,
        })
        logEvent("info", `achievements: ${ach.title} выдано игроку ${playerId.slice(0, 8)}`, "achievements")
      }
    }
  } catch (err) {
    // Тихо: достижения — опциональная функция
    logEvent("warn", `achievements: ${(err as Error).message}`, "achievements")
  }
}
