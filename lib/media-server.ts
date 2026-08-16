// Server-side helpers shared by the /api/media routes: config load, court
// match lookup, the auto-trigger evaluation step and playlist resolution.
// All decision logic lives in lib/media-core.ts (pure, tested); this module
// only moves rows in and out of Supabase.

import { createServerSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"
import {
  DEFAULT_BUMPER_CONFIG,
  buildPlaybackList,
  emptyMediaState,
  evaluateMediaState,
  lastScoreAtFromMatchRow,
  mediaItemFromRow,
  mediaPublicUrl,
  mediaStateFromRow,
  mediaStateToRow,
  normalizeBumper,
  normalizeTriggers,
  resolveTriggers,
  synthesizePlaylistItems,
  type MediaCourtState,
  type MediaItem,
  type MediaMatchInfo,
  type MediaPlaylist,
  type MediaTriggers,
  type PlaybackEntry,
} from "./media-core"

export interface MediaConfig {
  storageLimitBytes: number
  triggers: MediaTriggers
}

const DEFAULT_CONFIG: MediaConfig = {
  storageLimitBytes: 2 * 1024 * 1024 * 1024,
  triggers: normalizeTriggers({}),
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** club_settings row "media" → { storageLimitBytes, triggers } (with defaults). */
export async function getMediaConfig(supabase: any): Promise<MediaConfig> {
  const { data } = await supabase.from("club_settings").select("value").eq("key", "media").maybeSingle()
  const value = (data?.value ?? {}) as Record<string, unknown>
  const limit = Number(value.storageLimitBytes)
  return {
    storageLimitBytes: Number.isFinite(limit) && limit >= 0 ? Math.trunc(limit) : DEFAULT_CONFIG.storageLimitBytes,
    triggers: normalizeTriggers(value.triggers),
  }
}

/** Bytes currently occupied by library items. */
export async function getMediaUsedBytes(supabase: any): Promise<number> {
  const { data, error } = await supabase.from("media_items").select("size_bytes")
  if (error) {
    logEvent("error", `media: failed to sum sizes: ${error.message}`, "getMediaUsedBytes")
    return 0
  }
  return (data ?? []).reduce((sum: number, r: any) => sum + Number(r.size_bytes ?? 0), 0)
}

/**
 * The court's current match for the ad triggers: the newest ACTIVE match on
 * the court, falling back to the newest completed one (same rule the
 * fullscreen scoreboard uses). Null when the court has no match at all.
 */
export async function getCourtMatchInfo(supabase: any, courtNumber: number): Promise<MediaMatchInfo | null> {
  const columns = "id, is_completed, updated_at, extras"
  const active = await supabase
    .from("matches")
    .select(columns)
    .eq("court_number", courtNumber)
    .eq("is_completed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  let row = active.data
  if (!row && !active.error) {
    const completed = await supabase
      .from("matches")
      .select(columns)
      .eq("court_number", courtNumber)
      .eq("is_completed", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    row = completed.data
  }
  if (!row) return null
  const endedAt = row.extras?.timing?.matchEndedAt
  return {
    id: String(row.id),
    isCompleted: row.is_completed === true,
    matchEndedAt: endedAt ? new Date(endedAt).getTime() || null : null,
    lastScoreAt: lastScoreAtFromMatchRow(row),
  }
}

/** Load the persisted court state (or an empty one). */
export async function getMediaState(supabase: any, courtNumber: number): Promise<MediaCourtState> {
  const { data } = await supabase.from("media_state").select("*").eq("court_number", courtNumber).maybeSingle()
  return data ? mediaStateFromRow(data, courtNumber) : emptyMediaState(courtNumber)
}

/**
 * Run the pure reducer and persist the result when it changed. Returns the
 * effective state (always fresh even when no write happened).
 */
export async function evalCourtMediaState(
  supabase: any,
  courtNumber: number,
  triggers: MediaTriggers,
): Promise<MediaCourtState> {
  const [state, match] = await Promise.all([getMediaState(supabase, courtNumber), getCourtMatchInfo(supabase, courtNumber)])
  const next = evaluateMediaState(state, match, resolveTriggers(triggers, courtNumber), Date.now())
  if (next !== state) {
    const row = mediaStateToRow(next)
    const { error } = await supabase.from("media_state").upsert(row)
    if (error) {
      logEvent("error", `media: state upsert failed: ${error.message}`, "evalCourtMediaState", { courtNumber })
      // Serve the computed state anyway — screens stay correct this poll.
      return next
    }
    logEvent("info", `media: court ${courtNumber} → playing=${next.isPlaying} source=${next.source ?? "-"}`, "evalCourtMediaState")
  }
  return next
}

export async function saveMediaState(supabase: any, state: MediaCourtState): Promise<boolean> {
  const { error } = await supabase.from("media_state").upsert(mediaStateToRow(state))
  if (error) {
    logEvent("error", `media: state upsert failed: ${error.message}`, "saveMediaState", { court: state.courtNumber })
    return false
  }
  return true
}

export interface PlaylistPayload {
  playlist: MediaPlaylist | null
  entries: PlaybackEntry[]
}

/**
 * Resolve what a court should play: the state's playlist → the default
 * playlist → every active library item (synthesize). Rows → items, entries
 * carry public Storage URLs for the screens.
 */
export async function resolveCourtPlaylist(supabase: any, state: MediaCourtState): Promise<PlaylistPayload> {
  const [itemsRes, playlistsRes, refsRes] = await Promise.all([
    supabase.from("media_items").select("*").eq("is_active", true).order("created_at", { ascending: true }),
    supabase.from("media_playlists").select("*").order("created_at", { ascending: true }),
    supabase.from("media_playlist_items").select("playlist_id, item_id, position, duration_sec"),
  ])
  const items: MediaItem[] = (itemsRes.data ?? []).map(mediaItemFromRow)
  const refs = refsRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toPlaylist = (row: any): MediaPlaylist => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    isDefault: row.is_default === true,
    bumper: row.bumper ?? {},
    items: refs
      .filter((r: any) => r.playlist_id === row.id)
      .map((r: any) => ({ itemId: String(r.item_id), position: Number(r.position ?? 0), durationSec: r.duration_sec == null ? null : Number(r.duration_sec) }))
      .sort((a: any, b: any) => a.position - b.position),
  })
  const playlists: MediaPlaylist[] = (playlistsRes.data ?? []).map(toPlaylist)

  const chosen =
    (state.playlistId && playlists.find((p) => p.id === state.playlistId)) ||
    playlists.find((p) => p.isDefault) ||
    null
  const playlistItems = chosen ? chosen.items : synthesizePlaylistItems(items)
  const entries = buildPlaybackList(items, playlistItems, chosen ? normalizeBumper(chosen.bumper) : DEFAULT_BUMPER_CONFIG)
  return { playlist: chosen, entries }
}

/** Playback entries flattened for the wire (public URLs included). */
export function entriesToWire(entries: PlaybackEntry[]) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(/\/+$/, "")
  return entries.map((e) => ({
    id: e.item.id,
    title: e.item.title,
    kind: e.item.kind,
    url: mediaPublicUrl(base, e.item.storagePath),
    bgUrl: e.item.bgPath ? mediaPublicUrl(base, e.item.bgPath) : null,
    durationSec: e.durationSec,
    isBumper: e.isBumper,
    width: e.item.width,
    height: e.item.height,
  }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Single server client per request route (matches existing route pattern). */
export function mediaSupabase() {
  return createServerSupabaseClient()
}
