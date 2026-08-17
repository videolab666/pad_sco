"use client"

// Вход персонала клуба (plan-4 §4, Шаг 1 slice B): Supabase Auth
// email+password. Учетные записи создаёт админ: scripts/create-admin.mjs.
// После логина — доступ к /settings и управляющим API (членство с ролью).

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const login = async () => {
    setBusy(true)
    setError("")
    try {
      const supabase = createSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError("Неверный email или пароль")
        return
      }
      router.push("/settings")
      router.refresh()
    } catch {
      setError("Ошибка сети")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <CardTitle>Вход для персонала</CardTitle>
          <CardDescription>
            Учётную запись создаёт администратор клуба (scripts/create-admin.mjs)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void login()}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void login()}
            />
          </div>
          {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Button className="w-full" onClick={() => void login()} disabled={busy || !email || !password}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Войти
          </Button>
          <div className="text-center text-xs text-muted-foreground">
            <Link href="/settings" className="hover:underline">
              Вход по паролю клуба (устаревший)
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
