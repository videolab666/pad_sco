"use client"

// /login/player — вход ИГРОКА (plan 2026-09-02 player-auth-video-cabinet).
// Не путать с /login (email+password персонала клуба → /settings).
//
// Два способа: Google OAuth и email magic link (безпарольный — письмо со
// ссылкой). После входа — /auth/callback → сессия в cookie → профиль
// игрока создаётся автоматически. Apple — Phase 2 (см. docs/auth-setup.md).

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Mail, ChevronRight } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "Ссылка устарела — войдите заново",
  callback: "Не удалось завершить вход — попробуйте ещё раз",
}

export default function PlayerLoginPage() {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState<"google" | "email" | null>(null)
  const [sentTo, setSentTo] = useState("")
  const [error, setError] = useState("")
  // ?error= от /auth/callback — чистый lazy-инициализатор (без useSearchParams,
  // чтобы не тянуть Suspense-границу)
  const [urlError] = useState(() => {
    if (typeof window === "undefined") return ""
    const code = new URLSearchParams(window.location.search).get("error")
    return code ? (ERROR_MESSAGES[code] ?? "Вход не удался — попробуйте ещё раз") : ""
  })

  const nextPath = () => {
    if (typeof window === "undefined") return "/me"
    const next = new URLSearchParams(window.location.search).get("next") ?? "/me"
    return next.startsWith("/") && !next.startsWith("//") ? next : "/me"
  }

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`

  const google = async () => {
    setBusy("google")
    setError("")
    const { error: err } = await createSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    })
    if (err) {
      setError(
        /provider|support/i.test(err.message)
          ? "Вход через Google ещё не настроен — см. docs/auth-setup.md"
          : err.message,
      )
      setBusy(null)
    }
    // успех → редирект на Google
  }

  const sendLink = async () => {
    const trimmed = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError("Введите корректный email")
      return
    }
    setBusy("email")
    setError("")
    const { error: err } = await createSupabaseBrowserClient().auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: callbackUrl() },
    })
    setBusy(null)
    if (err) {
      setError(err.message)
      return
    }
    setSentTo(trimmed)
  }

  // ?error= читается в lazy-инициализаторе urlError выше

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-[#0A0F0A] via-[#0D1A0D] to-[#0A0F0A] text-white">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <Link href="/me" className="mb-8 flex items-center gap-1 text-sm text-white/50 hover:text-white/80">
          <ArrowLeft className="h-4 w-4" /> В кабинет игрока
        </Link>

        <h1 className="text-2xl font-bold">Вход игрока</h1>
        <p className="mt-2 text-sm text-white/50">
          Ваши матчи, записи видео и статистика — в личном кабинете. Без пароля:
          одной кнопкой или ссылкой из письма.
        </p>

        {sentTo ? (
          <div className="mt-8 rounded-xl border border-[#A4FB23]/30 bg-[#A4FB23]/5 p-5 text-center">
            <Mail className="mx-auto mb-3 h-8 w-8 text-[#A4FB23]" />
            <p className="text-sm">
              Письмо со ссылкой отправлено на
              <br />
              <span className="font-semibold text-[#A4FB23]">{sentTo}</span>
            </p>
            <p className="mt-2 text-xs text-white/40">
              Откройте его на телефоне и нажмите кнопку входа. Ссылка живёт 1 час.
            </p>
            <button
              onClick={() => setSentTo("")}
              className="mt-4 text-xs text-white/50 underline hover:text-white/80"
            >
              Ввести другой email
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            <button
              onClick={() => void google()}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-white/90 disabled:opacity-60"
            >
              {busy === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
                  />
                </svg>
              )}
              Продолжить с Google
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/30">или по почте</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="flex gap-2">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sendLink()}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm placeholder:text-white/30 focus:border-[#A4FB23]/50 focus:outline-none"
              />
              <button
                onClick={() => void sendLink()}
                disabled={busy !== null}
                className="flex items-center gap-1 rounded-xl bg-[#A4FB23] px-4 py-3 text-sm font-bold text-black transition hover:bg-[#A4FB23]/90 disabled:opacity-60"
              >
                {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                Войти
              </button>
            </div>

            <p className="text-xs text-white/35">Пришлём ссылку для входа — пароль не нужен.</p>
          </div>
        )}

        {(error || urlError) && (
          <div className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
            {error || urlError}
          </div>
        )}
      </div>
    </main>
  )
}
