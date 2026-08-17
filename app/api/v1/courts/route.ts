// GET /api/v1/courts — публичный список активных кортов (plan-4 §247).
// Минимальные поля: id, name, shortCode, legacyNumber, sortOrder.
// Читают: выбор корта при создании матча, QR-страницы, публичные интеграции.
// Не секретно: то, что и так видно на табло; управление — только через
// /api/courts (settings-auth).

import { NextResponse } from "next/server"
import { ensureCourtSchema, listCourts } from "@/lib/court-registry"

export async function GET() {
  if (!(await ensureCourtSchema())) {
    return NextResponse.json({ error: "schema_not_ready" }, { status: 503 })
  }
  try {
    const courts = await listCourts(false)
    return NextResponse.json(
      {
        courts: courts.map((c) => ({
          id: c.id,
          name: c.name,
          shortCode: c.shortCode,
          legacyNumber: c.legacyNumber,
          sortOrder: c.sortOrder,
        })),
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: "internal_error", message: (error as Error).message },
      { status: 500 },
    )
  }
}
