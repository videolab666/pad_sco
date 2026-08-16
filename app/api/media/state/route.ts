// GET  /api/media/state?court=N — PUBLIC. Scoreboard screens poll this every
//      ~10s; the server runs the auto-trigger reducer (evaluateMediaState),
//      persists any transition and answers with what the court should play.
//      GET without court → every court 1..MAX_COURT (admin panel; read-only,
//      no evaluation to keep it cheap).
// POST /api/media/state — AUTH (settings cookie or X-API-Key). Manual/remote
//      start/stop:
//        { court, action: "show"|"hide", source?: "manual"|"remote",
//          forcedUntilMin?: number, playlistId?: string }
//      This is the "корт простаивает — включи рекламу" remote command.

import { NextResponse, type NextRequest } from "next/server"
import { isAuthorizedSettingsRequest } from "@/lib/settings-auth"
import { resolveTriggers, applyManualHide, applyManualShow } from "@/lib/media-core"
import {
  entriesToWire,
  evalCourtMediaState,
  getMediaConfig,
  getMediaState,
  mediaSupabase,
  resolveCourtPlaylist,
  saveMediaState,
} from "@/lib/media-server"

const MAX_COURT = 10

export async function GET(request: NextRequest) {
  const courtParam = request.nextUrl.searchParams.get("court")
  const supabase = mediaSupabase()
  const config = await getMediaConfig(supabase)

  try {
    if (courtParam == null) {
      const courts = await Promise.all(
        Array.from({ length: MAX_COURT }, (_, i) => getMediaState(supabase, i + 1)),
      )
      return NextResponse.json({
        courts: courts.map((s) => ({
          court: s.courtNumber,
          isPlaying: s.isPlaying,
          source: s.source,
          startedAt: s.startedAt,
          forcedUntil: s.forcedUntil,
        })),
      })
    }

    const court = Number.parseInt(courtParam, 10)
    if (!Number.isFinite(court) || court < 1 || court > MAX_COURT) {
      return NextResponse.json({ error: "invalid_court" }, { status: 400 })
    }

    const state = await evalCourtMediaState(supabase, court, config.triggers)
    const { playlist, entries } = await resolveCourtPlaylist(supabase, state)

    return NextResponse.json({
      court,
      isPlaying: state.isPlaying,
      source: state.source,
      startedAt: state.startedAt,
      forcedUntil: state.forcedUntil,
      triggers: resolveTriggers(config.triggers, court),
      playlist: playlist ? { id: playlist.id, name: playlist.name, bumper: playlist.bumper } : null,
      entries: state.isPlaying ? entriesToWire(entries) : [],
    })
  } catch (err) {
    return NextResponse.json({ error: "state_failed", message: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedSettingsRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: {
    court?: number
    action?: string
    source?: string
    forcedUntilMin?: number
    playlistId?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const court = Number(body.court)
  if (!Number.isFinite(court) || court < 1 || court > MAX_COURT) {
    return NextResponse.json({ error: "invalid_court" }, { status: 400 })
  }
  const source = body.source === "remote" ? "remote" : "manual"

  const supabase = mediaSupabase()
  const state = await getMediaState(supabase, court)
  const now = Date.now()

  if (body.action === "show") {
    let playlistId: string | null = null
    if (body.playlistId) {
      const { data } = await supabase.from("media_playlists").select("id").eq("id", body.playlistId).maybeSingle()
      if (!data) return NextResponse.json({ error: "playlist_not_found" }, { status: 400 })
      playlistId = String(data.id)
    }
    const next = applyManualShow(state, source, now, body.forcedUntilMin ?? null, playlistId)
    if (!(await saveMediaState(supabase, next))) {
      return NextResponse.json({ error: "write_failed" }, { status: 500 })
    }
    return NextResponse.json({ court, isPlaying: true, source: next.source, forcedUntil: next.forcedUntil })
  }

  if (body.action === "hide") {
    const next = applyManualHide(state, now)
    if (!(await saveMediaState(supabase, next))) {
      return NextResponse.json({ error: "write_failed" }, { status: 500 })
    }
    return NextResponse.json({ court, isPlaying: false })
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 })
}
