"use client"

// Brand Provider (plan-4 §56): подтягивает бренд клуба (club_settings "brand")
// и инжектит CSS-переменные (--brand-primary, --brand-name, …) в <html>.
// Плюс контекст useBrand() для компонентов, которым нужны значения напрямую.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { DEFAULT_BRAND, brandToCssVars, type BrandProfile } from "@/lib/white-label"

interface BrandContextValue {
  brand: BrandProfile
  loaded: boolean
}

const BrandContext = createContext<BrandContextValue>({ brand: DEFAULT_BRAND, loaded: false })

export function useBrand(): BrandContextValue {
  return useContext(BrandContext)
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandProfile>(DEFAULT_BRAND)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings/brand", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.brand) setBrand(d.brand as BrandProfile)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Инжектим CSS-переменные в <html> — их видит любой компонент/страница.
  useEffect(() => {
    const vars = brandToCssVars(brand)
    for (const [prop, val] of Object.entries(vars)) {
      document.documentElement.style.setProperty(prop, val)
    }
  }, [brand])

  return <BrandContext.Provider value={{ brand, loaded }}>{children}</BrandContext.Provider>
}
