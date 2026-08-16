// GET  /api/media/playlists — AUTH. All playlists with their items.
// POST /api/media/playlists — AUTH. { name } → new empty playlist.

import { NextResponse, type NextRequest } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { mediaSupabase } from "@/lib/media-server"

export async function GET(request: NextRequest) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const supabase = mediaSupabase()
  const [playlistsRes, refsRes] = await Promise.all([
    supabase.from("media_playlists").select("*").order("created_at", { ascending: true }),
    supabase.from("media_playlist_items").select("playlist_id, item_id, position, duration_sec"),
  ])
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
  return NextResponse.json({ playlists })
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 })

  const supabase = mediaSupabase()
  const { data, error } = await supabase
    .from("media_playlists")
    .insert({ name, is_default: false, bumper: {} })
    .select("*")
    .single()
  if (error || !data) return NextResponse.json({ error: "insert_failed", message: error?.message }, { status: 500 })
  return NextResponse.json({ playlist: { id: String(data.id), name: data.name, isDefault: false, bumper: {}, items: [] } })
}
