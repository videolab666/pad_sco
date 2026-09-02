"use client"

// Вкладка «Брендинг» в /settings (plan-4 §56, §106): имя клуба, цвета, лого.
// Живое превью показывает, как будет выглядеть шапка табло.

import { useEffect, useState } from "react"
import { Check, Loader2, Palette, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DEFAULT_BRAND, type BrandProfile } from "@/lib/white-label"

const COLOR_FIELDS: Array<{ key: keyof BrandProfile; label: string; hint: string }> = [
  { key: "primaryColor", label: "Основной", hint: "шапка, кнопки" },
  { key: "secondaryColor", label: "Второстепенный", hint: "градиенты, акценты" },
  { key: "accentColor", label: "Акцент", hint: "счёт, победитель" },
  { key: "bgColor", label: "Фон", hint: "фон табло" },
  { key: "textColor", label: "Текст", hint: "текст на табло" },
]

export function BrandSettings() {
  const [brand, setBrand] = useState<BrandProfile>(DEFAULT_BRAND)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/settings/brand", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d?.brand && setBrand(d.brand))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch("/api/settings/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brand),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error === "invalid_json" ? "Некорректные данные" : "Проверьте поля (цвета — #RRGGBB)")
      }
    } catch {
      setError("Ошибка сети")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Брендинг клуба</h2>
        <p className="text-sm text-muted-foreground mt-1">
          White Label: имя, цвета и логотип применяются к табло и страницам клуба
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── Форма ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Профиль бренда
            </CardTitle>
            <CardDescription>Цвета в формате #RRGGBB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="club-name">Название клуба</Label>
              <Input
                id="club-name"
                value={brand.clubName}
                maxLength={100}
                onChange={(e) => setBrand({ ...brand, clubName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo-url">URL логотипа (необязательно)</Label>
              <Input
                id="logo-url"
                type="url"
                placeholder="https://example.com/logo.png"
                value={brand.logoUrl ?? ""}
                onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value || undefined })}
              />
            </div>

            <div className="space-y-3">
              <Label>Цвета</Label>
              {COLOR_FIELDS.map(({ key, label, hint }) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label={label}
                    value={brand[key] as string}
                    onChange={(e) => setBrand({ ...brand, [key]: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{hint}</div>
                  </div>
                  <Input
                    className="w-28 font-mono text-xs"
                    value={brand[key] as string}
                    onChange={(e) => setBrand({ ...brand, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Именование кортов</Label>
              <Select
                value={brand.courtNaming}
                onValueChange={(v) => setBrand({ ...brand, courtNaming: v as BrandProfile["courtNaming"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numbered">Корт 1, Корт 2…</SelectItem>
                  <SelectItem value="named">Свои имена кортов</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button onClick={save} disabled={saving || !brand.clubName.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : saved ? <Check className="mr-2 h-4 w-4 text-green-500" /> : null}
                {saved ? "Сохранено" : "Сохранить"}
              </Button>
              <Button variant="outline" onClick={() => setBrand(DEFAULT_BRAND)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Сбросить
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ─── Живое превью ─── */}
        <Card>
          <CardHeader>
            <CardTitle>Живое превью</CardTitle>
            <CardDescription>Так будет выглядеть шапка табло</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="overflow-hidden rounded-xl shadow-lg"
              style={{ background: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.secondaryColor})` }}
            >
              <div className="flex items-center gap-3 px-5 py-4" style={{ color: brand.textColor }}>
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt="" className="h-10 w-10 rounded-lg bg-white/20 object-cover" />
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-black"
                    style={{ background: `${brand.accentColor}33`, color: brand.accentColor }}
                  >
                    {brand.clubName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-lg font-black leading-tight">{brand.clubName || "Название клуба"}</div>
                  <div className="text-xs opacity-70">
                    {brand.courtNaming === "numbered" ? "Корт 1" : "Центральный корт"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-px" style={{ background: brand.bgColor }}>
                <PreviewCell label="СЕТЫ" a="1" b="2" brand={brand} />
                <PreviewCell label="ГЕЙМЫ" a="4" b="3" brand={brand} />
                <PreviewCell label="ОЧКИ" a="40" b="30" brand={brand} strong />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Бренд применяется через CSS-переменные (--brand-primary, --brand-name, …) ко всем страницам.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PreviewCell({ label, a, b, brand, strong }: {
  label: string; a: string; b: string; brand: BrandProfile; strong?: boolean
}) {
  return (
    <div className="px-4 py-3 text-center" style={{ background: brand.bgColor, color: brand.textColor }}>
      <div className="text-[10px] uppercase tracking-widest opacity-50">{label}</div>
      <div className="mt-1 flex items-center justify-center gap-3 font-mono text-xl font-black">
        <span style={strong ? { color: brand.accentColor } : undefined}>{a}</span>
        <span className="opacity-30">:</span>
        <span>{b}</span>
      </div>
    </div>
  )
}
