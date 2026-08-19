# Padel Camera Agent — Android (plan-4 §129-203, Sprint A)

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
3. **Camera Probe покажет найденные линзы** (§166): ультраширик, разрешения, FPS
4. Заполнить настройки:
   - **Код корта** — короткий код из `/settings → Корты` (кнопка `/c/XXXXXXX`)
   - **Gateway** — IP машины/VPS с MediaMTX (порт 8890)
   - **Платформа** — URL приложения (для heartbeat)
5. **Старт**

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
MainActivity (UI: probe + настройки)
    ↓ startForegroundService
CameraService (foreground, camera type)
    ├── CameraProbe → выбор ультраширика (§166)
    ├── SrtCamera2 (RootEncoder): Camera2 + SRT стриминг
    └── HeartbeatClient: POST /api/v1/video/heartbeat каждые 10с
BootReceiver → автозапуск после reboot (§185)
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
