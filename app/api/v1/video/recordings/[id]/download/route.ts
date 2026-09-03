// GET /api/v1/video/recordings/{id}/download — скачать полный матч (plan
// 2026-09-02, Task 6).
//
// v1-права: запись ready; id — непредсказуемый UUID, ссылка отдаётся с
// QR-страницы корта (мягкий гейт, R4 плана — ужесточится с профилями).
// Проксируем playback API gateway'я с Content-Disposition: attachment —
// MediaMTX сам заголовок не ставит, а браузер иначе откроет видео вместо
// скачивания. Скачанное остаётся у игрока навсегда (файл на сервере живёт
// по ретенции тарифа).

import { type NextRequest, NextResponse } from "next/server"
import { getRecording } from "@/lib/video-registry"
import { getAuthUser, getPlayerForUser, hasPlayerParticipants, isRecordingParticipant } from "@/lib/auth"
import { buildFullMatchVodUrl, buildPlaybackWindow } from "@/lib/video-public"
import { logEvent } from "@/lib/error-logger"

function buildFilename(startedAt: string, code: string | null): string {
  const d = new Date(startedAt)
  if (Number.isNaN(d.getTime())) return "padel-match.mp4"
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(
    d.getMinutes(),
  )}`
  return `padel-${code ? `${code}-` : ""}match-${stamp}.mp4`
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const recording = await getRecording(id)
    if (!recording) {
      return NextResponse.json({ error: "recording_not_found" }, { status: 404 })
    }
    if (recording.status !== "ready") {
      return NextResponse.json(
        { error: "not_ready", message: `Запись ещё ${recording.status} — попробуйте позже` },
        { status: 409 },
      )
    }

    // Права (plan Task 7): в записи есть игроки-участники → качает только
    // участник. Гостевые записи (без playerId) остаются доступны по ссылке —
    // QR-флоу корта не требует логина.
    if (hasPlayerParticipants(recording.metadata)) {
      const user = await getAuthUser()
      if (!user) {
        return NextResponse.json(
          { error: "auth_required", message: "Войдите, чтобы скачать свой матч" },
          { status: 401 },
        )
      }
      const player = await getPlayerForUser(user.id)
      if (!player || !isRecordingParticipant(recording.metadata, player.id)) {
        return NextResponse.json(
          { error: "forbidden", message: "Скачивать матч могут только его участники" },
          { status: 403 },
        )
      }
    }

    const streamKey = typeof recording.metadata?.streamKey === "string" ? recording.metadata.streamKey : null
    if (!streamKey) {
      return NextResponse.json({ error: "no_stream_key" }, { status: 409 })
    }

    // Окно в домене часов gateway (mediaStartedAt/mediaEndedAt), фолбэк —
    // таймстампы приложения; от 404 (start раньше первого сегмента) страхуют
    // две дополнительные попытки с меньшим lead
    const buildUrl = (leadTrimSec: number) => {
      const win = buildPlaybackWindow({
        startedAt: recording.startedAt,
        endedAt: recording.endedAt,
        mediaStartedAt: typeof recording.metadata?.mediaStartedAt === "string" ? recording.metadata.mediaStartedAt : null,
        mediaEndedAt: typeof recording.metadata?.mediaEndedAt === "string" ? recording.metadata.mediaEndedAt : null,
      })
      const startMs = Date.parse(win.start) + leadTrimSec * 1000
      return buildFullMatchVodUrl({
        streamKey,
        startedAt: new Date(startMs).toISOString(),
        durationSec: Math.max(1, win.durationSec - leadTrimSec),
      })
    }

    let upstream = await fetch(buildUrl(0), { cache: "no-store" })
    if (upstream.status === 404) upstream = await fetch(buildUrl(1), { cache: "no-store" })
    if (upstream.status === 404) upstream = await fetch(buildUrl(2), { cache: "no-store" })
    if (!upstream.ok || !upstream.body) {
      logEvent("warn", `download: playback ${upstream.status} для ${id.slice(0, 8)}`, "video-download")
      return NextResponse.json(
        { error: "playback_failed", message: `Gateway playback вернул ${upstream.status}` },
        { status: 502 },
      )
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${buildFilename(recording.startedAt, streamKey)}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    logEvent("error", `download: ${(err as Error).message}`, "video-download", err)
    return NextResponse.json({ error: "download_failed", message: (err as Error).message }, { status: 500 })
  }
}
