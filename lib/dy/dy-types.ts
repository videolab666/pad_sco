// TypeScript types for the double-yellow.be public feeds.

/** Root response of /feed/feeds.php */
export interface DyFeedsRoot {
  FeedMetaData: DyFeedMetaData
  [typeKeyOrUrl: string]: unknown // "<type>" array | "<type>.URL" string
}

export interface DyFeedMetaData {
  [k: string]: unknown // Sequence-*, plus per-type description objects
}

/** Description of one feed type (platform) from FeedMetaData. */
export interface DyFeedType {
  key: string // e.g. "rankedin.tennis.tournament"
  displayName: string // localized DisplayName
  shortDescription?: string
  imageBase64?: string // FeedKeys.Image — PNG base64
  imageUrl?: string
  bgColor: string // "#FFFFFF"
  textColor: string // "#000000"
  subFeedUrl?: string // value of "<key>.URL"
  embedded?: DyTournament[] // inline array when no ".URL"
  isLeague: boolean // key contains "league"
}

/** A tournament inside a sub-feed inc/feeds.*.json */
export interface DyTournament {
  Name: string
  FeedMatches: string // relative path
  FeedPlayers?: string
  ValidFrom?: string // YYYY-MM-DD or YYYYMMDD
  ValidTo?: string
  Country?: string
  CountryCode?: string
  Region?: string
  Section?: string
  Organization?: string
}

/** A match in the /{provider}/{id}/matches response. */
export interface DyMatch {
  id: number | string
  date: string // "YYYY-MM-DD" | "0001-01-01" (not scheduled)
  time: string // "HH:MM" | "00:00"
  A: DySide
  B: DySide
  court?: string
  result?: string
  round?: string
  division?: string
}

export interface DySide {
  name: string
  id: number | string
}

/** A raw entry in the /{provider}/{id}/players response. */
export interface DyPlayer {
  id: number | string
  name: string
  /** Individual player ids when the entry is a doubles pair ("id1/id2"). */
  ids?: string
  country?: string
}

/** One individual player row after splitting doubles-pair feed entries. */
export interface DyPlayerRow {
  name: string
  dyId?: string
  country?: string
}

/** Categories -> items (plus a service "config" key). */
export type DyMatchesResponse = Record<string, DyMatch[] | DyConfig>
export type DyPlayersResponse = Record<string, DyPlayerRow[]>
export interface DyConfig {
  [k: string]: unknown
}
