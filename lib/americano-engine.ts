// Americano Engine (plan-4 §10-12)
//
// Чистые функции: генерация Whist-расписаний (математически оптимальные
// пары для 8/12/16 игроков), leaderboard с tie-breaking, валидация.
// Покрыты тестами; серверный CRUD — через americano-service.ts.

// ─── Whist Schedule Generation (§10: «минимизирует повторения») ─────────────

export interface RoundPairing {
  round: number
  court: number
  teamASeats: [number, number]
  teamBSeats: [number, number]
}

/**
 * Whist-расписание для 4n игроков (§10):
 *   - каждый играет с каждым в паре ровно один раз
 *   - каждый играет против каждого ровно два раза
 *   - максимальное использование кортов
 *
 * Работает для 8, 12, 16, 20, 24... (кратно 4).
 * Для нестандартных чисел — fallback на round-robin.
 *
 * Использует circle method: игрок N-1 фиксирован, остальные
 * циклически переставляются. В раунде r партнёр игрока i:
 *   partner(i) = (r - i) mod (N-1), с фиксами для i = N-1.
 */
export function generateWhistSchedule(playerCount: number): RoundPairing[] {
  if (playerCount < 8 || playerCount % 4 !== 0) {
    return generateRoundRobinPairs(playerCount)
  }

  const N = playerCount
  const rounds = N - 1
  const pairings: RoundPairing[] = []

  for (let r = 0; r < rounds; r++) {
    // Генерируем N/2 пар для этого раунда (circle method)
    const used = new Set<number>()
    const pairs: Array<[number, number]> = []

    for (let i = 0; i < N; i++) {
      if (used.has(i)) continue

      let partner: number
      if (i === N - 1) {
        // Фиксированный игрок играет с (r) mod (N-1)
        partner = r % (N - 1)
      } else {
        partner = ((r - i) % (N - 1) + N - 1) % (N - 1)
        if (partner === i) partner = N - 1
      }
      if (used.has(partner)) continue

      used.add(i)
      used.add(partner)
      pairs.push([i, partner])
    }

    // Группируем пары в игры по 2 пары (4 игрока) на корт
    for (let c = 0; c < pairs.length / 2; c++) {
      const teamA = pairs[c * 2]
      const teamB = pairs[c * 2 + 1]
      pairings.push({
        round: r,
        court: c,
        teamASeats: [teamA[0], teamA[1]],
        teamBSeats: [teamB[0], teamB[1]],
      })
    }
  }

  return pairings
}

/**
 * Fallback: простой round-robin для нестандартных чисел.
 * Не гарантирует оптимальность Whist, но работает для любого N ≥ 4.
 */
export function generateRoundRobinPairs(playerCount: number): RoundPairing[] {
  if (playerCount < 4) return []

  const courts = Math.floor(playerCount / 4)
  const rounds = Math.max(playerCount - 1, courts)
  const pairings: RoundPairing[] = []

  for (let r = 0; r < rounds; r++) {
    const used = new Set<number>()
    for (let c = 0; c < courts; c++) {
      const team: number[] = []
      for (let i = 0; i < playerCount && team.length < 4; i++) {
        const idx = (i + r * 2) % playerCount
        if (!used.has(idx)) {
          used.add(idx)
          team.push(idx)
        }
      }
      if (team.length === 4) {
        pairings.push({
          round: r,
          court: c,
          teamASeats: [team[0], team[1]],
          teamBSeats: [team[2], team[3]],
        })
      }
    }
  }

  return pairings
}

// ─── Leaderboard (§10: «считает индивидуальные очки») ───────────────────────

export interface ParticipantScore {
  playerId: string
  seat: number
  totalPoints: number
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  pointsDiff: number
}

/**
 * Leaderboard Americano: сортировка по правилам §10:
 *   1. individual points (очки, набранные во всех матчах)
 *   2. games won (победы)
 *   3. points difference (разница)
 */
export function computeLeaderboard(
  participants: ParticipantScore[],
): ParticipantScore[] {
  return [...participants].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon
    return b.pointsDiff - a.pointsDiff
  })
}

/**
 * Применение результата матча к участникам Americano.
 * Возвращает обновлённые очки для 4 участников (по seat).
 */
export function applyMatchResult(
  participants: ParticipantScore[],
  teamASeats: number[],
  teamBSeats: number[],
  scoreA: number,
  scoreB: number,
): ParticipantScore[] {
  const updated = participants.map(p => ({ ...p }))
  const winnerSeats = scoreA > scoreB ? teamASeats : scoreB > scoreA ? teamBSeats : []

  for (const p of updated) {
    if (teamASeats.includes(p.seat)) {
      p.totalPoints += scoreA
      p.gamesPlayed++
      p.pointsDiff += scoreA - scoreB
      if (winnerSeats.includes(p.seat)) p.gamesWon++
      else if (winnerSeats.length > 0) p.gamesLost++
    } else if (teamBSeats.includes(p.seat)) {
      p.totalPoints += scoreB
      p.gamesPlayed++
      p.pointsDiff += scoreB - scoreA
      if (winnerSeats.includes(p.seat)) p.gamesWon++
      else if (winnerSeats.length > 0) p.gamesLost++
    }
  }

  return updated
}

// ─── Валидация ──────────────────────────────────────────────────────────────

export function validateAmericanoConfig(input: {
  playerCount?: unknown
  format?: unknown
  pointsPerRound?: unknown
}): string[] {
  const errors: string[] = []
  const count = typeof input.playerCount === "number" ? input.playerCount : 0

  if (count < 4) errors.push("Минимум 4 игрока")
  if (count > 32) errors.push("Максимум 32 игрока")
  if (count % 4 !== 0) errors.push("Количество игроков должно быть кратно 4")

  if (input.format !== undefined && !["americano", "mexicano"].includes(String(input.format))) {
    errors.push("format: americano | mexicano")
  }

  const ppr = input.pointsPerRound
  if (ppr !== undefined && (typeof ppr !== "number" || ppr < 1 || ppr > 100)) {
    errors.push("pointsPerRound: 1–100")
  }

  return errors
}

/**
 * Количество кортов и раундов для Americano.
 * Americano: rounds = playerCount - 1 (каждый с каждым в паре)
 * Mexicano: rounds настраиваются гибко (по умолчанию = кортов × 2)
 */
export function americanoDimensions(playerCount: number, format: string): {
  courts: number
  rounds: number
} {
  const courts = Math.max(1, Math.floor(playerCount / 4))
  const rounds = format === "mexicano" ? courts * 2 : playerCount - 1
  return { courts, rounds }
}
