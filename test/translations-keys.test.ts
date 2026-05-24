import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { translations } from "../lib/translations"

// Guards against the class of bug where a component calls t("some.key") with a
// key that does not exist in translations.ts (wrong namespace, typo, removed
// key). Such misses are invisible to the type-checker — t() takes a plain
// string — and only surface as a runtime "Translation key not found" warning.

/** Recursively collects .ts / .tsx source files under the given roots. */
function sourceFiles(roots: string[]): string[] {
  const out: string[] = []
  for (const root of roots) {
    let entries: string[]
    try {
      entries = readdirSync(root, { recursive: true }) as string[]
    } catch {
      continue
    }
    for (const e of entries) {
      if (/\.(ts|tsx)$/.test(e) && !/\.d\.ts$/.test(e)) out.push(join(root, e))
    }
  }
  return out
}

/** Extracts literal keys from t("..."), t('...'), t(`...`) calls. */
function extractKeys(src: string): string[] {
  const keys: string[] = []
  const re = /\bt\(\s*(["'`])([^"'`]+)\1/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const key = m[2]
    if (key.includes("${")) continue // dynamic — cannot be checked statically
    if (!/^[\w.]+$/.test(key)) continue // not a dotted translation key
    keys.push(key)
  }
  return keys
}

/** True when a dotted key resolves to a defined value in a language object. */
function resolves(langObj: unknown, key: string): boolean {
  let node: any = langObj
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object" || !(part in node)) return false
    node = node[part]
  }
  return node !== undefined
}

// Pre-existing missing keys, baselined 2026-05-17. The test gates against NEW
// misses; these are tracked tech debt. Burn this list down — never extend it.
// When a key is fixed in translations.ts, remove it here (a stale entry fails
// the "no stale entries" test).
const KNOWN_MISSING = new Set<string>([
  // wrong namespace / typo — cheap to fix in the calling component
  "common.appName",
  "common.copying",
  "newMatch.servingPlayer",
  "newMatch.servingSide",
  "newMatch.servingTeam",
  "players.errorUpdatingPlayer",
  // The 30 vmixSettings.* keys were added to translations.ts in Этап D.
])

describe("translations: every t() key used in the UI exists", () => {
  const files = sourceFiles(["components", "app", "contexts"])
  const used = new Map<string, string>() // key -> first file that uses it
  for (const file of files) {
    for (const key of extractKeys(readFileSync(file, "utf8"))) {
      if (!used.has(key)) used.set(key, file)
    }
  }

  it("scans a non-trivial number of translation keys", () => {
    expect(used.size).toBeGreaterThan(20)
  })

  it("resolves every used key in the base language (ru)", () => {
    const ru = (translations as any).ru
    const missing = [...used.keys()].filter((key) => !resolves(ru, key))
    const unexpected = missing
      .filter((key) => !KNOWN_MISSING.has(key))
      .map((key) => `  ${key}  →  ${used.get(key)}`)
    expect(
      unexpected,
      `\nNew missing translation key(s) — add them to translations.ts (or, ` +
        `if intentional and temporary, to KNOWN_MISSING):\n${unexpected.join("\n")}\n`,
    ).toEqual([])
  })

  it("has no stale entries in the known-missing baseline", () => {
    const ru = (translations as any).ru
    // When a baseline key is fixed it must be dropped from KNOWN_MISSING, so
    // the gate keeps tightening and the list cannot rot.
    const stale = [...KNOWN_MISSING].filter((key) => resolves(ru, key))
    expect(
      stale,
      `\nThese keys now resolve — remove them from KNOWN_MISSING:\n  ${stale.join("\n  ")}\n`,
    ).toEqual([])
  })
})
