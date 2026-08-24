// King of Court (plan-4 §12) — ротация по иерархии кортов.
//
// Несколько кортов с иерархией (King Court → Court 2 → Court 3 ...).
// Победители поднимаются вверх, проигравшие опускаются вниз.
// Timed rounds + automatic rotation + live ranking.
//
// Чистые функции — покрыты тестами.

export interface KingPlayer {
  playerId: string
  name: string
  position: number // 0 = King Court
}

export interface KingCourtMatch {
  courtLevel: number // 0 = King
  teamA: KingPlayer[]
  teamB: KingPlayer[]
  scoreA?: number
  scoreB?: number
  winner?: "A" | "B"
}

export interface KingState {
  players: KingPlayer[]
  courts: number
  currentRound: number
  matches: KingCourtMatch[]
}

/**
 * Инициализация: распределяет игроков по кортам (лучшие → King Court).
 */
export function initKingOfCourt(
  players: Array<{ playerId: string; name: string; rating?: number }>,
  courts: number,
): KingState {
  const sorted = [...players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  const kingPlayers: KingPlayer[] = sorted.map((p, i) => ({
    playerId: p.playerId,
    name: p.name,
    position: Math.floor(i / 4), // 4 игрока на корт
  }))

  const matches = buildRoundMatches(kingPlayers, courts)

  return {
    players: kingPlayers,
    courts,
    currentRound: 0,
    matches,
  }
}

/**
 * Строит матчи раунда: по 4 игрока на корт, 2vs2.
 */
function buildRoundMatches(players: KingPlayer[], courts: number): KingCourtMatch[] {
  const matches: KingCourtMatch[] = []

  for (let level = 0; level < courts; level++) {
    const courtPlayers = players.filter(p => p.position === level)
    if (courtPlayers.length < 4) continue

    matches.push({
      courtLevel: level,
      teamA: [courtPlayers[0], courtPlayers[3]], // сильный + слабый
      teamB: [courtPlayers[1], courtPlayers[2]],
    })
  }

  return matches
}

/**
 * Применяет результат матча: победители поднимаются, проигравшие опускаются.
 */
export function applyKingResult(
  state: KingState,
  matchIndex: number,
  scoreA: number,
  scoreB: number,
): KingState {
  const match = state.matches[matchIndex]
  if (!match || match.winner) return state

  const winner: "A" | "B" = scoreA > scoreB ? "A" : "B"
  const winners = winner === "A" ? match.teamA : match.teamB
  const losers = winner === "A" ? match.teamB : match.teamA

  // Обновляем позиции
  const updated = state.players.map(p => ({ ...p }))

  // Победители → вверх (position - 1, min 0)
  for (const w of winners) {
    const player = updated.find(p => p.playerId === w.playerId)
    if (player) player.position = Math.max(0, player.position - 1)
  }

  // Проигравшие → вниз (position + 1, max courts - 1)
  for (const l of losers) {
    const player = updated.find(p => p.playerId === l.playerId)
    if (player) player.position = Math.min(state.courts - 1, player.position + 1)
  }

  // Записываем результат
  const updatedMatches = state.matches.map((m, i) =>
    i === matchIndex ? { ...m, scoreA, scoreB, winner } : m
  )

  return { ...state, players: updated, matches: updatedMatches }
}

/**
 * Следующий раунд: строит новые матчи по обновлённым позициям.
 */
export function nextKingRound(state: KingState): KingState {
  return {
    ...state,
    currentRound: state.currentRound + 1,
    matches: buildRoundMatches(state.players, state.courts),
  }
}

/**
 * Live ranking: сортировка по позиции корта (King = #1).
 */
export function getKingRanking(state: KingState): KingPlayer[] {
  return [...state.players].sort((a, b) => a.position - b.position)
}

/**
 * Проверяет: все ли матчи текущего раунда завершены?
 */
export function isRoundComplete(state: KingState): boolean {
  return state.matches.every(m => m.winner !== undefined)
}
