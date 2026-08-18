// PATCH /api/video/recordings/{id} — статус записи (§133) и/или metadata.
// finalizing → uploading → ready | failed; финальные статусы ставят ended_at.

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import {
  VideoNotFoundError,
  VideoValidationError,
  updateRecording,
} from "@/lib/video-registry"

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
  try {
    const recording = await updateRecording(id, {
      status: typeof body.status === "string" ? body.status : undefined,
      metadata: (body.metadata as Record<string, unknown>) ?? undefined,
    })
    return NextResponse.json({ recording })
  } catch (err) {
    if (err instanceof VideoValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    if (err instanceof VideoNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }
    return NextResponse.json({ error: "update_failed", message: (err as Error).message }, { status: 500 })
  }
}
