// PATCH  /api/media/items/[id] — AUTH. { title?, isActive?, durationSec? }
// DELETE /api/media/items/[id] — AUTH. Removes the row and the Storage object.

import { NextResponse, type NextRequest } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { mediaItemFromRow, mediaPublicUrl } from "@/lib/media-core"
import { mediaSupabase } from "@/lib/media-server"

const BUCKET = "media"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await params
  let body: { title?: string; isActive?: boolean; durationSec?: number | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {}
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim()
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive
  if (body.durationSec === null || typeof body.durationSec === "number") {
    const n = Number(body.durationSec)
    patch.duration_sec = body.durationSec === null ? null : Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 })

  const supabase = mediaSupabase()
  const { data, error } = await supabase.from("media_items").update(patch).eq("id", id).select("*").single()
  if (error || !data) return NextResponse.json({ error: "update_failed", message: error?.message }, { status: 500 })

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(/\/+$/, "")
  return NextResponse.json({ item: { ...mediaItemFromRow(data), url: mediaPublicUrl(base, data.storage_path) } })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const supabase = mediaSupabase()

  const { data: existing } = await supabase.from("media_items").select("id, storage_path").eq("id", id).maybeSingle()
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const { error } = await supabase.from("media_items").delete().eq("id", id)
  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 })

  // media_playlist_items rows cascade; best-effort object removal.
  await supabase.storage.from(BUCKET).remove([String(existing.storage_path)])
  return NextResponse.json({ ok: true })
}
