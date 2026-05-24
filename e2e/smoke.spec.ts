import { test, expect, type Page } from "@playwright/test"

// Smoke tests — drive the real app in a real browser and fail on any uncaught
// runtime error. They catch build/render/routing breakage that type-checking
// and unit tests cannot.

/** Pre-seeds the home-page auth so gated tests can skip the password screen. */
async function skipHomeGate(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("main_page_auth", "true")
    localStorage.setItem("main_page_auth_date", new Date().toISOString())
  })
}

/** Collects uncaught page exceptions for an end-of-test assertion. */
function trackPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (err) => errors.push(String(err)))
  return errors
}

test.afterEach(async ({ page }) => {
  if (!page.isClosed()) {
    await page.close({ runBeforeUnload: false })
  }
})

test("home page: the password gate accepts the password and reveals content", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/")

  const password = page.getByPlaceholder("Введите пароль")
  await expect(password).toBeVisible()
  await password.fill("111")
  await page.getByRole("button", { name: "Войти" }).click()

  // Authorized home content carries an <h1> heading.
  await expect(page.locator("h1")).toBeVisible()
  expect(errors, errors.join("\n")).toHaveLength(0)
})

test("home page: clicking the new-match link navigates there", async ({ page }) => {
  await skipHomeGate(page)
  const errors = trackPageErrors(page)
  await page.goto("/")

  await page.locator('a[href="/new-match?type=padel"]').first().click()
  await expect(page).toHaveURL(/\/new-match/)
  expect(errors, errors.join("\n")).toHaveLength(0)
})

test("new-match page: renders with a working create button", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/new-match?type=padel")

  await expect(page.locator("button.orange-button-inner")).toBeVisible()
  expect(errors, errors.join("\n")).toHaveLength(0)
})

test("match page: an unknown match id renders the error card (exercises useMatch)", async ({ page }) => {
  // Drives the useMatch hook end-to-end in a real browser: load → not found →
  // error UI, with no uncaught exceptions.
  const errors = trackPageErrors(page)
  await page.goto("/match/nonexistent-match-xyz")

  await expect(page.locator("h2.text-red-500")).toBeVisible()
  expect(errors, errors.join("\n")).toHaveLength(0)
})

// --- vMix scoreboard pages (Этап C: unified <VmixScoreboard>) -------------

/** A doubles match in a break-point state (teamB on game point, teamA serving). */
const VMIX_MATCH = {
  id: "smoke-vmix-1",
  type: "padel",
  format: "doubles",
  createdAt: "2026-05-18T00:00:00.000Z",
  settings: { sets: 3, scoringSystem: "classic", gamesPerSet: 6, tiebreakEnabled: true },
  teamA: { players: [{ name: "Иванов", country: "RU" }, { name: "Петров", country: "RU" }] },
  teamB: { players: [{ name: "Smith", country: "US" }, { name: "Jones", country: "US" }] },
  score: {
    teamA: 1,
    teamB: 0,
    sets: [{ teamA: 6, teamB: 4, winner: "teamA" }],
    currentSet: { teamA: 3, teamB: 2, games: [], currentGame: { teamA: 0, teamB: 40 }, isTiebreak: false },
  },
  currentServer: { team: "teamA", playerIndex: 0 },
  courtSides: { teamA: "left", teamB: "right" },
  shouldChangeSides: false,
  isCompleted: false,
  revision: 0,
  history: [],
}

/** Same match in Supabase row shape (snake_case) for the by-court endpoints. */
function vmixMatchRow(courtNumber: number) {
  return {
    id: VMIX_MATCH.id,
    type: VMIX_MATCH.type,
    format: VMIX_MATCH.format,
    created_at: VMIX_MATCH.createdAt,
    settings: VMIX_MATCH.settings,
    team_a: VMIX_MATCH.teamA,
    team_b: VMIX_MATCH.teamB,
    score: VMIX_MATCH.score,
    current_server: VMIX_MATCH.currentServer,
    court_sides: VMIX_MATCH.courtSides,
    should_change_sides: false,
    is_completed: false,
    winner: null,
    court_number: courtNumber,
    revision: 0,
  }
}

/** Stubs the "match by court" Supabase query so by-court pages get a fixture. */
async function mockMatchByCourt(page: Page, courtNumber: number) {
  await page.route("**/rest/v1/matches*", (route) => {
    const url = route.request().url()
    if (url.includes(`court_number=eq.${courtNumber}`) && url.includes("is_completed=eq.false")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(vmixMatchRow(courtNumber)),
      })
    }
    return route.continue()
  })
}

test("vMix overlay (/vmix/[id]): renders the scoreboard with the break-point indicator", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.addInitScript((m) => {
    localStorage.setItem("tennis_padel_matches", JSON.stringify([m]))
  }, VMIX_MATCH)

  await page.goto(`/vmix/${VMIX_MATCH.id}`)

  await expect(page.getByText("Иванов")).toBeVisible({ timeout: 20_000 })
  // Break-point is shown on every scoreboard now (Т1).
  await expect(page.getByText(/BREAK POINT/)).toBeVisible()
  expect(errors, errors.join("\n")).toHaveLength(0)
})

test("vMix court (/court-vmix/[number]): renders the scoreboard", async ({ page }) => {
  const errors = trackPageErrors(page)
  await mockMatchByCourt(page, 1)

  await page.goto("/court-vmix/1")

  await expect(page.getByText("Иванов")).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/BREAK POINT/)).toBeVisible()
  expect(errors, errors.join("\n")).toHaveLength(0)
})

test("fullscreen scoreboard (/fullscreen-scoreboard/[number]): renders without errors", async ({ page }) => {
  const errors = trackPageErrors(page)
  await mockMatchByCourt(page, 1)

  await page.goto("/fullscreen-scoreboard/1?theme=default&language=ru")

  await expect(page.getByText("Иванов")).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/BREAK POINT/)).toBeVisible()
  expect(errors, errors.join("\n")).toHaveLength(0)
})

test("vMix settings (/vmix-settings/[id]): renders the unified settings editor", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.addInitScript((m) => {
    localStorage.setItem("tennis_padel_matches", JSON.stringify([m]))
  }, VMIX_MATCH)

  await page.goto(`/vmix-settings/${VMIX_MATCH.id}`)

  // The shared <VmixSettingsEditor> shows the match title and the API tab.
  await expect(page.getByText("Иванов / Петров", { exact: false })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("tab", { name: /API/i })).toBeVisible()
  expect(errors, errors.join("\n")).toHaveLength(0)
})

test("court vMix settings (/court-vmix-settings/[number]): renders the unified settings editor", async ({ page }) => {
  const errors = trackPageErrors(page)
  await mockMatchByCourt(page, 1)

  await page.goto("/court-vmix-settings/1")

  await expect(page.getByText("Иванов / Петров", { exact: false })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("tab", { name: /API/i })).toBeVisible()
  expect(errors, errors.join("\n")).toHaveLength(0)
})
