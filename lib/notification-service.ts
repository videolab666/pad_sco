// Notification Service (plan-4 §43) — Telegram-бот для персонала.
//
// Adapter pattern (§52): NotificationService → TelegramAdapter → Bot API.
// Каналы добавляются позже (email, push) через тот же интерфейс.
//
// ENV: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (в .env.local или Vercel)

import { logEvent } from "./error-logger"

export type NotificationEvent =
  | "device_offline"
  | "device_online"
  | "match_started"
  | "match_completed"
  | "camera_recording_started"
  | "camera_recording_stopped"
  | "camera_error"
  | "americano_started"
  | "americano_completed"
  | "session_auto_closed"
  | "low_storage"

export interface NotificationPayload {
  event: NotificationEvent
  title: string
  message: string
  severity?: "info" | "warning" | "critical"
  metadata?: Record<string, unknown>
}

/**
 * Отправка уведомления через Telegram Bot API.
 * Fire-and-forget: ошибки логируются, но не бросаются.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  // Если не настроено — тихо пропускаем
  if (!token || !chatId) {
    logEvent("debug", `notification: TELEGRAM не настроен, пропущено [${payload.event}]`, "notify")
    return
  }

  const icon = payload.severity === "critical" ? "🔴"
    : payload.severity === "warning" ? "🟡"
    : "🟢"

  const text = [
    `${icon} *${escapeMarkdown(payload.title)}*`,
    "",
    escapeMarkdown(payload.message),
    payload.metadata?.court ? `\n🏟 Корт: ${payload.metadata.court}` : "",
    payload.metadata?.device ? `\n📹 ${payload.metadata.device}` : "",
  ].filter(Boolean).join("\n")

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      logEvent("warn", `notification: Telegram ${res.status}: ${body}`, "notify")
    }
  } catch (err) {
    logEvent("warn", `notification: Telegram недоступен: ${(err as Error).message}`, "notify")
  }
}

/**
 * Уведомление о смене статуса устройства (§43: «device offline — только staff»).
 */
export async function notifyDeviceStatusChange(
  device: string,
  court: string,
  online: boolean,
): Promise<void> {
  void sendNotification({
    event: online ? "device_online" : "device_offline",
    title: online ? "Устройство подключено" : "⚠️ Устройство офлайн",
    message: online
      ? `${device} на корте «${court}» снова в сети`
      : `${device} на корте «${court}» потеряло соединение`,
    severity: online ? "info" : "warning",
    metadata: { device, court },
  })
}

/**
 * Уведомление о матче (§43: «match result»).
 */
export async function notifyMatchEvent(
  event: "match_started" | "match_completed",
  court: string,
  teams: string,
  score?: string,
): Promise<void> {
  void sendNotification({
    event,
    title: event === "match_started" ? "Матч начался" : "Матч завершён",
    message: event === "match_started"
      ? `${teams} · ${court}`
      : `${teams}\nСчёт: ${score ?? "—"}`,
    severity: "info",
    metadata: { court },
  })
}

/**
 * Уведомление об авто-закрытии сессии (§23).
 */
export async function notifyAutoClose(
  type: "recording" | "session",
  court: string,
  ageMinutes: number,
): Promise<void> {
  void sendNotification({
    event: "session_auto_closed",
    title: "Сессия автоматически закрыта",
    message: `${type === "recording" ? "Запись" : "Сессия корта"} на «${court}» висела ${ageMinutes} мин и была закрыта автоматически`,
    severity: "warning",
    metadata: { court },
  })
}

function escapeMarkdown(s: string): string {
  return s.replace(/[*_`\[\]]/g, "\\$&")
}
