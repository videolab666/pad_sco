# Padel Camera Agent — Android

OnePlus/OPPO → Camera2 → SRT → MediaMTX venue gateway + heartbeat платформе.

## Сборка

1. Открыть `android/` в Android Studio (Hedgehog+)
2. Sync Gradle → Build → Install на телефон

Или из командной строки:
```bash
cd android
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Первый запуск (§188: provisioning)

1. Установить APK на OnePlus
2. Открыть приложение → разрешить камеру
3. Приложение выберет проверенную ультраширокую камеру ID 2.
4. При необходимости открыть `ПАРАМЕТРЫ ПОТОКА` и заполнить:
   - **Код корта** — короткий код из `/settings → Корты` (кнопка `/c/XXXXXXX`)
   - **Gateway** — IP машины/VPS с MediaMTX (порт 8890)
   - **Платформа** — URL приложения (для heartbeat)
5. **Старт**

## Экран оператора

- Видоискатель показывает тот же кадр 16:9, который отправляется в SRT.
- Стрелка справа прячет всю панель и оставляет полноэкранное превью; выбор
  сохраняется после перезапуска.
- Сетка третей и электронный горизонт видны только на телефоне и не попадают
  в трансляцию.
- Экспозиция, фокус и баланс белого переключаются Auto/Manual независимо.
- В Manual доступны ISO, выдержка, дистанция фокуса и WB 2000–10000 K.
- При переходе WB Auto → Manual текущие Camera2 RGGB gains фиксируются как
  нейтральная точка этой камеры, поэтому цвет не скачет.
- Диафрагма OnePlus 9 Pro ID 2 фиксированная: f/2.2.
- Все значения камеры и режим панели сохраняются сразу. На выделенном телефоне
  Magisk policy запускает Activity и camera foreground service после загрузки.

## Проверка (на gateway-машине)

```bash
# HLS live
open http://localhost:8888/court-{код}-main

# Сегменты записи
ls video/recordings/court-{код}-main/

# Источник в платформе
curl http://localhost:3000/api/video/sources
```

## Архитектура

```text
MainActivity (видоискатель + ручные настройки + горизонт)
    ↓ startForegroundService
CameraService (foreground, camera type)
    ├── CameraProbe → выбор ультраширика (§166)
    ├── RootEncoder SrtStream: один владелец Camera2, preview + SRT
    ├── CameraManualController: CaptureRequest/CaptureResult + persistence
    └── HeartbeatClient: POST /api/v1/video/heartbeat каждые 10с
Magisk Padel Dedicated Camera Policy → безопасный автозапуск после reboot
```

## §166: главный риск Sprint A

Поддержка 4K50/60 ультрашириком для **стороннего** Camera2-приложения
не гарантирована даже если штатная камера это умеет. Camera Probe покажет
реальные возможности. Если 4K50 недоступен — fallback на 1080p30 или 4K30
(§201: «Если доступно только 4K30, провести sports-image test прежде чем
отказываться от платформы»).

## Зависимости

| Библиотека | Лицензия | Назначение |
|---|---|---|
| RootEncoder | Apache-2.0 | SRT стриминг с Camera2 |
| OkHttp | Apache-2.0 | HTTP heartbeat |
| Material Components | Apache-2.0 | UI |

Все permissive — лицензионный гейт §205 пройден.

## Композитная сборка RootEncoder (image-quality 2026-09-03)

Сборка использует **локальную правленую копию** RootEncoder 2.7.5 из
`C:/android-build/RootEncoder-2.7.5` (подмена Maven-артефакта в
`settings.gradle.kts` → `includeBuild`). Копия несёт патчи, без которых
приложение теряет ключевые фиксы:

| Патч | Файл | Зачем |
|---|---|---|
| `COLOR_RANGE_FULL` + BT.709 | `encoder/.../VideoEncoder.java` | VUI под фактический full-range контент GL-цепочки (limited-флаг давил тени/клипал света) |
| `setCameraId()` до старта | `encoder/.../sources/video/Camera2Source.kt` | целевая камера открывается сразу, optimal-размер буфера считается под неё (фикс «растянутого стрима») |
| snapshot `oldSps` в `requestKeyframe` | `encoder/.../VideoEncoder.java` | NPE-гонка при рестриме |
| AGP 8.10.1 / Kotlin 2.2.10 / без `:app` | `settings.gradle.kts`, `gradle/libs.versions.toml`, модули | совместимость с каноническим стеком (Gradle 8.12, JDK 17) |

**Воспроизводимость:** каталог либы вне git — при переносе сборочной машины
скопировать правленый `RootEncoder-2.7.5` (бэкап: `C:/android-build/`) или
повторить патчи по таблице выше. Версия-каталог либы: `local.properties`
(`sdk.dir`) уже в каталоге.
