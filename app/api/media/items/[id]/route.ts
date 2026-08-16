// PATCH  /api/media/items/[id] — AUTH. { title?, isActive?, durationSec?,
//        bgItemId?: string|null } — bgItemId picks a library PHOTO as the
//        blurred backdrop for vertical videos (null = same-media blur).
// DELETE /api/media/items/[id] — AUTH. Removes the row and the Storage object;
//        items using it as a backdrop fall back to the same-media blur.

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
  let body: { title?: string; isActive?: boolean; durationSec?: number | null; bgItemId?: string | null }
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
  if (body.bgItemId !== undefined) {
    if (body.bgItemId === null || body.bgItemId === "") {
      patch.bg_path = null
    } else if (typeof body.bgItemId === "string") {
      // Фон — только существующая картинка из медиатеки.
      const { data: bg } = await mediaSupabase()
        .from("media_items")
        .select("id, kind, storage_path")
        .eq("id", body.bgItemId)
        .maybeSingle()
      if (!bg || bg.kind !== "image") {
        return NextResponse.json({ error: "invalid_bg_item" }, { status: 400 })
      }
      patch.bg_path = String(bg.storage_path)
    }
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

  // Удалённую картинку могли выбрать фоном для вертикальных видео — снимаем
  // ссылки, оверлей откатывается на размытие самим видео.
  if (existing.storage_path) {
    await supabase.from("media_items").update({ bg_path: null }).eq("bg_path", existing.storage_path)
  }
  // media_playlist_items rows cascade; best-effort object removal.
  await supabase.storage.from(BUCKET).remove([String(existing.storage_path)])
  return NextResponse.json({ ok: true })
}
