// Avatar display helpers — mirror of the APK's ShowAvatarOn option.
//
// A player avatar is a plain image URL (`player.avatar`). On the scoreboard it
// renders as a small round photo in its own column before the country column.

/**
 * APK `hideAvatarForSameImage`: when every player on both sides uses the exact
 * same avatar image, the photos carry no information — hide them. Any player
 * without an avatar disables the rule (we keep showing the others).
 */
export function isSameAvatarAllPlayers(match: any): boolean {
  const avatars: string[] = []
  for (const team of ["teamA", "teamB"]) {
    const players: any[] = match?.[team]?.players ?? []
    for (const p of players) {
      const a = (p?.avatar ?? "").trim()
      if (!a) return false
      avatars.push(a)
    }
  }
  return avatars.length > 0 && new Set(avatars).size === 1
}
