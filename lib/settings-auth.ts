// Session guard for the /settings admin UI and the mutating /api/media
// routes. Two accepted credentials:
//   1. a session cookie issued by POST /api/settings/login (password from
//      SETTINGS_PASSWORD, default "111" — the same gate the UI password page
//      uses; override via .env.local for a stronger one);
//   2. the machine-to-machine X-API-Key from lib/api-auth (remote control).
//
// The cookie stores a deterministic SHA-256 of the password, so rotating
// SETTINGS_PASSWORD invalidates every session immediately.

import { createHash, timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"
import { isAuthorizedApiRequest } from "./api-auth"

export const SETTINGS_COOKIE_NAME = "settings_session"
export const SETTINGS_SESSION_MAX_AGE_SEC = 30 * 24 * 3600 // 30 days

/** Deterministic session token derived from the current password. */
export function settingsSessionToken(): string {
  const password = process.env.SETTINGS_PASSWORD ?? "111"
  return createHash("sha256").update(`${password}:settings-session:v1`).digest("hex")
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

/** Constant-time password check against SETTINGS_PASSWORD (default "111"). */
export function checkSettingsPassword(password: unknown): boolean {
  if (typeof password !== "string" || !password) return false
  const expected = process.env.SETTINGS_PASSWORD ?? "111"
  return safeEqual(password, expected)
}

/** Cookie or API key — either unlocks the settings/media write endpoints. */
export function isAuthorizedSettingsRequest(request: NextRequest | Request): boolean {
  if (isAuthorizedApiRequest(request)) return true
  const cookieHeader = request.headers.get("cookie") ?? ""
  const row = cookieHeader
    .split(/;\s*/)
    .find((c) => c.startsWith(`${SETTINGS_COOKIE_NAME}=`))
  if (!row) return false
  const provided = decodeURIComponent(row.slice(SETTINGS_COOKIE_NAME.length + 1))
  return safeEqual(provided, settingsSessionToken())
}
