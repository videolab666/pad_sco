// Staff-аутентификация (plan-4 §50, §118, Шаг 1 slice B).
//
// Supabase Auth (email+password) + club_memberships (роль в клубе).
// Проверка запроса: машина (X-API-Key) ИЛИ персонал (user-сессия с ролью).
// Члены с viewer — только просмотр через UI, не API-управление.

import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createServerSupabaseClient } from "./supabase"
import { isAuthorizedApiRequest } from "./api-auth"
import { logEvent } from "./error-logger"

export type StaffRole = "owner" | "manager" | "referee" | "coach" | "viewer"

/** Роли, которым доступны управляющие API клуба. */
export const STAFF_API_ROLES: StaffRole[] = ["owner", "manager", "referee", "coach"]

export interface StaffMembership {
  clubId: string
  role: StaffRole
}

export interface StaffUser {
  id: string
  email: string
  memberships: StaffMembership[]
}

/** Чистая проверка: есть ли у набора членств подходящая роль. */
export function hasStaffRole(
  memberships: StaffMembership[],
  roles: StaffRole[] = STAFF_API_ROLES,
): boolean {
  return memberships.some((m) => roles.includes(m.role))
}

/**
 * Текущий пользователь по cookie-сессии (@supabase/ssr) + его членства.
 * Вне request-контекста (тесты/скрипты) возвращает null, не бросая.
 */
export async function getStaffUser(): Promise<StaffUser | null> {
  try {
    const cookieStore = await cookies()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // В route handler нельзя выставить cookie повторно — refresh
          // делает middleware; здесь только чтение.
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    // Членства читает service role: таблица закрыта RLS, а пользователя
    // с его ролями должен видеть и сервер, и сам пользователь (own-policy).
    const svc = createServerSupabaseClient()
    const { data, error } = await svc
      .from("club_memberships")
      .select("club_id, role")
      .eq("user_id", user.id)
    if (error) {
      logEvent("error", `staff-auth: членства недоступны: ${error.message}`, "getStaffUser")
      return null
    }

    return {
      id: user.id,
      email: user.email ?? "",
      memberships: (data ?? []).map((m: { club_id: string; role: StaffRole }) => ({
        clubId: m.club_id,
        role: m.role,
      })),
    }
  } catch {
    // Не в request-контексте (unit-тест, скрипт) — персонала нет.
    return null
  }
}

/**
 * Авторизация запроса к управляющим API: машина (X-API-Key из api-auth)
 * или персонал (user-сессия с ролью из STAFF_API_ROLES).
 */
export async function isAuthorizedStaffRequest(request: NextRequest | Request): Promise<boolean> {
  if (isAuthorizedApiRequest(request)) return true
  const staff = await getStaffUser()
  if (staff && hasStaffRole(staff.memberships)) return true
  return false
}
