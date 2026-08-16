import { describe, it, expect } from "vitest"
import { hasCyrillic, transliterate } from "../lib/dy/translit"

// Scheme notes: Russian names use the RU passport table (г→g, и→i);
// names containing Ukrainian-only letters (і, ї, є, ґ) use the UA table
// (г→h, и→y). Ambiguous names default to the RU/international spelling.

describe("hasCyrillic", () => {
  it("detects Cyrillic letters", () => {
    expect(hasCyrillic("Гончаренко")).toBe(true)
    expect(hasCyrillic("Ігор")).toBe(true)
    expect(hasCyrillic("John O'Brien")).toBe(false)
    expect(hasCyrillic("Müller")).toBe(false)
    expect(hasCyrillic("")).toBe(false)
  })
})

describe("transliterate — Russian", () => {
  it("transliterates full names", () => {
    expect(transliterate("Гончаренко Игорь")).toBe("Goncharenko Igor")
    expect(transliterate("Шевченко Жанна")).toBe("Shevchenko Zhanna")
    expect(transliterate("Хаджиев Ринат")).toBe("Khadzhiev Rinat")
    expect(transliterate("Ольга Мельник")).toBe("Olga Melnik")
  })

  it("handles digraph capitals and rare letters", () => {
    expect(transliterate("Емельянов Щербаков")).toBe("Emelianov Shcherbakov")
    expect(transliterate("Эдуард Ёлкин")).toBe("Eduard Elkin")
    expect(transliterate("Крыжова")).toBe("Kryzhova")
  })

  it("keeps ALL-CAPS names fully uppercase", () => {
    expect(transliterate("ШУРОВА")).toBe("SHUROVA")
    expect(transliterate("ЩУКИН")).toBe("SHCHUKIN")
  })
})

describe("transliterate — Ukrainian", () => {
  it("uses the UA table when Ukrainian-only letters are present", () => {
    expect(transliterate("Дмитрішин")).toBe("Dmytrishyn")
    expect(transliterate("Гнатюк Ігор")).toBe("Hnatiuk Ihor")
    expect(transliterate("Євген Кравець")).toBe("Ievhen Kravets")
    expect(transliterate("Марія")).toBe("Mariia")
  })

  it("drops apostrophes between Cyrillic letters", () => {
    expect(transliterate("Дем'ян")).toBe("Demian")
  })

  it("defaults ambiguous names to the international spelling", () => {
    // No і/ї/є/ґ markers — treated as Russian (г→g), the dominant
    // international spelling for both languages.
    expect(transliterate("Гончарук Богдан")).toBe("Goncharuk Bogdan")
  })
})

describe("transliterate — passthrough", () => {
  it("leaves non-Cyrillic text unchanged", () => {
    expect(transliterate("John O'Brien")).toBe("John O'Brien")
    expect(transliterate("Fernando Alonso 3")).toBe("Fernando Alonso 3")
  })

  it("transliterates only the Cyrillic part of mixed names", () => {
    expect(transliterate("Иван Smirnoff")).toBe("Ivan Smirnoff")
  })

  it("trims and collapses whitespace", () => {
    expect(transliterate("  Гончаренко   Игорь ")).toBe("Goncharenko Igor")
    expect(transliterate("   ")).toBe("")
  })
})
