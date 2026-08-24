// GET  /api/americano?status=active — список событий
// POST /api/americano — создать: { name?, format?, playerIds[], pointsPerRound? }

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import {
  AmericanoValidationError,
  createAmericanoEvent,
  listAmericanoEvents,
} from "@/lib/americano-service"

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const url = new URL(request.url)
  try {
    const events = await listAmericanoEvents({
      status: url.searchParams.get("status") ?? undefined,
    })
    return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    return NextResponse.json({ error: "list_failed", message: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  if (!Array.isArray(body.playerIds) || body.playerIds.length < 4) {
    return NextResponse.json(
      { error: "validation", message: "playerIds: минимум 4 игрока (массив UUID)" },
      { status: 400 },
    )
  }
  try {
    const event = await createAmericanoEvent({
      name: typeof body.name === "string" ? body.name : undefined,
      format: typeof body.format === "string" ? body.format : undefined,
      playerIds: body.playerIds as string[],
      pointsPerRound: typeof body.pointsPerRound === "number" ? body.pointsPerRound : undefined,
    })
    return NextResponse.json({ event }, { status: 201 })
  } catch (err) {
    if (err instanceof AmericanoValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: "create_failed", message: (err as Error).message }, { status: 500 })
  }
}
