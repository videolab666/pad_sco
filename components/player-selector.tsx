"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"

interface PlayerSelectorProps {
  players: any[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}

export function PlayerSelector({ players, value, onChange, placeholder, label }: PlayerSelectorProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  // Update the selected player when the value changes
  useEffect(() => {
    if (value) {
      const player = players.find((player) => player.id === value)
      setSelectedPlayer(player ? player.name : value)
    } else {
      setSelectedPlayer(null)
    }
  }, [value, players])

  return (
    <div className="space-y-0.5">
      {label && <label className="text-sm font-medium">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between truncate px-1 py-0.5"
            type="button"
            onClick={() => setOpen(!open)}
          >
            <span className="truncate mr-0.25 text-left">
              {selectedPlayer || placeholder || t("players.selectPlayer")}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-full min-w-[200px]">
          <Command>
            <CommandInput placeholder={t("players.searchPlayer")} />
            <CommandList>
              <CommandEmpty>{t("players.noPlayersFound")}</CommandEmpty>
              <CommandGroup className="max-h-[200px] overflow-y-auto">
                {players.map((player) => (
                  <CommandItem
                    key={player.id}
                    value={player.name}
                    onSelect={() => {
                      onChange(player.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === player.id ? "opacity-100" : "opacity-0")} />
                    {player.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
