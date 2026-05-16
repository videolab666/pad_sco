"use client"

import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/contexts/language-context"
import type { DyFeedType } from "@/lib/dy/dy-types"

interface FeedPlatformCardProps {
  platform: DyFeedType
  onSelect: (platform: DyFeedType) => void
}

export function FeedPlatformCard({ platform, onSelect }: FeedPlatformCardProps) {
  const { t } = useLanguage()
  const imgSrc = platform.imageBase64
    ? `data:image/png;base64,${platform.imageBase64}`
    : platform.imageUrl

  return (
    <button
      type="button"
      onClick={() => onSelect(platform)}
      className="flex items-center gap-3 rounded-md border p-3 text-left transition-transform hover:scale-[1.02] hover:shadow-md"
      style={{ backgroundColor: platform.bgColor, color: platform.textColor }}
    >
      {imgSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgSrc} alt="" className="h-10 w-10 shrink-0 object-contain" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{platform.displayName}</span>
          {platform.isLeague && (
            <Badge variant="secondary" className="shrink-0">
              {t("feedImport.league")}
            </Badge>
          )}
        </div>
        {platform.shortDescription && (
          <p className="truncate text-xs opacity-80">{platform.shortDescription}</p>
        )}
      </div>
    </button>
  )
}
