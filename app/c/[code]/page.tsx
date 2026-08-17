// /c/{short_code} — вечная ссылка на табло корта (plan-4 §247).
//
// QR на корте и vMix/OBS browser sources указывают сюда: код глобально
// уникален, поэтому корты разных клубов не конфликтуют (superadmin может
// транслировать их одновременно). Переименование корта и смена slug ссылку
// не ломают — short_code immutable.
//
// Реализация: сервер резолвит код → корт; для кортов с legacy_number
// рендерится тот же клиентский компонент, что и на legacy-странице
// /fullscreen-scoreboard/[number] (один код-путь отображения).

import { notFound } from "next/navigation"
import FullscreenScoreboard from "../../fullscreen-scoreboard/[number]/page"
import { ensureCourtSchema, getCourtByShortCode } from "@/lib/court-registry"
import { logEvent } from "@/lib/error-logger"

export const dynamic = "force-dynamic"

export default async function CourtByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const ready = await ensureCourtSchema()
  const court = ready ? await getCourtByShortCode(code).catch((err) => {
    logEvent("error", `/c/${code}: ошибка резолва корта: ${(err as Error).message}`, "court-code-page", err)
    return null
  }) : null

  if (!court) notFound()

  if (court.legacyNumber !== null) {
    // Существующий корт 1..10 — полное табло (params как Promise, компонент
    // сам резолвит его через React.use).
    return (
      <FullscreenScoreboard params={Promise.resolve({ number: String(court.legacyNumber) })} />
    )
  }

  // Новый нечисловой корт: привязка матча появится в Шаге 2 (court_id в
  // matches + court_sessions). Пока — информация о корте.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0f0a] p-8 text-white">
      <div className="text-sm uppercase tracking-widest text-white/50">Court</div>
      <h1 className="text-5xl font-black">{court.name}</h1>
      <p className="max-w-md text-center text-white/60">
        Табло этого корта активируется после привязки матча (Шаг 2: Court Session).
        Ссылка /c/{court.shortCode} постоянная — QR обновлять не нужно.
      </p>
      <div className="rounded-lg border border-white/10 px-4 py-2 font-mono text-sm text-white/40">
        /c/{court.shortCode}
      </div>
    </main>
  )
}
