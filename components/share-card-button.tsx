"use client"

// Share Card Button (§45): кнопка «Поделиться» на странице матча.
// Открывает share-карточку в новой вкладке + копирует ссылку.

import { useState } from "react"
import { Check, Link2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ShareCardButton({ matchId, className = "" }: { matchId: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const cardUrl = `/api/match/${matchId}/share-card`
  const squareUrl = `${cardUrl}?format=square`
  const matchUrl = typeof window !== "undefined" ? `${window.location.origin}/match/${matchId}` : ""

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(matchUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Результат матча", url: matchUrl })
      } catch { /* user cancelled */ }
    } else {
      void copyLink()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Share2 className="h-4 w-4 mr-1" />
          Поделиться
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => window.open(cardUrl, "_blank")}>
          <Share2 className="h-4 w-4 mr-2" />
          Карточка (1200×630)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(squareUrl, "_blank")}>
          <Share2 className="h-4 w-4 mr-2" />
          Квадрат (1080×1080, Instagram)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void share()}>
          {copied ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Link2 className="h-4 w-4 mr-2" />}
          {copied ? "Скопировано!" : "Скопировать ссылку"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
