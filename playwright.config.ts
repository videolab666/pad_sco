import { defineConfig, devices } from "@playwright/test"

// End-to-end / API checks (see test/README.md).
//
// Runs against a real Chromium browser and a real `next dev` server, started
// automatically below. Every step is logged: traces, screenshots and video are
// captured on failure into logs/playwright-results, with an HTML report in
// logs/playwright-report.
//
//   npm run e2e            # headless run
//   npm run e2e:report     # open the last HTML report
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.mjs",
  globalTeardown: "./e2e/global-teardown.mjs",
  // First-time `next dev` compilation is slow — be generous.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    // Small tolerance for font antialiasing in visual-regression screenshots.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [
    ["list"],
    ["html", { outputFolder: "logs/playwright-report", open: "never" }],
  ],
  outputDir: "logs/playwright-results",

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 30_000,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
