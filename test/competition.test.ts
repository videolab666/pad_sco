// Competition: Americano Engine + Rating Service (plan-4 §10-12, §31-33)

import { describe, expect, it } from "vitest"
import {
  americanoDimensions,
  applyMatchResult,
  computeLeaderboard,
  generateMexicanoPairings,
  generateWhistSchedule,
  validateAmericanoConfig,
  type ParticipantScore,
} from "../lib/americano-engine"
import {
  DEFAULT_MU,
  DEFAULT_SIGMA,
  conservativeRating,
  ratingToDisplay,
} from "../lib/rating-service"

// ─── Americano Engine ───────────────────────────────────────────────────────

describe("generateWhistSchedule (§10)", () => {
  it("8 игроков → 7 раундов, 2 корта в раунде = 14 матчей", () => {
    const schedule = generateWhistSchedule(8)
    expect(schedule.length).toBe(14) // 7 раундов × 2 корта
    expect(new Set(schedule.map(s => s.round)).size).toBe(7)
    expect(new Set(schedule.map(s => s.court)).size).toBe(2)
  })

  it("12 игроков → 11 раундов", () => {
    const schedule = generateWhistSchedule(12)
    expect(new Set(schedule.map(s => s.round)).size).toBe(11)
  })

  it("каждый игрок играет в каждом раунде", () => {
    const schedule = generateWhistSchedule(8)
    for (let round = 0; round < 7; round++) {
      const roundMatches = schedule.filter(s => s.round === round)
      const seats = roundMatches.flatMap(s => [...s.teamASeats, ...s.teamBSeats])
      expect(new Set(seats).size).toBe(8) // все 8 в деле
    }
  })

  it("каждый партнёрствует с каждым ровно один раз", () => {
    const schedule = generateWhistSchedule(8)
    const partners = new Map<string, number>()
    for (const m of schedule) {
      for (const [a, b] of [[m.teamASeats[0], m.teamASeats[1]], [m.teamBSeats[0], m.teamBSeats[1]]]) {
        const key = [a, b].sort().join("-")
        partners.set(key, (partners.get(key) ?? 0) + 1)
      }
    }
    // C(8,2) = 28 уникальных пар
    expect(partners.size).toBe(28)
    for (const count of partners.values()) expect(count).toBe(1)
  })

  it("нестандартное число → fallback round-robin", () => {
    const schedule = generateWhistSchedule(6) // не кратно 4
    expect(schedule.length).toBeGreaterThan(0)
  })

  it("меньше 4 → пусто", () => {
    expect(generateWhistSchedule(2)).toEqual([])
  })
})

describe("computeLeaderboard (§10: tie-breaking)", () => {
  const p = (id: string, seat: number, points: number, won: number, diff: number): ParticipantScore => ({
    playerId: id, seat, totalPoints: points, gamesPlayed: won + 2, gamesWon: won,
    gamesLost: 2, pointsDiff: diff,
  })

  it("сортировка: очки → победы → разница", () => {
    const board = computeLeaderboard([
      p("a", 0, 40, 3, 10),
      p("b", 1, 50, 4, 20),
      p("c", 2, 40, 4, 5),  // = очки с a, но больше побед
      p("d", 3, 50, 4, 25), // = очки и победы с b, но лучше разница
    ])
    expect(board.map(x => x.playerId)).toEqual(["d", "b", "c", "a"])
  })
})

describe("applyMatchResult (§10)", () => {
  it("победа A → очки, победы, разница", () => {
    const participants: ParticipantScore[] = [
      { playerId: "a", seat: 0, totalPoints: 0, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, pointsDiff: 0 },
      { playerId: "b", seat: 1, totalPoints: 0, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, pointsDiff: 0 },
      { playerId: "c", seat: 2, totalPoints: 0, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, pointsDiff: 0 },
      { playerId: "d", seat: 3, totalPoints: 0, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, pointsDiff: 0 },
    ]

    const updated = applyMatchResult(participants, [0, 1], [2, 3], 16, 10)
    const a = updated.find(p => p.playerId === "a")!
    const c = updated.find(p => p.playerId === "c")!

    expect(a.totalPoints).toBe(16)
    expect(a.gamesWon).toBe(1)
    expect(a.pointsDiff).toBe(6)
    expect(c.totalPoints).toBe(10)
    expect(c.gamesLost).toBe(1)
    expect(c.pointsDiff).toBe(-6)
  })
})

