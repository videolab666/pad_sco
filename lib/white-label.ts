// White Label (plan-4 §56) — брендинг клуба.
//
// Priority: Platform Default → Organization → Club → Event/Tournament → Match.
// (§106: Tournament может временно override Club Brand)
//
// Чистые функции — покрыты тестами.

export interface BrandProfile {
  clubName: string
  logoUrl?: string
  secondaryLogoUrl?: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  bgColor: string
  textColor: string
  fontUrl?: string
  courtNaming: "numbered" | "named" | "custom"
  scorebugTheme?: string
  emailTheme?: string
  domain?: string // custom domain для white label
}

/** Дефолтный бренд платформы */
export const DEFAULT_BRAND: BrandProfile = {
  clubName: "Padel Club",
  primaryColor: "#0369a1",
  secondaryColor: "#0284c7",
  accentColor: "#A4FB23",
  bgColor: "#0A0F0A",
  textColor: "#FFFFFF",
  courtNaming: "numbered",
}

/**
 * Резолвит бренд с учётом приоритетов (§106).
 * Club может override дефолт, Tournament может override Club.
 */
export function resolveBrand(
  clubBrand: Partial<BrandProfile> | null,
  eventOverride: Partial<BrandProfile> | null = null,
): BrandProfile {
  return {
    ...DEFAULT_BRAND,
    ...(clubBrand ?? {}),
    ...(eventOverride ?? {}),
  }
}

/**
 * Генерирует CSS custom properties из BrandProfile.
 * Используется в layout для динамического брендинга.
 */
export function brandToCssVars(brand: BrandProfile): Record<string, string> {
  return {
    "--brand-primary": brand.primaryColor,
    "--brand-secondary": brand.secondaryColor,
    "--brand-accent": brand.accentColor,
    "--brand-bg": brand.bgColor,
    "--brand-text": brand.textColor,
    "--brand-name": `"${brand.clubName}"`,
  }
}

/**
 * Проверяет: есть ли у клуба custom domain (§56: white label only).
 */
export function hasCustomDomain(brand: BrandProfile, planTier: string): boolean {
  return planTier === "pro" && Boolean(brand.domain)
}

/**
 * Формат имени корта по типу naming (§56).
 */
export function formatCourtName(
  court: { name: string; number: number | null },
  naming: BrandProfile["courtNaming"],
): string {
  switch (naming) {
    case "named":
      return court.name
    case "custom":
      return court.name
    case "numbered":
    default:
      return court.number !== null ? `Корт ${court.number}` : court.name
  }
}
