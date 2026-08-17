// Player name formatting — mirrors the APK's NamePart option plus the web-only
// two-line layout / per-part typography settings.
//
// Names are plain display strings ("Anna Petrova"), so the parts are split on
// whitespace: first = leading word(s), last = final word.

export type PlayerNameFormat = "full" | "first" | "last"
export type PlayerNameCase = "as-is" | "upper" | "lower" | "capitalize"

/** Format a display name according to the selected part. */
export function formatPlayerName(name: string | null | undefined, mode: PlayerNameFormat): string {
  const trimmed = (name ?? "").trim()
  if (!trimmed || mode === "full") return trimmed
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]
  return mode === "first" ? parts[0] : parts[parts.length - 1]
}

/** Split a display name into { first, last }; a single word lands in `first`. */
export function splitNameParts(name: string | null | undefined): { first: string; last: string } {
  const trimmed = (name ?? "").trim()
  if (!trimmed) return { first: "", last: "" }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: "" }
  return { first: parts[0], last: parts[parts.length - 1] }
}

/** Apply the case mode: UPPERCASE / lowercase / Capitalized / as-is. */
export function applyNameCase(text: string, mode: PlayerNameCase): string {
  if (!text) return ""
  switch (mode) {
    case "upper":
      return text.toUpperCase()
    case "lower":
      return text.toLowerCase()
    case "capitalize":
      return text
        .split(/\s+/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(" ")
    case "as-is":
    default:
      return text
  }
}
