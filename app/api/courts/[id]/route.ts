// PATCH  /api/courts/[id] — переименование / slug / порядок / статус (settings-auth)
// DELETE /api/courts/[id] — архивация (soft delete, §246: hard delete запрещён)
//
// short_code immutable: попытка изменить → 422 (QR на корте вечный).

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import {
  CourtNotFoundError,
  CourtValidationError,
  archiveCourt,
  ensureCourtSchema,
  updateCourt,
} from "@/lib/court-registry"
import { logEvent } from "@/lib/error-logger"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!(await ensureCourtSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  const { id } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  try {
    const court = await updateCourt(id, body)
    return NextResponse.json({ court })
  } catch (err) {
    if (err instanceof CourtValidationError) {
      // Изменение short_code и прочие нарушения контракта — 422.
      return NextResponse.json({ error: "validation", errors: err.errors }, { status: 422 })
    }
    if (err instanceof CourtNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }
    logEvent("error", `Courts API: ошибка обновления корта: ${(err as Error).message}`, "courts-api", err)
    return NextResponse.json({ error: "update_failed", message: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!(await ensureCourtSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  const { id } = await params
  try {
    const court = await archiveCourt(id)
    logEvent("info", `Courts API: корт «${court.name}» заархивирован`, "courts-api")
    return NextResponse.json({ court })
  } catch (err) {
    if (err instanceof CourtNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }
    return NextResponse.json({ error: "archive_failed", message: (err as Error).message }, { status: 500 })
  }
}
