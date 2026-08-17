// Court registry — Шаг 1 (plan-4 §246/§247).
//
// Court перестаёт быть числом 1..10 и становится сущностью: свободное имя,
// редактируемый slug (алиас) и immutable short_code для вечной ссылки
// /c/{short_code} (QR на корте). Серверный модуль: работает только через
// service-role клиент; публичный доступ — через /api/v1/courts/{code}.
//
// Чистые хелперы (генерация кода, slug, валидация) вынесены без I/O и
// покрыты тестами (test/court-registry.test.ts).

import { createServerSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"
import { transliterate } from "./dy/translit"

export type CourtStatus = "active" | "archived" | "maintenance"

export interface CourtRecord {
  id: string
  clubId: string
  name: string
  slug: string
  shortCode: string
  legacyNumber: number | null
  sortOrder: number
  status: CourtStatus
  createdAt: string
  updatedAt: string
}

// ─── Чистые хелперы ──────────────────────────────────────────────────────────

/**
 * Base62 без визуально двусмысленных символов (0/O, 1/l/I, o).
 * 56 символов → 7 позиций ≈ 1.7e12 комбинаций; для одного клуба хватает
 * с огромным запасом, а глобальная уникальность проверяется в БД.
 */
export const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"

export const SHORT_CODE_LENGTH = 7

export function generateShortCode(
  length: number = SHORT_CODE_LENGTH,
  random: () => number = Math.random,
): string {
  let code = ""
  for (let i = 0; i < length; i++) {
    code += SHORT_CODE_ALPHABET[Math.floor(random() * SHORT_CODE_ALPHABET.length)]
  }
  return code
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 64 && SLUG_RE.test(slug)
}

/** Человекочитаемый slug из свободного имени: транслит кириллицы, [a-z0-9-]. */
export function slugifyCourtName(name: string): string | null {
  const base = /[\u0400-\u04FF]/.test(name) ? transliterate(name) : name
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "")
  return slug.length > 0 ? slug : null
}

export function validateCourtInput(input: { name?: unknown; slug?: unknown }): string[] {
  const errors: string[] = []
  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (!name) errors.push("Название корта обязательно")
  if (name.length > 100) errors.push("Название корта слишком длинное (макс. 100)")
  const slug = typeof input.slug === "string" ? input.slug.trim() : ""
  if (slug && !isValidSlug(slug)) {
    errors.push("Slug может содержать только строчные латинские буквы, цифры и дефисы")
  }
  return errors
}

export interface CourtPatch {
  name?: string
  slug?: string
  sortOrder?: number
  status?: CourtStatus
}

/**
 * Нормализует patch корта. Бросает Error при попытке изменить short_code
 * (immutable — QR на корте вечный) и при невалидных значениях.
 */
export function buildCourtPatch(patch: Record<string, unknown>): CourtPatch {
  if ("short_code" in patch || ("shortCode" in patch && patch.shortCode !== undefined)) {
    throw new Error("short_code неизменяем — создайте новый корт или используйте существующую ссылку")
  }
  const out: CourtPatch = {}
  if (patch.name !== undefined) {
    const name = String(patch.name).trim()
    if (!name) throw new Error("Название корта не может быть пустым")
    if (name.length > 100) throw new Error("Название корта слишком длинное (макс. 100)")
    out.name = name
  }
  if (patch.slug !== undefined) {
    const slug = String(patch.slug).trim()
    if (!isValidSlug(slug)) {
      throw new Error("Slug может содержать только строчные латинские буквы, цифры и дефисы")
    }
    out.slug = slug
  }
  if (patch.sortOrder !== undefined || patch.sort_order !== undefined) {
    const raw = patch.sortOrder ?? patch.sort_order
    const n = Number(raw)
    if (!Number.isFinite(n)) throw new Error("sortOrder должен быть числом")
    out.sortOrder = Math.trunc(n)
  }
  if (patch.status !== undefined) {
    const status = String(patch.status) as CourtStatus
    if (!["active", "archived", "maintenance"].includes(status)) {
      throw new Error("Недопустимый статус корта")
    }
    out.status = status
  }
  return out
}

// ─── DDL / bootstrap ─────────────────────────────────────────────────────────

export const getCourtTablesSql = (): string => `
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);
CREATE TABLE IF NOT EXISTS courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  legacy_number INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, slug)
);
CREATE UNIQUE INDEX IF NOT EXISTS courts_club_legacy_number_idx
  ON courts (club_id, legacy_number) WHERE legacy_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS courts_short_code_idx ON courts (short_code);
CREATE TABLE IF NOT EXISTS court_slug_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id),
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS court_slug_history_court_idx ON court_slug_history (court_id);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_slug_history ENABLE ROW LEVEL SECURITY;
`

