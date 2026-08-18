// Публичные URL видео (plan-4 §146): live-HLS на gateway и VOD полного
// матча через playback API MediaMTX. Чистые билдеры — покрыты тестами.
//
// Базы URL приходят из env (машина зрителя должна видеть gateway):
//   GATEWAY_PUBLIC_URL  (по умолчанию http://localhost:8888)  — HLS
//   PLAYBACK_PUBLIC_URL (по умолчанию http://localhost:9996)  — VOD

export function gatewayBase(): string {
  return (process.env.GATEWAY_PUBLIC_URL ?? "http://localhost:8888").replace(/\/+$/, "")
}

export function playbackBase(): string {
  return (process.env.PLAYBACK_PUBLIC_URL ?? "http://localhost:9996").replace(/\/+$/, "")
}

/** Живой поток корта: LL-HLS плейлист на gateway. */
export function buildLiveHlsUrl(streamKey: string, base = gatewayBase()): string {
  return `${base.replace(/\/+$/, "")}/${streamKey}/index.m3u8`
}

/**
 * VOD полного матча через playback API (§146): диапазон от старта записи.
 * MediaMTX сам склеивает fMP4-сегменты за запрошенный период.
 */
export function buildFullMatchVodUrl(input: {
  streamKey: string
  startedAt: string
  durationSec: number
  base?: string
}): string {
  const base = (input.base ?? playbackBase()).replace(/\/+$/, "")
  const duration = Math.max(1, Math.round(input.durationSec))
  return `${base}/get?path=${encodeURIComponent(input.streamKey)}&start=${encodeURIComponent(
    input.startedAt,
  )}&duration=${duration}`
}

/** Публичный файл клипа/миниатюры (роут собирает путь сам). */
export function buildClipFileUrl(clipId: string, thumb = false, base = ""): string {
  const prefix = base ? base.replace(/\/+$/, "") : ""
  return `${prefix}/api/v1/video/clips/${clipId}/file${thumb ? "?variant=thumb" : ""}`
}
