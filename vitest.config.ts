import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

// Automated verification config (see test/README.md).
//
// As new sports are added, drop a `test/<sport>.test.ts` file — it is picked up
// automatically. Keep the pure, testable logic in `lib/` so it stays inside the
// coverage scope below.
export default defineConfig({
  // Mirror the tsconfig "@/*" path alias so lib imports resolve under Vitest.
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    // The scoring/rules logic is plain TypeScript — no DOM needed.
    environment: "node",
    // Only real Vitest suites; the standalone *-regression.ts scripts are
    // bridged in through their .test.ts wrappers, never collected directly.
    // .test.tsx files are component tests (jsdom — set per-file via docblock).
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "logs/coverage",
      // Scope coverage to the pure logic the suites actually exercise. UI
      // components are excluded — they need a separate component-test setup.
      // Pure logic modules where line coverage is meaningful. React hooks /
      // components (e.g. hooks/use-match.ts) are tested separately — by the
      // hook/component suites — but excluded from the coverage gate, since
      // unit-covering their realtime/error branches only tests the mocks.
      include: [
        "lib/scoring-logic.ts",
        "lib/match-rule-change.ts",
        "lib/match-format-rules.ts",
        "lib/match-view.ts",
        "lib/match-metadata.ts",
        "lib/tennis-utils.ts",
        "lib/match-sync.ts",
        "lib/match-supabase.ts",
        "lib/scoreboard-settings.ts",
      ],
      // No-regression ratchet: gates set just below the current baseline
      // (measured 2026-05-17: stmts 72% / branch 60% / funcs 87% / lines 76%).
      // Raise these numbers as more sports/functions gain tests — never lower.
      thresholds: {
        lines: 75,
        functions: 85,
        statements: 70,
        branches: 58,
      },
    },
  },
})
