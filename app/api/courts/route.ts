// GET  /api/courts — список кортов (settings-auth)
// POST /api/courts — создать корт { name, slug?, sortOrder? } (settings-auth)
//
// Court Management — Шаг 1 (plan-4 §246/§248): первая видимая фича
// мульти-арендного каркаса. short_code генерируется сервером и immutable.

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import {
  CourtValidationError,
  createCourt,
  ensureCourtSchema,
  listCourts,
} from "@/lib/court-registry"
import { logEvent } from "@/lib/error-logger"

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!(await ensureCourtSchema())) {
    return NextResponse.json(
      { error: "schema_not_ready", hint: "Проверьте env Supabase и миграцию 20260817000000_add_orgs_clubs_courts.sql" },
      { status: 503 },
    )
  }
  const includeArchived = new URL(request.url).searchParams.get("archived") === "true"
  const courts = await listCourts(includeArchived)
  return NextResponse.json({ courts }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!(await ensureCourtSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  try {
    const court = await createCourt({
      name: String(body.name ?? ""),
      slug: typeof body.slug === "string" ? body.slug : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
    })
    logEvent("info", `Courts API: создан корт «${court.name}» (/c/${court.shortCode})`, "courts-api")
    return NextResponse.json({ court }, { status: 201 })
  } catch (err) {
    if (err instanceof CourtValidationError) {
      return NextResponse.json({ error: "validation", errors: err.errors }, { status: 400 })
    }
    logEvent("error", `Courts API: ошибка создания корта: ${(err as Error).message}`, "courts-api", err)
    return NextResponse.json({ error: "create_failed", message: (err as Error).message }, { status: 500 })
  }
}
