// Compatibility batch URL; uses exactly the same CAS/idempotency pipeline as
// individual commands so transport protections cannot drift between endpoints.
import { NextResponse } from "next/server"
import { POST as postCommand } from "../command/route"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  return postCommand(new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({
      operationId: body.operationId,
      clientId: body.clientId,
      command: "batch",
      args: { commands: body.commands },
    }),
  }), context)
}
