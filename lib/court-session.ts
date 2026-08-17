// Court Session — главная сущность платформы (plan-4 §5-6, Шаг 2).
//
// Booking ≠ Session ≠ Match: сессия — контейнер на корте: участники
// (player из базы / гость / тренер со статусами), 0..N матчей, типы
// (тренировка, open play, Americano, турнир…). Серверный модуль: доступ
// только через service role; чистые хелперы валидации покрыты тестами.

import { createServerSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"

export const SESSION_TYPES = [
  "match",
  "training",
  "open_play",
  "group_session",
  "americano",
  "mexicano",
  "king_of_court",
  "tournament",
  "custom",
] as const
export type SessionType = (typeof SESSION_TYPES)[number]

export const SESSION_STATUSES = ["preparing", "active", "completed", "cancelled"] as const
export type SessionStatus = (typeof SESSION_STATUSES)[number]

export const PARTICIPANT_ROLES = ["player", "guest", "coach"] as const
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number]

export const PARTICIPANT_STATUSES = ["expected", "checked_in", "playing", "waiting", "left"] as const
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number]

export interface SessionParticipant {
  id: string
  sessionId: string
  playerId: string | null
  displayName: string
  role: ParticipantRole
  status: ParticipantStatus
  createdAt: string
}

export interface CourtSession {
  id: string
  clubId: string
  courtId: string | null
  type: SessionType
  status: SessionStatus
  startedAt: string
  endedAt: string | null
  createdBy: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  participants?: SessionParticipant[]
}

// ─── Чистые хелперы (тесты: test/court-session.test.ts) ─────────────────────

export interface ParticipantInput {
  playerId?: string | null
  name?: string
  role?: string
  status?: string
}

/**
 * Нормализует участника. Требуется имя (гость) или playerId (игрок из базы);
 * имя игрока берётся из input или будет заполнено вызывающим кодом.
 */
export function normalizeParticipant(input: ParticipantInput): {
  playerId: string | null
  displayName: string
  role: ParticipantRole
  status: ParticipantStatus
} {
  const name = (input.name ?? "").trim()
  const playerId = typeof input.playerId === "string" && input.playerId ? input.playerId : null
  if (!name && !playerId) throw new SessionValidationError("Участнику нужно имя или playerId")
  if (name.length > 100) throw new SessionValidationError("Имя участника слишком длинное (макс. 100)")
  const role = (input.role ?? (playerId ? "player" : "guest")) as ParticipantRole
  if (!PARTICIPANT_ROLES.includes(role)) {
    throw new SessionValidationError(`role должен быть одним из: ${PARTICIPANT_ROLES.join(", ")}`)
  }
  const status = (input.status ?? "expected") as ParticipantStatus
  if (!PARTICIPANT_STATUSES.includes(status)) {
    throw new SessionValidationError(`status должен быть одним из: ${PARTICIPANT_STATUSES.join(", ")}`)
  }
  return { playerId, displayName: name, role, status }
}

export function validateSessionInput(input: {
  type?: unknown
  status?: unknown
  courtId?: unknown
  participants?: unknown
}): string[] {
  const errors: string[] = []
  if (input.type !== undefined && !SESSION_TYPES.includes(input.type as SessionType)) {
    errors.push(`type должен быть одним из: ${SESSION_TYPES.join(", ")}`)
  }
  if (input.status !== undefined && !SESSION_STATUSES.includes(input.status as SessionStatus)) {
    errors.push(`status должен быть одним из: ${SESSION_STATUSES.join(", ")}`)
  }
  if (input.courtId !== undefined && input.courtId !== null && typeof input.courtId !== "string") {
    errors.push("courtId должен быть UUID корта или null")
  }
  if (input.participants !== undefined) {
    if (!Array.isArray(input.participants)) {
      errors.push("participants должен быть массивом")
    } else {
      input.participants.forEach((p, i) => {
        try {
          normalizeParticipant(p ?? {})
        } catch (err) {
          errors.push(`participants[${i}]: ${(err as Error).message}`)
        }
      })
    }
  }
  return errors
}

/** Финальный статус сессии фиксирует ended_at (§5). */
export function finalStatuses(): SessionStatus[] {
  return ["completed", "cancelled"]
}

// ─── DDL / bootstrap (как в court-registry: миграция или exec_sql) ──────────

export const getSessionTablesSql = (): string => `
CREATE TABLE IF NOT EXISTS court_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  court_id UUID REFERENCES courts(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'match',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES court_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  status TEXT NOT NULL DEFAULT 'expected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS session_id UUID;
CREATE INDEX IF NOT EXISTS matches_session_id_idx ON matches (session_id) WHERE session_id IS NOT NULL;
ALTER TABLE court_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
`

let schemaPromise: Promise<boolean> | null = null

async function sessionsTableExists(): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from("court_sessions").select("id").limit(1)
  return !error
}

async function runSessionDdl(): Promise<void> {
  const supabase = createServerSupabaseClient()
  if (!supabase) throw new Error("Серверный Supabase клиент недоступен (env)")
  for (const statement of getSessionTablesSql()
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const { error } = await supabase.rpc("exec_sql", { sql_query: statement + ";" })
    if (error) throw new Error(`exec_sql: ${error.message}`)
  }
}

