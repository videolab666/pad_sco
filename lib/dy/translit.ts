// Cyrillic → Latin transliteration for names imported from feeds.
// Covers Russian and Ukrainian and follows the common passport standards
// (RU MID 2013 / UA KMU 2010), so imported names read naturally on an
// international scoreboard.

/** True when the string contains at least one Cyrillic letter. */
export function hasCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text)
}

// Base table — Ukrainian spelling (the larger alphabet).
const BASE: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie",
  ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "",
  ы: "y", ь: "", э: "e", ю: "iu", я: "ia", ё: "e",
}

// Russian spelling for the two letters the standards disagree on.
const RU_OVERRIDE: Record<string, string> = { г: "g", и: "i" }

// Ukrainian-only letters. A name containing any of them is transliterated
// with the Ukrainian table; otherwise the Russian one is used. Ambiguous
// names (no marker letters) get г→g / и→i — the dominant spelling in
// international sports listings for both languages.
const UK_ONLY = /[іїєґІЇЄҐ]/

/**
 * Transliterates a Cyrillic (Russian or Ukrainian) name to Latin.
 * Non-Cyrillic characters pass through unchanged; digraph capitals follow
 * the input casing ("Ж"→"Zh", "ЖУРОВА"→"ZHUROVA"). Soft/hard signs are
 * dropped, as are apostrophes between Cyrillic letters ("Дем'ян"→"Demian").
 */
export function transliterate(text: string): string {
  const cleaned = text.replace(/(?<=[\u0400-\u04FF])['’`](?=[\u0400-\u04FF])/g, "")
  const table = UK_ONLY.test(cleaned) ? BASE : { ...BASE, ...RU_OVERRIDE }
  const allCaps = cleaned.length > 0 && cleaned === cleaned.toUpperCase()
  let out = ""
  for (const ch of cleaned) {
    const mapped = table[ch.toLowerCase()]
    if (mapped === undefined) {
      out += ch // Latin, digits, punctuation — as is
      continue
    }
    if (!mapped) continue // ь / ъ — dropped
    if (ch === ch.toLowerCase()) out += mapped
    else out += allCaps ? mapped.toUpperCase() : mapped[0].toUpperCase() + mapped.slice(1)
  }
  return out.replace(/\s{2,}/g, " ").trim()
}