// Кэш на процесс: bootstrap выполняется один раз.
let schemaPromise: Promise<boolean> | null = null

async function courtsTableExists(): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from("courts").select("id").limit(1)
  return !error
}

async function runDdl(): Promise<void> {
  const supabase = createServerSupabaseClient()
  if (!supabase) throw new Error("Серверный Supabase клиент недоступен (env)")
  for (const statement of getCourtTablesSql()
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const { error } = await supabase.rpc("exec_sql", { sql_query: statement + ";" })
    if (error) {
      throw new Error(`exec_sql: ${error.message}`)
    }
  }
}

/** Идемпотентно: создаёт таблицы (если нет), default org/club и корты 1..10. */
export async function ensureCourtSchema(): Promise<boolean> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      try {
        // Таблицы обычно уже созданы миграцией (supabase/migrations);
        // self-DDL через exec_sql — запасной путь, если функции нет,
        // подскажем применить миграцию вручную.
        if (!(await courtsTableExists())) {
          await runDdl().catch((err) => {
            throw new Error(
              `${(err as Error).message} — примените миграцию вручную: ` +
                `supabase/migrations/20260817000000_add_orgs_clubs_courts.sql ` +
                `(напр. node scripts/apply-migration.mjs supabase/migrations/20260817000000_add_orgs_clubs_courts.sql)`,
            )
          })
          if (!(await courtsTableExists())) {
            throw new Error("Таблица courts не создалась — примените миграцию вручную")
          }
        }
        const clubId = await ensureDefaultClub()
        await seedLegacyCourts(clubId)
        return true
      } catch (err) {
        logEvent("error", `court-registry: bootstrap не выполнен: ${(err as Error).message}`, "ensureCourtSchema", err)
        // Сбрасываем кэш, чтобы следующая попытка повторилась.
        schemaPromise = null
        return false
      }
    })()
  }
  return schemaPromise
}

async function ensureDefaultClub(): Promise<string> {
  const supabase = createServerSupabaseClient()
  const existing = await supabase.from("clubs").select("id").limit(1)
  if (existing.data && existing.data.length > 0) return existing.data[0].id as string

  // Нет ни одного клуба → создаём default org + club.
  const org = await supabase
    .from("organizations")
    .insert({ name: "Default Organization", slug: "default" })
    .select("id")
    .single()
  if (org.error || !org.data) {
    // Возможно, org уже есть (гонка) — берём первый.
    const anyOrg = await supabase.from("organizations").select("id").limit(1)
    const orgId =
      anyOrg.data && anyOrg.data.length > 0
        ? (anyOrg.data[0].id as string)
        : (() => {
            throw new Error(`organizations: ${org.error?.message ?? "insert failed"}`)
          })()
    const club = await supabase
      .from("clubs")
      .insert({ organization_id: orgId, name: "Default Club", slug: "default" })
      .select("id")
      .single()
    if (club.error || !club.data) throw new Error(`clubs: ${club.error?.message ?? "insert failed"}`)
    return club.data.id as string
  }
  const club = await supabase
    .from("clubs")
    .insert({ organization_id: org.data.id, name: "Default Club", slug: "default" })
    .select("id")
    .single()
  if (club.error || !club.data) throw new Error(`clubs: ${club.error.message}`)
  return club.data.id as string
}