export async function ensureSessionSchema(): Promise<boolean> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      try {
        if (!(await sessionsTableExists())) {
          await runSessionDdl().catch((err) => {
            throw new Error(
              `${(err as Error).message} — примените миграцию вручную: ` +
                `node scripts/apply-migration.mjs supabase/migrations/20260817020000_add_court_sessions.sql`,
            )
          })
          if (!(await sessionsTableExists())) throw new Error("Таблица court_sessions не создалась")
        }
        return true
      } catch (err) {
        logEvent("error", `court-session: bootstrap не выполнен: ${(err as Error).message}`, "ensureSessionSchema", err)
        schemaPromise = null
        return false
      }
    })()
  }
  return schemaPromise
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

async function defaultClubId(): Promise<string> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.from("clubs").select("id").limit(1)
  if (error || !data || data.length === 0) throw new Error(`clubs: ${error?.message ?? "пусто"}`)
  return data[0].id as string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(row: any): CourtSession {
  return {
    id: row.id,
    clubId: row.club_id,
    courtId: row.court_id ?? null,
    type: row.type,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    createdBy: row.created_by ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToParticipant(row: any): SessionParticipant {
  return {
    id: row.id,
    sessionId: row.session_id,
    playerId: row.player_id ?? null,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  }
}

export async function createSession(input: {
  courtId?: string | null
  type?: string
  status?: string
  createdBy?: string
  participants?: ParticipantInput[]
  metadata?: Record<string, unknown>
}): Promise<CourtSession> {
  const errors = validateSessionInput(input)
  if (errors.length > 0) throw new SessionValidationError(errors)

  const supabase = createServerSupabaseClient()
  const clubId = await defaultClubId()
  const participants = (input.participants ?? []).map((p) => normalizeParticipant(p))

  const insert = await supabase
    .from("court_sessions")
    .insert({
      club_id: clubId,
      court_id: input.courtId ?? null,
      type: input.type ?? "match",
      status: input.status ?? "active",
      created_by: input.createdBy ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (insert.error || !insert.data) throw new Error(`createSession: ${insert.error?.message}`)
  const session = rowToSession(insert.data)

  if (participants.length > 0) {
    const rows = participants.map((p) => ({
      session_id: session.id,
      player_id: p.playerId,
      display_name: p.displayName || p.playerId!, // имя подставит вызывающий или UUID fallback
      role: p.role,
      status: p.status,
    }))
    const pin = await supabase.from("session_participants").insert(rows)
    if (pin.error) throw new Error(`createSession participants: ${pin.error.message}`)
  }
  return session
}

export async function listSessions(filter: {
  active?: boolean
  courtId?: string
  limit?: number
}): Promise<CourtSession[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("court_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(Math.min(filter.limit ?? 50, 200))
  if (filter.active) query = query.in("status", ["preparing", "active"])
  if (filter.courtId) query = query.eq("court_id", filter.courtId)
  const { data, error } = await query
  if (error) throw new Error(`listSessions: ${error.message}`)
  return (data ?? []).map(rowToSession)
}

/** Активная сессия корта (для публичного state, §46 dashboard). */
export async function getActiveSessionByCourt(courtId: string): Promise<CourtSession | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("court_sessions")
    .select("*")
    .eq("court_id", courtId)
    .in("status", ["preparing", "active"])
    .order("started_at", { ascending: false })
    .limit(1)
  if (error) throw new Error(`getActiveSessionByCourt: ${error.message}`)
  if (!data || data.length === 0) return null
  return rowToSession(data[0])
}

export async function getSession(id: string, withParticipants = true): Promise<CourtSession | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.from("court_sessions").select("*").eq("id", id).single()
  if (error || !data) return null
  const session = rowToSession(data)
  if (withParticipants) {
    const parts = await supabase
      .from("session_participants")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: true })
    session.participants = (parts.data ?? []).map(rowToParticipant)
  }
  return session
}

/** Смена статуса; финальный статус фиксирует ended_at (§5). */
export async function updateSessionStatus(id: string, status: string): Promise<CourtSession> {
  if (!SESSION_STATUSES.includes(status as SessionStatus)) {
    throw new SessionValidationError(`status должен быть одним из: ${SESSION_STATUSES.join(", ")}`)
  }
  const supabase = createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = { status }
  if (finalStatuses().includes(status as SessionStatus)) row.ended_at = new Date().toISOString()
  const { data, error } = await supabase.from("court_sessions").update(row).eq("id", id).select("*").single()
  if (error || !data) throw new Error(`updateSessionStatus: ${error?.message}`)
  return rowToSession(data)
}

/** Привязка матча к сессии (0..N матчей, §5); null — отвязать все матчи сессии. */
export async function linkMatch(sessionId: string, matchId: string | null): Promise<void> {
  const supabase = createServerSupabaseClient()
  if (matchId === null) {
    const { error } = await supabase
      .from("matches")
      .update({ session_id: null })
      .eq("session_id", sessionId)
    if (error) throw new Error(`unlinkMatches: ${error.message}`)
    return
  }
  const { error } = await supabase.from("matches").update({ session_id: sessionId }).eq("id", matchId)
  if (error) throw new Error(`linkMatch: ${error.message}`)
  logEvent("info", `court-session: матч ${matchId} привязан к сессии ${sessionId}`, "court-session")
}

export class SessionValidationError extends Error {
  constructor(message: string | string[]) {
    super(Array.isArray(message) ? message.join("; ") : message)
    this.name = "SessionValidationError"
  }
}
