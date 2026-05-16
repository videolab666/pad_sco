// Normalization: dates, grouping by country, parsing doubles pairs (slash).

import { DY_FILTER } from "./dy-config"
import type { DyTournament } from "./dy-types"

/** Support both date formats: 2026-05-18 and 20260518. */
export function parseDyDate(s?: string): Date | null {
  if (!s) return null
  const m1 = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  const m2 = /^(\d{4})(\d{2})(\d{2})$/.exec(s)
  const m = m1 ?? m2
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return d.getFullYear() < 2000 ? null : d // "0001-01-01" -> null
}

const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000)

/** Filter "active tournaments" — same logic as ShowFeedsAdapter in Android. */
export function filterActiveTournaments(list: DyTournament[], isLeague: boolean): DyTournament[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return list.filter((t) => {
    const from = parseDyDate(t.ValidFrom)
    const to = parseDyDate(t.ValidTo) ?? from
    if (!from && !to) return true // no dates — show it
    const dTo = to ? dayDiff(to, today) : 0
    const dFrom = from ? dayDiff(from, today) : 0
    if (dTo < -DY_FILTER.wasBusyDaysBack) return false // ended long ago
    if (dFrom > DY_FILTER.willStartDaysAhead) return false // too far in the future
    if (!isLeague && from && to && dayDiff(to, from) > DY_FILTER.maxDurationDays) return false
    return true
  })
}

/** Is the tournament running right now (for the "running" badge). */
export function isRunningNow(t: DyTournament): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const from = parseDyDate(t.ValidFrom)
  const to = parseDyDate(t.ValidTo) ?? from
  return !!from && !!to && from <= today && today <= to
}

/** Group tournaments by country / section. */
export function groupByCountry(list: DyTournament[]): Record<string, DyTournament[]> {
  const groups: Record<string, DyTournament[]> = {}
  for (const t of list) {
    const key = t.Section || t.Country || "—"
    ;(groups[key] ??= []).push(t)
  }
  // running tournaments float to the top
  for (const k of Object.keys(groups))
    groups[k].sort((a, b) => Number(isRunningNow(b)) - Number(isRunningNow(a)))
  return groups
}

/** Match categories (top-level keys except the service "config"). */
export const matchCategories = (resp: Record<string, unknown>) =>
  Object.keys(resp).filter((k) => k !== "config" && Array.isArray(resp[k]))

/** Split a match side into players, accounting for doubles (slash-separated). */
export function splitSide(side: { name: string; id: number | string }) {
  const names = String(side.name)
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
  const ids = String(side.id)
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
  return names.map((name, i) => ({ name, dyId: ids[i] ?? ids[0] ?? "" }))
}

/** Format a tournament date range for display ("" if no real dates). */
export function formatDateRange(t: DyTournament): string {
  const fmt = (d: Date | null) =>
    d
      ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
      : ""
  const from = fmt(parseDyDate(t.ValidFrom))
  const to = fmt(parseDyDate(t.ValidTo))
  if (from && to && from !== to) return `${from} – ${to}`
  return from || to || ""
}
