// Single source of truth for converting a match between the in-app camelCase
// shape and the Supabase `matches` row (snake_case).
//
// This conversion used to be copy-pasted in four places (match-storage,
// match-sync, server-match-storage, the match API route) — and the row→match
// copies had quietly diverged: server-match-storage dropped `code` and
// `revision`. Both directions now live here so they can never drift again.

/**
 * In-app match snapshot → Supabase `matches` row (snake_case).
 * `code` is intentionally omitted — there is no `code` column in the table.
 */
export function matchToRow(match: any): Record<string, any> {
  return {
    id: match.id,
    type: match.type,
    format: match.format,
    created_at: match.createdAt,
    settings: match.settings,
    team_a: match.teamA,
    team_b: match.teamB,
    score: match.score,
    current_server: match.currentServer,
    court_sides: match.courtSides,
    should_change_sides: match.shouldChangeSides,
    is_completed: match.isCompleted,
    winner: match.winner || null,
    court_number: match.courtNumber,
    created_via_court_link: match.created_via_court_link,
  }
}

/**
 * Supabase `matches` row → in-app match snapshot (camelCase).
 * Returns the full superset of fields (`code`, `revision`,
 * `created_via_court_link`) so every caller gets a complete object.
 */
export function matchFromRow(row: any): any {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    format: row.format,
    createdAt: row.created_at,
    settings: row.settings,
    teamA: row.team_a,
    teamB: row.team_b,
    score: row.score,
    currentServer: row.current_server,
    courtSides: row.court_sides,
    shouldChangeSides: row.should_change_sides,
    isCompleted: row.is_completed,
    winner: row.winner,
    courtNumber: row.court_number,
    created_via_court_link: row.created_via_court_link,
    revision: typeof row.revision === "number" ? row.revision : 0,
    history: [],
  }
}
