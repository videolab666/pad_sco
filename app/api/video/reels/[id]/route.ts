// PATCH /api/video/reels/{id} — статусы воркера (pending→processing→ready|failed).

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { updateReel } from "@/lib/reel-registry"

const STATUSES = ["pending", "processing", "ready", "failed"] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  if (body.status !== undefined && !STATUSES.includes(body.status as (typeof STATUSES)[number])) {
    return NextResponse.json(
      { error: "validation", message: `status должен быть одним из: ${STATUSES.join(", ")}` },
      { status: 400 },
    )
  }
  try {
    const reel = await updateReel(id, {
      status: body.status as (typeof STATUSES)[number] | undefined,
      fileName: typeof body.fileName === "string" ? body.fileName : undefined,
      thumbName: typeof body.thumbName === "string" ? body.thumbName : undefined,
      durationMs: typeof body.durationMs === "number" ? body.durationMs : undefined,
      error: typeof body.error === "string" ? body.error : undefined,
    })
    return NextResponse.json({ reel })
  } catch (err) {
    return NextResponse.json({ error: "update_failed", message: (err as Error).message }, { status: 500 })
  }
}
