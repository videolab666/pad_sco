import { test, expect } from "@playwright/test"

// API smoke tests — deterministic checks that need no seeded data: every case
// here depends only on the endpoint's own validation / not-found handling.

test.describe("API: /api/court/[number]", () => {
  test("rejects an out-of-range court number with 400", async ({ request }) => {
    const res = await request.get("/api/court/99")
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty("error")
  })

  test("rejects a non-numeric court with 400", async ({ request }) => {
    const res = await request.get("/api/court/abc")
    expect(res.status()).toBe(400)
  })

  test("responds for a valid court number with JSON", async ({ request }) => {
    const res = await request.get("/api/court/3")
    // 404 when no match is on the court, 200 with a vMix array when there is.
    expect([200, 404]).toContain(res.status())
    const body = await res.json()
    if (res.status() === 404) {
      expect(body).toHaveProperty("error")
      expect(body).toHaveProperty("courtNumber", 3)
    } else {
      expect(Array.isArray(body)).toBe(true)
      expect(body[0]).toHaveProperty("match_id")
      // A7 fix: at least 5 dynamic set columns.
      expect(body[0]).toHaveProperty("teamA_set5")
    }
  })
})

test.describe("API: /api/vmix/[id]", () => {
  test("returns 404 for an unknown match id", async ({ request }) => {
    const res = await request.get("/api/vmix/nonexistent-match-xyz")
    expect(res.status()).toBe(404)
    const body = await res.json()
    expect(body).toHaveProperty("error")
  })
})

test.describe("API: /api/health-check", () => {
  test("responds with a JSON status", async ({ request }) => {
    const res = await request.get("/api/health-check")
    // 200 when the database is reachable, 500 otherwise — both are valid JSON.
    expect([200, 500]).toContain(res.status())
    const body = await res.json()
    expect(body).toHaveProperty("status")
    expect(body).toHaveProperty("timestamp")
  })
})
