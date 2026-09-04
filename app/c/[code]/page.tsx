// /c/{short_code} — вечная ссылка на корт (plan-4 §247).
//
// QR на корте и vMix/OBS browser sources указывают сюда: код глобально
// уникален, корты разных клубов не конфликтуют. Переименование корта и
// смена slug ссылку не ломают — short_code immutable.
//
// Три состояния (§15/§16):
//   матч есть + числовой корт   → полный fullscreen-режим с автопереключением
//   матч есть + именованный корт → fullscreen в режиме matchId
//   матча нет                  → idle-экран с кнопкой «Быстрая игра» (QR-флоу)

import { notFound } from "next/navigation"
import FullscreenScoreboard from "../../fullscreen-scoreboard/[number]/page"
import { CourtIdleScreen } from "@/components/quick-play/court-idle-screen"
import { ensureCourtSchema, getCourtByShortCode } from "@/lib/court-registry"
import { getActiveSessionByCourt } from "@/lib/court-session"
import { getMatchFromServerByCourt } from "@/lib/server-match-storage"
import { logEvent } from "@/lib/error-logger"

export const dynamic = "force-dynamic"

export default async function CourtByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const ready = await ensureCourtSchema()
  const court = ready
    ? await getCourtByShortCode(code).catch((err) => {
        logEvent("error", `/c/${code}: ошибка резолва корта: ${(err as Error).message}`, "court-code-page", err)
        return null
      })
    : null

  if (!court) notFound()

  const match = await getMatchFromServerByCourt({
    id: court.id,
    legacyNumber: court.legacyNumber,
  }).catch(() => null)

  // Только АКТИВНЫЙ матч: getMatchFromServerByCourt через fallback возвращает
  // и последний завершённый — после «Завершить» корт обязан уходить в idle
  // (баг-репорт 2026-09-04: завершённый матч оставался на корте).
  if (match?.id && match.isCompleted !== true) {
    if (court.legacyNumber !== null) {
      return <FullscreenScoreboard params={Promise.resolve({ number: String(court.legacyNumber) })} />
    }
    // Нечисловой корт (§246): матч резолвлен по court_id — режим matchId.
    return (
      <FullscreenScoreboard
        key={match.id}
        params={Promise.resolve({ number: "0" })}
        matchId={match.id}
      />
    )
  }

  // Матча нет: idle-экран с Quick Play (сессия, если есть — тренировка и т.п.)
  let session: { type: string; startedAt: string } | null = null
  try {
    const active = await getActiveSessionByCourt(court.id)
    if (active) session = { type: active.type, startedAt: active.startedAt }
  } catch {
    /* sessions-таблиц может не быть — idle-экран покажется без сессии */
  }

  return (
    <CourtIdleScreen
      courtName={court.legacyNumber !== null ? `Корт ${court.name}` : court.name}
      code={court.shortCode}
      session={session}
    />
  )
}