describe("validateAmericanoConfig", () => {
  it("принимает валидную конфигурацию", () => {
    expect(validateAmericanoConfig({ playerCount: 8, format: "americano", pointsPerRound: 16 })).toEqual([])
    expect(validateAmericanoConfig({ playerCount: 16, format: "mexicano" })).toEqual([])
  })

  it("отклоняет: < 4, > 32, не кратно 4, плохой format", () => {
    expect(validateAmericanoConfig({ playerCount: 2 }).length).toBeGreaterThan(0)
    expect(validateAmericanoConfig({ playerCount: 36 }).length).toBeGreaterThan(0)
    expect(validateAmericanoConfig({ playerCount: 6 }).length).toBeGreaterThan(0)
    expect(validateAmericanoConfig({ playerCount: 8, format: "bowling" }).length).toBeGreaterThan(0)
    expect(validateAmericanoConfig({ playerCount: 8, pointsPerRound: 0 }).length).toBeGreaterThan(0)
  })
})

describe("americanoDimensions", () => {
  it("8 игроков → 2 корта, 7 раундов (americano)", () => {
    expect(americanoDimensions(8, "americano")).toEqual({ courts: 2, rounds: 7 })
  })

  it("16 игроков → 4 корта, 15 раундов", () => {
    expect(americanoDimensions(16, "americano")).toEqual({ courts: 4, rounds: 15 })
  })

  it("mexicano: меньше раундов (гибко)", () => {
    const d = americanoDimensions(8, "mexicano")
    expect(d.courts).toBe(2)
    expect(d.rounds).toBe(4) // courts × 2
  })
})

describe("generateMexicanoPairings (§11: динамический паринг)", () => {
  const standings = (points: number[]): ParticipantScore[] =>
    points.map((p, i) => ({
      playerId: `p${i}`, seat: i, totalPoints: p,
      gamesPlayed: 1, gamesWon: 0, gamesLost: 1, pointsDiff: p - 10,
    }))

  it("8 игроков: 4 команды snake-ом → 2 матча на 2 кортах", () => {
    // Standings: A(32) B(28) C(25) D(22) E(18) F(15) G(12) H(8)
    const pairs = generateMexicanoPairings(standings([32, 28, 25, 22, 18, 15, 12, 8]), 2, 0)
    expect(pairs.length).toBe(2) // 2 корта
    expect(pairs[0].teamASeats).toEqual([0, 7]) // сильнейший + слабейший
    expect(pairs[0].teamBSeats).toEqual([1, 6]) // 2-й + 7-й
    expect(pairs[1].teamASeats).toEqual([2, 5]) // 3-й + 6-й
    expect(pairs[1].teamBSeats).toEqual([3, 4]) // 4-й + 5-й
  })

  it("меньше 4 игроков → пусто", () => {
    expect(generateMexicanoPairings(standings([10, 5]), 1, 0)).toEqual([])
  })

  it("сильнейший играет со слабейшим (баланс §11)", () => {
    const pairs = generateMexicanoPairings(standings([40, 30, 20, 10]), 1, 0)
    expect(pairs[0].teamASeats).toEqual([0, 3]) // #1 + #4
    expect(pairs[0].teamBSeats).toEqual([1, 2]) // #2 + #3
  })
})

// ─── Rating Service ─────────────────────────────────────────────────────────

describe("Rating helpers (§31-33)", () => {
  it("дефолт: mu=25, sigma≈8.333", () => {
    expect(DEFAULT_MU).toBe(25.0)
    expect(DEFAULT_SIGMA).toBeCloseTo(8.333, 2)
  })

  it("conservativeRating = mu - 3*sigma", () => {
    expect(conservativeRating(25, 8.333)).toBeCloseTo(0.001, 1)
    expect(conservativeRating(30, 5)).toBe(15)
  })

  it("ratingToDisplay: диапазон 1.0–5.0", () => {
    const low = parseFloat(ratingToDisplay(10, 10))    // слабый
    const mid = parseFloat(ratingToDisplay(25, 8.333)) // дефолт
    const high = parseFloat(ratingToDisplay(35, 3))    // сильный
    expect(low).toBeLessThan(mid)
    expect(mid).toBeLessThan(high)
    expect(low).toBeGreaterThanOrEqual(1.0)
    expect(high).toBeLessThanOrEqual(5.0)
  })
})
