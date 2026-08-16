import { describe, it, expect } from "vitest"
import {
  appendMatchEvent,
  appendPointEvent,
  findLastEventOfTypes,
  mergeEventArrays,
  trimEventHistory,
} from "../lib/match-events"
import { backfillExtendedMatchState } from "../lib/match-extended-state"

const baseMatch = () =>
  backfillExtendedMatchState({
    id: "m1",
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
  })

describe("Task 2 — appendMatchEvent immutability and id/at autofill", () => {
  it("does not mutate the input", () => {
    const m = baseMatch()
    const before = JSON.stringify(m)
    const next = appendMatchEvent(m, { type: "point", setIndex: 0, gameIndex: 0, payload: {} })
    expect(JSON.stringify(m)).toBe(before)
    expect(next).not.toBe(m)
  })

  it("auto-fills id and at", () => {
    const m = baseMatch()
    const next = appendMatchEvent(m, { type: "point", setIndex: 0, gameIndex: 0, payload: {} })
    const ev = next.events[next.events.length - 1]
    expect(ev.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(typeof ev.at).toBe("string")
    expect(new Date(ev.at).toString()).not.toBe("Invalid Date")
  })

  it("respects explicit id / at", () => {
    const m = baseMatch()
    const next = appendMatchEvent(m, {
      type: "point",
      setIndex: 0,
      gameIndex: 0,
      payload: {},
      id: "custom-id",
      at: "2026-01-01T00:00:00.000Z",
    })
    expect(next.events[0].id).toBe("custom-id")
    expect(next.events[0].at).toBe("2026-01-01T00:00:00.000Z")
  })
})

describe("Task 2 — appendPointEvent", () => {
  it("records actor and indices", () => {
    let m = baseMatch()
    m = appendPointEvent(m, { team: "teamA", setIndex: 0, gameIndex: 0, pointIndex: 0 })
    m = appendPointEvent(m, { team: "teamB", setIndex: 0, gameIndex: 0, pointIndex: 1 })
    expect(m.events).toHaveLength(2)
    expect(m.events[0].actor).toBe("teamA")
    expect(m.events[1].actor).toBe("teamB")
    expect(m.events[1].type).toBe("point")
  })
})

describe("Task 2 — trimEventHistory", () => {
  it("compacts old events beyond keepRich while keeping ids", () => {
    let m = baseMatch()
    for (let i = 0; i < 60; i++) {
      m = appendPointEvent(m, { team: "teamA", setIndex: 0, gameIndex: 0, extra: { big: "x".repeat(100) } })
    }
    const trimmed = trimEventHistory(m, 10)
    expect(trimmed.events).toHaveLength(60)
    // first 50 should be compacted, last 10 still rich
    expect(trimmed.events[0].payload).toEqual({ compacted: true, type: "point", actor: "teamA" })
    expect(trimmed.events[55].payload.big).toBe("x".repeat(100))
  })

  it("is a no-op below the threshold", () => {
    let m = baseMatch()
    m = appendPointEvent(m, { team: "teamA", setIndex: 0, gameIndex: 0 })
    const trimmed = trimEventHistory(m, 10)
    expect(trimmed.events[0].payload).toEqual({})
  })
})

describe("Task 2 — findLastEventOfTypes", () => {
  it("returns the most recent event matching one of the types", () => {
    let m = baseMatch()
    m = appendPointEvent(m, { team: "teamA", setIndex: 0, gameIndex: 0 })
    m = appendMatchEvent(m, { type: "toss", setIndex: 0, gameIndex: 0, payload: { winner: "teamA" } })
    m = appendPointEvent(m, { team: "teamB", setIndex: 0, gameIndex: 0 })
    expect(findLastEventOfTypes(m, ["toss"])!.type).toBe("toss")
    expect(findLastEventOfTypes(m, ["point"])!.actor).toBe("teamB")
    expect(findLastEventOfTypes(m, ["timer"])).toBeUndefined()
  })
})

describe("Task 2 — mergeEventArrays", () => {
  it("appends remote-only events by id without dropping local ones", () => {
    const local = [
      { id: "a", type: "point", at: "t1", setIndex: 0, gameIndex: 0, payload: {} },
      { id: "b", type: "point", at: "t2", setIndex: 0, gameIndex: 0, payload: {} },
    ] as any
    const remote = [
      { id: "b", type: "point", at: "t2", setIndex: 0, gameIndex: 0, payload: {} },
      { id: "c", type: "point", at: "t3", setIndex: 0, gameIndex: 0, payload: {} },
    ] as any
    const merged = mergeEventArrays(local, remote)
    expect(merged.map((e: any) => e.id)).toEqual(["a", "b", "c"])
  })

  it("handles empty inputs", () => {
    expect(mergeEventArrays(undefined, undefined)).toEqual([])
    expect(mergeEventArrays([], [{ id: "x" } as any])).toEqual([{ id: "x" }])
    expect(mergeEventArrays([{ id: "y" } as any], [])).toEqual([{ id: "y" }])
  })
})
