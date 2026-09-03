// Billing Plans (plan-4 §55) — тарифы STARTER / CLUB / PRO.
//
// Feature flags привязаны к тарифу (§94): каждый фичечек
// проверяет план клуба и включена ли функция.
//
// v1: план хранится в clubs.metadata.plan (без Stripe — ручное управление).
// v2: Stripe Billing + webhook → автоматическое обновление плана.

export type PlanTier = "starter" | "club" | "pro"

export interface PlanFeature {
  key: string
  label: string
  plans: PlanTier[]
}

export interface PlanDefinition {
  tier: PlanTier
  name: string
  priceMonthly: number // USD
  priceYearly: number
  maxCourts: number
  maxPlayers: number
  features: PlanFeature[]
  limits: {
    videoRetentionDays: number
    storageGb: number
    apiCallsPerMonth: number
  }
}

/** Каталог фич (§94: feature flags scope = plan) */
const FEATURE_LIST: Record<string, PlanFeature> = {
  scoreboard: { key: "scoreboard", label: "Табло и подсчёт очков", plans: ["starter", "club", "pro"] },
  physical_buttons: { key: "physical_buttons", label: "Физические кнопки", plans: ["starter", "club", "pro"] },
  qr_play: { key: "qr_play", label: "QR + Quick Play", plans: ["club", "pro"] },
  multi_court: { key: "multi_court", label: "Мультикортный дашборд", plans: ["club", "pro"] },
  video_recording: { key: "video_recording", label: "Запись видео с камер", plans: ["club", "pro"] },
  video_highlights: { key: "video_highlights", label: "Автоклипы и highlight reels", plans: ["pro"] },
  americano: { key: "americano", label: "Americano / Mexicano турниры", plans: ["club", "pro"] },
  rating: { key: "rating", label: "OpenSkill рейтинги", plans: ["club", "pro"] },
  player_pwa: { key: "player_pwa", label: "Личные кабинеты игроков", plans: ["club", "pro"] },
  leagues: { key: "leagues", label: "Лиги и дивизионы", plans: ["pro"] },
  booking_integration: { key: "booking_integration", label: "Booking интеграция (Playtomic)", plans: ["club", "pro"] },
  api_access: { key: "api_access", label: "Публичный API + webhooks", plans: ["pro"] },
  white_label: { key: "white_label", label: "White label (свой бренд)", plans: ["pro"] },
  advanced_analytics: { key: "advanced_analytics", label: "Расширенная аналитика", plans: ["pro"] },
}

/** Тарифы (§55) */
export const PLANS: Record<PlanTier, PlanDefinition> = {
  starter: {
    tier: "starter",
    name: "STARTER",
    priceMonthly: 0,
    priceYearly: 0,
    maxCourts: 2,
    maxPlayers: 50,
    features: Object.values(FEATURE_LIST).filter(f => f.plans.includes("starter")),
    limits: { videoRetentionDays: 0, storageGb: 0, apiCallsPerMonth: 1000 },
  },
  club: {
    tier: "club",
    name: "CLUB",
    priceMonthly: 49,
    priceYearly: 490,
    maxCourts: 10,
    maxPlayers: 500,
    features: Object.values(FEATURE_LIST).filter(f => f.plans.includes("club")),
    // Хранилище: матч 1.5ч@8Мбит/с ≈ 5.4ГБ; 10 кортов × ~1.3 записанных
    // матча/день × 30 дней ≈ 2 ТБ (plan 2026-09-02, пересчёт с реальных цифр)
    limits: { videoRetentionDays: 30, storageGb: 2000, apiCallsPerMonth: 50_000 },
  },
  pro: {
    tier: "pro",
    name: "PRO / TOURNAMENT",
    priceMonthly: 149,
    priceYearly: 1490,
    maxCourts: 50,
    maxPlayers: 5000,
    features: Object.values(FEATURE_LIST).filter(f => f.plans.includes("pro")),
    // 90 дней — только избранный контент (финалы/hyperlights); полные матчи
    // 30 дней как CLUB: 90d × 50 кортов = ~30 ТБ — неэкономично (§148)
    limits: { videoRetentionDays: 30, storageGb: 5000, apiCallsPerMonth: 500_000 },
  },
}

/**
 * Проверяет: доступна ли фича на текущем тарифе (§94).
 */
export function hasPlanFeature(tier: PlanTier, featureKey: string): boolean {
  const feature = FEATURE_LIST[featureKey]
  if (!feature) return false
  return feature.plans.includes(tier)
}

/**
 * Возвращает тариф клуба из metadata (v1) или дефолт.
 */
export function getClubPlan(clubMetadata: Record<string, unknown> | null): PlanDefinition {
  const tier = (clubMetadata?.plan as PlanTier) ?? "starter"
  return PLANS[tier] ?? PLANS.starter
}

/**
 * Проверяет лимит кортов для тарифа.
 */
export function canAddCourt(tier: PlanTier, currentCourts: number): boolean {
  return currentCourts < PLANS[tier].maxCourts
}
