import { describe, it } from "vitest"
import { main as runMatchSyncRegression } from "./match-sync-regression"

// Bridges the durable-sync integration script into Vitest. Unlike the other two
// suites this one is async, so its exported runner is awaited explicitly — any
// failed scenario throws and fails this test.
describe("match-sync regression", () => {
  it("all durable-sync scenarios pass", async () => {
    await runMatchSyncRegression()
  })
})
