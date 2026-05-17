import { describe, it, expect } from "vitest"
import {
  getCourtSideName,
  getTennisPointName,
  getTiebreakServer,
  shouldChangeSides,
} from "../lib/tennis-utils"

describe("tennis-utils: getTennisPointName", () => {
  it("maps the four tennis points and advantage to labels", () => {
    expect(getTennisPointName(0)).toBe("0")
    expect(getTennisPointName(15)).toBe("15")
    expect(getTennisPointName(30)).toBe("30")
    expect(getTennisPointName(40)).toBe("40")
    expect(getTennisPointName("Ad")).toBe("Ad")
  })

  it("passes raw tiebreak counts through as strings", () => {
    expect(getTennisPointName(7)).toBe("7")
  })
})

describe("tennis-utils: shouldChangeSides", () => {
  it("changes ends after an odd number of games", () => {
    expect(shouldChangeSides(1)).toBe(true)
    expect(shouldChangeSides(3)).toBe(true)
  })

  it("does not change ends after an even number of games", () => {
    expect(shouldChangeSides(2)).toBe(false)
    expect(shouldChangeSides(0)).toBe(false)
  })
})

describe("tennis-utils: getTiebreakServer", () => {
  it("keeps the starting server on the first point", () => {
    expect(getTiebreakServer(true, 0)).toBe(true)
  })

  it("hands serve to the other player after the first point", () => {
    expect(getTiebreakServer(true, 1)).toBe(false)
  })
})

describe("tennis-utils: getCourtSideName", () => {
  it("returns full side names", () => {
    expect(getCourtSideName("left")).toBe("Левая")
    expect(getCourtSideName("right")).toBe("Правая")
  })

  it("returns short side names when requested", () => {
    expect(getCourtSideName("left", true)).toBe("Л")
    expect(getCourtSideName("right", true)).toBe("П")
  })

  it("returns an empty string for an unknown side", () => {
    expect(getCourtSideName("middle")).toBe("")
  })
})
