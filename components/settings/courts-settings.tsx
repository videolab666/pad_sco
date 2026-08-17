"use client"

// Вкладка «Корты» (Шаг 1, plan-4 §246/§247): создание, переименование,
// архивация. short_code показывается рядом с вечной ссылкой /c/{code} —
// он immutable, QR на корте не устаревает.
//
// Управление идёт через /api/courts (settings-auth). Русские строки
// соответствуют соглашению страницы /settings (админ-UI без i18n).

import { useCallback, useEffect, useState } from "react"
import { Archive, ArchiveRestore, Check, Copy, Loader2, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface CourtRow {
  id: string
  name: string
  slug: string
  shortCode: string
  legacyNumber: number | null
  sortOrder: number
  status: "active" | "archived" | "maintenance"
}

export function CourtsSettings() {
  const [courts, setCourts] = useState<CourtRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [newName, setNewName] = useState("")
  const [newSlug, setNewSlug] = useState("")
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [draftNames, setDraftNames] = useState<Record<string, string>>({})
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(
    async (archived: boolean) => {
      setLoading(true)
      setError("")
      try {
        const res = await fetch(`/api/courts${archived ? "?archived=true" : ""}`, { cache: "no-store" })
        if (res.status === 401) {
          setError("Нет доступа — войдите заново")
          return
        }
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error === "schema_not_ready" ? "Таблицы кортов недоступны (проверьте миграцию)" : "Ошибка загрузки")
          return
        }
        setCourts(data.courts ?? [])
      } catch {
        setError("Ошибка сети")
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void load(showArchived)
  }, [load, showArchived])

  const create = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    setError("")
    try {
      const res = await fetch("/api/courts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), slug: newSlug.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError((data?.errors ?? [data?.error ?? "Не удалось создать корт"]).join("; "))
        return
      }
      setNewName("")
      setNewSlug("")
      await load(showArchived)
    } catch {
      setError("Ошибка сети")
    } finally {
      setCreating(false)
    }
  }

  const rename = async (court: CourtRow) => {
    const name = (draftNames[court.id] ?? "").trim()
    if (!name || name === court.name) return
    setBusyId(court.id)
    try {
      const res = await fetch(`/api/courts/${court.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError((data?.errors ?? [data?.error ?? "Не удалось переименовать"]).join("; "))
        return
      }
      setDraftNames((prev) => {
        const next = { ...prev }
        delete next[court.id]
        return next
      })
      // short_code не меняется — ссылки и QR живы (§246)
      await load(showArchived)
    } finally {
      setBusyId(null)
    }
  }

  const setStatus = async (court: CourtRow, status: "active" | "archived") => {
    setBusyId(court.id)
    try {
      const res = await fetch(`/api/courts/${court.id}`, {
        method: status === "archived" ? "DELETE" : "PATCH",
        headers: status === "archived" ? undefined : { "Content-Type": "application/json" },
        body: status === "archived" ? undefined : JSON.stringify({ status: "active" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? "Не удалось изменить статус")
        return
      }
      await load(showArchived)
    } finally {
      setBusyId(null)
    }
  }

  const copyLink = async (court: CourtRow) => {
    const url = `${window.location.origin}/c/${court.shortCode}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(court.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      setError(url)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Корты клуба</CardTitle>
        <CardDescription>
          Корт — сущность с любым названием. Ссылка /c/&#123;код&#125; постоянная: печатайте её в QR —
          переименование корта её не меняет.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-56">
            <Input
              placeholder="Название (напр. Центральный)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void create()}
            />
          </div>
          <div className="w-44">
            <Input
              placeholder="slug (необязательно)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void create()}
            />
          </div>
          <Button onClick={() => void create()} disabled={!newName.trim() || creating}>
            {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Добавить
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Скрыть архив" : "Показать архив"}
          </Button>
        </div>

        {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {courts.length === 0 && <div className="p-4 text-sm text-muted-foreground">Кортов пока нет</div>}
            {courts.map((court) => {
              const draft = draftNames[court.id] ?? court.name
              return (
                <div key={court.id} className="flex flex-wrap items-center gap-2 p-3">
                  <div className="flex min-w-48 flex-1 items-center gap-2">
                    <Input
                      value={draft}
                      onChange={(e) => setDraftNames((prev) => ({ ...prev, [court.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && void rename(court)}
                      className="h-8"
                    />
                    {draft !== court.name && (
                      <Button size="sm" className="h-8" disabled={busyId === court.id} onClick={() => void rename(court)}>
                        {busyId === court.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">/{court.slug}</div>
                  <button
                    type="button"
                    onClick={() => void copyLink(court)}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs hover:bg-accent"
                    title="Скопировать вечную ссылку"
                  >
                    /c/{court.shortCode}
                    {copiedId === court.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                  {court.legacyNumber !== null && (
                    <Badge variant="outline" className="text-xs">
                      №{court.legacyNumber}
                    </Badge>
                  )}
                  {court.status === "archived" ? (
                    <Badge variant="secondary">архив</Badge>
                  ) : court.status === "maintenance" ? (
                    <Badge variant="outline">сервис</Badge>
                  ) : null}
                  {court.status === "archived" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === court.id}
                      onClick={() => void setStatus(court, "active")}
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === court.id}
                      onClick={() => void setStatus(court, "archived")}
                      title="Архивировать (soft delete)"
                    >
                      {busyId === court.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
