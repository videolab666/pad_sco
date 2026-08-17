import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

// Обновление Supabase Auth-сессии (стандартный паттерн @supabase/ssr):
// middleware перечитывает/продлевает cookie сессии на каждом запросе страниц.

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anonKey) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    })

    // Валидирует сессию и продлевает токен при необходимости.
    await supabase.auth.getUser()
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Всё, кроме статики и медиа-файлов (тем же паттерном, что примеры
     * Supabase): _next/static, изображения, favicon, публичные файлы Storage.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mov|ico|css|js|map).*$).*)",
  ],
}
