"use client"

// Панель входа/профиля игрока (plan 2026-09-02 player-auth-video-cabinet).
// Гость → кнопка «Войти» (/login/player); залогинен → имя/аватар + выход.
// Хук useMeProfile тянет /api/v1/me/profile (cookie-сессия).

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { LogIn, LogOut } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"

export interface MeProfile {
  user: { email: string | null; name: string; avatarUrl: string | null } | null
  player: { id: string; name: string; avatarUrl: string | null; email: string | null } | null
}

export function useMeProfile() {
  const [profile, setProfile] = useState<MeProfile>({ user: null, player: null })
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/me/profile", { cache: "no-store" })
      if (res.ok) setProfile((await res.json()) as MeProfile)
    } catch {
      /* тихо: панели не критичны */
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { profile, loaded, refresh }
}

export function PlayerAuthPanel({ variant = "card" }: { variant?: "card" | "compact" }) {
  const { profile, loaded, refresh } = useMeProfile()
  const [busy, setBusy] = useState(false)
  if (!loaded) return null

  const next = typeof window === "undefined" ? "/me" : window.location.pathname

  const logout = async () => {
    setBusy(true)
    try {
      await createSupabaseBrowserClient().auth.signOut()
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  if (!profile.user) {
    if (variant === "compact") {
      return (
        <Link
          href={`/login/player?next=${encodeURIComponent(next)}`}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 hover:border-[#A4FB23]/40 hover:text-[#A4FB23]"
        >
          <LogIn className="h-3.5 w-3.5" /> Войти
        </Link>
      )
    }
    return (
      <div className="rounded-xl border border-[#A4FB23]/25 bg-[#A4FB23]/5 p-4">
        <p className="text-sm text-white/70">
          Войдите, чтобы ваши матчи и записи видео копились в личном кабинете.
        </p>
        <Link
          href={`/login/player?next=${encodeURIComponent(next)}`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#A4FB23] px-4 py-2 text-sm font-bold text-black hover:bg-[#A4FB23]/90"
        >
          <LogIn className="h-4 w-4" /> Войти без пароля
        </Link>
      </div>
    )
  }

  const name = profile.player?.name ?? profile.user.name
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        <span className="max-w-32 truncate text-xs font-semibold text-[#A4FB23]">{name}</span>
        <button
          onClick={() => void logout()}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/60 hover:border-white/40 disabled:opacity-50"
          title="Выйти"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        {profile.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#A4FB23]/20 text-sm font-bold text-[#A4FB23]">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-white">{name}</div>
          {profile.user.email && <div className="text-xs text-white/40">{profile.user.email}</div>}
        </div>
      </div>
      <button
        onClick={() => void logout()}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:border-white/40 disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" /> Выйти
      </button>
    </div>
  )
}
