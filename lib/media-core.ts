// Pure media-playlist (ads) logic shared by the /api/media routes, the
// /settings admin UI and the fullscreen scoreboard overlay. No I/O here —
// everything is unit-tested in test/media-core.test.ts.
//
// Three layers:
//   1. buildPlaybackList  — ordered entries for a playlist incl. the
//      "virtual duplicate" bumper (club video inserted between ad items).
//   2. evaluateMediaState — the single trigger/stop reducer. The public
//      GET /api/media/state?court=N runs it server-side on every poll, so
//      scoreboards never need write access and every screen converges to the
//      same decision.
//   3. quotaCheck         — storage quota gate used by upload-url.

// ─── Types ───────────────────────────────────────────────────────────────────

export type MediaKind = "image" | "video"

export interface MediaItem {
  id: string
  title: string
  kind: MediaKind
  storagePath: string
  sizeBytes: number
  mime: string
  durationSec: number | null
  width: number | null
  height: number | null
  /** Optional background photo for vertical videos (blurred backdrop). */
  bgPath: string | null
  isActive: boolean
  createdAt?: string
}

export interface PlaylistItemRef {
  itemId: string
  position: number
  durationSec: number | null
}

export interface BumperConfig {
  /** Insert the bumper after every N-th real item (null/0 = disabled). */
  afterEveryN: number | null
  /** ...but not more often than once per M seconds (null/0 = no throttle). */
  minIntervalSec: number | null
  /** Library item used as the bumper. */
  bumperItemId: string | null
}

export interface MediaPlaylist {
  id: string
  name: string
  isDefault: boolean
  bumper: BumperConfig
  items: PlaylistItemRef[]
}

export type MediaTriggerSource = "manual" | "remote" | "idle" | "completed" | "no-match"

export const MEDIA_TRIGGER_SOURCES: readonly MediaTriggerSource[] = [
  "manual",
  "remote",
  "idle",
  "completed",
  "no-match",
]

export interface MediaTriggers {
  /** Show N minutes after the match completed (0 = off). */
  afterCompletedMin: number
  /** No score change for N minutes during a live match (0 = off). */
  noScoreMin: number
  /** No match on the court for N minutes (0 = off). */
  noMatchMin: number
  /** Disable every automatic trigger — manual/remote only. */
  manualOnly: boolean
  /** Any score change stops a running ad session. */
  stopOnAnyScore: boolean
  /** A new active match assigned to the court stops the session. */
  stopOnNewMatch: boolean
  /** Hard session cap in minutes (0 = unlimited). */
  maxSessionMin: number
  /** Stop after N full playlist loops (0 = unlimited). */
  loopsLimit: number
  /** After a session stops, wait N minutes before auto-starting again. */
  cooldownAfterStopMin: number
  /** Per-court partial overrides applied on top of the base config. */
  perCourt: Record<string, Partial<Omit<MediaTriggers, "perCourt">>>
}

export const DEFAULT_MEDIA_TRIGGERS: MediaTriggers = {
  afterCompletedMin: 10,
  noScoreMin: 15,
  noMatchMin: 0,
  manualOnly: false,
  stopOnAnyScore: true,
  stopOnNewMatch: true,
  maxSessionMin: 0,
  loopsLimit: 0,
  cooldownAfterStopMin: 10,
  perCourt: {},
}

/** Ready-made presets offered as buttons in the /settings triggers form. */
export const TRIGGER_PRESETS: Record<string, Partial<MediaTriggers>> = {
  afterMatch: { manualOnly: false, afterCompletedMin: 10, noScoreMin: 0, noMatchMin: 0 },
  idleCourt: { manualOnly: false, afterCompletedMin: 5, noScoreMin: 15, noMatchMin: 10 },
  manualOnly: { manualOnly: true, afterCompletedMin: 0, noScoreMin: 0, noMatchMin: 0 },
}

// ─── Config normalization ────────────────────────────────────────────────────

