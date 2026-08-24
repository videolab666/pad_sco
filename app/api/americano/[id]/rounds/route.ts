// GET /api/americano/{id}/rounds — раунды с матчами (для UI live-таблицы)
import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { getAmericanoRounds } from "@/lib/americano-service"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const rounds = await getAmericanoRounds(id)
  return NextResponse.json({ rounds }, { headers: { "Cache-Control": "no-store" } })
}
