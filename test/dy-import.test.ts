import { describe, it, expect, vi, beforeEach } from "vitest"

// In-memory player store standing in for localStorage + Supabase.
let store: Array<{ id: string; name: string; dyId?: string }>

vi.mock("@/lib/player-storage", () => ({
  getPlayers: async () => store.map((p) => ({ ...p })),
  // Mimics the real addPlayer: rejects duplicate (case-insensitive) names.
  addPlayer: async (p: { id: string; name: string; dyId?: string }) => {
    if (store.some((x) => x.name.trim().toLowerCase() === p.name.trim().toLowerCase()))
      return { success: false }
    store.push(p)
    return { success: true }
  },
}))

import { importPlayers, ensureLocalPlayer } from "../lib/dy/dy-import"
import { getPlayers } from "@/lib/player-storage"

beforeEach(() => {
  store = []
})

describe("importPlayers — transliterate option", () => {
  it("transliterates Cyrillic names when the option is on", async () => {
    const result = await importPlayers([{ name: "Гончаренко Игорь", dyId: "7" }], {
      transliterate: true,
    })
    expect(result[0].name).toBe("Goncharenko Igor")
    const players = await getPlayers()
    expect(players).toHaveLength(1)
    expect(players[0].name).toBe("Goncharenko Igor")
    expect(players[0].dyId).toBe("7")
  })

  it("keeps original names when the option is off", async () => {
    const result = await importPlayers([{ name: "Гончаренко Игорь", dyId: "7" }])
    expect(result[0].name).toBe("Гончаренко Игорь")
    expect((await getPlayers())[0].name).toBe("Гончаренко Игорь")
  })

  it("leaves Latin names untouched in both modes", async () => {
    await importPlayers([{ name: "John O'Brien", dyId: "1" }], { transliterate: true })
    expect((await getPlayers())[0].name).toBe("John O'Brien")
  })

  it("does not duplicate a player stored under the Cyrillic spelling", async () => {
    store.push({ id: "local-1", name: "Гончаренко Игорь" })
    const result = await importPlayers([{ name: "Гончаренко Игорь", dyId: "7" }], {
      transliterate: true,
    })
    expect(result[0]).toMatchObject({ id: "local-1", name: "Гончаренко Игорь" })
    expect(await getPlayers()).toHaveLength(1)
  })

  it("does not duplicate a player stored under the Latin spelling", async () => {
    store.push({ id: "local-1", name: "Goncharenko Igor" })
    const result = await importPlayers([{ name: "Гончаренко Игорь", dyId: "7" }], {
      transliterate: true,
    })
    expect(result[0]).toMatchObject({ id: "local-1", name: "Goncharenko Igor" })
    expect(await getPlayers()).toHaveLength(1)
  })

  it("still dedups by dyId first, keeping the earlier name", async () => {
    store.push({ id: "local-1", name: "Goncharenko", dyId: "7" })
    const result = await ensureLocalPlayer({ name: "Гончаренко Игорь", dyId: "7" }, {
      transliterate: true,
    })
    expect(result).toMatchObject({ id: "local-1", name: "Goncharenko" })
    expect(await getPlayers()).toHaveLength(1)
  })
})
