"use client"

// Вкладка «Настройка рекламы»: медиатека с квотой, плейлисты с «виртуальным
// дубликатом», триггеры показа/остановки (с пресетами и переопределениями по
// кортам) и ручное управление показом на каждом корту.
//
// Загрузка файлов идёт напрямую в Supabase Storage по presigned-URL
// (POST /api/media/upload-url → PUT → POST /api/media/confirm), поэтому
// большие видео не проходят через тело Next.js-функции.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, Loader2, Plus, Star, Trash2, Upload, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_MEDIA_TRIGGERS,
  TRIGGER_PRESETS,
  normalizeBumper,
  type BumperConfig,
  type MediaItem,
  type MediaTriggers,
} from "@/lib/media-core"

// ─── Wire types ──────────────────────────────────────────────────────────────

type ItemWire = MediaItem & { url: string }

interface PlaylistWire {
  id: string
  name: string
  isDefault: boolean
  bumper: BumperConfig
  items: { itemId: string; position: number; durationSec: number | null }[]
}

interface CourtWire {
  court: number
  isPlaying: boolean
  source: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtBytes = (b: number) => {
  if (!Number.isFinite(b)) return "—"
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} ГБ`
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} МБ`
  if (b >= 1024) return `${(b / 1024).toFixed(0)} КБ`
  return `${b} Б`
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "вручную",
  remote: "команда",
  idle: "простой",
  completed: "матч завершён",
  "no-match": "нет матча",
}

/** Client-side metadata probe (duration / dimensions) before upload. */
function probeMedia(file: File): Promise<{ durationSec: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const done = (r: { durationSec: number | null; width: number | null; height: number | null }) => {
      URL.revokeObjectURL(url)
      resolve(r)
    }
    if (file.type.startsWith("image/")) {
      const img = new Image()
      img.onload = () => done({ durationSec: null, width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => done({ durationSec: null, width: null, height: null })
      img.src = url
    } else if (file.type.startsWith("video/")) {
      const v = document.createElement("video")
      v.preload = "metadata"
      v.onloadedmetadata = () => done({ durationSec: Math.round(v.duration) || null, width: v.videoWidth || null, height: v.videoHeight || null })
      v.onerror = () => done({ durationSec: null, width: null, height: null })
      v.src = url
    } else {
      done({ durationSec: null, width: null, height: null })
    }
  })
}

/** PUT with upload progress (fetch has none; videos are hundreds of MB). */
function putWithProgress(url: string, file: File, onProgress: (frac: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)))
    xhr.onerror = () => reject(new Error("Сеть недоступна"))
    xhr.send(file)
  })
}

