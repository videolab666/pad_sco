// GET   /api/settings/brand — ПУБЛИЧНО (брендинг — отображаемые данные:
// CSS-переменные нужны табло/dashboard без пароля настроек).
// PATCH /api/settings/brand — settings-auth. { ...BrandProfile } → club_settings "brand".

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveBrand, type BrandProfile } from "@/lib/white-label"

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const COURT_NAMINGS: BrandProfile["courtNaming"][] = ["numbered", "named", "custom"]

/** Публичный бренд клуба (из club_settings "brand", слитый с дефолтом). */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase.from("club_settings").select("value").eq("key", "brand").maybeSingle()
    const brand = resolveBrand((data?.value as Partial<BrandProfile>) ?? null)
    return NextResponse.json({ brand }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    // База недоступна — отдаём дефолт, чтобы UI не падал
    return NextResponse.json({ brand: resolveBrand(null) }, { headers: { "Cache-Control": "no-store" } })
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const clubName = typeof body.clubName === "string" ? body.clubName.trim() : ""
  if (!clubName || clubName.length > 100) {
    return NextResponse.json({ error: "invalid_club_name" }, { status: 400 })
  }

  const colors = ["primaryColor", "secondaryColor", "accentColor", "bgColor", "textColor"] as const
  const value: Record<string, unknown> = { clubName }
  for (const key of colors) {
    const v = body[key]
    if (typeof v !== "string" || !HEX_RE.test(v)) {
      return NextResponse.json({ error: `invalid_${key}`, hint: "ожидается #RRGGBB" }, { status: 400 })
    }
    value[key] = v.toLowerCase()
  }

  const naming = body.courtNaming
  if (naming !== undefined && !COURT_NAMINGS.includes(naming as BrandProfile["courtNaming"])) {
    return NextResponse.json({ error: "invalid_court_naming" }, { status: 400 })
  }
  value.courtNaming = (naming as BrandProfile["courtNaming"]) ?? "numbered"

  // Необязательные URL (лого/шрифт/домен) — только https
  for (const key of ["logoUrl", "secondaryLogoUrl", "fontUrl", "domain"] as const) {
    const v = body[key]
    if (typeof v === "string" && v) {
      if (!/^https:\/\/.+/.test(v)) {
        return NextResponse.json({ error: `invalid_${key}`, hint: "ожидается https://…" }, { status: 400 })
      }
      value[key] = v
    }
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from("club_settings")
    .upsert({ key: "brand", value, updated_at: new Date().toISOString() }, { onConflict: "key" })
  if (error) {
    return NextResponse.json({ error: "write_failed", message: error.message }, { status: 500 })
  }

  return NextResponse.json({ brand: resolveBrand(value as Partial<BrandProfile>) })
}
