import { describe, it, expect } from "vitest"
import { backfillExtendedMatchState } from "../lib/match-extended-state"
import { ensureSeedSnapshot } from "../lib/match-undo"
import { applyPointWithExtras } from "../lib/apply-point"
import { applyRemoteCommand, REMOTE_COMMANDS, RemoteCommandError } from "../lib/remote-commands"

const freshMatch = () =>
  ensureSeedSnapshot(
    backfillExtendedMatchState({
      id: "m1",
      type: "padel",
      format: "doubles",
      isCompleted: false,
      settings: {
        sets: 3,
        scoringSystem: "classic",
        goldenPointFormat: "none",
        gamesPerSet: 6,
        tiebreakEnabled: true,
        tiebreakAt: "6-6",
      },
      teamA: { name: "Team A", players: [{ id: "pa1", name: "Alpha" }, { id: "pa2", name: "Beta" }] },
      teamB: { name: "Team B", players: [{ id: "pb1", name: "Gamma" }, { id: "pb2", name: "Delta" }] },
      score: {
        teamA: 0,
        teamB: 0,
        sets: [] as any[],
        currentSet: {
          teamA: 0,
          teamB: 0,
          games: [],
          currentGame: { teamA: 0, teamB: 0 },
          isTiebreak: false,
        },
      },
      currentServer: { team: "teamA", playerIndex: 0 },
      courtSides: { teamA: "left", teamB: "right" },
    }),
  )

function score(match: any, team: "teamA" | "teamB", times = 1) {
  let m = match
  for (let i = 0; i < times; i++) m = applyPointWithExtras(m, team)
  return m
}

const err = (fn: () => unknown): RemoteCommandError => {
  try {
    fn()
  } catch (e: any) {
    if (e instanceof RemoteCommandError) return e
    throw e
  }
  throw new Error("expected RemoteCommandError")
}

describe("applyRemoteCommand — point", () => {
  it("scores a point through the shared engine", () => {
    const m = applyRemoteCommand(freshMatch(), "point", { team: "teamA" })
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 15, teamB: 0 })
    expect(m.events.at(-1).type).toBe("point")
  })

  it("refuses a point on a completed match", () => {
    let m = freshMatch()
    m = score(m, "teamA", 24) // 6-0 set — match still live (3 sets)
    m.isCompleted = true
    m.winner = "teamA"
    const e = err(() => applyRemoteCommand(m, "point", { team: "teamA" }))
    expect(e.code).toBe("match_completed")
    expect(e.status).toBe(400)
  })

  it("validates the team argument", () => {
    const e = err(() => applyRemoteCommand(freshMatch(), "point", { team: "left" }))
    expect(e.code).toBe("invalid_args")
  })
})

describe("applyRemoteCommand — undo", () => {
  it("undoes the last point and refuses on a diverged journal", () => {
    let m = score(freshMatch(), "teamA", 2)
    const undone = applyRemoteCommand(m, "undo-point")
    expect(undone.score.currentSet.currentGame).toEqual({ teamA: 15, teamB: 0 })

    // Silent mutation → journal diverges → replay undo must refuse.
    m.score.currentSet.teamA = 4
    const e = err(() => applyRemoteCommand(m, "undo-point"))
    expect(e.code).toBe("journal_diverged")
  })

  it("undo-set rolls a completed set back in progress", () => {
    const m = score(freshMatch(), "teamA", 24) // set 1: 6-0
    expect(m.score.sets).toHaveLength(1)
    const undone = applyRemoteCommand(m, "undo-set")
    expect(undone.score.sets).toHaveLength(0)
    expect(undone.score.currentSet.teamA).toBe(5)
  })

  it("refuses when there is nothing to undo", () => {
    const e = err(() => applyRemoteCommand(freshMatch(), "undo-game"))
    expect(e.code).toBe("nothing_to_undo")
  })
})

describe("applyRemoteCommand — adjust", () => {
  it("adjust-set writes exact game counts", () => {
    const m = applyRemoteCommand(freshMatch(), "adjust-set", { teamA: 5, teamB: 5 })
    expect(m.score.currentSet.teamA).toBe(5)
    expect(m.score.currentSet.teamB).toBe(5)
    expect(m.events.at(-1).payload.action).toBe("adjust-current-set")
  })

  it("adjust-game validates tennis point values", () => {
    expect(err(() => applyRemoteCommand(freshMatch(), "adjust-game", { teamA: 7, teamB: 0 })).code).toBe("invalid_args")
    const m = applyRemoteCommand(freshMatch(), "adjust-game", { teamA: "Ad", teamB: 3 })
    expect(m.score.currentSet.currentGame).toEqual({ teamA: "Ad", teamB: 40 })
  })

  it("set-server moves the server", () => {
    const m = applyRemoteCommand(freshMatch(), "set-server", { team: "teamB", playerIndex: 1 })
    expect(m.currentServer).toEqual({ team: "teamB", playerIndex: 1 })
  })
})

