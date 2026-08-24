// Фичи: Notifications + Balanced Teams + King of Court + Leagues + Billing + White Label

import { describe, expect, it } from "vitest"
import { suggestBalancedTeams, suggestRotationOrder, type RatedPlayer } from "../lib/balanced-teams"
import {
  applyKingResult, getKingRanking, initKingOfCourt, isRoundComplete, nextKingRound,
} from "../lib/king-of-court"
import {
  applyFixtureResult, computeStandings, generateRoundRobin, getPromotionsAndRelegations,
  type Standing,
} from "../lib/league-engine"
import { canAddCourt, getClubPlan, hasPlanFeature, PLANS } from "../lib/billing-plans"
import { DEFAULT_BRAND, formatCourtName, resolveBrand } from "../lib/white-label"
import { generateShareCardSvg } from "../lib/share-card"

// ─── Balanced Teams (§32) ───────────────────────────────────────────────────

describe("suggestBalancedTeams (§32)", () => {
  const p = (id: string, name: string, rating: number): RatedPlayer => ({ playerId: id, name, rating })

  it("4 игрока: находит оптимальное разбиение (минимальная разница)", () => {
    const players = [p("a", "A", 30), p("b", "B", 25), p("c", "C", 20), p("d", "D", 15)]
    const result = suggestBalancedTeams(players)
    expect(result).not.toBeNull()
    // Оптимально: [A,D]=22.5 vs [B,C]=22.5 (разница 0)
    expect(result!.difference).toBeLessThan(1)
    expect(result!.balancePercent).toBeGreaterThan(95)
  })

  it("4 игрока с большим разбросом: выбирает лучшую пару сильный+слабый", () => {
    const players = [p("a", "A", 40), p("b", "B", 30), p("c", "C", 20), p("d", "D", 10)]
    const result = suggestBalancedTeams(players)
    // [A,D]=25 vs [B,C]=25 — идеально сбалансировано
    expect(result!.difference).toBe(0)
    expect(result!.balancePercent).toBe(100)
  })

  it("меньше 4 → null", () => {
    expect(suggestBalancedTeams([p("a", "A", 10), p("b", "B", 20)])).toBeNull()
  })

  it("8 игроков: snake draft", () => {
    const players = Array.from({ length: 8 }, (_, i) => p(`p${i}`, `P${i}`, 40 - i * 5))
    const result = suggestBalancedTeams(players)
    expect(result).not.toBeNull()
    expect(result!.teamA.length).toBe(4)
    expect(result!.teamB.length).toBe(4)
  })
})

describe("suggestRotationOrder (§9)", () => {
  it("меняет порядок между раундами", () => {
    const players = Array.from({ length: 6 }, (_, i) => ({ playerId: `p${i}`, name: `P${i}`, rating: 30 - i * 5 }))
    const r0 = suggestRotationOrder(players, 0)
    const r1 = suggestRotationOrder(players, 1)
    expect(r0[0].playerId).not.toBe(r1[0].playerId)
  })
})

// ─── King of Court (§12) ────────────────────────────────────────────────────

