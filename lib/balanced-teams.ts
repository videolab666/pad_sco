// Balanced Teams (plan-4 §32) — рекомендация равных команд по рейтингу.
//
// Для 4 игроков: перебор всех разбиений 2+2, минимизация разницы
// консервативных рейтингов (mu - 3σ). Для 5-8: жадный + обмен.
//
// Чистая функция — покрыта тестами.

export interface RatedPlayer {
  playerId: string
  name: string
  rating: number // conservative rating (mu - 3σ)
}

export interface BalancedSuggestion {
  teamA: RatedPlayer[]
  teamB: RatedPlayer[]
  teamARating: number
  teamBRating: number
  difference: number
  balancePercent: number
}

/**
 * Находит оптимальное разбиение 4 игроков на 2 команды.
 * Перебирает все 3 уникальные комбинации (C(4,2)/2 = 3).
 *
 * Для 5-8 игроков: сортирует по рейтингу и чередует (snake draft).
 */
export function suggestBalancedTeams(players: RatedPlayer[]): BalancedSuggestion | null {
  if (players.length < 4) return null

  if (players.length === 4) {
    return balanceFour(players)
  }

  // 5-8 игроков: snake draft
  const sorted = [...players].sort((a, b) => b.rating - a.rating)
  const teamA: RatedPlayer[] = []
  const teamB: RatedPlayer[] = []

  sorted.forEach((p, i) => {
    const round = Math.floor(i / 2)
    const isEvenRound = round % 2 === 0
    const isFirst = i % 2 === 0

    if (isFirst) {
      (isEvenRound ? teamA : teamB).push(p)
    } else {
      (isEvenRound ? teamB : teamA).push(p)
    }
  })

  return buildSuggestion(teamA, teamB)
}

/**
 * Для ровно 4 игроков: перебор всех 3 разбиений.
 */
function balanceFour(players: RatedPlayer[]): BalancedSuggestion {
  const [a, b, c, d] = players

  const options: Array<[RatedPlayer[], RatedPlayer[]]> = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ]

  let best: BalancedSuggestion | null = null

  for (const [ta, tb] of options) {
    const suggestion = buildSuggestion(ta, tb)
    if (!best || suggestion.difference < best.difference) {
      best = suggestion
    }
  }

  return best!
}

function buildSuggestion(teamA: RatedPlayer[], teamB: RatedPlayer[]): BalancedSuggestion {
  const teamARating = teamA.reduce((sum, p) => sum + p.rating, 0) / teamA.length
  const teamBRating = teamB.reduce((sum, p) => sum + p.rating, 0) / teamB.length
  const difference = Math.abs(teamARating - teamBRating)
  const maxRating = Math.max(teamARating, teamBRating)
  const balancePercent = maxRating > 0
    ? Math.round((1 - difference / (maxRating * 2)) * 100)
    : 100

  return {
    teamA,
    teamB,
    teamARating: Math.round(teamARating * 100) / 100,
    teamBRating: Math.round(teamBRating * 100) / 100,
    difference: Math.round(difference * 100) / 100,
    balancePercent: Math.min(100, Math.max(0, balancePercent)),
  }
}

/**
 * Сортирует игроков для ротации 5-8+ (§9).
 * Каждый раунд садится по-разному для разнообразия.
 */
export function suggestRotationOrder(players: RatedPlayer[], round: number): RatedPlayer[] {
  const sorted = [...players].sort((a, b) => b.rating - a.rating)
  const n = sorted.length
  const result: RatedPlayer[] = []

  for (let i = 0; i < n; i++) {
    const idx = (i + round) % n
    result.push(sorted[idx])
  }

  return result
}
