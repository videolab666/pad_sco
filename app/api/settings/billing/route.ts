// GET   /api/settings/billing — settings-auth. { plan, usage: { courts, maxCourts } }
// PATCH /api/settings/billing — settings-auth. { plan: "starter"|"club"|"pro" }
//
// v1 (plan-4 §55): план хранится в club_settings "billing" — ручное управление,
// без Stripe. Переключение тарифа — действие администратора.

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { createServerSupabaseClient } from "@/lib/supabase"
import { listCourts } from "@/lib/court-registry"
import { PLANS, type PlanTier } from "@/lib/billing-plans"

async function readPlanTier(): Promise<PlanTier> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase.from("club_settings").select("value").eq("key", "billing").maybeSingle()
  const tier = (data?.value as { plan?: PlanTier } | null)?.plan
  return tier && tier in PLANS ? tier : "starter"
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const tier = await readPlanTier()
  const courts = await listCourts(false).catch(() => [])
  return NextResponse.json({
    plan: PLANS[tier],
    usage: {
      courts: courts.length,
      maxCourts: PLANS[tier].maxCourts,
      players: null, // счётчик игроков подключим позже (players RLS)
    },
  })
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: { plan?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const tier = body.plan as PlanTier
  if (!tier || !(tier in PLANS)) {
    return NextResponse.json({ error: "invalid_plan", hint: "starter | club | pro" }, { status: 400 })
  }

  // Понижение тарифа проверяем на превышение лимита кортов (§55):
  // переключить можно, но предупреждаем в UI; здесь возвращаем факт превышения.
  const courts = await listCourts(false).catch(() => [])
  const overLimit = courts.length > PLANS[tier].maxCourts

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from("club_settings")
    .upsert(
      { key: "billing", value: { plan: tier }, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    )
  if (error) {
    return NextResponse.json({ error: "write_failed", message: error.message }, { status: 500 })
  }

  return NextResponse.json({ plan: PLANS[tier], overLimit, courtsCount: courts.length })
}