async function seedLegacyCourts(clubId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.from("courts").select("id").limit(1)
  if (error) throw new Error(`courts: ${error.message}`)
  if (data && data.length > 0) return

  const rows = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1
    return {
      club_id: clubId,
      name: String(n),
      slug: String(n),
      short_code: generateShortCode(),
      legacy_number: n,
      sort_order: n,
      status: "active",
    }
  })
  const insert = await supabase.from("courts").insert(rows)
  if (insert.error) throw new Error(`courts seed: ${insert.error.message}`)
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCourt(row: any): CourtRecord {
  return {
    id: row.id,
    clubId: row.club_id,
    name: row.name,
    slug: row.slug,
    shortCode: row.short_code,
    legacyNumber: row.legacy_number ?? null,
    sortOrder: row.sort_order ?? 0,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listCourts(includeArchived = false): Promise<CourtRecord[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("courts")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("legacy_number", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
  if (!includeArchived) query = query.neq("status", "archived")
  const { data, error } = await query
  if (error) throw new Error(`listCourts: ${error.message}`)
  return (data ?? []).map(rowToCourt)
}

export async function createCourt(input: { name: string; slug?: string; sortOrder?: number }): Promise<CourtRecord> {
  const errors = validateCourtInput(input)
  if (errors.length > 0) throw new CourtValidationError(errors)

  const supabase = createServerSupabaseClient()
  const clubId = await ensureDefaultClub()
  const name = input.name.trim()
  let slug = (input.slug ?? "").trim() || slugifyCourtName(name) || ""
  if (!slug) slug = `court-${generateShortCode(5).toLowerCase()}`

  // Коллизии slug внутри клуба — суффиксируем коротким кодом.
  const slugTaken = await supabase.from("courts").select("id").eq("club_id", clubId).eq("slug", slug).limit(1)
  if (slugTaken.data && slugTaken.data.length > 0) slug = `${slug}-${generateShortCode(4).toLowerCase()}`

  // short_code: глобально уникален, добираемся до свободного с retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = generateShortCode()
    const insert = await supabase
      .from("courts")
      .insert({
        club_id: clubId,
        name,
        slug,
        short_code: shortCode,
        sort_order: input.sortOrder ?? 100,
        status: "active",
      })
      .select("*")
      .single()
    if (!insert.error && insert.data) return rowToCourt(insert.data)
    if (insert.error && !/duplicate key|unique/i.test(insert.error.message)) {
      throw new Error(`createCourt: ${insert.error.message}`)
    }
    // коллизия short_code (или slug) — повторяем
  }
  throw new Error("createCourt: не удалось подобрать уникальный short_code")
}

export async function updateCourt(id: string, patch: Record<string, unknown>): Promise<CourtRecord> {
  let clean: CourtPatch
  try {
    clean = buildCourtPatch(patch)
  } catch (err) {
    throw new CourtValidationError([(err as Error).message])
  }

  const supabase = createServerSupabaseClient()
  const current = await supabase.from("courts").select("*").eq("id", id).single()
  if (current.error || !current.data) throw new CourtNotFoundError(id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {}
  if (clean.name !== undefined) row.name = clean.name
  if (clean.slug !== undefined && clean.slug !== current.data.slug) {
    row.slug = clean.slug
    // История slug — старые ссылки продолжают резолвиться (§246).
    await supabase.from("court_slug_history").insert({
      court_id: id,
      old_slug: current.data.slug,
      new_slug: clean.slug,
    })
  }
  if (clean.sortOrder !== undefined) row.sort_order = clean.sortOrder
  if (clean.status !== undefined) row.status = clean.status
  if (Object.keys(row).length === 0) return rowToCourt(current.data)

  const update = await supabase.from("courts").update(row).eq("id", id).select("*").single()
  if (update.error) {
    if (/duplicate key|unique/i.test(update.error.message)) {
      throw new CourtValidationError(["Такой slug уже занят в этом клубе"])
    }
    throw new Error(`updateCourt: ${update.error.message}`)
  }
  return rowToCourt(update.data)
}

export async function archiveCourt(id: string): Promise<CourtRecord> {
  return updateCourt(id, { status: "archived" })
}

/** Публичное разрешение вечной ссылки /c/{code}: только не-archived. */
export async function getCourtByShortCode(code: string): Promise<CourtRecord | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("courts")
    .select("*")
    .eq("short_code", code)
    .neq("status", "archived")
    .limit(1)
  if (error) throw new Error(`getCourtByShortCode: ${error.message}`)
  if (!data || data.length === 0) return null
  return rowToCourt(data[0])
}

/** Резолвит court и по историческим slug (court_slug_history). */
export async function getCourtBySlugHistory(slug: string): Promise<CourtRecord | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("court_slug_history")
    .select("court_id")
    .eq("old_slug", slug)
    .order("changed_at", { ascending: false })
    .limit(1)
  if (error || !data || data.length === 0) return null
  const court = await supabase
    .from("courts")
    .select("*")
    .eq("id", data[0].court_id)
    .neq("status", "archived")
    .limit(1)
  if (court.error || !court.data || court.data.length === 0) return null
  return rowToCourt(court.data[0])
}

export class CourtValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "))
    this.name = "CourtValidationError"
  }
}

export class CourtNotFoundError extends Error {
  constructor(id: string) {
    super(`Корт ${id} не найден`)
    this.name = "CourtNotFoundError"
  }
}
