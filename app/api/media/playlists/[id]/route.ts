// PATCH  /api/media/playlists/[id] — AUTH.
//        { name?, isDefault?, bumper?, items?: [{ itemId, durationSec? }] }
//        `items` replaces the whole ordered membership (position = array order).
// DELETE /api/media/playlists/[id] — AUTH (items rows cascade).

import { NextResponse, type NextRequest } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { normalizeBumper } from "@/lib/media-core"
import { mediaSupabase } from "@/lib/media-server"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await params
  let body: { name?: string; isDefault?: boolean; bumper?: unknown; items?: { itemId?: string; durationSec?: number | null }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const supabase = mediaSupabase()
  const { data: existing } = await supabase.from("media_playlists").select("id").eq("id", id).maybeSingle()
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {}
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.isDefault === "boolean") patch.is_default = body.isDefault
  if (body.bumper !== undefined) patch.bumper = normalizeBumper(body.bumper)
  if (Object.keys(patch).length > 0) {
    // Exactly one default playlist: clear the flag elsewhere first.
    if (patch.is_default === true) {
      await supabase.from("media_playlists").update({ is_default: false }).neq("id", id)
    }
    const { error } = await supabase.from("media_playlists").update(patch).eq("id", id)
    if (error) return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 })
  }

  if (Array.isArray(body.items)) {
    const rows = body.items
      .map((it, position) => ({
        playlist_id: id,
        item_id: typeof it?.itemId === "string" ? it.itemId : "",
        position,
        duration_sec: it?.durationSec == null ? null : Math.max(0, Math.trunc(Number(it.durationSec))) || null,
      }))
      .filter((r) => r.item_id)
    const known = new Set(
      (
        await supabase
          .from("media_items")
          .select("id")
          .in("id", rows.map((r) => r.item_id))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ).data?.map((r: any) => String(r.id)) ?? [],
    )
    const valid = rows.filter((r) => known.has(r.item_id))

    const del = await supabase.from("media_playlist_items").delete().eq("playlist_id", id)
    if (del.error) return NextResponse.json({ error: "items_reset_failed", message: del.error.message }, { status: 500 })
    if (valid.length > 0) {
      const ins = await supabase.from("media_playlist_items").upsert(valid, { onConflict: "playlist_id,item_id" })
      if (ins.error) return NextResponse.json({ error: "items_write_failed", message: ins.error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const supabase = mediaSupabase()
  const { error } = await supabase.from("media_playlists").delete().eq("id", id)
  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
