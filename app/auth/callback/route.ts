// GET /auth/callback — обмен PKCE-кода на сессию (plan 2026-09-02, Task 4).
//
// Сюда возвращают Google OAuth и email magic link (emailRedirectTo /
// redirectTo с ?next=). Код обменивается на сессию, cookie ставится в
// ответ, при первом входе создаётся профиль игрока (ensurePlayerForUser).
// ?next валидируется: только локальные пути (защита от open redirect).

import { type NextRequest, NextResponse } from "next/server"
import { createAuthClient, ensurePlayerForUser } from "@/lib/auth"
import { logEvent } from "@/lib/error-logger"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const nextParam = url.searchParams.get("next") ?? "/me"
  const safeNext = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/me"

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", url.origin))
  }

  const response = NextResponse.redirect(new URL(safeNext, url.origin))
  // exchangeCodeForSession — метод supabase.auth (клиент.auth)
  const supabase = createAuthClient({
    getAll: () => request.cookies.getAll(),
    set: (name, value, options) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.cookies.set(name, value, options as any)
    },
  })

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    logEvent("warn", `auth callback: ${error?.message ?? "нет user"}`, "auth-callback")
    return NextResponse.redirect(new URL("/login?error=callback", url.origin))
  }

  try {
    await ensurePlayerForUser(data.user)
  } catch (err) {
    // Профиль не создался — не блокируем вход; создастся при /api/v1/me/profile
    logEvent("warn", `auth callback: ensurePlayer: ${(err as Error).message}`, "auth-callback")
  }
  return response
}
