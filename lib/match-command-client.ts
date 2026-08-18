// Клиент командного конвейера (Шаг 3, §99): UI отправляет КОМАНДЫ, а не
// снапшоты. Сервер — единственный писатель: применение через тот же чистый
// движок (applyRemoteCommand), идемпотентность operationId, revision-guard,
// журнал match_operations.
//
// Паттерн вызова (см. score-board.tsx / fullscreen):
//   1) локальная оптимистика тем же движком (applyPointWithExtras / undo);
//   2) localStorage-обновление БЕЗ снапшот-пуша (updateMatch(m, {localOnly}));
//   3) sendMatchCommand('point', {team}) — fire-and-forget;
//   4) при 409-конфликте серверный снапшот авторитетен — колбэк onConflict.

import { v4 as uuidv4 } from "uuid"

export type SendCommandResult =
  | { status: "ok"; revision: number }
  | { status: "conflict"; match: any }
  | { status: "failed"; error: string }

/**
 * Отправка одной команды матча. operationId уникален на вызов — повтор
 * (retry) должен использовать тот же id, поэтому принимаем его опционально.
 */
export async function sendMatchCommand(
  matchId: string,
  command: string,
  args: Record<string, unknown> = {},
  options: { operationId?: string; clientId?: string } = {},
): Promise<SendCommandResult> {
  const operationId = options.operationId ?? uuidv4()
  try {
    const res = await fetch(`/api/match/${matchId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, args, operationId, clientId: options.clientId ?? "ui" }),
    })
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}))
      return { status: "conflict", match: data.match ?? null }
    }
    if (!res.ok) {
      return { status: "failed", error: `http_${res.status}` }
    }
    const data = await res.json().catch(() => ({}))
    return { status: "ok", revision: typeof data.revision === "number" ? data.revision : 0 }
  } catch {
    return { status: "failed", error: "network" }
  }
}
