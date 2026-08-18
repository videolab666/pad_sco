// Origin-доступ к командному конвейеру (Шаг 3, §99): браузер своего сайта
// проходит без ключа, внешний клиент — нет.

import { describe, expect, it } from "vitest"
import { isAuthorizedMatchCommandRequest, isSameOriginRequest } from "../lib/api-auth"

const req = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: "POST", headers })

describe("isSameOriginRequest", () => {
  it("browser same-origin POST: Origin совпадает — да", () => {
    expect(isSameOriginRequest(req("http://localhost:3000/api/x", { origin: "http://localhost:3000" }))).toBe(true)
    expect(
      isSameOriginRequest(req("https://club.app/api/x", { origin: "https://club.app" })),
    ).toBe(true)
  })

  it("чужой Origin — нет", () => {
    expect(isSameOriginRequest(req("http://localhost:3000/api/x", { origin: "https://evil.example" }))).toBe(false)
  })

  it("Referer fallback: свой сайт — да, чужой — нет", () => {
    expect(isSameOriginRequest(req("http://localhost:3000/api/x", { referer: "http://localhost:3000/page" }))).toBe(true)
    expect(isSameOriginRequest(req("http://localhost:3000/api/x", { referer: "https://evil.example/x" }))).toBe(false)
  })

  it("curl без Origin/Referer — нет (нужен X-API-Key)", () => {
    expect(isSameOriginRequest(req("http://localhost:3000/api/x"))).toBe(false)
  })

  it("мусорный Origin не бросает", () => {
    expect(isSameOriginRequest(req("http://localhost:3000/api/x", { origin: "::::not-a-url" }))).toBe(false)
  })
})

describe("isAuthorizedMatchCommandRequest", () => {
  it("без ключа в env: браузер проходит, curl нет (fail-closed для внешних)", () => {
    delete process.env.SCOREBOARD_API_KEY
    expect(
      isAuthorizedMatchCommandRequest(req("http://localhost:3000/api/x", { origin: "http://localhost:3000" })),
    ).toBe(true)
    expect(isAuthorizedMatchCommandRequest(req("http://localhost:3000/api/x"))).toBe(false)
  })

  it("X-API-Key по-прежнему работает", () => {
    process.env.SCOREBOARD_API_KEY = "test-key"
    expect(
      isAuthorizedMatchCommandRequest(req("http://localhost:3000/api/x", { "x-api-key": "test-key" })),
    ).toBe(true)
    delete process.env.SCOREBOARD_API_KEY
  })
})
