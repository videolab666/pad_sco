import { test, expect } from "@playwright/test"

// Visual-regression baseline for the vMix scoreboard (vmix-scoreboard-unification.md,
// Вариант 1). The /vmix/[id] route reads a match from localStorage when the id is
// not a Supabase uuid, so a fixed fixture is seeded for a deterministic render.
//
// The fixture is in a NEUTRAL state (30-15, no game/set/match/break point) so the
// shot is stable and shows no transient indicator banner. These screenshots are
// the reference against which the <VmixScoreboard> extraction (Этап C) is checked:
//   npx playwright test e2e/visual.spec.ts                  # compare to baseline
//   npx playwright test e2e/visual.spec.ts --update-snapshots  # (re)create baseline

const FIXTURE = {
  id: "visual-fixture-1",
  type: "padel",
  format: "doubles",
  createdAt: "2026-05-18T00:00:00.000Z",
  settings: {
    sets: 3,
    scoringSystem: "classic",
    gamesPerSet: 6,
    tiebreakEnabled: true,
    tiebreakAt: "6-6",
    tiebreakLength: 7,
    finalSetFinish: "standard-7",
  },
  teamA: { players: [{ name: "Иванов", country: "RU" }, { name: "Петров", country: "RU" }] },
  teamB: { players: [{ name: "Smith", country: "US" }, { name: "Jones", country: "US" }] },
  score: {
    teamA: 1,
    teamB: 0,
    sets: [{ teamA: 6, teamB: 4, winner: "teamA" }],
    currentSet: { teamA: 3, teamB: 2, games: [], currentGame: { teamA: 30, teamB: 15 }, isTiebreak: false },
  },
  currentServer: { team: "teamA", playerIndex: 0 },
  courtSides: { teamA: "left", teamB: "right" },
  shouldChangeSides: false,
  isCompleted: false,
  revision: 0,
  history: [],
}

const THEMES = ["default", "transparent", "dark"]

for (const theme of THEMES) {
  test(`vMix scoreboard renders — theme=${theme}`, async ({ page }) => {
    await page.addInitScript((m) => {
      // safeGetItem accepts plain JSON when lz-decompression fails.
      localStorage.setItem("tennis_padel_matches", JSON.stringify([m]))
    }, FIXTURE)

    await page.goto(`/vmix/${FIXTURE.id}?theme=${theme}`)

    // Wait for the scoreboard to render its data (a player name).
    await expect(page.getByText("Иванов")).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(600) // let layout/fonts settle

    await expect(page).toHaveScreenshot(`vmix-${theme}.png`, { fullPage: true })
  })
}
