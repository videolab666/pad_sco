import { describe, it } from "vitest"

// Bridges the standalone rule-change realtime regression script into Vitest.
// Any failed node:assert check rejects the dynamic import and fails this test.
describe("rule-change realtime regression", () => {
  it("all rule-change realtime assertions pass", async () => {
    await import("./rule-change-realtime-regression")
  })
})
