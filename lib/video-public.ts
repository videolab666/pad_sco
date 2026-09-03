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

/**
 * Окно VOD (plan 2026-09-02): ЕДИНЫЙ ИСТОЧНИК ВРЕМЕНИ — часы gateway
 * (mediaStartedAt/mediaEndedAt из HTTP Date при включении/выключении
 * записи): только они совпадают с доменом имён fMP4-сегментов и
 * интерпретацией start/duration в playback API. Сдвиги часов БД и
 * приложения не влияют. Playback отвечает 404, если start раньше первого
 * сегмента, поэтому небольшой lead вперёд остаётся (spin-up рекордера
 * ~1с; HTTP Date — секундная точность). Фолбэк на started_at/ended_at
 * приложения (lead больше) — для легаси-строк без media-таймстампов.
 */
export const PLAYBACK_LEAD_SEC = 1
export const PLAYBACK_FALLBACK_LEAD_SEC = 4
export const PLAYBACK_PAD_SEC = 6

export interface PlaybackWindowInput {
  startedAt: string
  endedAt?: string | null
  /** Часы gateway (metadata.mediaStartedAt). */
  mediaStartedAt?: string | null
  /** Часы gateway (metadata.mediaEndedAt). */
  mediaEndedAt?: string | null
}

function parseOr(raw: string | null | undefined, fallback: number): number {
  if (!raw) return fallback
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : fallback
}

export function buildPlaybackWindow(input: PlaybackWindowInput): { start: string; durationSec: number } {
  const usesGateway = !!input.mediaStartedAt || !!input.mediaEndedAt
  const leadSec = usesGateway ? PLAYBACK_LEAD_SEC : PLAYBACK_FALLBACK_LEAD_SEC

  const appStartMs = parseOr(input.startedAt, Date.now() - 60_000)
  const appEndMs = input.endedAt ? parseOr(input.endedAt, Date.now()) : Date.now()
  const startMs = parseOr(input.mediaStartedAt, appStartMs)
  const endMs = parseOr(input.mediaEndedAt, appEndMs)

  // lead не должен съесть запись целиком
  const leadMs = Math.min(leadSec * 1000, Math.max(0, endMs - startMs - 500))
  const durationSec = Math.max(1, Math.round((endMs - startMs) / 1000) + PLAYBACK_PAD_SEC)
  return { start: new Date(startMs + leadMs).toISOString(), durationSec }
}

/** VOD полного матча с окном в домене часов gateway (устойчив к сдвигам). */
export function buildPaddedMatchVodUrl(input: PlaybackWindowInput & {
  streamKey: string
  base?: string
}): string {
  const win = buildPlaybackWindow(input)
  return buildFullMatchVodUrl({ streamKey: input.streamKey, startedAt: win.start, durationSec: win.durationSec, base: input.base })
}

/** Публичный файл клипа/миниатюры (роут собирает путь сам). */
export function buildClipFileUrl(clipId: string, thumb = false, base = ""): string {
  const prefix = base ? base.replace(/\/+$/, "") : ""
  return `${prefix}/api/v1/video/clips/${clipId}/file${thumb ? "?variant=thumb" : ""}`
}