describe("King of Court (§12)", () => {
  const players = Array.from({ length: 8 }, (_, i) => ({
    playerId: `p${i}`, name: `P${i}`, rating: 40 - i * 5,
  }))

  it("инициализация: 2 корта по 4 игрока, сильнейшие на King Court", () => {
    const state = initKingOfCourt(players, 2)
    expect(state.matches.length).toBe(2)
    expect(state.matches[0].courtLevel).toBe(0) // King Court
    // Сильнейший игрок на позиции 0 (King Court)
    expect(state.players.find(p => p.playerId === "p0")?.position).toBe(0)
  })

  it("победители поднимаются, проигравшие опускаются", () => {
    const players12 = Array.from({ length: 12 }, (_, i) => ({
      playerId: `p${i}`, name: `P${i}`, rating: 40 - i * 3,
    }))
    let state = initKingOfCourt(players12, 3)
    // Матч на Court 2 (level 2): победители → level 1, проигравшие → level 2 (некуда ниже)
    const court2Match = state.matches.find(m => m.courtLevel === 2)!
    const matchIndex = state.matches.indexOf(court2Match)

    state = applyKingResult(state, matchIndex, 16, 10) // Team A wins

    // Победители teamA → position 1 (поднялись с 2)
    for (const w of court2Match.teamA) {
      expect(state.players.find(p => p.playerId === w.playerId)?.position).toBe(1)
    }
    // Проигравшие teamB → position 2 (остались на нижнем корте, некуда ниже)
    for (const l of court2Match.teamB) {
      expect(state.players.find(p => p.playerId === l.playerId)?.position).toBe(2)
    }

    // Матч на Court 1 (level 1): победители → King Court, проигравшие → Court 3
    const court1Match = state.matches.find(m => m.courtLevel === 1)!
    const idx1 = state.matches.indexOf(court1Match)
    state = applyKingResult(state, idx1, 10, 16) // Team B wins

    for (const w of court1Match.teamB) {
      expect(state.players.find(p => p.playerId === w.playerId)?.position).toBe(0)
    }
    for (const l of court1Match.teamA) {
      expect(state.players.find(p => p.playerId === l.playerId)?.position).toBe(2)
    }
  })

  it("раунд завершён после всех результатов → next round", () => {
    let state = initKingOfCourt(players, 2)
    state = applyKingResult(state, 0, 16, 10)
    expect(isRoundComplete(state)).toBe(false)
    state = applyKingResult(state, 1, 12, 16)
    expect(isRoundComplete(state)).toBe(true)
    state = nextKingRound(state)
    expect(state.currentRound).toBe(1)
  })
})

// ─── Leagues (§81) ──────────────────────────────────────────────────────────

describe("generateRoundRobin (§81)", () => {
  it("4 игрока → 3 раунда по 2 матча = 6 fixtures", () => {
    const fixtures = generateRoundRobin(["a", "b", "c", "d"])
    expect(fixtures.length).toBe(6)
    expect(new Set(fixtures.map(f => f.round)).size).toBe(3)
  })

  it("каждый играет с каждым один раз", () => {
    const fixtures = generateRoundRobin(["a", "b", "c", "d", "e", "f"])
    const pairs = new Set(
      fixtures.map(f => [f.playerAId, f.playerBId].sort().join("-"))
    )
    // C(6,2) = 15 уникальных пар
    expect(pairs.size).toBe(15)
  })

  it("нечётное количество: bye обрабатывается", () => {
    const fixtures = generateRoundRobin(["a", "b", "c"])
    // C(3,2) = 3 пары (один игрок отдыхает каждый раунд)
    expect(fixtures.length).toBe(3)
    expect(fixtures.every(f => f.playerAId !== "__bye__" && f.playerBId !== "__bye__")).toBe(true)
  })
})

describe("applyFixtureResult + standings (§81)", () => {
  const standings: Standing[] = [
    { playerId: "a", played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, points: 0 },
    { playerId: "b", played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, points: 0 },
  ]

  it("победа → 3 очка, поражение → 1", () => {
    const updated = applyFixtureResult(standings, "a", "b", 2, 1)
    const a = updated.find(s => s.playerId === "a")!
    const b = updated.find(s => s.playerId === "b")!
    expect(a.points).toBe(3)
    expect(b.points).toBe(1)
    expect(a.won).toBe(1)
    expect(b.lost).toBe(1)
  })

  it("сортировка: очки → разница сетов", () => {
    const s: Standing[] = [
      { playerId: "a", played: 5, won: 3, lost: 2, setsWon: 10, setsLost: 6, points: 10 },
      { playerId: "b", played: 5, won: 3, lost: 2, setsWon: 9, setsLost: 5, points: 10 },
    ]
    const sorted = computeStandings(s)
    // Очки равны, но у a разница сетов лучше
    expect(sorted[0].playerId).toBe("a")
  })

  it("promotions/relegations (§81)", () => {
    const s: Standing[] = [
      { playerId: "top1", played: 5, won: 5, lost: 0, setsWon: 15, setsLost: 3, points: 15 },
      { playerId: "top2", played: 5, won: 4, lost: 1, setsWon: 12, setsLost: 6, points: 13 },
      { playerId: "mid", played: 5, won: 2, lost: 3, setsWon: 8, setsLost: 10, points: 7 },
      { playerId: "bot1", played: 5, won: 1, lost: 4, setsWon: 5, setsLost: 12, points: 5 },
      { playerId: "bot2", played: 5, won: 0, lost: 5, setsWon: 2, setsLost: 15, points: 3 },
    ]
    const { promote, relegate } = getPromotionsAndRelegations(s, 2, 2)
    expect(promote).toEqual(["top1", "top2"])
    expect(relegate).toEqual(["bot1", "bot2"])
  })
})

