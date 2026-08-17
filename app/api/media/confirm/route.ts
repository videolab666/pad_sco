// POST /api/media/confirm — AUTH. After the browser PUT the file to the
// presigned URL: verify the object actually exists in the bucket and record
// the media_items row.
// Body: { path, title?, sizeBytes, mime, durationSec?, width?, height? }

import { NextResponse, type NextRequest } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { mediaItemFromRow, mediaPublicUrl } from "@/lib/media-core"
import { mediaSupabase } from "@/lib/media-server"

const BUCKET = "media"

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: {
    path?: string
    title?: string
    sizeBytes?: number
    mime?: string
    durationSec?: number | null
    width?: number | null
    height?: number | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const path = typeof body.path === "string" ? body.path.trim() : ""
  const mime = typeof body.mime === "string" ? body.mime : ""
  if (!path || path.includes("..") || !/^(image|video)\//.test(mime)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
  }

  const supabase = mediaSupabase()

  // Verify the upload really happened: list the folder and search the name.
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""
  const name = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path
  const { data: listed, error: listError } = await supabase.storage.from(BUCKET).list(dir, { search: name, limit: 1 })
  if (listError || !listed || listed.length === 0) {
    return NextResponse.json({ error: "not_uploaded" }, { status: 400 })
  }

  const kind = mime.startsWith("video/") ? "video" : "image"
  const int = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
  }
  const row = {
    title: (typeof body.title === "string" && body.title.trim()) || name,
    kind,
    storage_path: path,
    size_bytes: Math.max(0, Math.trunc(Number(body.sizeBytes) || 0)),
    mime,
    duration_sec: int(body.durationSec),
    width: int(body.width),
    height: int(body.height),
    is_active: true,
  }
  const { data, error } = await supabase.from("media_items").insert(row).select("*").single()
  if (error || !data) {
    return NextResponse.json({ error: "insert_failed", message: error?.message }, { status: 500 })
  }

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(/\/+$/, "")
  return NextResponse.json({ item: { ...mediaItemFromRow(data), url: mediaPublicUrl(base, row.storage_path) } })
}
