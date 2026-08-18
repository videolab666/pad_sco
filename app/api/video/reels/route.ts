// GET  /api/video/reels?status=&recording= — список (staff/воркер)
// POST /api/video/reels — { recordingSessionId, topN? }: собрать highlight-reel
//        из топ-N маркеров по важности (§144); воркер сделает вертикальные
//        клипы для недостающих маркеров и склеит reel.

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { ReelValidationError, createReel, listReels } from "@/lib/reel-registry"

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const url = new URL(request.url)
  try {
    const reels = await listReels({
      status: url.searchParams.get("status") ?? undefined,
      recordingSessionId: url.searchParams.get("recording") ?? undefined,
    })
    return NextResponse.json({ reels }, { headers: { "Cache-Control": "no-store" } })
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
    const reel = await createReel({
      recordingSessionId: body.recordingSessionId,
      topN: typeof body.topN === "number" ? body.topN : undefined,
    })
    return NextResponse.json({ reel }, { status: 201 })
  } catch (err) {
    if (err instanceof ReelValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: "create_failed", message: (err as Error).message }, { status: 500 })
  }
}
