// GET /api/v1/me/profile — профиль залогиненного игрока (plan 2026-09-02,
// Task 4/5). Cookie-сессия → auth-юзер → профиль игрока (создаётся при
// первом заходе). Гость → { user: null, player: null }.

import { NextResponse } from "next/server"
import { displayNameFromAuth, ensurePlayerForUser, getAuthUser } from "@/lib/auth"
import { logEvent } from "@/lib/error-logger"

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ user: null, player: null }, { headers: { "Cache-Control": "no-store" } })
    }
    const player = await ensurePlayerForUser(user).catch((err) => {
      logEvent("warn", `me/profile: ensurePlayer: ${(err as Error).message}`, "me-profile")
      return null
    })
    return NextResponse.json(
      {
        user: {
          email: user.email ?? null,
          name: displayNameFromAuth({
            email: user.email,
            userMetadata: user.user_metadata as Record<string, unknown> | null,
          }),
          avatarUrl:
            typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
        },
        player,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    logEvent("error", `me/profile: ${(err as Error).message}`, "me-profile", err)
    return NextResponse.json({ error: "profile_failed" }, { status: 500 })
  }
}
