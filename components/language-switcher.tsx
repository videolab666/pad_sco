"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/contexts/language-context"
import type { Language } from "@/lib/translations"
import { Globe } from "lucide-react"
import { createClientSupabaseClient } from "@/lib/supabase"
import { useState } from "react"
import { logEvent } from "@/lib/error-logger"

export function LanguageSwitcher() {
  const { language, setLanguage, languages, t } = useLanguage()
  const [isSaving, setIsSaving] = useState(false)

  // Save language preference to database
  const saveLanguageToDatabase = async (lang: Language) => {
    try {
      setIsSaving(true)
      const supabase = createClientSupabaseClient()

      if (!supabase) {
        // If Supabase is not available, just use localStorage (handled in context)
        logEvent("warn", "Supabase not available for saving language preference", "saveLanguageToDatabase")
        return
      }

      // Create or update a user_preferences record
      // Using a fixed ID for simplicity - in a real app with authentication,
      // you would use the user's ID
      const { error } = await supabase.from("user_preferences").upsert({
        id: "global",
        language: lang,
        updated_at: new Date().toISOString(),
      })

      if (error) {
        logEvent("error", "Failed to save language preference", "saveLanguageToDatabase", { error })
      } else {
        logEvent("info", "Language preference saved to database", "saveLanguageToDatabase", { language: lang })
      }
    } catch (error) {
      logEvent("error", "Error saving language preference", "saveLanguageToDatabase", { error })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle language change
  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    saveLanguageToDatabase(lang)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isSaving}>
          <Globe className="h-4 w-4 mr-2" />
          {isSaving ? t("common.saving") : languages[language]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(languages).map(([code, name]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => handleLanguageChange(code as Language)}
            className={language === code ? "bg-muted" : ""}
          >
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
