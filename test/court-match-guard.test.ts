import { describe, expect, it } from "vitest"
import { isMatchOnCourt } from "../lib/court-match-guard"

describe("court-match-guard: isMatchOnCourt", () => {
  it("accepts an active match assigned to the viewed court", () => {
    expect(isMatchOnCourt({ courtNumber: 2, isCompleted: false }, 2)).toBe(true)
  })

  it("rejects a match that was moved to another court", () => {
    expect(isMatchOnCourt({ courtNumber: 3, isCompleted: false }, 2)).toBe(false)
  })

  it("rejects missing and invalid matches for a court screen", () => {
    expect(isMatchOnCourt(null, 2)).toBe(false)
    expect(isMatchOnCourt({ courtNumber: null, isCompleted: false }, 2)).toBe(false)
    expect(isMatchOnCourt({ courtNumber: 2, isCompleted: false }, Number.NaN)).toBe(false)
  })
})
