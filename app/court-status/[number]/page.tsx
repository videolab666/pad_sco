"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getMatchByCourtNumber } from "@/lib/court-utils"
import { logEvent } from "@/lib/error-logger"
import { useLanguage } from "@/contexts/language-context"
import { translations } from "@/lib/translations"

export default function CourtStatusPage({ params }: { params: { number: string } }) {
  const router = useRouter()
  const [isMatchActive, setIsMatchActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const { language } = useLanguage()
  const t = translations[language]
  const courtNumber = Number.parseInt(params.number)

  useEffect(() => {
    const checkCourtStatus = async () => {
      try {
        if (isNaN(courtNumber) || courtNumber < 1 || courtNumber > 10) {
          throw new Error("Некорректный номер корта")
        }

        const match = await getMatchByCourtNumber(courtNumber)
        setIsMatchActive(!!match)
        setError("")
      } catch (err) {
        setError("Ошибка проверки статуса корта")
        console.error(err)
        logEvent("error", `Ошибка проверки статуса корта ${courtNumber}`, "CourtStatusPage", err)
      } finally {
        setLoading(false)
      }
    }

    checkCourtStatus()
  }, [courtNumber])

  const handleRefresh = () => {
    if (isMatchActive) {
      router.refresh()
    } else {
      router.push(`/court/${courtNumber}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl">Проверка статуса корта...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => router.back()}>Вернуться</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Alert variant={isMatchActive ? "destructive" : "default"}>
          <AlertTitle>
            {isMatchActive
              ? t.common.courtStatus.matchInProgress
              : t.common.courtStatus.noMatch}
          </AlertTitle>
          <AlertDescription>
            {isMatchActive
              ? t.common.courtStatus.matchInProgressDescription
              : t.common.courtStatus.noMatchDescription}
          </AlertDescription>
        </Alert>
        <Button onClick={handleRefresh} className="mt-4">
          {isMatchActive ? t.common.courtStatus.refresh : t.common.courtStatus.continue}
        </Button>
      </div>
    </div>
  )
}
