import { use } from "react"
import { redirect } from "next/navigation"

export default function SBRedirect({ params }: { params: Promise<{ number: string }> }) {
  const resolvedParams = use(params)
  // Получаем параметры запроса из URL
  const searchParams = new URLSearchParams()
  if (typeof window !== "undefined") {
    // Копируем все параметры из текущего URL
    const currentParams = new URL(window.location.href).searchParams
    currentParams.forEach((value, key) => {
      searchParams.set(key, value)
    })
  }

  // Формируем URL для перенаправления
  const redirectUrl = `/fullscreen-scoreboard/${resolvedParams.number}${searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`

  // Перенаправляем на страницу fullscreen-scoreboard
  redirect(redirectUrl)
}
