import { applyRemoteCommand, stableOperationUuid } from "./remote-commands"
import { hasAppliedOperationId } from "./match-operation-id"
import type { MatchOperation } from "./types"

/** Display server truth plus this client's remaining intent, never a stale snapshot. */
export function projectPendingCommands(server: any, queue: MatchOperation[]): any {
  if (!server) return server
  let view = server
  for (const op of queue) {
    if (op.kind !== "command" || hasAppliedOperationId(server, stableOperationUuid(op.operationId))) continue
    try {
      view = applyRemoteCommand(view, op.payload.command, op.payload.args ?? {})
    } catch {
      // The server will reject invalid intent and provide an explicit error.
      // Never show a phantom point after another referee completed the match.
    }
  }
  return { ...view, revision: server.revision }
}
