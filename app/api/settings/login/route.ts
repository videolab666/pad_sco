// POST   /api/settings/login — { password } → sets the httpOnly session cookie
// GET    /api/settings/login — { authenticated }
// DELETE /api/settings/login — clears the cookie
//
// Password: SETTINGS_PASSWORD env (default "111", see lib/settings-auth.ts).

import { NextResponse, type NextRequest } from "next/server"
import {
  SETTINGS_COOKIE_NAME,
  SETTINGS_SESSION_MAX_AGE_SEC,
  checkSettingsPassword,
  isAuthorizedSettingsRequest,
  settingsSessionToken,
} from "@/lib/settings-auth"

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: isAuthorizedSettingsRequest(request) })
}

export async function POST(request: NextRequest) {
  let password: unknown = null
  try {
    const body = await request.json()
    password = body?.password
  } catch {
    /* fall through to the check */
  }
  if (!checkSettingsPassword(password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 })
  }
  const res = NextResponse.json({ authenticated: true })
  res.cookies.set(SETTINGS_COOKIE_NAME, settingsSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SETTINGS_SESSION_MAX_AGE_SEC,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ authenticated: false })
  res.cookies.set(SETTINGS_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 })
  return res
}