// ─── Billing (§55) ──────────────────────────────────────────────────────────

describe("Billing Plans (§55)", () => {
  it("starter: 2 корта, бесплатно, без видео", () => {
    const plan = PLANS.starter
    expect(plan.maxCourts).toBe(2)
    expect(plan.priceMonthly).toBe(0)
    expect(hasPlanFeature("starter", "video_recording")).toBe(false)
    expect(hasPlanFeature("starter", "scoreboard")).toBe(true)
  })

  it("club: 10 кортов, видео + Americano + рейтинги", () => {
    const plan = PLANS.club
    expect(plan.maxCourts).toBe(10)
    expect(hasPlanFeature("club", "video_recording")).toBe(true)
    expect(hasPlanFeature("club", "americano")).toBe(true)
    expect(hasPlanFeature("club", "leagues")).toBe(false)
  })

  it("pro: безлимит кортов, все фичи", () => {
    const plan = PLANS.pro
    expect(hasPlanFeature("pro", "leagues")).toBe(true)
    expect(hasPlanFeature("pro", "white_label")).toBe(true)
    expect(hasPlanFeature("pro", "api_access")).toBe(true)
  })

  it("canAddCourt: проверяет лимит", () => {
    expect(canAddCourt("starter", 1)).toBe(true)
    expect(canAddCourt("starter", 2)).toBe(false)
    expect(canAddCourt("club", 9)).toBe(true)
    expect(canAddCourt("club", 10)).toBe(false)
  })

  it("getClubPlan: возвращает план из metadata", () => {
    expect(getClubPlan({ plan: "pro" }).tier).toBe("pro")
    expect(getClubPlan(null).tier).toBe("starter")
  })
})

// ─── White Label (§56) ──────────────────────────────────────────────────────

describe("White Label (§56)", () => {
  it("resolveBrand: дефолт → клуб → event override", () => {
    const club = { clubName: "REJO Padel", primaryColor: "#FF0000" }
    const event = { accentColor: "#00FF00" }
    const brand = resolveBrand(club, event)
    expect(brand.clubName).toBe("REJO Padel")
    expect(brand.primaryColor).toBe("#FF0000")
    expect(brand.accentColor).toBe("#00FF00")
    expect(brand.bgColor).toBe(DEFAULT_BRAND.bgColor) // из дефолта
  })

  it("formatCourtName: numbered vs named", () => {
    const court = { name: "Centre", number: 1 }
    expect(formatCourtName(court, "numbered")).toBe("Корт 1")
    expect(formatCourtName(court, "named")).toBe("Centre")
  })
})

// ─── Share Card (§45) ───────────────────────────────────────────────────────

describe("Share Card SVG (§45)", () => {
  it("генерирует валидный SVG с данными матча", () => {
    const svg = generateShareCardSvg({
      clubName: "REJO Padel",
      teamA: "Alex / Max",
      teamB: "Denis / Oleg",
      score: "6:4 3:6 10:7",
      winner: "A",
      court: "Корт 1",
      duration: "1ч 24м",
      date: "19 августа 2026",
    })
    expect(svg).toContain("<svg")
    expect(svg).toContain("REJO PADEL")
    expect(svg).toContain("Alex / Max")
    expect(svg).toContain("6:4 3:6 10:7")
    expect(svg).not.toContain("<script") // XSS safe
  })

  it("экранирует XML-спецсимволы", () => {
    const svg = generateShareCardSvg({
      clubName: 'Club <"&\'>',
      teamA: "A",
      teamB: "B",
      score: "1:0",
      winner: null,
      court: "",
      duration: "",
      date: "",
    })
    expect(svg).toContain("&lt;")
    expect(svg).toContain("&amp;")
    expect(svg).toContain("&quot;")
  })
})
