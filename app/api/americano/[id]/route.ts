// GET /api/americano/{id} — событие с участниками
import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { getAmericanoEvent } from "@/lib/americano-service"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const event = await getAmericanoEvent(id)
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ event }, { headers: { "Cache-Control": "no-store" } })
}
