// POST /api/americano/matches/{id}/result — ввод счёта матча { scoreA, scoreB }
import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { AmericanoValidationError, submitMatchResult } from "@/lib/americano-service"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const scoreA = Number(body.scoreA)
  const scoreB = Number(body.scoreB)
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA > 99 || scoreB > 99) {
    return NextResponse.json({ error: "validation", message: "scoreA/scoreB: целые 0–99" }, { status: 400 })
  }
  try {
    await submitMatchResult({ matchId: id, scoreA, scoreB })
    return NextResponse.json({ status: "ok" })
  } catch (err) {
    if (err instanceof AmericanoValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    return NextResponse.json({ error: "result_failed", message: (err as Error).message }, { status: 500 })
  }
}
