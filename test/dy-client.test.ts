import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getTournamentPlayers } from "../lib/dy/dy-client"
import type { DyTournament } from "../lib/dy/dy-types"

// Real-shape rankedin players feed (tournament 66927): pairs come as one
// entry; individual ids live in the `ids` field.
const feed = {
  "Open 1000 Men": [
    { id: 1468735, name: "Fedor Modnikov/Volodymyr Yelizarov", country: "UKR", ids: "1200619/1524778" },
    { id: 1464958, name: "Vladislav Horodynskyi/Oleg Dolgosheyev", country: "UKR", ids: "1471770/1396995" },
  ],
  "Open 1000 Women": [],
  config: { __RANKEDIN_GUID__: "66927" },
}

const tournament = (over?: Partial<DyTournament>): DyTournament => ({
  Name: "REJO 1000",
  FeedMatches: "rankedin/padel/tournament/66927/matches",
  FeedPlayers: "rankedin/padel/tournament/66927/players",
  ...over,
})

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => feed })))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getTournamentPlayers", () => {
  it("splits every pair into individual players", async () => {
    const resp = await getTournamentPlayers(tournament())
    expect(resp["Open 1000 Men"]).toEqual([
      { name: "Fedor Modnikov", dyId: "1200619" },
      { name: "Volodymyr Yelizarov", dyId: "1524778" },
      { name: "Vladislav Horodynskyi", dyId: "1471770" },
      { name: "Oleg Dolgosheyev", dyId: "1396995" },
    ])
  })

  it("keeps empty categories and drops non-array (config) keys", async () => {
    const resp = await getTournamentPlayers(tournament())
    expect(resp["Open 1000 Women"]).toEqual([])
    expect(Object.keys(resp)).not.toContain("config")
  })

  it("returns {} when the tournament has no players feed", async () => {
    const resp = await getTournamentPlayers(tournament({ FeedPlayers: undefined }))
    expect(resp).toEqual({})
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})
