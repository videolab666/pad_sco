import { expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ updates: 0 }))
vi.mock("../lib/api-auth", () => ({ isAuthorizedMatchCommandRequest: () => true }))
vi.mock("../lib/error-logger", () => ({ logEvent: vi.fn() }))
vi.mock("../lib/supabase", () => ({ createServerSupabaseClient: () => ({
  from: (table: string) => {
    let update = false, single = false
    const q: any = {
      select: () => q, eq: () => q, is: () => q, or: () => q, limit: () => q,
      maybeSingle: () => { single = true; return q },
      update: () => { update = true; return q },
      then: (resolve: any) => {
        if (table === "courts") return Promise.resolve({ data: { id: "court-one" }, error: null }).then(resolve)
        if (update) {
          state.updates++
          // First CAS loses to a reassignment; a second write would close the
          // match on the wrong court and is the regression under test.
          return Promise.resolve({ data: state.updates === 1 ? [] : [{ id: "moved" }], error: null }).then(resolve)
        }
        return Promise.resolve({ data: single
          ? { id: "moved", revision: 2, is_completed: false, court_number: 2, court_id: "court-two" }
          : [{ id: "moved", revision: 1 }], error: null }).then(resolve)
      },
    }
    return q
  },
}) }))
import { POST } from "../app/api/courts/free/route"

it("does not complete a match moved to another court during a CAS retry", async () => {
  state.updates = 0
  const response = await POST(new Request("http://localhost/api/courts/free", {
    method: "POST", body: JSON.stringify({ courtNumber: 1 }),
  }) as any)
  expect(state.updates).toBe(1)
  expect(response.status).toBe(409)
})
