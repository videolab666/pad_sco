// Чистые хелперы court-registry (plan-4 §246): short_code, slug, валидация,
// immutable short_code. Без БД — серверные функции покрыты e2e/smoke.

import { describe, expect, it } from "vitest"
import {
  SHORT_CODE_ALPHABET,
  buildCourtPatch,
  generateShortCode,
  isValidSlug,
  slugifyCourtName,
  validateCourtInput,
} from "../lib/court-registry"

describe("short_code (§246)", () => {
  it("алфавит не содержит визуально двусмысленных символов", () => {
    for (const ch of ["0", "O", "o", "1", "l", "I"]) {
      expect(SHORT_CODE_ALPHABET).not.toContain(ch)
    }
    expect(SHORT_CODE_ALPHABET.length).toBeGreaterThanOrEqual(50)
    // каждый символ уникален
    expect(new Set(SHORT_CODE_ALPHABET).size).toBe(SHORT_CODE_ALPHABET.length)
  })

  it("генерирует код нужной длины из алфавита", () => {
    const code = generateShortCode()
    expect(code).toHaveLength(7)
    for (const ch of code) expect(SHORT_CODE_ALPHABET).toContain(ch)
  })

  it("детерминирован при инжектированном rng", () => {
    const fakeRandom = () => 0
    expect(generateShortCode(4, fakeRandom)).toBe(SHORT_CODE_ALPHABET[0].repeat(4))
  })

  it("на большой выборке коды практически не повторяются", () => {
    const seen = new Set(Array.from({ length: 5000 }, () => generateShortCode()))
    // при 56^7 ≈ 1.7e12 комбинаций коллизий ожидаем ≤ единиц
    expect(seen.size).toBeGreaterThan(4990)
  })
})

describe("slug (§246)", () => {
  it("валидирует допустимые slug", () => {
    expect(isValidSlug("1")).toBe(true)
    expect(isValidSlug("central")).toBe(true)
    expect(isValidSlug("court-7-a")).toBe(true)
  })

  it("отклоняет недопустимые slug", () => {
    expect(isValidSlug("")).toBe(false)
    expect(isValidSlug("Court")).toBe(false) // только строчные
    expect(isValidSlug("-court")).toBe(false)
    expect(isValidSlug("court-")).toBe(false)
    expect(isValidSlug("ко")).toBe(false) // кириллица
    expect(isValidSlug("a".repeat(65))).toBe(false)
    expect(isValidSlug("court_7")).toBe(false)
  })

  it("slugify: латиница, пробелы и регистр", () => {
    expect(slugifyCourtName("Central Court")).toBe("central-court")
    expect(slugifyCourtName("  Court   A  ")).toBe("court-a")
    expect(slugifyCourtName("Backyard / #2!")).toBe("backyard-2")
  })

  it("slugify: кириллица транслитерируется", () => {
    expect(slugifyCourtName("Центральний")).toBe("tsentralnii") // паспортный стандарт: «ий» → «ii»
    expect(slugifyCourtName("Корт 3")).toBe("kort-3")
  })

  it("slugify: null для имени без пригодных символов", () => {
    expect(slugifyCourtName("!!!")).toBeNull()
    expect(slugifyCourtName("")).toBeNull()
  })
})

describe("validateCourtInput", () => {
  it("требует непустое имя", () => {
    expect(validateCourtInput({ name: "  " })).toContainEqual(expect.stringContaining("Название"))
    expect(validateCourtInput({ name: "Центральный" })).toEqual([])
  })

  it("отклоняет слишком длинное имя", () => {
    expect(validateCourtInput({ name: "к".repeat(101) }).length).toBeGreaterThan(0)
  })

  it("проверяет slug, когда задан", () => {
    expect(validateCourtInput({ name: "A", slug: "Nice-Slug" }).length).toBeGreaterThan(0)
    expect(validateCourtInput({ name: "A", slug: "nice-slug" })).toEqual([])
  })
})

describe("buildCourtPatch: immutable short_code (§246/§247)", () => {
  it("запрещает изменение short_code в любой нотации", () => {
    expect(() => buildCourtPatch({ short_code: "Ab3xK9x" })).toThrow(/short_code неизменяем/)
    expect(() => buildCourtPatch({ shortCode: "Ab3xK9x" })).toThrow(/short_code неизменяем/)
  })

  it("нормализует допустимые поля", () => {
    expect(buildCourtPatch({ name: "  Центр  " })).toEqual({ name: "Центр" })
    expect(buildCourtPatch({ slug: "center", sort_order: 3 })).toEqual({ slug: "center", sortOrder: 3 })
    expect(buildCourtPatch({ status: "maintenance" })).toEqual({ status: "maintenance" })
  })

  it("отклоняет пустое имя, плохой slug и плохой статус", () => {
    expect(() => buildCourtPatch({ name: "" })).toThrow(/пустым/)
    expect(() => buildCourtPatch({ slug: "Bad_Slug" })).toThrow(/Slug/)
    expect(() => buildCourtPatch({ status: "closed" })).toThrow(/статус/)
  })

  it("пустой patch — пустой результат", () => {
    expect(buildCourtPatch({})).toEqual({})
  })
})
