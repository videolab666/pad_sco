import { describe, it } from "vitest"

// Bridges the standalone scoring-logic regression script into the Vitest suite.
// The script runs all of its node:assert checks at import time; any failure
// rejects the dynamic import and fails this test.
//
// New, finer-grained suites (e.g. one per sport) should be written with
// describe / it / expect directly — see test/_template.test.ts.
describe("scoring-logic regression", () => {
  it("all scoring-logic / match-view assertions pass", async () => {
    await import("./scoring-logic-regression")
  })
})
