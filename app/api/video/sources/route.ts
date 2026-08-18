// GET /api/video/sources — реестр камер (staff-auth, §130/§152).

import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { listSources } from "@/lib/video-registry"

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedSettingsRequest(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  try {
    const sources = await listSources()
    return NextResponse.json({ sources }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    return NextResponse.json({ error: "list_failed", message: (err as Error).message }, { status: 500 })
  }
}
