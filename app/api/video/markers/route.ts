// GET  /api/video/markers?recording=…&match=…&minImportance=… — маркеры (staff)
// POST /api/video/markers — маркер на записи (§137): важность и pre/post-roll
//      по умолчанию берутся из таблицы §140/§138 для типа маркера.

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { addMarker, listMarkers } from "@/lib/video-registry"

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const url = new URL(request.url)
  const minImportanceParam = Number.parseInt(url.searchParams.get("minImportance") ?? "")
  try {
    const markers = await listMarkers({
      recordingSessionId: url.searchParams.get("recording") ?? undefined,
      matchId: url.searchParams.get("match") ?? undefined,
      minImportance: Number.isFinite(minImportanceParam) ? minImportanceParam : undefined,
    })
    return NextResponse.json({ markers }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    return NextResponse.json({ error: "list_failed", message: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  if (typeof body.recordingSessionId !== "string") {
    return NextResponse.json({ error: "validation", message: "recordingSessionId обязателен" }, { status: 400 })
  }
  try {
    const marker = await addMarker({
      recordingSessionId: body.recordingSessionId,
      matchId: typeof body.matchId === "string" ? body.matchId : null,
      eventId: typeof body.eventId === "string" ? body.eventId : undefined,
      markerType: typeof body.markerType === "string" ? body.markerType : undefined,
      occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : undefined,
      videoPositionMs: typeof body.videoPositionMs === "number" ? body.videoPositionMs : undefined,
      importance: typeof body.importance === "number" ? body.importance : undefined,
      preRollMs: typeof body.preRollMs === "number" ? body.preRollMs : undefined,
      postRollMs: typeof body.postRollMs === "number" ? body.postRollMs : undefined,
      metadata: (body.metadata as Record<string, unknown>) ?? undefined,
    })
    return NextResponse.json({ marker }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: "marker_failed", message: (err as Error).message }, { status: 500 })
  }
}
