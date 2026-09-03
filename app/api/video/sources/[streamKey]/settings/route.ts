// GET  /api/video/sources/{streamKey}/settings — желаемый конфиг камеры +
//      фактическое состояние устройства (из health последнего heartbeat):
//      pending = settings_version > deviceSettings.version.
// PUT  — частичное обновление: { camera?: {...}, stream?: {...} } →
//      sanitize + merge + settings_version +1 (plan 2026-09-02, Task 1).
// Staff-only: settings-пароль или X-API-Key (isAuthorizedSettingsRequest).

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import {
  mergeDesired,
  sanitizeCameraPatch,
  sanitizeStreamPatch,
  type DesiredSettings,
} from "@/lib/camera-remote-settings"
import { logEvent } from "@/lib/error-logger"

async function loadSourceRow(supabase: ReturnType<typeof createServerSupabaseClient>, streamKey: string) {
  const { data, error } = await supabase
    .from("video_sources")
    .select("id, stream_key, status, last_seen_at, desired_settings, settings_version, acked_local_seq, health")
    .eq("stream_key", streamKey)
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ streamKey: string }> }) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { streamKey } = await params
  try {
    const row = await loadSourceRow(createServerSupabaseClient(), streamKey)
    if (!row) return NextResponse.json({ error: "source_not_found" }, { status: 404 })

    const device = (row.health as Record<string, unknown>)?.deviceSettings as
      | { version?: number; localSeq?: number; caps?: Record<string, unknown> }
      | undefined

    return NextResponse.json(
      {
        streamKey: row.stream_key,
        status: row.status,
        lastSeenAt: row.last_seen_at,
        desired: row.desired_settings ?? {},
        version: row.settings_version,
        ackedLocalSeq: row.acked_local_seq,
        device: device ?? null,
        sceneFlicker: (row.health as Record<string, unknown>)?.sceneFlicker ?? null,
        caps: device?.caps ?? null,
        pending: row.settings_version > (device?.version ?? 0),
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    return NextResponse.json({ error: "load_failed", message: (err as Error).message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ streamKey: string }> }) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { streamKey } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const camera = sanitizeCameraPatch(body.camera)
  const stream = sanitizeStreamPatch(body.stream)
  if (Object.keys(camera).length === 0 && Object.keys(stream).length === 0) {
    return NextResponse.json(
      { error: "validation", message: "Пустой или некорректный патч (нет ни одного известного ключа)" },
      { status: 400 },
    )
  }

  try {
    const supabase = createServerSupabaseClient()
    const row = await loadSourceRow(supabase, streamKey)
    if (!row) return NextResponse.json({ error: "source_not_found" }, { status: 404 })

    const current = (row.desired_settings as DesiredSettings) ?? {}
    const desired = mergeDesired(current, { camera, ...(Object.keys(stream).length ? { stream } : {}) })
    const nextVersion = Number(row.settings_version ?? 0) + 1

    const { error } = await supabase
      .from("video_sources")
      .update({ desired_settings: desired, settings_version: nextVersion })
      .eq("id", row.id)
    if (error) throw new Error(error.message)

    logEvent("info", `camera settings: PUT ${streamKey} v${nextVersion} keys=[${Object.keys(camera).join(",")}]`, "camera-settings")
    return NextResponse.json({ desired, version: nextVersion }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    logEvent("error", `camera settings PUT: ${(err as Error).message}`, "camera-settings", err)
    return NextResponse.json({ error: "put_failed", message: (err as Error).message }, { status: 500 })
  }
}
