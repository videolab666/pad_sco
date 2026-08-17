import { describe, it, expect } from "vitest"
import { splitSide, splitPlayerEntry } from "../lib/dy/dy-normalize"

// Fixtures mirror the real rankedin feeds (tournament 66927):
// players: one entry per pair — name "A/B", pair id in `id`,
// individual ids in `ids`; matches: side id already "id1/id2".

describe("splitPlayerEntry", () => {
  it("splits a doubles pair into two players with individual dyIds", () => {
    expect(
      splitPlayerEntry({
        id: 1468735,
        name: "Fedor Modnikov/Volodymyr Yelizarov",
        country: "UKR",
        ids: "1200619/1524778",
      }),
    ).toEqual([
      { name: "Fedor Modnikov", dyId: "1200619", country: "UKR" },
      { name: "Volodymyr Yelizarov", dyId: "1524778", country: "UKR" },
    ])
  })

  it("keeps a singles entry as one player with its own id", () => {
    expect(splitPlayerEntry({ id: 42, name: "John O'Brien" })).toEqual([
      { name: "John O'Brien", dyId: "42" },
    ])
  })

  it("attaches no dyId to a pair when the feed gives only the pair id", () => {
    // Sharing the pair id would make the dyId dedup collapse both
    // partners into one local player.
    expect(splitPlayerEntry({ id: 77, name: "Player One/Player Two" })).toEqual([
      { name: "Player One", dyId: undefined },
      { name: "Player Two", dyId: undefined },
    ])
  })

  it("trims spaces around the slash", () => {
    expect(splitPlayerEntry({ id: 1, name: "Андрій Богатирьов / Іван Петренко", ids: "1 / 2" })).toEqual([
      { name: "Андрій Богатирьов", dyId: "1" },
      { name: "Іван Петренко", dyId: "2" },
    ])
  })

  it("returns nothing for an empty name", () => {
    expect(splitPlayerEntry({ id: 5, name: "" })).toEqual([])
  })
})

describe("splitSide", () => {
  it("splits a doubles side with per-player ids", () => {
    expect(splitSide({ name: "Stas Arkhypov/Sergiy Stakhovsky", id: "81336/2415136" })).toEqual([
      { name: "Stas Arkhypov", dyId: "81336" },
      { name: "Sergiy Stakhovsky", dyId: "2415136" },
    ])
  })

  it("keeps a singles side intact", () => {
    expect(splitSide({ name: "Ivan Ivanov", id: 9 })).toEqual([
      { name: "Ivan Ivanov", dyId: "9" },
    ])
  })

  it("does not share one side id between both partners", () => {
    const res = splitSide({ name: "A/B", id: 5 })
    expect(res[0].dyId).not.toBe(res[1].dyId) // shared id would collapse the pair
    expect(res[1].dyId).toBe("")
  })
})
