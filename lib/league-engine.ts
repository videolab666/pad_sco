// League Engine (plan-4 §81) — round-robin fixtures + standings.
//
// Чистые функции: генерация fixtures, обновление таблицы,
// продвижение/вылет. Покрыты тестами.

export interface Fixture {
  round: number
  playerAId: string
  playerBId: string
}

export interface Standing {
  playerId: string
  played: number
  won: number
  lost: number
  setsWon: number
  setsLost: number
  points: number
}

/**
 * Round-robin fixtures (Berger tables): каждый играет с каждым один раз.
 * Для N игроков → N-1 раундов (N-1)/2 матчей в раунде.
 */
export function generateRoundRobin(playerIds: string[]): Fixture[] {
  if (playerIds.length < 2) return []

  const n = playerIds.length
  // Для нечётного количества добавляем фиктивного игрока (bye)
  const ids = n % 2 === 0 ? [...playerIds] : [...playerIds, "__bye__"]
  const rounds = ids.length - 1
  const fixtures: Fixture[] = []

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < ids.length / 2; i++) {
      const a = ids[i]
      const b = ids[ids.length - 1 - i]
      if (a === "__bye__" || b === "__bye__") continue
      fixtures.push({ round: r, playerAId: a, playerBId: b })
    }
    // Ротация: фиксируем первого, сдвигаем остальных
    ids.splice(1, 0, ids.pop()!)
  }

  return fixtures
}

/**
 * Обновление standings после результата матча.
 * Очки: победа = 3, поражение = 1 (настраивается).
 */
export function applyFixtureResult(
  standings: Standing[],
  playerAId: string,
  playerBId: string,
  setsA: number,
  setsB: number,
  pointsForWin = 3,
  pointsForLoss = 1,
): Standing[] {
  const updated = standings.map(s => ({ ...s }))
  const a = updated.find(s => s.playerId === playerAId)
  const b = updated.find(s => s.playerId === playerBId)
  if (!a || !b) return updated

  a.played++
  b.played++
  a.setsWon += setsA
  a.setsLost += setsB
  b.setsWon += setsB
  b.setsLost += setsA

  if (setsA > setsB) {
    a.won++; a.points += pointsForWin
    b.lost++; b.points += pointsForLoss
  } else if (setsB > setsA) {
    b.won++; b.points += pointsForWin
    a.lost++; a.points += pointsForLoss
  }

  return updated
}

/**
 * Сортировка таблицы: очки → разница сетов → победы.
 */
export function computeStandings(standings: Standing[]): Standing[] {
  return [...standings].sort((a, b) =>
    b.points - a.points ||
    (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost) ||
    b.won - a.won
  )
}

/**
 * Продвижение/вылет (§81): топ-N поднимаются, нижние-N вылетают.
 */
export function getPromotionsAndRelegations(
  standings: Standing[],
  promoteCount: number,
  relegateCount: number,
): { promote: string[]; relegate: string[] } {
  const sorted = computeStandings(standings)
  return {
    promote: sorted.slice(0, promoteCount).map(s => s.playerId),
    relegate: sorted.slice(-relegateCount).map(s => s.playerId),
  }
}
