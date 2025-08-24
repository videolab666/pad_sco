"use client"

import { Button } from "@/components/ui/button"
import { Volume2, VolumeX } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type SoundToggleProps = {
  enabled: boolean
  onToggle: () => void
}

export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="default" size="icon" onClick={onToggle} className="h-8 w-8">
            {enabled ? <Volume2 className="h-4 w-4 text-white" /> : <VolumeX className="h-4 w-4 text-white" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="bg-gray-800 text-white border-gray-700">
          <p>{enabled ? "Отключить звуки" : "Включить звуки"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
