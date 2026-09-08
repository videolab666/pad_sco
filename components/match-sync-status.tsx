"use client"

import { useContext, useEffect, useState } from "react"
import { LanguageContext } from "@/contexts/language-context"
import { retrySyncNow, subscribeSyncState } from "@/lib/match-sync"
import type { SyncState } from "@/lib/types"

const labels = {
  ru: { pending: "Ожидают сохранения", failed: "Изменения отклонены сервером. Проверьте актуальный счёт.", retry: "Повторить отправку" },
  uk: { pending: "Очікують збереження", failed: "Зміни відхилено сервером. Перевірте актуальний рахунок.", retry: "Повторити надсилання" },
  en: { pending: "Changes awaiting sync", failed: "Changes were rejected by the server. Check the current score.", retry: "Retry sync" },
}

export function MatchSyncStatus({ matchId }: { matchId: string }) {
  const [state, setState] = useState<SyncState | null>(null)
  const language = useContext(LanguageContext)?.language ?? "ru"
  const text = labels[language as keyof typeof labels] ?? labels.ru
  useEffect(() => subscribeSyncState(matchId, setState), [matchId])
  if (!state || (!state.pendingCount && !state.deadLetterCount)) return null
  return (
    <div role="status" aria-live="polite" className="my-2 rounded border border-amber-500/50 bg-amber-100 px-3 py-2 text-sm text-amber-950">
      {state.pendingCount > 0 && <span>{text.pending}: {state.pendingCount}. </span>}
      {state.deadLetterCount > 0 && <span>{text.failed} </span>}
      {state.pendingCount > 0 && (state.syncStatus === "error" || state.syncStatus === "offline") && (
        <button type="button" className="underline" onClick={() => void retrySyncNow(matchId)}>{text.retry}</button>
      )}
    </div>
  )
}
