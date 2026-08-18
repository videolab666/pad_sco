// POST /api/v1/video/heartbeat — heartbeat камеры (§152/§194).
//
// Устройство (Court Camera Agent / симулятор) сообщает stream_key, статус и
// здоровье. stream_key играет роль идентификатора устройства (v1: доступ
// устройства к endpoint ограничен самим ключом; выдача ключей и ротация —
// §101 api_keys позже). Источник создаётся при первом heartbeat —
// zero-friction provisioning (§88).

import { type NextRequest, NextResponse } from "next/server"
import { heartbeatSource, VideoValidationError, type VideoSourceStatus } from "@/lib/video-registry"
import { logEvent } from "@/lib/error-logger"

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  try {
    const source = await heartbeatSource({
      streamKey: String(body.streamKey ?? ""),
      status: (body.status ?? "online") as VideoSourceStatus,
      name: typeof body.name === "string" ? body.name : undefined,
      health: (body.health as Record<string, unknown>) ?? {},
    })
    return NextResponse.json({ source: { id: source.id, streamKey: source.streamKey, status: source.status } })
  } catch (err) {
    if (err instanceof VideoValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    logEvent("error", `video heartbeat: ${(err as Error).message}`, "video-heartbeat", err)
    return NextResponse.json({ error: "heartbeat_failed", message: (err as Error).message }, { status: 500 })
  }
}
