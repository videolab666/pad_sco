"use client"

import { useState, useEffect, useRef } from "react"

type SoundType = "point" | "game" | "set" | "match" | "undo"

export function useSoundEffects() {
  const [soundsEnabled, setSoundsEnabled] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Инициализируем AudioContext при монтировании компонента
  useEffect(() => {
    if (typeof window === "undefined") return

    // Проверяем, сохранено ли состояние звуков в localStorage
    const savedSoundsEnabled = localStorage.getItem("tennis_padel_sounds_enabled")
    if (savedSoundsEnabled !== null) {
      setSoundsEnabled(savedSoundsEnabled === "true")
    }

    // Создаем AudioContext только при необходимости (по клику пользователя)
    // Это соответствует политике автовоспроизведения браузеров
    return () => {
      // Закрываем AudioContext при размонтировании
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error)
      }
    }
  }, [])

  // Функция для создания простого звукового сигнала
  const createBeep = (frequency = 440, duration = 0.1, volume = 0.5, type: OscillatorType = "sine") => {
    try {
      // Создаем AudioContext при первом воспроизведении звука
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const audioContext = audioContextRef.current

      // Создаем осциллятор (генератор звука)
      const oscillator = audioContext.createOscillator()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)

      // Создаем регулятор громкости
      const gainNode = audioContext.createGain()
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime)

      // Настраиваем затухание звука
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration)

      // Соединяем компоненты
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Запускаем и останавливаем осциллятор
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration)

      return true
    } catch (error) {
      console.error("Ошибка при создании звука:", error)
      return false
    }
  }

  // Функция для воспроизведения звука
  const playSound = (type: SoundType) => {
    if (!soundsEnabled) return

    try {
      switch (type) {
        case "point":
          // Короткий высокий звук для очка
          createBeep(880, 0.1, 0.3)
          break
        case "game":
          // Двойной звук для гейма
          createBeep(660, 0.1, 0.3)
          setTimeout(() => createBeep(880, 0.1, 0.3), 150)
          break
        case "set":
          // Тройной звук для сета
          createBeep(440, 0.1, 0.3)
          setTimeout(() => createBeep(660, 0.1, 0.3), 150)
          setTimeout(() => createBeep(880, 0.1, 0.3), 300)
          break
        case "match":
          // Длинный звук для матча
          createBeep(440, 0.1, 0.3)
          setTimeout(() => createBeep(660, 0.1, 0.3), 150)
          setTimeout(() => createBeep(880, 0.2, 0.3), 300)
          setTimeout(() => createBeep(1100, 0.3, 0.3), 500)
          break
        case "undo":
          // Нисходящий звук для отмены
          createBeep(660, 0.1, 0.2)
          setTimeout(() => createBeep(440, 0.1, 0.2), 100)
          break
        default:
          break
      }
    } catch (error) {
      console.error(`Ошибка при воспроизведении звука ${type}:`, error)
    }
  }

  // Функция для включения/отключения звуков
  const toggleSounds = () => {
    const newState = !soundsEnabled
    setSoundsEnabled(newState)

    // Сохраняем состояние в localStorage
    localStorage.setItem("tennis_padel_sounds_enabled", newState.toString())

    // Если звуки включены, воспроизводим тестовый звук
    if (newState) {
      playSound("point")
    }

    return newState
  }

  return {
    soundsEnabled,
    soundsLoaded: true, // Всегда true, так как звуки генерируются программно
    playSound,
    toggleSounds,
  }
}