describe("applyRemoteCommand — set scores / reopen", () => {
  it("set-set-scores requires the exact row structure", () => {
    let m = score(freshMatch(), "teamA", 24) // 1 completed set + live set = 2 rows
    expect(err(() => applyRemoteCommand(m, "set-set-scores", { rows: [{ teamA: 6, teamB: 4 }] })).code).toBe(
      "invalid_args",
    )
    const edited = applyRemoteCommand(m, "set-set-scores", {
      rows: [
        { teamA: 4, teamB: 6 },
        { teamA: 0, teamB: 0 },
      ],
    })
    expect(edited.score.sets[0].winner).toBe("teamB")
    expect(edited.score.currentSet.teamA).toBe(0)
  })

  it("reopen-set restores a corrected 6-6 with the tiebreak flag", () => {
    let m = score(freshMatch(), "teamA", 24)
    const reopened = applyRemoteCommand(m, "reopen-set", { setIndex: 0, score: { teamA: 6, teamB: 6 } })
    expect(reopened.score.sets).toHaveLength(0)
    expect(reopened.score.currentSet).toMatchObject({ teamA: 6, teamB: 6, isTiebreak: true })
    expect(err(() => applyRemoteCommand(m, "reopen-set", { setIndex: 5 })).code).toBe("invalid_args")
  })
})

describe("applyRemoteCommand — end / unlock", () => {
  it("ends the match with a reason and unlocks it back", () => {
    let m = score(freshMatch(), "teamA")
    const ended = applyRemoteCommand(m, "end-match", { reason: "time-up", winner: "teamA" })
    expect(ended.isCompleted).toBe(true)
    expect(ended.winner).toBe("teamA")
    expect(ended.endMatchReason).toBe("time-up")

    expect(err(() => applyRemoteCommand(ended, "end-match", { reason: "time-up", winner: "teamA" })).code).toBe(
      "match_completed",
    )

    const unlocked = applyRemoteCommand(ended, "unlock-match")
    expect(unlocked.isCompleted).toBe(false)
    expect(unlocked.winner).toBe(null)
    expect(err(() => applyRemoteCommand(unlocked, "unlock-match")).code).toBe("not_completed")
  })

  it("validates the end reason", () => {
    expect(err(() => applyRemoteCommand(freshMatch(), "end-match", { reason: "bored", winner: "teamA" })).code).toBe(
      "invalid_args",
    )
  })
})

describe("applyRemoteCommand — set-players", () => {
  it("replaces a lineup, reusing player ids by name", () => {
    const m = applyRemoteCommand(freshMatch(), "set-players", {
      teamA: { players: ["Alpha", "New Guy"] },
    })
    expect(m.teamA.players.map((p: any) => p.name)).toEqual(["Alpha", "New Guy"])
    expect(m.teamA.players[0].id).toBe("pa1") // same name → stable id
    expect(m.teamA.players[1].id).toBeTruthy()
    expect(m.teamB.players).toHaveLength(2) // untouched
    expect(m.teamA.name).toBe("Team A") // name preserved
  })

  it("validates the lineup shape", () => {
    expect(err(() => applyRemoteCommand(freshMatch(), "set-players", {})).code).toBe("invalid_args")
    expect(err(() => applyRemoteCommand(freshMatch(), "set-players", { teamA: { players: [] } })).code).toBe(
      "invalid_args",
    )
    expect(err(() => applyRemoteCommand(freshMatch(), "set-players", { teamA: { players: [""] } })).code).toBe(
      "invalid_args",
    )
  })
})

describe("applyRemoteCommand — dispatch", () => {
  it("rejects unknown commands with the supported list", () => {
    const e = err(() => applyRemoteCommand(freshMatch(), "explode"))
    expect(e.code).toBe("unknown_command")
    expect(e.message).toContain(REMOTE_COMMANDS.join(", "))
  })

  it("never mutates the input snapshot", () => {
    const m = freshMatch()
    const snapshot = JSON.stringify(m)
    applyRemoteCommand(m, "point", { team: "teamA" })
    applyRemoteCommand(m, "adjust-set", { teamA: 3, teamB: 2 })
    applyRemoteCommand(m, "set-players", { teamB: { players: ["X", "Y"] } })
    expect(JSON.stringify(m)).toBe(snapshot)
  })
})

describe("stableOperationUuid", () => {
  it("maps free-form ids deterministically to valid uuids", async () => {
    const { stableOperationUuid } = await import("../lib/remote-commands")
    const a = stableOperationUuid("idem-B")
    const b = stableOperationUuid("idem-B")
    const c = stableOperationUuid("другой")
    expect(a).toBe(b) // same input → same uuid (retry finds the record)
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(a).not.toBe(c)
  })

  it("passes through valid uuids unchanged (lowercased)", async () => {
    const { stableOperationUuid } = await import("../lib/remote-commands")
    const u = "11111111-2222-3333-4444-555555555555"
    expect(stableOperationUuid(u)).toBe(u)
    expect(stableOperationUuid(u.toUpperCase())).toBe(u)
  })
})