const jsonFetch = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { body })
  return body
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdsSettings() {
  const [items, setItems] = useState<ItemWire[]>([])
  const [playlists, setPlaylists] = useState<PlaylistWire[]>([])
  const [quota, setQuota] = useState<{ usedBytes: number; limitBytes: number }>({ usedBytes: 0, limitBytes: 0 })
  const [triggers, setTriggers] = useState<MediaTriggers>(DEFAULT_MEDIA_TRIGGERS)
  const [courts, setCourts] = useState<CourtWire[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const load = useCallback(async () => {
    try {
      const [library, states] = await Promise.all([
        jsonFetch("/api/media/library", { cache: "no-store" }),
        jsonFetch("/api/media/state", { cache: "no-store" }),
      ])
      setItems(library.items ?? [])
      setPlaylists(library.playlists ?? [])
      setQuota(library.quota ?? { usedBytes: 0, limitBytes: 0 })
      setTriggers(library.triggers ?? DEFAULT_MEDIA_TRIGGERS)
      setCourts(states.courts ?? [])
      setLoadError("")
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Ошибка загрузки")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="mb-2 text-destructive">{loadError}</p>
          <p className="mb-4 text-sm text-muted-foreground">Проверьте, что база данных доступна (миграция 20260816_media).</p>
          <Button variant="outline" onClick={load}>
            Повторить
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <MediaLibrary items={items} quota={quota} onChanged={load} />
      <PlaylistEditor playlists={playlists} items={items} onChanged={load} />
      <TriggersForm triggers={triggers} onChanged={load} />
      <CourtsControl courts={courts} onChanged={load} />
    </div>
  )
}

// ─── Медиатека ───────────────────────────────────────────────────────────────

function MediaLibrary({
  items,
  quota,
  onChanged,
}: {
  items: ItemWire[]
  quota: { usedBytes: number; limitBytes: number }
  onChanged: () => void
}) {
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadOne = async (file: File) => {
    setError("")
    setUploading({ name: file.name, progress: 0 })
    try {
      const probe = await probeMedia(file)
      const signed = await jsonFetch("/api/media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, sizeBytes: file.size, mime: file.type }),
      })
      await putWithProgress(signed.url, file, (p) => setUploading({ name: file.name, progress: p }))
      await jsonFetch("/api/media/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: signed.path,
          title: file.name.replace(/\.[^.]+$/, ""),
          sizeBytes: file.size,
          mime: file.type,
          ...probe,
        }),
      })
      onChanged()
    } catch (e) {
      const code = e instanceof Error ? e.message : ""
      const human =
        code === "quota_exceeded"
          ? "Квота хранилища исчерпана — увеличьте лимит или удалите часть файлов"
          : code === "file_too_large"
            ? "Файл больше 500 МБ"
            : code === "unsupported_mime"
              ? "Поддерживаются только фото и видео"
              : `Загрузка не удалась: ${code}`
      setError(human)
    } finally {
      setUploading(null)
    }
  }

  const onFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files)
      .filter((f) => /^(image|video)\//.test(f.type))
      .reduce(async (prev, file) => {
        await prev
        await uploadOne(file)
      }, Promise.resolve())
  }

  const patchItem = async (id: string, patch: Record<string, unknown>) => {
    setBusyId(id)
    try {
      await jsonFetch(`/api/media/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusyId(null)
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Удалить файл из медиатеки? Он пропадёт из всех плейлистов.")) return
    setBusyId(id)
    try {
      await jsonFetch(`/api/media/items/${id}`, { method: "DELETE" })
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusyId(null)
    }
  }

  const usedPct = quota.limitBytes > 0 ? Math.min(100, (quota.usedBytes / quota.limitBytes) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Медиатека</CardTitle>
        <CardDescription>Фото и видео для показа на табло. Загружается сразу на все устройства клуба.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span>
              Хранилище: {fmtBytes(quota.usedBytes)}
              {quota.limitBytes > 0 ? ` из ${fmtBytes(quota.limitBytes)}` : " (без лимита)"}
            </span>
          </div>
          {quota.limitBytes > 0 && <Progress value={usedPct} />}
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              onFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!!uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {uploading ? `Загрузка: ${uploading.name} (${Math.round(uploading.progress * 100)}%)` : "Загрузить файлы"}
          </Button>
          {uploading && <Progress className="mt-2" value={uploading.progress * 100} />}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => {
              const vertical = !!item.width && !!item.height && item.height > item.width
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border p-2">
                  {item.kind === "image" ? (
                    <img src={item.url} alt="" className="h-12 w-16 shrink-0 rounded object-cover" />
                  ) : (
                    <video src={item.url} className="h-12 w-16 shrink-0 rounded object-cover" muted />
                  )}
                  <div className="min-w-0 flex-1">
                    <Input
                      className="h-8"
                      defaultValue={item.title}
                      onBlur={(e) => e.target.value !== item.title && patchItem(item.id, { title: e.target.value })}
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{fmtBytes(item.sizeBytes)}</span>
                      {item.kind === "video" && <span>· {item.durationSec ?? "?"} с</span>}
                      {vertical && <Badge variant="secondary">вертикальное</Badge>}
                      {item.kind === "image" && (
                        <span className="flex items-center gap-1">
                          · <span>показ</span>
                          <Input
                            type="number"
                            min={1}
                            className="h-6 w-16 px-1"
                            defaultValue={item.durationSec ?? 10}
                            onBlur={(e) => {
                              const v = Math.max(1, Math.trunc(Number(e.target.value) || 10))
                              if (v !== item.durationSec) patchItem(item.id, { durationSec: v })
                            }}
                          />
                          <span>с</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={item.isActive} onCheckedChange={(v) => patchItem(item.id, { isActive: v })} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busyId === item.id} onClick={() => deleteItem(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Плейлисты ───────────────────────────────────────────────────────────────

function PlaylistEditor({
  playlists,
  items,
  onChanged,
}: {
  playlists: PlaylistWire[]
  items: ItemWire[]
  onChanged: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(playlists[0]?.id ?? null)
  const selected = useMemo(() => playlists.find((p) => p.id === selectedId) ?? null, [playlists, selectedId])
  const [name, setName] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [bumperEnabled, setBumperEnabled] = useState(false)
  const [bumper, setBumper] = useState<BumperConfig>(normalizeBumper({}))
  const [order, setOrder] = useState<{ itemId: string; durationSec: number | null }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!selected) {
      setName("")
      return
    }
    setName(selected.name)
    setIsDefault(selected.isDefault)
    const b = normalizeBumper(selected.bumper)
    setBumper(b)
    setBumperEnabled(!!b.bumperItemId && (!!b.afterEveryN || !!b.minIntervalSec))
    setOrder(selected.items.map((i) => ({ itemId: i.itemId, durationSec: i.durationSec })))
  }, [selected])

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const inPlaylist = new Set(order.map((o) => o.itemId))
  const available = items.filter((i) => !inPlaylist.has(i.id))

  const createPlaylist = async () => {
    const name_ = prompt("Название плейлиста:")
    if (!name_) return
    setBusy(true)
    try {
      const { playlist } = await jsonFetch("/api/media/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name_ }),
      })
      await onChanged()
      setSelectedId(playlist.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!selected) return
    setBusy(true)
    setError("")
    try {
      await jsonFetch(`/api/media/playlists/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          isDefault,
          bumper: bumperEnabled ? bumper : normalizeBumper({}),
          items: order.map((o, position) => ({ itemId: o.itemId, durationSec: o.durationSec, position })),
        }),
      })
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!selected || !confirm(`Удалить плейлист «${selected.name}»?`)) return
    setBusy(true)
    try {
      await jsonFetch(`/api/media/playlists/${selected.id}`, { method: "DELETE" })
      setSelectedId(null)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  const move = (index: number, delta: number) => {
    setOrder((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Плейлисты</CardTitle>
            <CardDescription>
              Что и в каком порядке крутится на табло. Без плейлистов показывается вся активная медиатека.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={createPlaylist} disabled={busy}>
            <Plus className="mr-1 h-4 w-4" />
            Новый
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedId ?? "none"} onValueChange={(v) => setSelectedId(v === "none" ? null : v)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Выберите плейлист" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— не выбран —</SelectItem>
              {playlists.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.isDefault ? " ★" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {playlists.length === 0 && <span className="text-sm text-muted-foreground">Пока нет ни одного плейлиста</span>}
        </div>

        {selected && (
          <div className="space-y-4 rounded-lg border p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>Название</Label>
                <Input className="w-64" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 pb-1.5">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} id="pl-default" />
                <Label htmlFor="pl-default">Плейлист по умолчанию</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Файлы плейлиста ({order.length})</Label>
              {order.map((entry, index) => {
                const item = byId.get(entry.itemId)
                if (!item) return null
                return (
                  <div key={entry.itemId} className="flex items-center gap-2 rounded-md border p-2">
                    <span className="w-5 text-center text-sm text-muted-foreground">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {item.title} <span className="text-muted-foreground">({item.kind === "video" ? "видео" : "фото"})</span>
                    </span>
                    {item.kind === "image" && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        показ
                        <Input
                          type="number"
                          min={1}
                          className="h-7 w-16 px-1"
                          value={entry.durationSec ?? item.durationSec ?? 10}
                          onChange={(e) => {
                            const v = Math.max(1, Math.trunc(Number(e.target.value) || 1))
                            setOrder((prev) => prev.map((o) => (o.itemId === entry.itemId ? { ...o, durationSec: v } : o)))
                          }}
                        />
                        с
                      </span>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(index, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(index, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setOrder((prev) => prev.filter((o) => o.itemId !== entry.itemId))}
                    >
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )
              })}
              {available.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select
                    onValueChange={(itemId) => {
                      setOrder((prev) => [...prev, { itemId, durationSec: null }])
                    }}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Добавить файл…" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.title} ({i.kind === "video" ? "видео" : "фото"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-md bg-muted/40 p-2">
              <div className="flex items-center gap-2">
                <Switch checked={bumperEnabled} onCheckedChange={setBumperEnabled} id="bumper" />
                <Label htmlFor="bumper">Виртуальный дубликат (заставка клуба)</Label>
              </div>
              {bumperEnabled && (
                <div className="flex flex-wrap items-end gap-3 pl-6">
                  <div className="space-y-1">
                    <Label className="text-xs">Файл заставки</Label>
                    <Select value={bumper.bumperItemId ?? "none"} onValueChange={(v) => setBumper((b) => ({ ...b, bumperItemId: v === "none" ? null : v }))}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Выберите видео" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— нет —</SelectItem>
                        {items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">После каждого N-го файла</Label>
                    <Input
                      type="number"
                      min={0}
                      className="w-24"
                      value={bumper.afterEveryN ?? ""}
                      placeholder="выкл"
                      onChange={(e) => setBumper((b) => ({ ...b, afterEveryN: Math.max(0, Math.trunc(Number(e.target.value))) || null }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Но не чаще, раз в N сек</Label>
                    <Input
                      type="number"
                      min={0}
                      className="w-24"
                      value={bumper.minIntervalSec ?? ""}
                      placeholder="выкл"
                      onChange={(e) => setBumper((b) => ({ ...b, minIntervalSec: Math.max(0, Math.trunc(Number(e.target.value))) || null }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Сохранить плейлист
              </Button>
              <Button variant="outline" onClick={remove} disabled={busy}>
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </Button>
              {error && <span className="text-sm text-destructive">{error}</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Триггеры ────────────────────────────────────────────────────────────────

function TriggerNumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label} {hint && <span className="text-muted-foreground">({hint})</span>}
      </Label>
      <Input type="number" min={0} className="w-28" value={value} onChange={(e) => onChange(Math.max(0, Math.trunc(Number(e.target.value)) || 0))} />
    </div>
  )
}

function TriggersForm({ triggers, onChanged }: { triggers: MediaTriggers; onChanged: () => void }) {
  const [draft, setDraft] = useState<MediaTriggers>(triggers)
  const [perCourtDraft, setPerCourtDraft] = useState<Record<string, Partial<MediaTriggers>>>(triggers.perCourt ?? {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDraft(triggers)
    setPerCourtDraft(triggers.perCourt ?? {})
  }, [triggers])

  const set = (patch: Partial<MediaTriggers>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setSaved(false)
  }

  const save = async () => {
    setBusy(true)
    setError("")
    try {
      await jsonFetch("/api/media/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggers: { ...draft, perCourt: perCourtDraft } }),
      })
      setSaved(true)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  const setCourt = (court: number, patch: Partial<MediaTriggers> | null) => {
    setPerCourtDraft((prev) => {
      const next = { ...prev }
      if (patch === null) {
        delete next[String(court)]
      } else {
        // undefined in a patch means "убрать переопределение поля" → inherit.
        const merged = { ...next[String(court)], ...patch }
        for (const k of Object.keys(merged)) {
          if (merged[k as keyof MediaTriggers] === undefined) delete merged[k as keyof MediaTriggers]
        }
        if (Object.keys(merged).length === 0) delete next[String(court)]
        else next[String(court)] = merged
      }
      return next
    })
    setSaved(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Триггеры показа и остановки</CardTitle>
        <CardDescription>Когда реклама включается сама и что её гасит. Все пороги в минутах; 0 = выключено.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(TRIGGER_PRESETS).map(([key, preset]) => (
            <Button key={key} variant="outline" size="sm" onClick={() => set(preset)}>
              <Star className="mr-1 h-3.5 w-3.5" />
              {key === "afterMatch" ? "После матча" : key === "idleCourt" ? "Простой корта" : "Только вручную"}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-4">
          <TriggerNumberField label="После завершения матча" hint="мин" value={draft.afterCompletedMin} onChange={(v) => set({ afterCompletedMin: v })} />
          <TriggerNumberField label="Без очков в матче" hint="мин" value={draft.noScoreMin} onChange={(v) => set({ noScoreMin: v })} />
          <TriggerNumberField label="Нет матча на корте" hint="мин" value={draft.noMatchMin} onChange={(v) => set({ noMatchMin: v })} />
          <TriggerNumberField label="Пауза после остановки" hint="мин" value={draft.cooldownAfterStopMin} onChange={(v) => set({ cooldownAfterStopMin: v })} />
          <TriggerNumberField label="Максимум сессии" hint="мин" value={draft.maxSessionMin} onChange={(v) => set({ maxSessionMin: v })} />
          <TriggerNumberField label="Лимит циклов" hint="шт" value={draft.loopsLimit} onChange={(v) => set({ loopsLimit: v })} />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(
            [
              ["manualOnly", "Только ручной запуск"],
              ["stopOnAnyScore", "Стоп при любом очке"],
              ["stopOnNewMatch", "Стоп при новом матче"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <Switch id={`tr-${key}`} checked={draft[key] as boolean} onCheckedChange={(v) => set({ [key]: v } as Partial<MediaTriggers>)} />
              <Label htmlFor={`tr-${key}`}>{label}</Label>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <Label className="text-sm font-medium">Переопределения по кортам</Label>
          <p className="text-xs text-muted-foreground">Пустое поле — берётся из общих настроек.</p>
          <div className="grid gap-2 md:grid-cols-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((court) => {
              const override = perCourtDraft[String(court)]
              return (
                <div key={court} className="rounded-md border p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Корт {court}</span>
                    <Switch checked={!!override} onCheckedChange={(v) => setCourt(court, v ? { stopOnAnyScore: true } : null)} />
                  </div>
                  {override && (
                    <div className="mt-2 flex flex-wrap gap-2 pl-1">
                      <div className="space-y-1">
                        <Label className="text-xs">После матча</Label>
                        <Input
                          type="number"
                          min={0}
                          className="w-20"
                          placeholder="—"
                          value={override.afterCompletedMin ?? ""}
                          onChange={(e) =>
                            setCourt(court, { afterCompletedMin: e.target.value === "" ? undefined : Math.max(0, Math.trunc(Number(e.target.value)) || 0) })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Без очков</Label>
                        <Input
                          type="number"
                          min={0}
                          className="w-20"
                          placeholder="—"
                          value={override.noScoreMin ?? ""}
                          onChange={(e) =>
                            setCourt(court, { noScoreMin: e.target.value === "" ? undefined : Math.max(0, Math.trunc(Number(e.target.value)) || 0) })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Нет матча</Label>
                        <Input
                          type="number"
                          min={0}
                          className="w-20"
                          placeholder="—"
                          value={override.noMatchMin ?? ""}
                          onChange={(e) =>
                            setCourt(court, { noMatchMin: e.target.value === "" ? undefined : Math.max(0, Math.trunc(Number(e.target.value)) || 0) })
                          }
                        />
                      </div>
                      <div className="flex items-end gap-2 pb-1.5">
                        <Switch
                          id={`pc-${court}-stop`}
                          checked={override.stopOnAnyScore !== false}
                          onCheckedChange={(v) => setCourt(court, { stopOnAnyScore: v })}
                        />
                        <Label htmlFor={`pc-${court}-stop`} className="text-xs">
                          стоп по очку
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить триггеры
          </Button>
          {saved && <span className="text-sm text-emerald-600">Сохранено ✓</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Управление по кортам ────────────────────────────────────────────────────

function CourtsControl({ courts, onChanged }: { courts: CourtWire[]; onChanged: () => void }) {
  const [busyCourt, setBusyCourt] = useState<number | null>(null)
  const [forcedMin, setForcedMin] = useState("30")

  const act = async (court: number, action: "show" | "hide") => {
    setBusyCourt(court)
    try {
      await jsonFetch("/api/media/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court,
          action,
          source: "manual",
          forcedUntilMin: action === "show" ? Math.max(0, Math.trunc(Number(forcedMin) || 0)) || null : undefined,
        }),
      })
      onChanged()
    } finally {
      setBusyCourt(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Управление по кортам</CardTitle>
            <CardDescription>Ручной показ: «включить на N минут» держит рекламу, дальше действуют обычные правила.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Включить на</Label>
            <Select value={forcedMin} onValueChange={setForcedMin}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">без срока</SelectItem>
                <SelectItem value="15">15 мин</SelectItem>
                <SelectItem value="30">30 мин</SelectItem>
                <SelectItem value="60">60 мин</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
          {courts.map((c) => (
            <div key={c.court} className="flex items-center justify-between gap-2 rounded-lg border p-2">
              <div>
                <div className="text-sm font-medium">Корт {c.court}</div>
                <div className="text-xs text-muted-foreground">
                  {c.isPlaying ? `Реклама · ${SOURCE_LABELS[c.source ?? ""] ?? c.source}` : "Табло"}
                </div>
              </div>
              {c.isPlaying ? (
                <Button variant="outline" size="sm" disabled={busyCourt === c.court} onClick={() => act(c.court, "hide")}>
                  {busyCourt === c.court ? <Loader2 className="h-4 w-4 animate-spin" /> : "Стоп"}
                </Button>
              ) : (
                <Button size="sm" disabled={busyCourt === c.court} onClick={() => act(c.court, "show")}>
                  {busyCourt === c.court ? <Loader2 className="h-4 w-4 animate-spin" /> : "Реклама"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
