"use client"

// Вкладка «Тариф» в /settings (plan-4 §55): STARTER / CLUB / PRO.
// v1 — ручное управление планом (без Stripe): кнопка «Переключить».

import { useEffect, useState } from "react"
import { AlertTriangle, Check, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PLANS, type PlanDefinition, type PlanTier } from "@/lib/billing-plans"

const TIER_ORDER: PlanTier[] = ["starter", "club", "pro"]
const TIER_BADGE: Record<PlanTier, string> = {
  starter: "Бесплатно",
  club: "Популярный",
  pro: "Максимум",
}

export function BillingSettings() {
  const [current, setCurrent] = useState<PlanTier>("starter")
  const [courts, setCourts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<PlanTier | null>(null)
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null)

  const load = async () => {
    try {
      const res = await fetch("/api/settings/billing", { cache: "no-store" })
      if (res.ok) {
        const d = await res.json()
        setCurrent(d.plan.tier)
        setCourts(d.usage.courts)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const switchPlan = async (tier: PlanTier) => {
    if (tier === current) return
    setSwitching(tier)
    setNotice(null)
    try {
      const res = await fetch("/api/settings/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: tier }),
      })
      if (res.ok) {
        const d = await res.json()
        setCurrent(tier)
        setNotice(
          d.overLimit
            ? { kind: "warn", text: `Тариф переключён, но кортов больше лимита (${d.courtsCount}/${PLANS[tier].maxCourts}) — новые корты добавить будет нельзя` }
            : { kind: "ok", text: `Тариф переключён: ${PLANS[tier].name}` },
        )
      }
    } catch {
      setNotice({ kind: "warn", text: "Ошибка сети" })
    } finally {
      setSwitching(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const plan = PLANS[current]
  const courtPct = Math.min(100, Math.round((courts / plan.maxCourts) * 100))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Тариф</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Управление планом клуба: лимиты кортов и доступные функции
        </p>
      </div>

      {notice && (
        <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
          notice.kind === "ok" ? "border-green-300 bg-green-50 text-green-800" : "border-amber-300 bg-amber-50 text-amber-800"
        }`}>
          {notice.kind === "warn" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          {notice.text}
        </div>
      )}

      {/* Использование */}
      <Card>
        <CardHeader>
          <CardTitle>Использование — {plan.name}</CardTitle>
          <CardDescription>
            Квота кортов: {courts} из {plan.maxCourts}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                courtPct >= 100 ? "bg-red-500" : courtPct >= 80 ? "bg-amber-500" : "bg-green-600"
              }`}
              style={{ width: `${courtPct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
            <LimitCell label="Хранение видео" value={`${plan.limits.storageGb} ГБ`} />
            <LimitCell label="Хранение записей" value={`${plan.limits.videoRetentionDays} дн.`} />
            <LimitCell label="API-запросы" value={plan.limits.apiCallsPerMonth.toLocaleString("ru-RU")} />
          </div>
        </CardContent>
      </Card>

      {/* Карточки тарифов */}
      <div className="grid gap-4 md:grid-cols-3">
        {TIER_ORDER.map((tier) => (
          <PlanCard
            key={tier}
            plan={PLANS[tier]}
            current={tier === current}
            switching={switching === tier}
            disabled={switching !== null || tier === current}
            onSwitch={() => switchPlan(tier)}
          />
        ))}
      </div>

      {/* Матрица фич */}
      <Card>
        <CardHeader>
          <CardTitle>Сравнение функций</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Функция</th>
                  {TIER_ORDER.map((tier) => (
                    <th key={tier} className={`pb-2 text-center font-medium ${tier === current ? "text-primary" : "text-muted-foreground"}`}>
                      {PLANS[tier].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLANS.pro.features.map((f) => (
                  <tr key={f.key} className="border-b last:border-0">
                    <td className="py-2">{f.label}</td>
                    {TIER_ORDER.map((tier) => (
                      <td key={tier} className="py-2 text-center">
                        {PLANS[tier].features.some((x) => x.key === f.key) ? (
                          <Check className="mx-auto h-4 w-4 text-green-600" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PlanCard({ plan, current, switching, disabled, onSwitch }: {
  plan: PlanDefinition
  current: boolean
  switching: boolean
  disabled: boolean
  onSwitch: () => void
}) {
  return (
    <Card className={`relative flex flex-col ${current ? "border-primary shadow-md ring-1 ring-primary" : ""}`}>
      {plan.tier === "club" && !current && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
          <Sparkles className="mr-1 inline h-3 w-3" />
          {TIER_BADGE[plan.tier]}
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{plan.name}</CardTitle>
        <CardDescription>
          {plan.priceMonthly === 0 ? (
            "Бесплатно"
          ) : (
            <>
              <span className="text-2xl font-black text-foreground">${plan.priceMonthly}</span>
              <span className="text-xs"> / мес · ${plan.priceYearly} / год</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="text-sm text-muted-foreground">
          До {plan.maxCourts} кортов · до {plan.maxPlayers} игроков
        </div>
        <ul className="flex-1 space-y-1.5 text-sm">
          {plan.features.slice(0, 7).map((f) => (
            <li key={f.key} className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              {f.label}
            </li>
          ))}
          {plan.features.length > 7 && (
            <li className="text-xs text-muted-foreground">+{plan.features.length - 7} ещё…</li>
          )}
        </ul>
        <Button
          variant={current ? "secondary" : "default"}
          disabled={disabled}
          onClick={onSwitch}
          className="w-full"
        >
          {switching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {current ? "Текущий тариф" : `Переключить на ${plan.name}`}
        </Button>
      </CardContent>
    </Card>
  )
}

function LimitCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
