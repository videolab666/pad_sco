import { describe, it, expect } from "vitest"
import { isSameAvatarAllPlayers } from "../lib/avatar-display"

describe("isSameAvatarAllPlayers (APK hideAvatarForSameImage)", () => {
  const match = (a: string[], b: string[]) => ({
    teamA: { players: a.map((avatar) => ({ avatar })) },
    teamB: { players: b.map((avatar) => ({ avatar })) },
  })

  it("true when every player on both sides uses the same image", () => {
    const url = "https://x/photo.png"
    expect(isSameAvatarAllPlayers(match([url, url], [url, url]))).toBe(true)
  })

  it("false for different images or any player without an avatar", () => {
    expect(isSameAvatarAllPlayers(match(["a.png", "b.png"], ["a.png"]))).toBe(false)
    expect(isSameAvatarAllPlayers(match(["a.png", ""], ["a.png"]))).toBe(false)
    expect(isSameAvatarAllPlayers(match([], []))).toBe(false)
  })
})
