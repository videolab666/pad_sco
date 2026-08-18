// GET  /api/video/recordings?active=true — сессии записи (staff)
// POST /api/video/recordings — старт записи (§134): { streamKey | courtId,
//      courtSessionId?, metadata? }. Источник должен быть online (heartbeat).

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import {
  VideoValidationError,
  listRecordings,
  startRecording,
} from "@/lib/video-registry"

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const url = new URL(request.url)
  try {
    const recordings = await listRecordings({
      active: url.searchParams.get("active") === "true",
      courtId: url.searchParams.get("court") ?? undefined,
    })
    return NextResponse.json({ recordings }, { headers: { "Cache-Control": "no-store" } })
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
  try {
    const recording = await startRecording({
      streamKey: typeof body.streamKey === "string" ? body.streamKey : undefined,
      courtId: typeof body.courtId === "string" ? body.courtId : undefined,
      courtSessionId: typeof body.courtSessionId === "string" ? body.courtSessionId : undefined,
      metadata: (body.metadata as Record<string, unknown>) ?? undefined,
    })
    return NextResponse.json({ recording }, { status: 201 })
  } catch (err) {
    if (err instanceof VideoValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: "start_failed", message: (err as Error).message }, { status: 500 })
  }
}
