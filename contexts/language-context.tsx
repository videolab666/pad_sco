"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { type Language, LANGUAGES, translations } from "@/lib/translations"
import { createClientSupabaseClient } from "@/lib/supabase"
import { logEvent } from "@/lib/error-logger"

type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  languages: typeof LANGUAGES
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ru")
  const [isLoaded, setIsLoaded] = useState(false)

  // Load language preference from database or localStorage
  useEffect(() => {
    const loadLanguagePreference = async () => {
      try {
        // Try to get language from database first
        const supabase = createClientSupabaseClient()

        if (supabase) {
          const { data, error } = await supabase.from("user_preferences").select("language").eq("id", "global").single()

          if (!error && data && data.language) {
            const dbLanguage = data.language as Language
            if (Object.keys(LANGUAGES).includes(dbLanguage)) {
              setLanguageState(dbLanguage)
              logEvent("info", "Loaded language preference from database", "loadLanguagePreference", {
                language: dbLanguage,
              })
              setIsLoaded(true)
              return
            }
          }
        }

        // Fall back to localStorage if database not available or no preference found
        const savedLanguage = localStorage.getItem("language") as Language
        if (savedLanguage && Object.keys(LANGUAGES).includes(savedLanguage)) {
          setLanguageState(savedLanguage)
          logEvent("info", "Loaded language preference from localStorage", "loadLanguagePreference", {
            language: savedLanguage,
          })
        }

        setIsLoaded(true)
      } catch (error) {
        logEvent("error", "Error loading language preference", "loadLanguagePreference", { error })
        // Fall back to localStorage in case of error
        const savedLanguage = localStorage.getItem("language") as Language
        if (savedLanguage && Object.keys(LANGUAGES).includes(savedLanguage)) {
          setLanguageState(savedLanguage)
        }
        setIsLoaded(true)
      }
    }

    loadLanguagePreference()
  }, [])

  // Save language to localStorage as a fallback
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("language", language)
    }
  }, [language, isLoaded])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
  }

  const t = (key: string): string => {
    const keys = key.split(".")
    let value: any = translations[language]

    for (const k of keys) {
      if (value && value[k]) {
        value = value[k]
      } else {
        console.warn(`Translation key not found: ${key}`)
        return key
      }
    }

    return value
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}

export { LanguageContext }