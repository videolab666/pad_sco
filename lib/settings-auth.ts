// Session guard for the /settings admin UI and the mutating /api/media
// routes. Two accepted credentials:
//   1. a session cookie issued by POST /api/settings/login — the password
//      comes from the mandatory SETTINGS_PASSWORD env. Fail-closed: when the
//      env is not set, every login and every session check is rejected;
//   2. the machine-to-machine X-API-Key from lib/api-auth (remote control).
//
// The cookie stores a deterministic SHA-256 of the password, so rotating
// SETTINGS_PASSWORD invalidates every session immediately.

import { createHash, timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"
import { isAuthorizedApiRequest } from "./api-auth"

export const SETTINGS_COOKIE_NAME = "settings_session"
export const SETTINGS_SESSION_MAX_AGE_SEC = 30 * 24 * 3600 // 30 days

let missingPasswordWarned = false
function warnMissingPassword(): void {
  if (missingPasswordWarned) return
  missingPasswordWarned = true
  console.error(
    "[settings-auth] SETTINGS_PASSWORD is not set — the settings/media login is DISABLED. " +
      "Add SETTINGS_PASSWORD to .env.local to enable it.",
  )
}

/** The configured password, or null when SETTINGS_PASSWORD is not set. */
function getSettingsPassword(): string | null {
  const value = process.env.SETTINGS_PASSWORD
  return value && value.length > 0 ? value : null
}

/**
 * Deterministic session token derived from the current password.
 * Returns "" when SETTINGS_PASSWORD is unset — callers must treat an empty
 * token as "never authorized" (fail-closed).
 */
export function settingsSessionToken(): string {
  const password = getSettingsPassword()
  if (password === null) {
    warnMissingPassword()
    return ""
  }
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

/**
 * Constant-time password check against SETTINGS_PASSWORD.
 * Fail-closed: with the env unset nothing is accepted.
 */
export function checkSettingsPassword(password: unknown): boolean {
  const expected = getSettingsPassword()
  if (expected === null) {
    warnMissingPassword()
    return false
  }
  if (typeof password !== "string" || !password) return false
  return safeEqual(password, expected)
}

/** Cookie or API key — either unlocks the settings/media write endpoints. */
export function isAuthorizedSettingsRequest(request: NextRequest | Request): boolean {
  if (isAuthorizedApiRequest(request)) return true
  const expectedToken = settingsSessionToken()
  // SETTINGS_PASSWORD unset → no session can be valid (fail-closed; also
  // guards against an empty cookie value matching an empty token).
  if (!expectedToken) return false
  const cookieHeader = request.headers.get("cookie") ?? ""
  const row = cookieHeader
    .split(/;\s*/)
    .find((c) => c.startsWith(`${SETTINGS_COOKIE_NAME}=`))
  if (!row) return false
  const provided = decodeURIComponent(row.slice(SETTINGS_COOKIE_NAME.length + 1))
  return safeEqual(provided, expectedToken)
}
