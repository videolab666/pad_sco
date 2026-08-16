// GET /api/media/library — AUTH. One call for the /settings ad tab initial
// load: media items (with URLs), playlists (with item refs) and the quota.

import { NextResponse, type NextRequest } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { mediaItemFromRow, mediaPublicUrl } from "@/lib/media-core"
import { getMediaConfig, getMediaUsedBytes, mediaSupabase } from "@/lib/media-server"

export async function GET(request: NextRequest) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const supabase = mediaSupabase()
  const [itemsRes, playlistsRes, refsRes, config, usedBytes] = await Promise.all([
    supabase.from("media_items").select("*").order("created_at", { ascending: true }),
    supabase.from("media_playlists").select("*").order("created_at", { ascending: true }),
    supabase.from("media_playlist_items").select("playlist_id, item_id, position, duration_sec"),
    getMediaConfig(supabase),
    getMediaUsedBytes(supabase),
  ])

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(/\/+$/, "")
  const items = (itemsRes.data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: any) => ({ ...mediaItemFromRow(row), url: mediaPublicUrl(base, row.storage_path) }),
  )
  const refs = refsRes.data ?? []
  const playlists = (playlistsRes.data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: any) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      isDefault: row.is_default === true,
      bumper: row.bumper ?? {},
      items: refs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((r: any) => r.playlist_id === row.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => ({
          itemId: String(r.item_id),
          position: Number(r.position ?? 0),
          durationSec: r.duration_sec == null ? null : Number(r.duration_sec),
        })),
    }),
  )

  return NextResponse.json({
    items,
    playlists,
    quota: { usedBytes, limitBytes: config.storageLimitBytes },
    triggers: config.triggers,
  })
}
