// Task 16 — Result Poster.
//
// POSTs the final match snapshot (as JSON) to a configured external URL when a
// match completes. Optional. Behaviour:
//
//   - URL + optional HTTP Basic Auth come from match.settings.resultPoster.
//   - Caller chooses how to fire it: manual button or auto-post hook on match
//     completion (postResultIfConfigured below is the auto-post entry point).
//   - 3 retries with exponential backoff (1s / 2s / 4s).
//   - On final failure the attempt is dead-lettered into the match's events
//     journal as `result-poster` with `payload.outcome = "dead-letter"` so the
//     operator can see what happened.
//
// Pure-network module: no localStorage / no Supabase interaction. Caller still
// owns persistence via updateMatch().

import { appendMatchEvent } from "./match-events"
import type { MatchEventType, ResultPosterConfig } from "./types"

const DEFAULT_RETRIES = 3
const BASE_BACKOFF_MS = 1000

export interface PostResult {
  ok: boolean
  attempts: number
  status?: number
  error?: string
}

/** Strip noisy / large fields so the payload sent over the wire stays small. */
export function buildResultPayload(match: any): Record<string, unknown> {
  if (!match) return {}
  return {
    id: match.id,
    code: match.code,
    type: match.type,
    format: match.format,
    completedAt: match.timing?.matchEndedAt ?? new Date().toISOString(),
    winner: match.winner ?? null,
    endMatchReason: match.endMatchReason ?? "completed",
    sets: match.score?.sets ?? [],
    teamA: {
      players: match.teamA?.players?.map((p: any) => ({ id: p.id, name: p.name, country: p.country })) ?? [],
    },
    teamB: {
      players: match.teamB?.players?.map((p: any) => ({ id: p.id, name: p.name, country: p.country })) ?? [],
    },
    courtNumber: match.courtNumber ?? null,
  }
}

/** Build the Authorization header from a basic-auth config block, if present. */
function buildAuthHeader(config: ResultPosterConfig): string | null {
  if (!config.basicAuth) return null
  const { username, password } = config.basicAuth
  if (!username) return null
  // btoa is browser-only but exists in jsdom and modern Node — fine for both.
  const raw = `${username}:${password ?? ""}`
  if (typeof btoa === "function") return `Basic ${btoa(raw)}`
  // Node fallback.
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`
}

/**
 * Inner POST step — single attempt, no retry. Exported so callers can drive
 * their own retry policy if they don't want our defaults.
 */
export async function postOnce(
  config: ResultPosterConfig,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<PostResult> {
  if (!config?.url) return { ok: false, attempts: 0, error: "no-url" }
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const auth = buildAuthHeader(config)
  if (auth) headers.Authorization = auth
  try {
    const res = await fetchImpl(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })
    return { ok: res.ok, attempts: 1, status: res.status }
  } catch (err: any) {
    return { ok: false, attempts: 1, error: err?.message ?? "fetch-error" }
  }
}

/**
 * Retrying POST with exponential backoff. Returns the final outcome (ok / not).
 * `sleep` is injectable so unit tests can resolve backoff immediately.
 */
export async function postWithRetry(
  config: ResultPosterConfig,
  payload: Record<string, unknown>,
  options: {
    fetchImpl?: typeof fetch
    sleep?: (ms: number) => Promise<void>
    retries?: number
  } = {},
): Promise<PostResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)))
  const retries = options.retries ?? DEFAULT_RETRIES

  let last: PostResult = { ok: false, attempts: 0 }
  for (let attempt = 0; attempt < retries; attempt++) {
    const r = await postOnce(config, payload, fetchImpl)
    last = { ...r, attempts: attempt + 1 }
    if (r.ok) return last
    if (attempt < retries - 1) {
      await sleep(BASE_BACKOFF_MS * 2 ** attempt)
    }
  }
  return last
}

/**
 * Auto-post entry point — called from the orchestrator when a match completes.
 * Returns a new match snapshot with a `result-poster` event recording the
 * outcome (success / dead-letter). The caller is still responsible for
 * persisting that snapshot.
 *
 * Safe to call on every save: if the match isn't completed OR no resultPoster
 * config exists OR autoOnComplete is disabled, returns the input unchanged.
 */
export async function postResultIfConfigured(
  match: any,
  options: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: Date } = {},
): Promise<any> {
  if (!match?.isCompleted) return match
  const config: ResultPosterConfig | undefined = match?.settings?.resultPoster
  if (!config?.url || !config.autoOnComplete) return match

  const payload = buildResultPayload(match)
  const result = await postWithRetry(config, payload, options)

  const now = options.now ?? new Date()
  return appendMatchEvent(match, {
    type: "result-poster" as MatchEventType,
    setIndex: match.score?.sets?.length ?? 0,
    gameIndex: match.score?.currentSet?.games?.length ?? 0,
    payload: {
      url: config.url,
      ok: result.ok,
      attempts: result.attempts,
      status: result.status,
      error: result.error,
      outcome: result.ok ? "posted" : "dead-letter",
    },
    at: now.toISOString(),
  })
}
