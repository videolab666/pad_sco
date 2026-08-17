// POST /api/media/upload-url — AUTH. Quota pre-check, then a presigned
// Storage upload URL so the browser PUTs the file bytes straight to Supabase
// (keeps big videos out of the Next.js function body limit ~6 MB).
// Body: { filename, sizeBytes, mime, durationSec?, width?, height? }
// → { path, url }  (client then PUTs the file and calls /api/media/confirm).

import { NextResponse, type NextRequest } from "next/server"
import { randomBytes } from "node:crypto"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { quotaCheck } from "@/lib/media-core"
import { getMediaConfig, getMediaUsedBytes, mediaSupabase } from "@/lib/media-server"

const MAX_FILE_BYTES = 500 * 1024 * 1024 // per-file cap: 500 MB

function safeName(name: string): string {
  return (
    name
      .replace(/[/\\?%*:|"<>\x00-\x1f]/g, "_")
      .replace(/^\.+/, "_")
      .slice(-120) || "file"
  )
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: { filename?: string; sizeBytes?: number; mime?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const filename = typeof body.filename === "string" ? body.filename.trim() : ""
  const sizeBytes = Number(body.sizeBytes)
  const mime = typeof body.mime === "string" ? body.mime : ""
  if (!filename) return NextResponse.json({ error: "missing_filename" }, { status: 400 })
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return NextResponse.json({ error: "invalid_size" }, { status: 400 })
  if (sizeBytes > MAX_FILE_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 })
  if (!/^(image|video)\//.test(mime)) return NextResponse.json({ error: "unsupported_mime" }, { status: 400 })

  const supabase = mediaSupabase()
  const config = await getMediaConfig(supabase)
  const quota = quotaCheck({ usedBytes: await getMediaUsedBytes(supabase), limitBytes: config.storageLimitBytes }, sizeBytes)
  if (!quota.ok) {
    return NextResponse.json({ error: "quota_exceeded", usedBytes: quota.usedAfterBytes - sizeBytes, limitBytes: quota.limitBytes }, { status: 413 })
  }

  const path = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}-${safeName(filename)}`
  const { data, error } = await supabase.storage.from("media").createSignedUploadUrl(path)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "sign_failed", message: error?.message ?? "no signed url" }, { status: 500 })
  }

  return NextResponse.json({ path, url: data.signedUrl, token: data.token ?? null })
}
