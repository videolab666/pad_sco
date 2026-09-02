"use client"

// Вкладка «Интеграции» в /settings: Telegram-бот уведомлений (§43).
// Пользователь вводит bot token + chat ID → отправляем тест → сохраняем.

import { useEffect, useState } from "react"
import { CalendarRange, Check, Loader2, MessageCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function IntegrationsSettings() {
  const [botToken, setBotToken] = useState("")
  const [chatId, setChatId] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null)

  const sendTest = async () => {
    if (!botToken || !chatId) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🟢 *Padel Club Platform*\n\nТестовое уведомление — всё работает!",
          parse_mode: "Markdown",
        }),
      })
      setTestResult(res.ok ? "ok" : "fail")
    } catch {
      setTestResult("fail")
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Интеграции</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Подключите Telegram-бота для уведомлений персоналу
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#229ED9]" />
            Telegram-бот уведомлений
          </CardTitle>
          <CardDescription>
            Получайте алерты: камера офлайн, матч начался, сессия закрыта автоматически
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bot-token">Bot Token</Label>
            <Input
              id="bot-token"
              type="password"
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Получите у @BotFather в Telegram → /newbot
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chat-id">Chat ID</Label>
            <Input
              id="chat-id"
              placeholder="-1001234567890"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              ID группового чата (узнайте у @getidsbot) или личный ID
            </p>
          </div>

          <Button
            onClick={() => void sendTest()}
            disabled={!botToken || !chatId || testing}
            className="w-full"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Отправить тестовое уведомление
          </Button>

          {testResult === "ok" && (
            <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
              <Check className="inline h-4 w-4 mr-1" />
              Тест отправлен! Проверьте Telegram.
            </div>
          )}
          {testResult === "fail" && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              Ошибка — проверьте токен и Chat ID
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-white/70 mb-1">После настройки добавьте в .env.local:</p>
            <pre className="font-mono text-[11px] whitespace-pre-wrap">
{`TELEGRAM_BOT_TOKEN=${botToken ? "***" : "..."}
TELEGRAM_CHAT_ID=${chatId || "..."}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Доступные уведомления */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Типы уведомлений</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            {[
              { icon: "🔴", title: "Камера офлайн", desc: "Устройство потеряло соединение" },
              { icon: "🟢", title: "Матч начался", desc: "Игроки на корте, счёт открыт" },
              { icon: "🏆", title: "Матч завершён", desc: "С результатом и счётом сетов" },
              { icon: "🟡", title: "Авто-закрытие сессии", desc: "Зависшая запись/сессия закрыта" },
              { icon: "📹", title: "Запись началась/остановлена", desc: "Камера на корте" },
            ].map(item => (
              <div key={item.title} className="flex items-center gap-3 rounded-lg border border-white/5 p-2">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <BookingSettings />
    </div>
  )
}

// ─── Playtomic Booking (§13) ─────────────────────────────────────────────────

interface BookingCourt {
  id: string
  name: string
  number: number | null
}

interface SyncResult {
  createdCount: number
  normalizedCount: number
  rawCount: number
  upcoming: Array<{ courtName: string; startsAt: string; players: string[] }>
  skipped: { cancelled: number; unmapped: string[]; past: number; duplicate: number }
  errors: string[]
}

function BookingSettings() {
  const [courts, setCourts] = useState<BookingCourt[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [externalNames, setExternalNames] = useState<string[]>([])
  const [jsonPaste, setJsonPaste] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState("")
  const [lastSync, setLastSync] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/booking", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setCourts(d.courts ?? [])
        setMapping(d.courtMapping ?? {})
        setLastSync(d.lastSync ?? null)
      })
      .catch(() => {})
  }, [])

  const saveMapping = async (next: Record<string, string>) => {
    setMapping(next)
    await fetch("/api/booking", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courtMapping: next }),
    }).catch(() => {})
  }

  const sync = async () => {
    setSyncing(true)
    setSyncError("")
    setResult(null)
    try {
      let body: string | undefined
      if (jsonPaste.trim()) {
        const parsed = JSON.parse(jsonPaste)
        body = JSON.stringify({ rawBookings: Array.isArray(parsed) ? parsed : [parsed] })
      }
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ?? "{}",
      })
      const d = await res.json()
      if (!res.ok) {
        setSyncError(d.error === "no_source"
          ? "Вставьте JSON броней или сохраните токен Playtomic API"
          : d.message || d.error || "Ошибка синхронизации")
      } else {
        setResult(d)
        setLastSync(new Date().toISOString())
        const names = new Set<string>([
          ...(d.upcoming ?? []).map((u: { courtName: string }) => u.courtName),
          ...(d.skipped?.unmapped ?? []),
        ])
        setExternalNames([...names])
      }
    } catch (e) {
      setSyncError(e instanceof SyntaxError ? "Некорректный JSON" : "Ошибка сети")
    } finally {
      setSyncing(false)
    }
  }

  const allExternalNames = [...new Set([...externalNames, ...Object.keys(mapping)])]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-[#FF5A5F]" />
          Бронирования Playtomic
        </CardTitle>
        <CardDescription>
          Синхронизация броней → сессии кортов. Активная бронь становится сессией на дашборде
          {lastSync && ` · последняя синхронизация: ${new Date(lastSync).toLocaleString("ru-RU")}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Маппинг кортов */}
        <div className="space-y-2">
          <Label>Соответствие кортов</Label>
          <p className="text-xs text-muted-foreground">
            Внешнее имя из Playtomic → корт клуба. Совпадение по имени подставляется автоматически.
          </p>
          <div className="flex flex-wrap gap-2">
            {courts.map((c) => (
              <span key={c.id} className="rounded-full border px-3 py-1 text-xs">
                {c.name}
              </span>
            ))}
            {courts.length === 0 && (
              <p className="text-xs text-muted-foreground">Сначала создайте корты во вкладке «Корты»</p>
            )}
          </div>
          {allExternalNames.length > 0 && (
            <div className="space-y-2 mt-2">
              {allExternalNames.map((ext) => (
                <div key={ext} className="flex items-center gap-2">
                  <span className="w-40 truncate text-sm">{ext}</span>
                  <span className="text-muted-foreground">→</span>
                  <select
                    className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                    value={mapping[ext] ?? ""}
                    onChange={(e) => void saveMapping({ ...mapping, [ext]: e.target.value })}
                  >
                    <option value="">— не сопоставлено —</option>
                    {courts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Вставка JSON */}
        <div className="space-y-2">
          <Label htmlFor="booking-json">JSON броней (выгрузка Playtomic)</Label>
          <Textarea
            id="booking-json"
            rows={4}
            placeholder='[{"id":"b1","tennis_court":{"name":"Court 1"},"date":"2026-09-02T18:00:00+0000","duration":90,"players_list":[…]}]'
            className="font-mono text-xs"
            value={jsonPaste}
            onChange={(e) => setJsonPaste(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Вставьте массив броней — синхронизация создаст сессии для идущих сейчас и покажет предстоящие.
            Оставьте пустым, чтобы использовать токен API (если сохранён).
          </p>
        </div>

        <Button onClick={() => void sync()} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarRange className="mr-2 h-4 w-4" />}
          Синхронизировать
        </Button>

        {syncError && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {syncError}
          </div>
        )}

        {result && (
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <div className="font-medium">
              Создано сессий: {result.createdCount}
              {result.normalizedCount < result.rawCount && ` (распознано ${result.normalizedCount} из ${result.rawCount})`}
            </div>
            {result.upcoming.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">Предстоящие брони</div>
                <ul className="mt-1 space-y-1">
                  {result.upcoming.slice(0, 8).map((u, i) => (
                    <li key={i} className="text-xs">
                      {new Date(u.startsAt).toLocaleString("ru-RU")} · {u.courtName}
                      {u.players.length > 0 && ` · ${u.players.join(", ")}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(result.skipped.cancelled > 0 || result.skipped.past > 0 || result.skipped.duplicate > 0 ||
              result.skipped.unmapped.length > 0) && (
              <div className="text-xs text-muted-foreground">
                Пропущено: {result.skipped.cancelled} отменено, {result.skipped.past} прошло,{" "}
                {result.skipped.duplicate} дубликатов
                {result.skipped.unmapped.length > 0 && `, без маппинга: ${result.skipped.unmapped.join(", ")}`}
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="text-xs text-red-600">Ошибки: {result.errors.join("; ")}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
