// GET   /api/media/settings — AUTH. { storageLimitBytes, usedBytes, triggers }
// PATCH /api/media/settings — AUTH. { storageLimitBytes?, triggers? } — quota
//        and the ad-trigger config (club_settings row "media").

import { NextResponse, type NextRequest } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { normalizeTriggers } from "@/lib/media-core"
import { getMediaConfig, getMediaUsedBytes, mediaSupabase } from "@/lib/media-server"

export async function GET(request: NextRequest) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const supabase = mediaSupabase()
  const config = await getMediaConfig(supabase)
  return NextResponse.json({
    storageLimitBytes: config.storageLimitBytes,
    usedBytes: await getMediaUsedBytes(supabase),
    triggers: config.triggers,
  })
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: { storageLimitBytes?: number; triggers?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const supabase = mediaSupabase()
  const config = await getMediaConfig(supabase)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value: Record<string, any> = { triggers: config.triggers, storageLimitBytes: config.storageLimitBytes }
  if (body.triggers !== undefined) value.triggers = normalizeTriggers(body.triggers)
  if (body.storageLimitBytes !== undefined) {
    const n = Number(body.storageLimitBytes)
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "invalid_quota" }, { status: 400 })
    value.storageLimitBytes = Math.trunc(n)
  }

  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: "media", value, updated_at: new Date().toISOString() }, { onConflict: "key" })
  if (error) return NextResponse.json({ error: "write_failed", message: error.message }, { status: 500 })

  return NextResponse.json({ storageLimitBytes: value.storageLimitBytes, usedBytes: await getMediaUsedBytes(supabase), triggers: value.triggers })
}
