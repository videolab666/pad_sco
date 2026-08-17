// Fail-closed behaviour of the settings/media password gate (Шаг 0):
// with SETTINGS_PASSWORD unset nothing is accepted — including the legacy
// hardcoded default "111" — and no session cookie can authorize a request.

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  SETTINGS_COOKIE_NAME,
  checkSettingsPassword,
  isAuthorizedSettingsRequest,
  settingsSessionToken,
} from "../lib/settings-auth"

const realPassword = process.env.SETTINGS_PASSWORD

const requestWithCookie = (token: string): Request =>
  new Request("http://localhost/api/settings/login", {
    headers: { cookie: `${SETTINGS_COOKIE_NAME}=${encodeURIComponent(token)}` },
  })

describe("settings-auth: fail-closed SETTINGS_PASSWORD", () => {
  beforeEach(() => {
    delete process.env.SETTINGS_PASSWORD
    delete process.env.SCOREBOARD_API_KEY
  })

  afterEach(() => {
    if (realPassword === undefined) delete process.env.SETTINGS_PASSWORD
    else process.env.SETTINGS_PASSWORD = realPassword
  })

  it("rejects the legacy default password when the env is unset", () => {
    expect(checkSettingsPassword("111")).toBe(false)
    expect(checkSettingsPassword("")).toBe(false)
    expect(checkSettingsPassword(undefined)).toBe(false)
    expect(checkSettingsPassword(null)).toBe(false)
  })

  it("issues an empty session token when the env is unset", () => {
    expect(settingsSessionToken()).toBe("")
  })

  it("never authorizes a cookie when the env is unset (even an empty one)", () => {
    expect(isAuthorizedSettingsRequest(requestWithCookie(""))).toBe(false)
    expect(
      isAuthorizedSettingsRequest(requestWithCookie(settingsSessionToken())),
    ).toBe(false)
  })

  it("accepts the configured password and issues a working cookie", () => {
    process.env.SETTINGS_PASSWORD = "correct horse battery staple"
    expect(checkSettingsPassword("correct horse battery staple")).toBe(true)
    expect(checkSettingsPassword("111")).toBe(false)
    expect(checkSettingsPassword("wrong")).toBe(false)

    const token = settingsSessionToken()
    expect(token).not.toBe("")
    expect(isAuthorizedSettingsRequest(requestWithCookie(token))).toBe(true)
  })

  it("rejects a cookie signed with a different password (rotation kills sessions)", () => {
    process.env.SETTINGS_PASSWORD = "first"
    const oldToken = settingsSessionToken()
    process.env.SETTINGS_PASSWORD = "second"
    expect(isAuthorizedSettingsRequest(requestWithCookie(oldToken))).toBe(false)
    expect(isAuthorizedSettingsRequest(requestWithCookie(settingsSessionToken()))).toBe(true)
  })
})
