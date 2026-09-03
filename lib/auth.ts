// Auth-контур игрока (plan 2026-09-02 player-auth-video-cabinet):
// Supabase Auth через cookie-сессию (@supabase/ssr) + связка auth-юзер ↔
// players.user_id. Чистые хелперы (participant-матч, имя из OAuth) без I/O
// покрыты тестами (test/auth.test.ts); серверная часть — service role,
// права проверяются в API-слое (RLS на таблицах не меняется).

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import { createServerSupabaseClient } from "./supabase"

// ─── Чистые хелперы ────────────────────────────────────────────────────────

/** Участники записи: metadata.participants[] = {name, playerId} (QR-старт). */
export function isRecordingParticipant(
  metadata: Record<string, unknown> | null | undefined,
  playerId: string | null | undefined,
): boolean {
  if (!playerId || !metadata) return false
  const participants = metadata.participants
  if (!Array.isArray(participants)) return false
  return participants.some(
    (p) => typeof p === "object" && p !== null && (p as { playerId?: unknown }).playerId === playerId,
  )
}

/**
 * Есть ли в записи хоть один участник-игрок (с playerId). Гостевые записи
 * (без единого playerId) остаются доступны по ссылке — QR-флоу корта
 * не должен требовать логина (продуктовое решение плана, Task 7).
 */
export function hasPlayerParticipants(metadata: Record<string, unknown> | null | undefined): boolean {
  const participants = metadata?.participants
  if (!Array.isArray(participants)) return false
  return participants.some(
    (p) =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as { playerId?: unknown }).playerId === "string" &&
      (p as { playerId?: unknown }).playerId !== "",
  )
}

/** Имя профиля из OAuth-метаданных или локальной части email. */
export function displayNameFromAuth(user: {
  email?: string | null
  userMetadata?: Record<string, unknown> | null
}): string {
  const meta = user.userMetadata ?? {}
  const full = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "")
  if (full) return full.trim().slice(0, 60)
  if (user.email) {
    const local = user.email.split("@")[0]
    if (local) return local.slice(0, 60)
  }
  return "Игрок"
}

// ─── Cookie-клиент (App Router, route handlers + server components) ───────

export function createAuthClient(cookieStore: {
  getAll: () => { name: string; value: string }[]
  set: (name: string, value: string, options?: Record<string, unknown>) => void
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("Supabase env не настроены (NEXT_PUBLIC_SUPABASE_*)")
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Component: cookie-set бросает — сессию обновит route handler
        }
      },
    },
  })
}

/** Текущий auth-юзер по cookie (null — гость). */
export async function getAuthUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const supabase = createAuthClient(cookieStore)
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

// ─── Связка auth ↔ players (plan Task 2) ───────────────────────────────────

export interface AuthPlayer {
  id: string
  name: string
  avatarUrl: string | null
  email: string | null
}

/** Профиль игрока по auth-юзеру (null — ещё не создан). */
export async function getPlayerForUser(userId: string): Promise<AuthPlayer | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("players")
    .select("id, name, avatar_url, email")
    .eq("user_id", userId)
    .limit(1)
  if (!data || data.length === 0) return null
  const row = data[0]
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url ?? null,
    email: row.email ?? null,
  }
}

/**
 * Профиль игрока по auth-юзеру с авто-созданием при первом входе
 * (Task 2: имя — из OAuth-метаданных / email-префикса).
 */
export async function ensurePlayerForUser(user: User): Promise<AuthPlayer> {
  const existing = await getPlayerForUser(user.id)
  if (existing) return existing

  const supabase = createServerSupabaseClient()
  const email = user.email ?? null
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null
  // players.id не имеет DB-default (клиентски генерируется UUID) — делаем так же
  const { data, error } = await supabase
    .from("players")
    .insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      name: displayNameFromAuth({
        email: user.email,
        userMetadata: user.user_metadata as Record<string, unknown> | null,
      }),
      email,
      avatar_url: avatarUrl,
    })
    .select("id, name, avatar_url, email")
    .single()
  if (error || !data) throw new Error(`ensurePlayerForUser: ${error?.message}`)
  return { id: data.id, name: data.name, avatarUrl: data.avatar_url ?? null, email: data.email ?? null }
}
