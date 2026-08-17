// Суммаризатор карточки корта для Multi-court Dashboard (plan-4 §46).
//
// Чистая функция: корт из реестра + снапшот матча + активная сессия →
// компактная карточка. Имена/длительность берутся из buildCourtVmixPayload
// (единый источник проекции), сеты — из score. Покрыто тестами.

import { buildCourtVmixPayload } from "./match-view"

export interface DashboardSessionInfo {
  type: string
  status: string
  startedAt: string
}

export interface DashboardCourtCard {
  courtId: string
  name: string
  shortCode: string
  number: number | null
  scoreboardUrl: string
  state: "live" | "session_only" | "available"
  session: DashboardSessionInfo | null
  match: {
    id: string
    teamAName: string
    teamBName: string
    setsWonA: number
    setsWonB: number
    /** "6-4 3-6" — завершённые сеты */
    setsSummary: string
    /** Текущий сет по геймам: "3-2" */
    currentSet: string
    /** Текущий гейм: теннис "40-30" или тайбрейк "5-4" */
    currentGame: string
    isTiebreak: boolean
    duration: string
    isCompleted: boolean
    winner: string
  } | null
}

/** Строковое значение очка гейма: 0/15/30/40/Ad или число тайбрейка. */
function gamePointLabel(v: unknown): string {
  if (v === "Ad") return "Ad"
  if (typeof v === "number") return String(v)
  return "0"
}

export function buildDashboardCourtCard(
  court: { id: string; name: string; shortCode: string; legacyNumber: number | null },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: any,
  session: DashboardSessionInfo | null,
): DashboardCourtCard {
  const card: DashboardCourtCard = {
    courtId: court.id,
    name: court.name,
    shortCode: court.shortCode,
    number: court.legacyNumber,
    scoreboardUrl: `/c/${court.shortCode}`,
    state: "available",
    session,
    match: null,
  }
  if (!match) {
    // Корт занят сессией без активного матча (тренировка, Americano
    // между матчами, подготовка) — не «свободен».
    if (session) card.state = "session_only"
    return card
  }

  // Одна проекция на матч: имена и длительность совпадают с vMix JSON.
  const payload = buildCourtVmixPayload(match, court.legacyNumber, undefined, court.name)

  const sets = Array.isArray(match?.score?.sets) ? match.score.sets : []
  const setsSummary = sets.map((s: { teamA: number; teamB: number }) => `${s.teamA}-${s.teamB}`).join(" ")
  const setsWonA = sets.filter((s: { winner?: string }) => s.winner === "teamA").length
  const setsWonB = sets.filter((s: { winner?: string }) => s.winner === "teamB").length
  const currentSet = match?.score?.currentSet
  const currentGame = currentSet?.currentGame

  card.match = {
    id: String(match?.id ?? ""),
    teamAName: String(payload.teamA_name ?? ""),
    teamBName: String(payload.teamB_name ?? ""),
    setsWonA,
    setsWonB,
    setsSummary,
    currentSet: currentSet ? `${currentSet.teamA ?? 0}-${currentSet.teamB ?? 0}` : "",
    currentGame: currentGame
      ? `${gamePointLabel(currentGame.teamA)}-${gamePointLabel(currentGame.teamB)}`
      : "",
    isTiebreak: Boolean(currentSet?.isTiebreak),
    duration: String(payload.match_duration ?? ""),
    isCompleted: Boolean(match?.isCompleted),
    winner: String(payload.winner ?? match?.winner ?? ""),
  }
  card.state = match?.isCompleted ? "session_only" : "live"
  return card
}
