"use client"

// Country combobox: type to filter (code / ISO3 / Russian name), pick from
// the list, or keep a custom value. The stored value stays the plain code
// (ISO2 preferred) — exactly what the scoreboard expects.

import { useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown } from "lucide-react"
import { COUNTRIES, iso2Flag, countryByCode } from "@/lib/countries"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

interface Props {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
}

export function CountryCombobox({ value, onChange, disabled }: Props) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selected = useMemo(() => countryByCode(value), [value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      (c) =>
        c.iso2.toLowerCase().startsWith(q) ||
        c.iso3.toLowerCase().startsWith(q) ||
        c.ru.toLowerCase().startsWith(q),
    )
  }, [query])

  const pick = (iso2: string) => {
    onChange(iso2)
    setOpen(false)
    setQuery("")
  }

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery("") }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            {selected
              ? `${iso2Flag(selected.iso2)} ${selected.iso2} — ${selected.ru}`
              : value
                ? value
                : t("players.countryPick")}
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t("players.countrySearch")}
            />
            <CommandList>
              <CommandEmpty>
                {query ? (
                  <button
                    type="button"
                    className="w-full text-sm px-2 py-1.5 text-left hover:bg-accent"
                    onClick={() => pick(query.trim().toUpperCase())}
                  >
                    {t("players.countryUseCustom")}: «{query.trim().toUpperCase()}»
                  </button>
                ) : null}
              </CommandEmpty>
              <CommandGroup>
                {filtered.slice(0, 60).map((c) => (
                  <CommandItem key={c.iso2} value={c.iso2} onSelect={() => pick(c.iso2)}>
                    <Check className={`mr-1 h-3 w-3 ${selected?.iso2 === c.iso2 ? "opacity-100" : "opacity-0"}`} />
                    {iso2Flag(c.iso2)} {c.iso2} ({c.iso3}) — {c.ru}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-2"
          disabled={disabled}
          onClick={() => onChange("")}
          title="×"
        >
          ×
        </Button>
      ) : null}
    </div>
  )
}
