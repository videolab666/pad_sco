"use client"

// Общие настройки клуба (пока единственная вкладка — «Настройка рекламы»,
// остальные появятся позже). Вход — тот же пароль, что и на главной
// (SETTINGS_PASSWORD, обязателен в .env.local), но проверяется уже на сервере:
// успешный логин выдаёт httpOnly-cookie на 30 дней.

import { useEffect, useState } from "react"
import { Loader2, Lock, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdsSettings } from "@/components/settings/ads-settings"

export default function SettingsPage() {
  const [authState, setAuthState] = useState<"checking" | "login" | "ok">("checking")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/settings/login", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAuthState(d.authenticated ? "ok" : "login"))
      .catch(() => setAuthState("login"))
  }, [])

  const login = async () => {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/settings/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setAuthState("ok")
        setPassword("")
      } else {
        setError("Неверный пароль")
      }
    } catch {
      setError("Ошибка сети")
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    await fetch("/api/settings/login", { method: "DELETE" }).catch(() => {})
    setAuthState("login")
  }

  if (authState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (authState === "login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <CardTitle>Общие настройки</CardTitle>
            <CardDescription>Введите пароль администратора</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                login()
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || !password}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Войти
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Общие настройки</h1>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </Button>
      </div>

      <Tabs defaultValue="ads">
        <TabsList>
          <TabsTrigger value="ads">Настройка рекламы</TabsTrigger>
        </TabsList>
        <TabsContent value="ads" className="mt-4">
          <AdsSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
