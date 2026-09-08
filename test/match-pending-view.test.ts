import { describe, expect, it } from "vitest"
import { projectPendingCommands } from "../lib/match-pending-view"
import { applyRemoteCommand } from "../lib/remote-commands"
import { recordAppliedOperationId } from "../lib/match-operation-id"

const match = () => ({
  id: "pending-view", revision: 8, type: "padel", format: "doubles", isCompleted: false,
  settings: { sets: 3, gamesPerSet: 6, scoringSystem: "classic" },
  teamA: { players: [] }, teamB: { players: [] },
  currentServer: { team: "teamA", playerIndex: 0 }, courtSides: { teamA: "left", teamB: "right" },
  score: { teamA: 0, teamB: 0, sets: [], currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false } },
})
const op = (team: string, id = "09a98b16-cec9-4bd7-8194-9a44edb2e147"): any => ({
  operationId: id, kind: "command", payload: { command: "point", args: { team } },
})

describe("pending command display", () => {
  it("retains the next pending point when the previous point is acknowledged", () => {
    const server = applyRemoteCommand(match(), "point", { team: "teamA" })
    const view = projectPendingCommands(server, [op("teamA")])
    expect(view.score.currentSet.currentGame).toEqual({ teamA: 30, teamB: 0 })
    expect(view.revision).toBe(8)
    expect(server.score.currentSet.currentGame.teamA).toBe(15)
  })
  it("shows another referee's point while a local point is pending", () => {
    const server = applyRemoteCommand(match(), "point", { team: "teamB" })
    expect(projectPendingCommands(server, [op("teamA")]).score.currentSet.currentGame)
      .toEqual({ teamA: 15, teamB: 15 })
  })
  it("does not count a pending operation twice when realtime beats its ACK", () => {
    const pending = op("teamA")
    const server = recordAppliedOperationId(applyRemoteCommand(match(), "point", { team: "teamA" }), pending.operationId)
    expect(projectPendingCommands(server, [pending]).score.currentSet.currentGame.teamA).toBe(15)
  })
  it("keeps remote completion terminal despite queued points", () => {
    const server = { ...match(), isCompleted: true, winner: "teamA" }
    expect(projectPendingCommands(server, [op("teamB")])).toEqual(server)
  })
})
