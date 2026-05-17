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
