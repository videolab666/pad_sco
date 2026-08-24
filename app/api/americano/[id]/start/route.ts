// POST /api/americano/{id}/start — запуск: генерация Whist-расписания + раунды
import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { AmericanoValidationError, startAmericanoEvent } from "@/lib/americano-service"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await params
  try {
    const event = await startAmericanoEvent(id)
    return NextResponse.json({ event })
  } catch (err) {
    if (err instanceof AmericanoValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: "start_failed", message: (err as Error).message }, { status: 500 })
  }
}
