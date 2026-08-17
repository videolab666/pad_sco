// Роли персонала (plan-4 §4.10/§118) и переходный auth (Шаг 1 slice B).

import { describe, expect, it } from "vitest"
import { STAFF_API_ROLES, hasStaffRole, type StaffMembership } from "../lib/staff-auth"

const m = (role: StaffMembership["role"]): StaffMembership => ({ clubId: "c-1", role })

describe("hasStaffRole", () => {
  it("пустые членства — не персонал", () => {
    expect(hasStaffRole([])).toBe(false)
  })

  it("роль из STAFF_API_ROLES открывает API", () => {
    expect(hasStaffRole([m("owner")])).toBe(true)
    expect(hasStaffRole([m("manager")])).toBe(true)
    expect(hasStaffRole([m("referee")])).toBe(true)
    expect(hasStaffRole([m("coach")])).toBe(true)
  })

  it("viewer не получает API-доступ (только просмотр UI)", () => {
    expect(hasStaffRole([m("viewer")])).toBe(false)
    expect(hasStaffRole([m("viewer"), m("viewer")])).toBe(false)
  })

  it("кастомный набор ролей", () => {
    expect(hasStaffRole([m("viewer")], ["viewer"])).toBe(true)
    expect(hasStaffRole([m("manager")], ["owner"])).toBe(false)
  })

  it("STAFF_API_ROLES соответствует ролям клуба", () => {
    expect(STAFF_API_ROLES).toEqual(["owner", "manager", "referee", "coach"])
  })
})