describe("applyRemoteCommand — set-rules", () => {
  it("patches rules, recomputes and journals with settings", () => {
    let m = freshMatch()
    m = score(m, "teamA", 24) // сет 6-0
    const patched = applyRemoteCommand(m, "set-rules", { rules: { sets: 1 } })
    expect(patched.settings.sets).toBe(1)
    // 6-0 сет при sets=1 — матч завершается пересчётом
    expect(patched.isCompleted).toBe(true)
    expect(patched.ruleRevision).toBe(1)
    const ev = patched.events.at(-1)
    expect(ev.payload.action).toBe("rule-change")
    expect(ev.payload.after.settings.sets).toBe(1)
  })

  it("rejects unknown rule keys", () => {
    const e = err(() => applyRemoteCommand(freshMatch(), "set-rules", { rules: { hack: 1 } }))
    expect(e.code).toBe("invalid_args")
    expect(e.message).toContain("hack")
  })
})

describe("applyRemoteCommand — toss / assign-court", () => {
  it("commitToss sets server and sides from the decision", () => {
    const m = applyRemoteCommand(freshMatch(), "toss", {
      winner: "teamB",
      choice: "receive",
      teamOnLeft: "teamB",
    })
    expect(m.currentServer.team).toBe("teamA") // выигравший принял — подаёт другой
    expect(m.courtSides).toEqual({ teamA: "right", teamB: "left" })
    expect(m.events.at(-1).type).toBe("toss")
  })

  it("validates toss args", () => {
    expect(err(() => applyRemoteCommand(freshMatch(), "toss", { winner: "teamA", choice: "heads", teamOnLeft: "teamA" })).code).toBe("invalid_args")
  })

  it("assigns and clears the court", () => {
    const m = applyRemoteCommand(freshMatch(), "assign-court", { court: 7 })
    expect(m.courtNumber).toBe(7)
    const cleared = applyRemoteCommand(m, "assign-court", { court: null })
    expect(cleared.courtNumber).toBe(null)
    expect(err(() => applyRemoteCommand(freshMatch(), "assign-court", { court: 0 })).code).toBe("invalid_args")
  })

  it("assign-court с courtId: нечисловые корты (Шаг 2, §246)", () => {
    const courtUuid = "7e4f98c5-7f51-4e7f-80a9-cf89fdfd86d0"
    const m = applyRemoteCommand(freshMatch(), "assign-court", { court: null, courtId: courtUuid })
    expect(m.courtId).toBe(courtUuid)
    expect(m.courtNumber).toBe(null)

    // явный courtId:null отвязывает корт
    const cleared = applyRemoteCommand(m, "assign-court", { court: null, courtId: null })
    expect(cleared.courtId).toBe(null)

    // без поля courtId прежняя привязка сохраняется (совместимость)
    const kept = applyRemoteCommand({ ...freshMatch(), courtId: courtUuid }, "assign-court", { court: 3 })
    expect(kept.courtNumber).toBe(3)
    expect(kept.courtId).toBe(courtUuid)

    // тип courtId валидируется
    expect(err(() => applyRemoteCommand(freshMatch(), "assign-court", { courtId: 42 })).code).toBe("invalid_args")
  })

  it("switch-sides: единый swapCourtSides из движка (Шаг 3, §99)", () => {
    const m = applyRemoteCommand(freshMatch(), "switch-sides")
    expect(m.courtSides).toEqual({ teamA: "right", teamB: "left" })
    // повторный вызов возвращает обратно
    const back = applyRemoteCommand(m, "switch-sides")
    expect(back.courtSides).toEqual({ teamA: "left", teamB: "right" })
    // match остаётся тем же объектом по составу
    expect(m.id).toBe(freshMatch().id)
  })
})

describe("applyRemoteBatch", () => {
  it("applies a sequence atomically over one snapshot", async () => {
    const { applyRemoteBatch } = await import("../lib/remote-commands")
    const m = applyRemoteBatch(freshMatch(), [
      { command: "adjust-set", args: { teamA: 5, teamB: 5 } },
      { command: "adjust-game", args: { teamA: 0, teamB: 0 } },
      { command: "point", args: { team: "teamA" } },
    ])
    expect(m.score.currentSet.teamA).toBe(5)
    expect(m.score.currentSet.currentGame).toEqual({ teamA: 15, teamB: 0 })
  })

  it("aborts the whole batch on a failing command (nothing applied)", async () => {
    const { applyRemoteBatch } = await import("../lib/remote-commands")
    const base = freshMatch()
    const e = err(() =>
      applyRemoteBatch(base, [
        { command: "point", args: { team: "teamA" } },
        { command: "explode" },
      ]),
    )
    expect(e.code).toBe("unknown_command")
    expect(e.message).toContain("batch[1]")
    // вход не тронут — атомарность на уровне вызывающего (ничего не пишем)
    expect(base.score.currentSet.currentGame).toEqual({ teamA: 0, teamB: 0 })
  })
})
