"use client"

import { useLanguage } from "@/contexts/language-context"
import { LanguageSwitcher } from "./language-switcher"

export function LanguageAwareNavigation() {
  const { t } = useLanguage()

  return (
    <nav className="bg-background border-b p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="font-bold text-xl">{t("common.appName")}</h1>
        <LanguageSwitcher />
      </div>
    </nav>
  )
}
