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
//
// Фикс 2026-09-04 («Завершить» не доезжал до сервера): успешный ACK команды
// и 409-снапшот докладывают ревизию в sync-запись (noteCommandApplied) —
// иначе baseline отстаёт после каждой команды и снапшоты вечно фризятся
// в server_ahead-конфликте.
//
// Фикс 2026-09-04 №2 (потерянные очки при быстрых кликах): две команды
// впритык гонятся на сервере — обе читают снапшот с одной ревизией,
// выигрывает одна, вторая получает 409, и её очко ТЕРЯЛОСЬ (UI откатывался
// на серверный снапшот). Команда при 409 не применена вовсе, поэтому
// безопасно повторить её с ТЕМ ЖЕ operationId: роут применяет её поверх
// свежего серверного состояния (идемпотентность operationId страхует от
// двойного применения, если первый заход всё же успел записаться).

import { v4 as uuidv4 } from "uuid"
import { noteCommandApplied } from "./match-sync"

export type SendCommandResult =
  | { status: "ok"; revision: number }
  | { status: "conflict"; match: any }
  | { status: "failed"; error: string }

/** Попыток на команду: 1 основная + 2 повтора при 409/сети/5xx (гонки и транзиенты). */
const MAX_CONFLICT_ATTEMPTS = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
  for (let attempt = 1; ; attempt++) {
    let result: SendCommandResult | null = null
    let retryable = false
    try {
      const res = await fetch(`/api/match/${matchId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, args, operationId, clientId: options.clientId ?? "ui" }),
      })
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}))
        const serverMatch = data.match ?? null
        noteCommandApplied(matchId, serverMatch?.revision, serverMatch)
        result = { status: "conflict", match: serverMatch }
        retryable = true // команда НЕ применена — повторяем поверх свежего состояния
      } else if (res.status >= 500) {
        // 5xx — транзиентно (cold start, прокси): очко не должно теряться.
        result = { status: "failed", error: `http_${res.status}` }
        retryable = true
      } else if (!res.ok) {
        // 400/401/404 — постоянные (match_completed, инвалидные аргументы):
        // ретрай бессмыслен и опасен (повторно завершать/менять нельзя).
        return { status: "failed", error: `http_${res.status}` }
      } else {
        const data = await res.json().catch(() => ({}))
        const revision = typeof data.revision === "number" ? data.revision : 0
        noteCommandApplied(matchId, revision)
        return { status: "ok", revision }
      }
    } catch {
      // Сеть — транзиентно: повторяем (офлайн-клик не должен теряться).
      result = { status: "failed", error: "network" }
      retryable = true
    }

    if (!retryable || attempt >= MAX_CONFLICT_ATTEMPTS) return result as SendCommandResult
    await sleep(80 * attempt)
  }
}