const toNonNegativeInt = (v: unknown): number => {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : typeof v === "number" ? Math.trunc(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}

const toBool = (v: unknown): boolean => v === true || v === "true"

/**
 * Merge an arbitrary (DB / request body) partial onto DEFAULT_MEDIA_TRIGGERS,
 * clamping numbers and dropping junk. Per-court overrides stay PARTIAL — only
 * the keys actually present are kept, so a court override of {noScoreMin: 30}
 * leaves every other base value intact (see resolveTriggers).
 */
const PER_COURT_KEYS = [
  "afterCompletedMin",
  "noScoreMin",
  "noMatchMin",
  "manualOnly",
  "stopOnAnyScore",
  "stopOnNewMatch",
  "maxSessionMin",
  "loopsLimit",
  "cooldownAfterStopMin",
] as const

export function normalizeTriggers(raw: unknown): MediaTriggers {
  const src = (raw ?? {}) as Record<string, unknown>
  const num = (k: keyof MediaTriggers) => toNonNegativeInt(src[k as string])
  const perCourt: MediaTriggers["perCourt"] = {}
  const rawPerCourt = (src.perCourt ?? {}) as Record<string, unknown>
  for (const [court, overrideRaw] of Object.entries(rawPerCourt)) {
    if (!/^\d+$/.test(court)) continue
    const o = (overrideRaw ?? {}) as Record<string, unknown>
    const partial: Partial<Omit<MediaTriggers, "perCourt">> = {}
    for (const key of PER_COURT_KEYS) {
      if (!(key in o)) continue
      if (key === "manualOnly" || key === "stopOnAnyScore" || key === "stopOnNewMatch") {
        ;(partial as Record<string, unknown>)[key] = toBool(o[key])
      } else {
        ;(partial as Record<string, unknown>)[key] = toNonNegativeInt(o[key])
      }
    }
    if (Object.keys(partial).length > 0) perCourt[court] = partial
  }
  return {
    afterCompletedMin: num("afterCompletedMin"),
    noScoreMin: num("noScoreMin"),
    noMatchMin: num("noMatchMin"),
    manualOnly: toBool(src.manualOnly),
    stopOnAnyScore: src.stopOnAnyScore === undefined ? DEFAULT_MEDIA_TRIGGERS.stopOnAnyScore : toBool(src.stopOnAnyScore),
    stopOnNewMatch: src.stopOnNewMatch === undefined ? DEFAULT_MEDIA_TRIGGERS.stopOnNewMatch : toBool(src.stopOnNewMatch),
    maxSessionMin: num("maxSessionMin"),
    loopsLimit: num("loopsLimit"),
    cooldownAfterStopMin: src.cooldownAfterStopMin === undefined ? DEFAULT_MEDIA_TRIGGERS.cooldownAfterStopMin : num("cooldownAfterStopMin"),
    perCourt,
  }
}

/** Per-court resolution: base config + the court's partial override. */
export function resolveTriggers(base: MediaTriggers, courtNumber: number | null): MediaTriggers {
  if (courtNumber == null) return base
  const override = base.perCourt[String(courtNumber)]
  if (!override) return base
  return { ...base, ...override, perCourt: base.perCourt }
}

export const DEFAULT_BUMPER_CONFIG: BumperConfig = {
  afterEveryN: null,
  minIntervalSec: null,
  bumperItemId: null,
}

export function normalizeBumper(raw: unknown): BumperConfig {
  const src = (raw ?? {}) as Record<string, unknown>
  const n = src.afterEveryN
  const m = src.minIntervalSec
  const bumperId = typeof src.bumperItemId === "string" && src.bumperItemId ? src.bumperItemId : null
  return {
    afterEveryN: typeof n === "number" && n > 0 ? Math.trunc(n) : null,
    minIntervalSec: typeof m === "number" && m > 0 ? Math.trunc(m) : null,
    bumperItemId: bumperId,
  }
}

/** True when a bumper is actually configured (id set + at least one rule). */
export function bumperEnabled(bumper: BumperConfig): boolean {
  return !!bumper.bumperItemId && (!!(bumper.afterEveryN && bumper.afterEveryN > 0) || !!(bumper.minIntervalSec && bumper.minIntervalSec > 0))
}

// ─── Playback list ───────────────────────────────────────────────────────────

export interface PlaybackEntry {
  item: MediaItem
  /** Resolved display duration in seconds (photos default to 10). */
  durationSec: number
  isBumper: boolean
}

export const DEFAULT_PHOTO_DURATION_SEC = 10
/** Used when a video has no known duration (needed for bumper throttling). */
export const VIDEO_DURATION_FALLBACK_SEC = 30

export function itemDurationSec(item: MediaItem, override: number | null | undefined): number {
  if (override && override > 0) return override
  if (item.durationSec && item.durationSec > 0) return item.durationSec
  return item.kind === "video" ? VIDEO_DURATION_FALLBACK_SEC : DEFAULT_PHOTO_DURATION_SEC
}

/**
 * Library-order playlist refs for clubs that never created a playlist:
 * every active item once, newest last.
 */
export function synthesizePlaylistItems(items: MediaItem[]): PlaylistItemRef[] {
  return items.map((item, index) => ({ itemId: item.id, position: index, durationSec: null }))
}

/**
 * Ordered playback entries for a playlist, with the "virtual duplicate"
 * bumper woven in:
 *   - `afterEveryN` — a bumper candidate appears after every N-th real item;
 *   - `minIntervalSec` — candidates are dropped until M seconds elapsed since
 *     the previous bumper (elapsed is estimated from resolved durations).
 * Both null → no bumper at all.
 */
export function buildPlaybackList(
  items: MediaItem[],
  playlistItems: PlaylistItemRef[],
  bumper: BumperConfig,
): PlaybackEntry[] {
  const byId = new Map(items.map((it) => [it.id, it]))
  const ordered = [...playlistItems]
    .sort((a, b) => a.position - b.position)
    .map((ref) => byId.get(ref.itemId))
    .filter((it): it is MediaItem => !!it && it.isActive)

  const entries: PlaybackEntry[] = []
  const useBumper = bumperEnabled(bumper) && byId.has(bumper.bumperItemId!)
  const bumperItem = useBumper ? byId.get(bumper.bumperItemId!)! : null
  let elapsedSec = 0
  let lastBumperAtSec = -Infinity

  ordered.forEach((item, index) => {
    const ref = playlistItems.find((r) => r.itemId === item.id)
    const duration = itemDurationSec(item, ref?.durationSec)
    entries.push({ item, durationSec: duration, isBumper: false })
    elapsedSec += duration

    if (!useBumper) return
    const positionOk = !bumper.afterEveryN || bumper.afterEveryN <= 0 ? true : (index + 1) % bumper.afterEveryN === 0
    const intervalOk =
      !bumper.minIntervalSec || bumper.minIntervalSec <= 0 ? true : elapsedSec - lastBumperAtSec >= bumper.minIntervalSec
    if (positionOk && intervalOk) {
      const bumperDuration = itemDurationSec(bumperItem!, null)
      entries.push({ item: bumperItem!, durationSec: bumperDuration, isBumper: true })
      lastBumperAtSec = elapsedSec
      elapsedSec += bumperDuration
    }
  })

  return entries
}

/** Total playback duration of a list in seconds (0 for empty). */
export function playbackListDurationSec(entries: PlaybackEntry[]): number {
  return entries.reduce((sum, e) => sum + e.durationSec, 0)
}

// ─── Court state + trigger reducer ───────────────────────────────────────────

export interface MediaCourtState {
  courtNumber: number
  isPlaying: boolean
  startedAt: number | null // ms epoch
  source: MediaTriggerSource | null
  /** Forced (manual/remote) sessions: auto rules take over after this moment. */
  forcedUntil: number | null // ms epoch
  playlistId: string | null
  lastStoppedAt: number | null // ms epoch
  lastMatchSeenAt: number | null // ms epoch — for the no-match trigger
  lastMatchId: string | null
  /** Match id whose completion already triggered a session (one per match). */
  lastCompletedShownFor: string | null
}

export function emptyMediaState(courtNumber: number): MediaCourtState {
  return {
    courtNumber,
    isPlaying: false,
    startedAt: null,
    source: null,
    forcedUntil: null,
    playlistId: null,
    lastStoppedAt: null,
    lastMatchSeenAt: null,
    lastMatchId: null,
    lastCompletedShownFor: null,
  }
}

/** What the server sees of the court's match right now (ms epochs). */
export interface MediaMatchInfo {
  id: string
  isCompleted: boolean
  matchEndedAt: number | null
  lastScoreAt: number | null
}

export type SessionStopReason = "score" | "new-match" | "max-session" | "forced-end"

/**
 * Why the running session must stop (null = keep playing). Shared by the
 * server reducer and the client overlay so both react identically.
 * "forced-end" is server-only: after it the session may continue under auto
 * rules, which the client cannot re-derive — the next poll decides.
 */
export function sessionStopReason(
  state: MediaCourtState,
  match: MediaMatchInfo | null,
  triggers: MediaTriggers,
  now: number,
): SessionStopReason | null {
  if (!state.isPlaying || !state.startedAt) return null
  if (triggers.stopOnAnyScore && match && match.lastScoreAt != null && match.lastScoreAt >= state.startedAt) {
    return "score"
  }
  if (
    triggers.stopOnNewMatch &&
    match &&
    !match.isCompleted &&
    state.lastMatchId != null &&
    match.id !== state.lastMatchId
  ) {
    return "new-match"
  }
  if (triggers.maxSessionMin > 0 && now - state.startedAt >= triggers.maxSessionMin * 60_000) {
    return "max-session"
  }
  const forced = state.source === "manual" || state.source === "remote"
  if (forced && state.forcedUntil != null && now >= state.forcedUntil) {
    return "forced-end"
  }
  return null
}

function autoStartSource(
  state: MediaCourtState,
  match: MediaMatchInfo | null,
  triggers: MediaTriggers,
  now: number,
): MediaTriggerSource | null {
  if (triggers.manualOnly) return null
  if (
    match &&
    match.isCompleted &&
    triggers.afterCompletedMin > 0 &&
    match.matchEndedAt != null &&
    now - match.matchEndedAt >= triggers.afterCompletedMin * 60_000 &&
    state.lastCompletedShownFor !== match.id
  ) {
    return "completed"
  }
  if (
    match &&
    !match.isCompleted &&
    triggers.noScoreMin > 0 &&
    match.lastScoreAt != null &&
    now - match.lastScoreAt >= triggers.noScoreMin * 60_000
  ) {
    return "idle"
  }
  if (!match && triggers.noMatchMin > 0 && state.lastMatchSeenAt != null && now - state.lastMatchSeenAt >= triggers.noMatchMin * 60_000) {
    return "no-match"
  }
  return null
}

export const LAST_SEEN_QUANTUM_MS = 5 * 60_000

/**
 * The single trigger/stop reducer. Given the persisted state, the court's
 * current match and the resolved triggers, compute the next state.
 * Returns the SAME reference when nothing changes, so callers can skip writes.
 *
 * Bookkeeping (lastMatchId / lastMatchSeenAt) is updated on every call;
 * lastMatchSeenAt is quantized to 5-minute steps so a continuously present
 * match does not cause a DB write (and a realtime broadcast) on every poll.
 * A forced session that hit forced-end degrades into an auto-evaluated session
 * instead of hard-stopping when an auto trigger still applies.
 */
export function evaluateMediaState(
  state: MediaCourtState,
  match: MediaMatchInfo | null,
  triggers: MediaTriggers,
  now: number,
): MediaCourtState {
  let next: MediaCourtState = { ...state }

  // Track which match is (or was last) on the court.
  if (match && match.id !== next.lastMatchId) next.lastMatchId = match.id
  if (match && (next.lastMatchSeenAt == null || now - next.lastMatchSeenAt >= LAST_SEEN_QUANTUM_MS)) {
    next.lastMatchSeenAt = now
  }

  if (next.isPlaying) {
    const reason = sessionStopReason(state, match, triggers, now)
    if (reason === "score" || reason === "new-match" || reason === "max-session") {
      if (state.source === "completed" && match) next.lastCompletedShownFor = match.id
      next.isPlaying = false
      next.source = null
      next.startedAt = null
      next.forcedUntil = null
      next.lastStoppedAt = now
    } else if (reason === "forced-end") {
      // Forced window over — continue only if an auto trigger independently
      // applies; otherwise stop (this also drops source to the auto value).
      const auto = autoStartSource(next, match, triggers, now)
      if (auto) {
        next.source = auto
        next.forcedUntil = null
      } else {
        next.isPlaying = false
        next.source = null
        next.startedAt = null
        next.forcedUntil = null
        next.lastStoppedAt = now
      }
    }
  } else {
    const cooldownMs = triggers.cooldownAfterStopMin * 60_000
    const inCooldown = next.lastStoppedAt != null && cooldownMs > 0 && now - next.lastStoppedAt < cooldownMs
    if (!inCooldown) {
      const auto = autoStartSource(next, match, triggers, now)
      if (auto) {
        next.isPlaying = true
        next.source = auto
        next.startedAt = now
        next.forcedUntil = null
        if (auto === "completed" && match) next.lastCompletedShownFor = match.id
      }
    }
  }

  // Same reference when nothing actually changed → caller skips the UPDATE.
  const { courtNumber: _cn, ...a } = next
  const { courtNumber: _c, ...b } = state
  return JSON.stringify(a) === JSON.stringify(b) ? state : next
}

/**
 * Manual/remote show applied on top of the reducer result (POST
 * /api/media/state): forced sessions ignore cooldowns and auto triggers.
 */
export function applyManualShow(
  state: MediaCourtState,
  source: "manual" | "remote",
  now: number,
  forcedUntilMin: number | null = null,
  playlistId: string | null = null,
): MediaCourtState {
  return {
    ...state,
    isPlaying: true,
    source,
    startedAt: now,
    forcedUntil: forcedUntilMin && forcedUntilMin > 0 ? now + forcedUntilMin * 60_000 : null,
    playlistId,
    lastStoppedAt: null,
  }
}

export function applyManualHide(state: MediaCourtState, now: number): MediaCourtState {
  return {
    ...state,
    isPlaying: false,
    source: null,
    startedAt: null,
    forcedUntil: null,
    lastStoppedAt: now,
  }
}

// ─── Quota ───────────────────────────────────────────────────────────────────

export interface MediaQuota {
  usedBytes: number
  /** 0 = unlimited (super admin's choice). */
  limitBytes: number
}

export function quotaCheck(
  quota: MediaQuota,
  incomingBytes: number,
): { ok: boolean; usedAfterBytes: number; remainingBytes: number; limitBytes: number } {
  const size = Math.max(0, Math.trunc(incomingBytes))
  const limit = Math.max(0, Math.trunc(quota.limitBytes))
  const usedAfter = Math.max(0, Math.trunc(quota.usedBytes)) + size
  const remaining = limit > 0 ? Math.max(0, limit - usedAfter) : Number.POSITIVE_INFINITY
  return { ok: limit <= 0 || usedAfter <= limit, usedAfterBytes: usedAfter, remainingBytes: remaining, limitBytes: limit }
}

// ─── Row mapping (snake_case DB ↔ camelCase app) ─────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mediaItemFromRow(row: any): MediaItem {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    kind: row.kind === "video" ? "video" : "image",
    storagePath: String(row.storage_path ?? ""),
    sizeBytes: Number(row.size_bytes ?? 0),
    mime: String(row.mime ?? ""),
    durationSec: row.duration_sec == null ? null : Number(row.duration_sec),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    bgPath: row.bg_path ?? null,
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? undefined,
  }
}

