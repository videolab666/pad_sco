// Client-side helpers: call /api/dy/* and normalize the response.

import { DY_SEQUENCE_KEY } from "./dy-config"
import type { DyFeedType, DyTournament, DyMatchesResponse, DyPlayersResponse } from "./dy-types"

const proxy = (urlOrPath: string) => `/api/dy?url=${encodeURIComponent(urlOrPath)}`

async function getJson<T>(urlOrPath: string): Promise<T> {
  const r = await fetch(proxy(urlOrPath))
  if (!r.ok) throw new Error(`dy fetch ${r.status}`)
  return r.json() as Promise<T>
}

/** Step 1: list of platforms (feed types) in Sequence-TennisPadel order. */
export async function getPlatforms(): Promise<DyFeedType[]> {
  const root = await getJson<Record<string, any>>("/feed/feeds.php")
  const meta = root.FeedMetaData ?? {}
  const seq: string[] = meta[DY_SEQUENCE_KEY] ?? meta["Sequence"] ?? []
  const lang = "en" // DisplayName-<lang>; "en" is the safe default
  return seq
    .filter((k) => k !== "FeedMetaData" && !k.startsWith("-"))
    .map((key) => {
      const d = meta[key] ?? {}
      return {
        key,
        displayName: d[`DisplayName-${lang}`] ?? d.DisplayName ?? key,
        shortDescription: d.ShortDescription,
        imageBase64: d.Image,
        imageUrl: d.ImageURL,
        bgColor: d.BGColor ?? "#FFFFFF",
        textColor: d.TextColor ?? "#000000",
        subFeedUrl: typeof root[`${key}.URL`] === "string" ? root[`${key}.URL`] : undefined,
        embedded: Array.isArray(root[key]) ? (root[key] as DyTournament[]) : undefined,
        isLeague: /league/i.test(key),
      } as DyFeedType
    })
    // keep only platforms that actually have tournaments to show
    .filter((p) => p.subFeedUrl || p.embedded)
}

/** Step 2: tournaments of the selected platform. */
export async function getTournaments(platform: DyFeedType): Promise<DyTournament[]> {
  if (platform.subFeedUrl) return getJson<DyTournament[]>(platform.subFeedUrl)
  return platform.embedded ?? []
}

/** Step 3: matches and players of a specific tournament. */
export const getMatches = (t: DyTournament) => getJson<DyMatchesResponse>(t.FeedMatches)

export const getTournamentPlayers = (t: DyTournament): Promise<DyPlayersResponse> =>
  t.FeedPlayers ? getJson<DyPlayersResponse>(t.FeedPlayers) : Promise.resolve({})
