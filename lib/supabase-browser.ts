"use client"

// Браузерный клиент Supabase для staff-логина (@supabase/ssr).
// Анонимный ключ публичен по определению; чувствительные операции закрыты
// RLS-политиками (миграция 20260817030000).

import { createBrowserClient } from "@supabase/ssr"

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