const ms = (v: any): number | null => (v == null ? null : new Date(v).getTime() || null)

export function mediaStateFromRow(row: any, courtNumber: number): MediaCourtState {
  return {
    courtNumber,
    isPlaying: row?.is_playing === true,
    startedAt: ms(row?.started_at),
    source: MEDIA_TRIGGER_SOURCES.includes(row?.trigger_source) ? row.trigger_source : null,
    forcedUntil: ms(row?.forced_until),
    playlistId: row?.playlist_id ?? null,
    lastStoppedAt: ms(row?.last_stopped_at),
    lastMatchSeenAt: ms(row?.last_match_seen_at),
    lastMatchId: row?.last_match_id ?? null,
    lastCompletedShownFor: row?.last_completed_shown_for ?? null,
  }
}

export function mediaStateToRow(state: MediaCourtState): Record<string, unknown> {
  const iso = (v: number | null) => (v == null ? null : new Date(v).toISOString())
  return {
    court_number: state.courtNumber,
    is_playing: state.isPlaying,
    started_at: iso(state.startedAt),
    trigger_source: state.source,
    forced_until: iso(state.forcedUntil),
    playlist_id: state.playlistId,
    last_stopped_at: iso(state.lastStoppedAt),
    last_match_seen_at: iso(state.lastMatchSeenAt),
    last_match_id: state.lastMatchId,
    last_completed_shown_for: state.lastCompletedShownFor,
    updated_at: new Date().toISOString(),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * lastScoreAt for the reducer: timestamp of the most recent "point" event,
 * falling back to the row's updated_at (matches without a journal still get a
 * usable freshness signal).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function lastScoreAtFromMatchRow(row: any): number | null {
  const events = row?.extras?.events
  if (Array.isArray(events)) {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]
      if (ev?.type === "point") {
        const t = ms(ev.at)
        if (t != null) return t
      }
    }
  }
  return ms(row?.updated_at)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Public Storage URL for a media object (public bucket → no signing needed). */
export function mediaPublicUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/+$/, "")
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/")
  return `${base}/storage/v1/object/public/media/${encoded}`
}
