// Americano Service (plan-4 §10-12) — серверный CRUD через service role.
// Чистая логика (расписания, leaderboard) в americano-engine.ts.

import { createServerSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"
import {
  americanoDimensions,
  applyMatchResult,
  computeLeaderboard,
  generateMexicanoPairings,
  generateWhistSchedule,
  validateAmericanoConfig,
  type ParticipantScore,
  type RoundPairing,
} from "./americano-engine"

// ─── Типы ───────────────────────────────────────────────────────────────────

export interface AmericanoEvent {
  id: string
  name: string
  format: "americano" | "mexicano"
  status: "creating" | "active" | "completed" | "cancelled"
  playerCount: number
  courtCount: number
  pointsPerRound: number
  totalRounds: number
  currentRound: number
  startedAt: string | null
  completedAt: string | null
  participants: AmericanoParticipant[]
}

export interface AmericanoParticipant {
  playerId: string
  playerName: string
  seat: number | null
  totalPoints: number
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  pointsDiff: number
}

export interface AmericanoRound {
  roundNumber: number
  status: "pending" | "playing" | "completed"
  matches: AmericanoMatch[]
}

export interface AmericanoMatch {
  id: string
  courtNumber: number
  teamASeats: number[]
  teamBSeats: number[]
  teamAPlayers: string[]
  teamBPlayers: string[]
  scoreA: number | null
  scoreB: number | null
  winner: string | null
}

// ─── Создание ───────────────────────────────────────────────────────────────

export async function createAmericanoEvent(input: {
  name?: string
  format?: string
  playerIds: string[]
  pointsPerRound?: number
}): Promise<AmericanoEvent> {
  const playerCount = input.playerIds.length
  const errors = validateAmericanoConfig({
    playerCount,
    format: input.format,
    pointsPerRound: input.pointsPerRound,
  })
  if (errors.length > 0) throw new AmericanoValidationError(errors)

  const format = (input.format ?? "americano") as "americano" | "mexicano"
  const { courts, rounds } = americanoDimensions(playerCount, format)

  const supabase = createServerSupabaseClient()

  // Club ID
  const { data: clubs } = await supabase.from("clubs").select("id").limit(1)
  const clubId = clubs?.[0]?.id
  if (!clubId) throw new Error("Клуб не найден")

  // Создаём событие
  const { data: event, error } = await supabase
    .from("americano_events")
    .insert({
      club_id: clubId,
      name: input.name ?? `${format === "americano" ? "Americano" : "Mexicano"} ${new Date().toLocaleDateString("ru-RU")}`,
      format,
      player_count: playerCount,
      court_count: courts,
      points_per_round: input.pointsPerRound ?? 16,
      total_rounds: rounds,
      status: "creating",
    })
    .select("*")
    .single()
  if (error || !event) throw new Error(`createAmericanoEvent: ${error?.message}`)

  // Участники
  const seats = [...input.playerIds.keys()]
  const participantRows = input.playerIds.map((playerId, i) => ({
    event_id: event.id,
    player_id: playerId,
    seat: seats[i],
  }))
  const { error: pErr } = await supabase.from("americano_participants").insert(participantRows)
  if (pErr) throw new Error(`participants: ${pErr.message}`)

  return (await getAmericanoEvent(event.id)) as AmericanoEvent
}

// ─── Чтение ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEvent(row: any, participants: AmericanoParticipant[]): AmericanoEvent {
  return {
    id: row.id,
    name: row.name,
    format: row.format,
    status: row.status,
    playerCount: row.player_count,
    courtCount: row.court_count,
    pointsPerRound: row.points_per_round,
    totalRounds: row.total_rounds,
    currentRound: row.current_round,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    participants,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToParticipant(row: any, playerName: string): AmericanoParticipant {
  return {
    playerId: row.player_id,
    playerName,
    seat: row.seat ?? null,
    totalPoints: row.total_points ?? 0,
    gamesPlayed: row.games_played ?? 0,
    gamesWon: row.games_won ?? 0,
    gamesLost: row.games_lost ?? 0,
    pointsDiff: row.points_diff ?? 0,
  }
}

export async function getAmericanoEvent(id: string): Promise<AmericanoEvent | null> {
  const supabase = createServerSupabaseClient()

  const { data: event } = await supabase
    .from("americano_events")
    .select("*")
    .eq("id", id)
    .single()
  if (!event) return null

  // Участники с именами
  const { data: parts } = await supabase
    .from("americano_participants")
    .select("*, players!inner(name)")
    .eq("event_id", id)
    .order("seat")

  const participants = (parts ?? []).map((p: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const player = Array.isArray(p.players) ? (p.players as any[])[0] : (p.players as any)
    return rowToParticipant(p, player?.name ?? "—")
  })

  return rowToEvent(event, participants)
}

export async function listAmericanoEvents(filter: { status?: string; limit?: number } = {}): Promise<AmericanoEvent[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("americano_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 20)
  if (filter.status) query = query.eq("status", filter.status)

  const { data, error } = await query
  if (error) throw new Error(`listAmericanoEvents: ${error.message}`)

  // Догружаем участников
  const events: AmericanoEvent[] = []
  for (const row of data ?? []) {
    const { data: parts } = await supabase
      .from("americano_participants")
      .select("*, players!inner(name)")
      .eq("event_id", row.id)
      .order("seat")
    const participants = (parts ?? []).map((p: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = Array.isArray(p.players) ? (p.players as any[])[0] : (p.players as any)
      return rowToParticipant(p, player?.name ?? "—")
    })
    events.push(rowToEvent(row, participants))
  }
  return events
}

// ─── Старт (генерация раундов) ─────────────────────────────────────────────

export async function startAmericanoEvent(id: string): Promise<AmericanoEvent> {
  const supabase = createServerSupabaseClient()
  const event = await getAmericanoEvent(id)
  if (!event) throw new AmericanoValidationError(["Событие не найдено"])
  if (event.status !== "creating") throw new AmericanoValidationError(["Событие уже запущено"])

  if (event.format === "mexicano") {
    // §11: Mexicano — ЛЕНИВАЯ генерация: только первый раунд,
    // остальные создаются после завершения предыдущего.
    const scores: ParticipantScore[] = event.participants.map(p => ({
      playerId: p.playerId,
      seat: p.seat ?? 0,
      totalPoints: p.totalPoints,
      gamesPlayed: p.gamesPlayed,
      gamesWon: p.gamesWon,
      gamesLost: p.gamesLost,
      pointsDiff: p.pointsDiff,
    }))
    const pairings = generateMexicanoPairings(scores, event.courtCount, 0)

    // Создаём ВСЕ раунды (пустые), но матчи только в первом
    for (let rn = 0; rn < event.totalRounds; rn++) {
      const { data: round } = await supabase
        .from("americano_rounds")
        .insert({ event_id: id, round_number: rn, status: rn === 0 ? "playing" : "pending" })
        .select("*")
        .single()

      if (round && rn === 0) {
        for (const m of pairings) {
          await supabase.from("americano_matches").insert({
            round_id: round.id,
            event_id: id,
            court_number: m.court,
            team_a_seats: m.teamASeats,
            team_b_seats: m.teamBSeats,
          })
        }
      }
    }
  } else {
    // Americano: генерируем ВСЕ раунды upfront (Whist-расписание)
    const schedule = generateWhistSchedule(event.playerCount)
    if (schedule.length === 0) throw new AmericanoValidationError(["Не удалось сгенерировать расписание"])

    const roundNumbers = [...new Set(schedule.map(s => s.round))].sort((a, b) => a - b)
    for (const rn of roundNumbers) {
      const { data: round } = await supabase
        .from("americano_rounds")
        .insert({ event_id: id, round_number: rn, status: rn === 0 ? "playing" : "pending" })
        .select("*")
        .single()
      if (!round) continue
      const roundMatches = schedule.filter(s => s.round === rn)
      for (const m of roundMatches) {
        await supabase.from("americano_matches").insert({
          round_id: round.id,
          event_id: id,
          court_number: m.court,
          team_a_seats: m.teamASeats,
          team_b_seats: m.teamBSeats,
        })
      }
    }
  }

  // Обновляем статус события
  await supabase
    .from("americano_events")
    .update({ status: "active", current_round: 0, started_at: new Date().toISOString() })
    .eq("id", id)

  logEvent("info", `americano: событие ${id.slice(0, 8)} запущено (${event.format})`, "americano")
  return (await getAmericanoEvent(id)) as AmericanoEvent
}

// ─── Раунды и матчи ─────────────────────────────────────────────────────────

export async function getAmericanoRounds(eventId: string): Promise<AmericanoRound[]> {
  const supabase = createServerSupabaseClient()
  const event = await getAmericanoEvent(eventId)
  if (!event) return []

  // Seat → playerName
  const seatToName = new Map<number, string>()
  for (const p of event.participants) {
    if (p.seat !== null) seatToName.set(p.seat, p.playerName)
  }

  const { data: rounds } = await supabase
    .from("americano_rounds")
    .select("*")
    .eq("event_id", eventId)
    .order("round_number")

  const { data: matches } = await supabase
    .from("americano_matches")
    .select("*")
    .eq("event_id", eventId)
    .order("court_number")

  const result: AmericanoRound[] = []
  for (const round of rounds ?? []) {
    const roundMatches: AmericanoMatch[] = (matches ?? [])
      .filter((m: Record<string, unknown>) => m.round_id === round.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({
        id: m.id,
        courtNumber: m.court_number,
        teamASeats: m.team_a_seats ?? [],
        teamBSeats: m.team_b_seats ?? [],
        teamAPlayers: (m.team_a_seats ?? []).map((s: number) => seatToName.get(s) ?? `Seat ${s}`),
        teamBPlayers: (m.team_b_seats ?? []).map((s: number) => seatToName.get(s) ?? `Seat ${s}`),
        scoreA: m.score_a ?? null,
        scoreB: m.score_b ?? null,
        winner: m.winner ?? null,
      }))

    result.push({
      roundNumber: round.round_number,
      status: round.status,
      matches: roundMatches,
    })
  }

  return result
}

// ─── Ввод результата ───────────────────────────────────────────────────────

export async function submitMatchResult(input: {
  matchId: string
  scoreA: number
  scoreB: number
}): Promise<void> {
  const supabase = createServerSupabaseClient()

  // Находим матч
  const { data: match } = await supabase
    .from("americano_matches")
    .select("*")
    .eq("id", input.matchId)
    .single()
  if (!match) throw new AmericanoValidationError(["Матч не найден"])
  if (match.winner) throw new AmericanoValidationError(["Результат уже введён"])

  const winner = input.scoreA > input.scoreB ? "A" : input.scoreB > input.scoreA ? "B" : "draw"

  // Записываем результат матча
  await supabase
    .from("americano_matches")
    .update({
      score_a: input.scoreA,
      score_b: input.scoreB,
      winner,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.matchId)

  // Обновляем участников
  const event = await getAmericanoEvent(match.event_id)
  if (!event) return

  const scores: ParticipantScore[] = event.participants.map(p => ({
    playerId: p.playerId,
    seat: p.seat ?? 0,
    totalPoints: p.totalPoints,
    gamesPlayed: p.gamesPlayed,
    gamesWon: p.gamesWon,
    gamesLost: p.gamesLost,
    pointsDiff: p.pointsDiff,
  }))

  const updated = applyMatchResult(scores, match.team_a_seats, match.team_b_seats, input.scoreA, input.scoreB)

  for (const u of updated) {
    await supabase
      .from("americano_participants")
      .update({
        total_points: u.totalPoints,
        games_played: u.gamesPlayed,
        games_won: u.gamesWon,
        games_lost: u.gamesLost,
        points_diff: u.pointsDiff,
      })
      .eq("event_id", match.event_id)
      .eq("player_id", u.playerId)
  }

  // Проверяем: все матчи раунда завершены?
  const { data: remaining } = await supabase
    .from("americano_matches")
    .select("id")
    .eq("round_id", match.round_id)
    .is("winner", null)

  if (!remaining || remaining.length === 0) {
    // Раунд завершён
    await supabase.from("americano_rounds").update({ status: "completed" }).eq("id", match.round_id)

    // Следующий раунд → playing
    const { data: nextRound } = await supabase
      .from("americano_rounds")
      .select("id, round_number")
      .eq("event_id", match.event_id)
      .eq("status", "pending")
      .order("round_number")
      .limit(1)

    if (nextRound?.[0]) {
      await supabase.from("americano_rounds").update({ status: "playing" }).eq("id", nextRound[0].id)
      await supabase
        .from("americano_events")
        .update({ current_round: nextRound[0].round_number })
        .eq("id", match.event_id)

      // §11: Mexicano — генерируем матчи следующего раунда по текущей таблице
      const updatedEvent = await getAmericanoEvent(match.event_id)
      if (updatedEvent && updatedEvent.format === "mexicano") {
        const scores: ParticipantScore[] = updatedEvent.participants.map(p => ({
          playerId: p.playerId,
          seat: p.seat ?? 0,
          totalPoints: p.totalPoints,
          gamesPlayed: p.gamesPlayed,
          gamesWon: p.gamesWon,
          gamesLost: p.gamesLost,
          pointsDiff: p.pointsDiff,
        }))
        const nextPairings = generateMexicanoPairings(scores, updatedEvent.courtCount, nextRound[0].round_number)
        for (const m of nextPairings) {
          await supabase.from("americano_matches").insert({
            round_id: nextRound[0].id,
            event_id: match.event_id,
            court_number: m.court,
            team_a_seats: m.teamASeats,
            team_b_seats: m.teamBSeats,
          })
        }
        logEvent("info", `mexicano: раунд ${nextRound[0].round_number + 1} сгенерирован (${nextPairings.length} матчей)`, "americano")
      }
    } else {
      // Все раунды завершены
      await supabase
        .from("americano_events")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", match.event_id)
      logEvent("info", `americano: событие ${match.event_id.slice(0, 8)} завершено`, "americano")
    }
  }
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

export function getEventLeaderboard(event: AmericanoEvent): AmericanoParticipant[] {
  const scores: ParticipantScore[] = event.participants.map(p => ({
    playerId: p.playerId,
    seat: p.seat ?? 0,
    totalPoints: p.totalPoints,
    gamesPlayed: p.gamesPlayed,
    gamesWon: p.gamesWon,
    gamesLost: p.gamesLost,
    pointsDiff: p.pointsDiff,
  }))
  const ranked = computeLeaderboard(scores)
  return ranked
    .map(r => event.participants.find(p => p.playerId === r.playerId)!)
    .filter(Boolean)
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export class AmericanoValidationError extends Error {
  constructor(messages: string | string[]) {
    super(Array.isArray(messages) ? messages.join("; ") : messages)
    this.name = "AmericanoValidationError"
  }
}
