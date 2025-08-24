import { createClientSupabaseClient } from "./supabase"
import { logEvent } from "./error-logger"
import { v4 as uuidv4 } from "uuid"

// Интерфейс для настроек vMix
export interface VmixSettings {
  id?: string
  name: string
  settings: any
  is_default?: boolean
  created_at?: string
  updated_at?: string
}

// Получение всех настроек vMix
export const getAllVmixSettings = async (): Promise<VmixSettings[]> => {
  try {
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const { data, error } = await supabase.from("vmix_settings").select("*").order("created_at", { ascending: false })

    if (error) {
      logEvent("error", "Ошибка при получении настроек vMix", "getAllVmixSettings", error)
      throw error
    }

    return data || []
  } catch (error) {
    logEvent("error", "Исключение при получении настроек vMix", "getAllVmixSettings", error)
    return []
  }
}

// Получение настроек vMix п�� ID
export const getVmixSettingsById = async (id: string): Promise<VmixSettings | null> => {
  try {
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const { data, error } = await supabase.from("vmix_settings").select("*").eq("id", id).single()

    if (error) {
      logEvent("error", `Ошибка при получении настроек vMix по ID: ${id}`, "getVmixSettingsById", error)
      throw error
    }

    return data
  } catch (error) {
    logEvent("error", "Исключение при получении настроек vMix по ID", "getVmixSettingsById", error)
    return null
  }
}

// Получение настроек vMix по умолчанию
export const getDefaultVmixSettings = async (): Promise<VmixSettings | null> => {
  try {
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const { data, error } = await supabase
      .from("vmix_settings")
      .select("*")
      .eq("is_default", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 - это код ошибки "Результат не найден", который мы можем игнорировать
      logEvent("error", "Ошибка при получении настроек vMix по умолчанию", "getDefaultVmixSettings", error)
      throw error
    }

    return data || null
  } catch (error) {
    logEvent("error", "Исключение при получении настроек vMix по умолчанию", "getDefaultVmixSettings", error)
    return null
  }
}

// Сохранение настроек vMix
export const saveVmixSettings = async (settings: VmixSettings): Promise<VmixSettings | null> => {
  try {
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    // Если настройки помечены как "по умолчанию", сначала сбрасываем флаг у всех других настроек
    if (settings.is_default) {
      const { error: resetError } = await supabase
        .from("vmix_settings")
        .update({ is_default: false })
        .eq("is_default", true)

      if (resetError) {
        logEvent("error", "Ошибка при сбросе флага 'по умолчанию'", "saveVmixSettings", resetError)
        throw resetError
      }
    }

    // Если ID не указан, создаем новую запись
    if (!settings.id) {
      const newId = uuidv4()
      const { data, error } = await supabase
        .from("vmix_settings")
        .insert({
          id: newId,
          name: settings.name,
          settings: settings.settings,
          is_default: settings.is_default || false,
        })
        .select()
        .single()

      if (error) {
        logEvent("error", "Ошибка при создании настроек vMix", "saveVmixSettings", error)
        throw error
      }

      logEvent("info", `Созданы новые настройки vMix: ${settings.name}`, "saveVmixSettings")
      return data
    } else {
      // Обновляем существующую запись
      const { data, error } = await supabase
        .from("vmix_settings")
        .update({
          name: settings.name,
          settings: settings.settings,
          is_default: settings.is_default || false,
        })
        .eq("id", settings.id)
        .select()
        .single()

      if (error) {
        logEvent("error", `Ошибка при обновлении настроек vMix: ${settings.id}`, "saveVmixSettings", error)
        throw error
      }

      logEvent("info", `Обновлены настройки vMix: ${settings.name}`, "saveVmixSettings")
      return data
    }
  } catch (error) {
    logEvent("error", "Исключение при сохранении настроек vMix", "saveVmixSettings", error)
    return null
  }
}

// Удаление настроек vMix
export const deleteVmixSettings = async (id: string): Promise<boolean> => {
  try {
    const supabase = createClientSupabaseClient()
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    // Проверяем, не удаляем ли мы настройки по умолчанию
    const { data: settingsData } = await supabase.from("vmix_settings").select("is_default").eq("id", id).single()

    // Если удаляем настройки по умолчанию, нужно будет установить другие настройки по умолчанию
    const isDefault = settingsData?.is_default || false

    const { error } = await supabase.from("vmix_settings").delete().eq("id", id)

    if (error) {
      logEvent("error", `Ошибка при удалении настроек vMix: ${id}`, "deleteVmixSettings", error)
      throw error
    }

    // Если удалили настройки по умолчанию, устанавливаем новые настройки по умолчанию
    if (isDefault) {
      const { data: remainingSettings } = await supabase
        .from("vmix_settings")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)

      if (remainingSettings && remainingSettings.length > 0) {
        await supabase.from("vmix_settings").update({ is_default: true }).eq("id", remainingSettings[0].id)
      }
    }

    logEvent("info", `Удалены настройки vMix: ${id}`, "deleteVmixSettings")
    return true
  } catch (error) {
    logEvent("error", "Исключение при удалении настроек vMix", "deleteVmixSettings", error)
    return false
  }
}
