"use client"

import { useCallback, useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { getPlatforms } from "@/lib/dy/dy-client"
import type { DyFeedType } from "@/lib/dy/dy-types"
import { FeedPlatformCard } from "./feed-platform-card"

interface StepSelectPlatformProps {
  onSelect: (platform: DyFeedType) => void
}

export function StepSelectPlatform({ onSelect }: StepSelectPlatformProps) {
  const { t } = useLanguage()
  const [platforms, setPlatforms] = useState<DyFeedType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setPlatforms(await getPlatforms())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-2">
          <span>{t("feedImport.loadError")}</span>
          <Button size="sm" variant="outline" onClick={load}>
            {t("feedImport.refresh")}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {platforms.map((p) => (
        <FeedPlatformCard key={p.key} platform={p} onSelect={onSelect} />
      ))}
    </div>
  )
}
