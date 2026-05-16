"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { freeUpCourt } from "@/lib/court-utils"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

export default function CourtFinishPage({ params }: { params: { number: string } }) {
  const router = useRouter()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState<boolean | null>(null)

  useEffect(() => {
    const finish = async () => {
      const ok = await freeUpCourt(params.number)
      setSuccess(ok)
      setLoading(false)
    }
    finish()
  }, [params.number])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Alert variant={success ? "success" : "destructive"} className="max-w-md mx-auto">
        <AlertTitle>
          {success ? t("common.courtStatus.matchFinished") : t("common.courtStatus.finishMatchError")}
        </AlertTitle>
        <AlertDescription>
          {success
            ? t("common.courtStatus.matchFinishedDescription")
            : t("common.courtStatus.finishMatchErrorDescription")}
        </AlertDescription>
      </Alert>
    </div>
  )
}
