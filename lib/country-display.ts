// Country display helpers — mirror of the APK's ShowCountryAs option.
//
// The APK renders the ISO 3166-1 flag for a player's country and offers
// flag / code / name display. On the web we use emoji flags (regional
// indicator symbols): zero assets, works in every modern browser.

import { COUNTRIES, countryByCode } from "./countries"

export type CountryDisplayMode = "flag" | "code" | "name"

/** "ua" | "UA" → 🇺🇦. Returns "" for input that is not a 2-letter code. */
export function countryToFlag(iso2: string | null | undefined): string {
  if (!iso2 || iso2.length !== 2 || !/^[a-zA-Z]{2}$/.test(iso2)) return ""
  return iso2
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65))
}

// Both lookup maps derive from the single ISO source (lib/countries.ts).
export const COUNTRY_NAMES_RU: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.iso2, c.ru]),
)

export const ISO3_TO_ISO2: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.iso3, c.iso2]),
)

/** Normalise a feed country code to ISO2 ("UKR"/"ua" → "UA"); "" when unknown shape. */
export function toIso2(code: string | null | undefined): string {
  const c = countryByCode(code ?? "")
  return c ? c.iso2 : ""
}

/** Russian country name for a country code; the code itself when unknown. */
export function getCountryName(code: string | null | undefined): string {
  if (!code) return ""
  const iso2 = toIso2(code)
  if (iso2) return COUNTRY_NAMES_RU[iso2] ?? iso2
  return code.trim().toUpperCase()
}

/**
 * Render text for a player's country according to the display mode.
 * Same as the APK: empty input always renders as "" (the scoreboard turns
 * that into a blank cell). Feed codes may be ISO2 or ISO3 — normalised here.
 */
export function formatCountry(
  code: string | null | undefined,
  mode: CountryDisplayMode,
): string {
  if (!code) return ""
  const iso2 = toIso2(code)
  switch (mode) {
    case "flag":
      return (iso2 && countryToFlag(iso2)) || code.trim().toUpperCase()
    case "name":
      return getCountryName(code)
    case "code":
    default:
      return (iso2 || code).trim().toUpperCase()
  }
}

/**
 * APK `hideFlagForSameCountry`: when every player on both sides has the same
 * (non-empty) country, the flags carry no information — hide them.
 */
export function isSameCountryAllPlayers(match: any): boolean {
  const countries: string[] = []
  for (const team of ["teamA", "teamB"]) {
    const players: any[] = match?.[team]?.players ?? []
    for (const p of players) {
      const c = toIso2(p?.country) || (p?.country ?? "").trim().toUpperCase()
      if (!c) return false // unknown country → keep showing what we know
      countries.push(c)
    }
  }
  return countries.length > 0 && new Set(countries).size === 1
}
