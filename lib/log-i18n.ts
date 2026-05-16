import { type Language, translations } from "./translations"

let _currentLang: Language = "ru"

export const setGlobalLanguage = (lang: Language) => {
  _currentLang = lang
}

const getLang = (): Language => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("language") as Language
    if (saved && ["ru", "en", "uk"].includes(saved)) {
      _currentLang = saved
    }
  }
  return _currentLang
}

export const tSync = (key: string, params?: Record<string, string | number>): string => {
  const lang = getLang()
  const keys = key.split(".")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = translations[lang]

  for (const k of keys) {
    if (value && value[k] !== undefined) {
      value = value[k]
    } else {
      return key
    }
  }

  if (typeof value === "string" && params) {
    let result = value
    for (const [p, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{\\{${p}\\}\\}`, "g"), String(v))
      result = result.replace(new RegExp(`\\{${p}\\}`, "g"), String(v))
    }
    return result
  }

  return typeof value === "string" ? value : key
}
