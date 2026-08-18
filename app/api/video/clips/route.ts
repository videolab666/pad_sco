// GET  /api/video/clips?status=pending — список заявок (staff/воркер по X-API-Key)
// POST /api/video/clips — { markerId }: создать клип из маркера (§141).
//        Диапазон (in/out) считается из pre/post-roll маркера (§138).

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import {
  ClipValidationError,
  createClipFromMarker,
  listClips,
} from "@/lib/clip-registry"
import { logEvent } from "@/lib/error-logger"

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const url = new URL(request.url)
  try {
    const clips = await listClips({
      status: url.searchParams.get("status") ?? undefined,
      recordingSessionId: url.searchParams.get("recording") ?? undefined,
    })
    return NextResponse.json({ clips }, { headers: { "Cache-Control": "no-store" } })
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
  if (typeof body.markerId !== "string") {
    return NextResponse.json({ error: "validation", message: "markerId обязателен" }, { status: 400 })
  }
  try {
    const clip = await createClipFromMarker(body.markerId)
    logEvent("info", `clips: заявка ${clip.id} из маркера ${body.markerId} (${clip.inMs}–${clip.outMs}мс)`, "clips-api")
    return NextResponse.json({ clip }, { status: 201 })
  } catch (err) {
    if (err instanceof ClipValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    logEvent("error", `clips: ${(err as Error).message}`, "clips-api", err)
    return NextResponse.json({ error: "create_failed", message: (err as Error).message }, { status: 500 })
  }
}
