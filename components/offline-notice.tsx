"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"
import { isSupabaseAvailable } from "@/lib/supabase"

export function OfflineNotice() {
  const [isOffline, setIsOffline] = useState(true)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Проверяем статус Supabase при монтировании компонента
    const checkSupabase = async () => {
      setIsChecking(true)
      const status = await isSupabaseAvailable()
      setIsOffline(!status)
      setIsChecking(false)
    }

    // Проверяем сразу
    checkSupabase()

    // И периодически проверяем статус
    const interval = setInterval(checkSupabase, 30000)

    return () => clearInterval(interval)
  }, [])

  if (isChecking || !isOffline) return null

  return (
    <Alert className="bg-amber-50 border-amber-200 mb-4">
      <Info className="h-4 w-4 text-amber-800" />
      <AlertTitle className="text-amber-800">Автономный режим</AlertTitle>
      <AlertDescription className="text-amber-800">
        Приложение работает в автономном режиме. Данные сохраняются только на этом устройстве и будут доступны только в
        этом браузере. Для сохранения важных матчей используйте функцию экспорта в разделе "Экспорт/Импорт".
      </AlertDescription>
    </Alert>
  )
}
