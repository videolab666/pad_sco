// API-key guard for the mutating HTTP endpoints (remote command API and the
// whole-snapshot PUT). The UI password gate is client-side only, so every
// server-side write path must authenticate on its own.
//
// The key lives in SCOREBOARD_API_KEY (.env.local). Fails CLOSED: if the env
// variable is unset, no request is authorized.

import { timingSafeEqual } from "node:crypto"

/** Constant-time string comparison (length differences leak only the length). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) {
    // Compare against itself to keep the timing profile, then fail.
    timingSafeEqual(ab, ab)
    return false
  }
  return timingSafeEqual(ab, bb)
}

/**
 * True when the request carries a valid X-API-Key header. Reads the key from
 * the environment on every call (no caching) so rotation applies immediately.
 */
export function isAuthorizedApiRequest(request: Request): boolean {
  const expected = process.env.SCOREBOARD_API_KEY
  if (!expected) return false // fail closed
  const provided =
    request.headers.get("x-api-key") ??
    // Bearer form, for clients that prefer the standard header.
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")!.slice("Bearer ".length)
      : null)
  if (!provided) return false
  return safeEqual(provided, expected)
}
