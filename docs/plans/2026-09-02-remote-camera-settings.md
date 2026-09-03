# Remote Camera Settings — Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Админ меняет ВСЕ настройки камеры-телефона со страницы «Видео» в /settings: режим экспозиции с раздельными авто-ISO/авто-выдержкой + EV-коррекцию, фокус, ББ, картинку, разрешение, код корта — камера применяет сама в течение ≤10с (период heartbeat). Локальные правки на телефоне и удалённые на сервере **бесконфликтно сходятся** без опоры на часы устройств.

**Architecture:** Desired-state с серверной версией и приёмом локальных правок («adopt»): сервер — единственный источник версии; телефон хранит `appliedVersion` и монотонный `localSeq`. Heartbeat несёт `{appliedVersion, localSeq, settings}`; сервер либо доносит desired (если телефон отстал и не менял локально), либо **усыновляет** локальную правку телефона как новый desired (если localSeq продвинулся). Экспозиция — четыре режима (`auto` / `manualShutter` (авто-ISO) / `manualIso` (авто-выдержка) / `manual`), EV-коррекция применяется к автоматическим компонентам; полу-авто считается на телефоне через «якорь замера» из AE-результатов.

**Tech Stack:** Kotlin (OkHttp, Camera2 через CameraManualController), SharedPreferences; Next.js staff API, Supabase, video-settings.tsx.

**Status:** Выполнен (2026-09-02), Tasks 1–5. Живой e2e на рутованном OnePlus 9 Pro: PUT manualShutter+1/50 → агент принял через heartbeat («Remote settings v1 применяюсь») → dumpsys: exposureTime=20000000 зафиксирована, sensitivity живая (5851→5443→6302, аппаратный shutter-priority), aeMode=ON → агент подтвердил версию (pending=false, device v1 == desired v1). CameraCaps доходят до UI (ISO 100–6400, EV ±18 шаг 1/6). Спайк «как сток»: см. раздел автозамера. Ограничения: CLI JUnit на кириллическом пути проекта не исполняется (форк-энкодинг) — тесты компилируются и гоняются в Android Studio; luma-контур (запасной путь) и локальный mode-selector на телефоне — follow-up; локальная правка adopt покрыта юнит-тестами протокола, живая проверка — при следующем ручном прогоне.

**Предыдущие планы:** `2026-09-01-oneplus-camera-srt.md`, `2026-09-02-qr-gated-recording-retention-downloads.md` (урок о сдвиге часов — здесь version/seq монотонные счётчики, НЕ epoch).

---

## Контекст: что уже есть

- **APK**: `CameraSettingsCodec` (16 параметров ↔ Map), `CameraSettingsStore` (prefs), `CameraManualController` (применение на лету), `HeartbeatClient` (10с, тело ответа игнорирует — готовый канал доставки). Стрим-ключи prefs: courtCode/gateway/platformUrl/resolution/srtPort.
- **Сервер**: heartbeat-роут (ответ `{source}`), `video_sources`, staff-auth `isAuthorizedSettingsRequest`, вкладка «Видео» в /settings.

## Синхронизация правок (телефон ↔ сервер) — протокол без часов

Часы телефона и сервера могут расходиться сколь угодно (урок плана 2026-09-02: ловили +13с), поэтому **никаких epoch-версий** — только монотонные счётчики:

- Сервер: `settings_version INT` (инкремент на каждом изменении desired), `acked_local_seq INT` (последний увиденный localSeq телефона).
- Телефон (prefs): `applied_version` (последняя применённая серверная), `local_seq` (инкремент при каждом ЛОКАЛЬНОМ сохранении).

Heartbeat каждые 10с несёт `settingsVersion` (= applied_version) и `localSeq` + полный текущий конфиг камеры. Логика сервера в ответе:

```
если localSeq > acked_local_seq:        # телефон менял локально — сервер ещё не видел
    desired = конфиг телефона (adopt)   # локальная правка становится желаемой
    settings_version += 1
    acked_local_seq = localSeq
    ответ несёт {version, settings}     # телефон применит то же самое (hash-равно → no-op)
иначе если settingsVersion < settings_version:
    ответ несёт {version, desired}      # обычный push
иначе:
    ничего (синхронизированы)
```

Свойства (ответ на «будет ли нормально работать»):
- **Телефон → сервер**: локальное сохранение → через ≤10с heartbeat → сервер adopt → в UI админа фактически действующие настройки. Победа локальной правки в её «окне» — осознанная семантика: пока человек держит телефон в руках, удалёнка его не перетирает.
- **Сервер → телефон**: PUT → version+1 → следующий heartbeat доносит → применение.
- **Синхронно с двух сторон в одном окне**: если админ PUT между локальной правкой и heartbeat — adopt перезапишет desired админа конфигом телефона (см. выше), UI честно покажет «конфиг с телефона принят как желаемый». Админ повторит PUT — вторая итерация уже чистая. Гонок и молчаливых потерь нет.
- Телефон не применяет `{version ≤ applied_version}` и не применяет при hash-равенстве (adopt-эхо) — петель нет.
- Офлайн-камера: desired ждёт, применится при возврате.

## Модель экспозиции (запрос: раздельные авто-ISO / авто-выдержка + EV)

Camera2-реальность: `AE_MODE ON` управляет ISO и выдержкой **вместе**, EV-коррекция (`CONTROL_AE_EXPOSURE_COMPENSATION`) работает **только** в авто; `AE_MODE OFF` требует оба значения вручную. Поэтому полу-авто считаем на телефоне через «якорь замера».

Четыре режима (`exposureMode` в настройках, заменяет `autoExposure: Boolean`):

| Режим | AE_MODE | ISO | Выдержка | EV-коррекция |
|---|---|---|---|---|
| `auto` | ON | алгоритм | алгоритм | аппаратно, к общей экспозиции |
| `manualShutter` (авто-ISO) | OFF | **телефон, непрерывно** | ручная (пресеты 1/50, 1/100…) | сдвигает цель ISO (×2^EV) |
| `manualIso` (авто-выдержка) | OFF | ручная | **телефон, непрерывно** | сдвигает цель выдержки (×2^EV) |
| `manual` | OFF | ручная | ручная | скрыта/игнорируется (авто-компоненты нет) |

### Непрерывный автозамер (ключевой сценарий: выдержка 1/50 от мерцания 50Гц + авто-ISO весь день)

**СПАЙК ВЫПОЛНЕН (2026-09-02, рут-дамп стоковой камеры на живом OnePlus 9 Pro)**: shutter-priority поддерживается HAL Qualcomm нативно — стоковое приложение в режиме «фильм» шлёт через обычный Camera2: `CONTROL_AE_MODE=ON` + `SENSOR_EXPOSURE_TIME=20000000` (1/50) + `SENSOR_SENSITIVITY=-1` (сентинел «auto»); в дампах зафиксировано: выдержка прибита во всех кадрах, фактическая ISO живая (6400 в тёмной комнате, aeState SEARCHING→CONVERGED). Vendor-теги `org.quic.camera.manualExposure.*` есть, но сток для этого НЕ использует. Рантайм-рут не нужен.

**Основной путь (`manualShutter`/`manualIso`)** — аппаратный, как у стока:
- repeating-запрос: `AE_MODE=ON` + фиксированный `SENSOR_EXPOSURE_TIME` + `SENSOR_SENSITIVITY=-1` (для `manualIso` — зеркально);
- EV-коррекция — нативный `AE_EXPOSURE_COMPENSATION` (aeMode ON это чтит);
- плавность ведения — родной AE-алгоритм Qualcomm (заточен под видео);
- «контрольный выстрел» в агенте: подписка на `CaptureResult.SENSOR_SENSITIVITY` — если фактическая ISO не меняется при смене света N секунд (HAL паттерн не принял, например после OTA) → автопереход на luma-контур + пометка в health.

**Запасной путь — собственный AE-контур по яркости** (канон для сторонних приложений, Eddy Talvala; включается автоматически при отказе аппаратного пути или вручную):
1. Дополнительный низкоразрешённый выход сессии: `ImageReader` YUV_420_888 ~320×240 как ещё один таргет ТОГО ЖЕ repeating-запроса — кадры идут параллельно энкодеру, стрим не теряет ни кадра.
2. Контур — два независимых такта (все параметры в настройках кодека, управляются удалённо и с телефона):
    - **Замер** раз в `meterIntervalSec` (дефолт **5с**, диапазон 1–60): среднее Y по кадру (EMA-сглаживание) → целевая ISO: `targetY = 0.47 · 2^EV`.
    - **Ведение** каждые ~0.5–1с (фиксированный быстрый тик): текущая ISO **плавно скользит** к цели с ограничением скорости `isoRampEvPerSec` (дефолт **0.5 EV/с**, диапазон 0.1–2.0):
      ```
      curEv = log2(iso);  tgtEv = log2(target)
      step  = clamp(tgtEv − curEv, −ramp·dt, +ramp·dt)   // + мёртвая зона 0.05 EV (не осциллируем у равновесия)
      iso   = clamp(2^(curEv + step), isoMin, isoMax)
      ```
      Чистая функция `IsoRamp.nextIso(…)` — JUnit-тестируется без камеры. Пример: туча закрыла солнце (−4 EV) при 0.5 EV/с → полная адаптация за ~8с без единого скачка; при 5с-интервале замера цель обновится между делом, ведение не ждёт.
3. EV-коррекция = сдвиг уставки контура (чисто и точно); в `manual` контур выключен. Пресет «плавность»: `meterIntervalSec=5 / ramp=0.5` по умолчанию, «нервный» 2с/1.0, «кинематографичный» 10с/0.2 — пресетами в UI, значения свободные.
4. Fallback, если к RootEncoder Camera2Source нельзя добавить второй выход (главный инжиниринг-риск): редкий «блинк» — одиночный AE-запрос раз в 5-15с на metering-поверхность, ISO = ISO_ae·t_ae/t_ручная·2^EV (энкодер теряет ~1 кадр из 150+); либо полный manual как ручной fallback.
5. `STATISTICS_SCENE_FLICKER` из результатов: предупреждение в UI при мерцании 50/60Гц и некратной выдержке (подсказка «поставьте 1/50»).
6. Пресеты выдержки в UI (телефон + удалённая панель): 1/25, 1/50, 1/60, 1/100, 1/120 + свободный ввод в нс — антифликерные значения первыми.

Backward-compat prefs: старый ключ `camera_auto_exposure` маппится true→`auto`, false→`manual`.

Фокус, ББ (включая 6 anchor-гейнов), saturation/contrast/gamma — без изменений, как в кодеке.

## Task 1: Схема и API желаемого конфига

**Files:**
- Create: `supabase/migrations/20260904000000_add_video_source_settings.sql`
- Create: `lib/camera-remote-settings.ts` (чистые sanitize/merge) + `test/camera-remote-settings.test.ts`
- Create: `app/api/video/sources/[streamKey]/settings/route.ts`

1. Миграция: `ALTER TABLE video_sources ADD COLUMN IF NOT EXISTS desired_settings JSONB NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS settings_version INT NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS acked_local_seq INT NOT NULL DEFAULT 0;`
2. `PUT` (staff): `{ camera?: {...}, stream?: {resolution?, courtCode?} }` → `sanitizeDesiredSettings` (валидация по схеме кодека v2 + clamp по cameraCaps из health; exposureMode из 4 значений; courtCode по regex; resolution из белого списка) → merge с текущим desired → `settings_version += 1`.
3. `GET` (staff): desired + фактическое состояние (health.settings/settingsVersion/localSeq) + `pending = settings_version > health.settingsVersion`.
4. Heartbeat-роут: по протоколу выше — adopt или push (чистая функция `resolveSettingsSync` в lib, витестами).

## Task 2: APK — приём/применение конфига + localSeq

**Files:**
- Modify: `HeartbeatClient.kt`, `CameraService.kt`
- Create: `android/.../RemoteSettingsParser.kt` + `RemoteSettingsParserTest.kt`

1. Heartbeat payload: `settingsVersion`, `localSeq`, полный `settings` (JSON кодека v2), `cameraCaps` (isoRange, exposureRange, evRange+step, minFocus, supportsManual*).
2. Ответ: `RemoteSettingsParser` → `RemoteConfig(version, camera?, stream?)` c типозащитой как в кодеке.
3. `applyRemoteConfig`: camera → Store.save + ManualController.apply (немедленно); stream → prefs + перезапуск SRT; `applied_version = version`; **skip если version ≤ applied или hash-равно**. Локальное сохранение из UI телефона: `local_seq += 1`, `applied_version` не трогаем.
4. UI телефона (MainActivity): тост «применены удалённые настройки v{n}».

## Task 3: Модель экспозиции в APK (режимы + непрерывный автозамер + EV)

**Files:**
- Modify: `ManualCameraSettings.kt` (exposureMode + `meterIntervalSec` (5) + `isoRampEvPerSec` (0.5), дефолты, compat-маппинг), `CameraSettingsCodec.kt` (ключи `camera_exposure_mode`, `camera_meter_interval_sec`, `camera_iso_ramp_ev_per_sec`, миграция старого ключа), `CameraManualController.kt` (4 режима + metering-цикл + чистая `IsoRamp.nextIso` + clamp), `CameraService.kt` (доп. metering-выход сессии), `MainActivity.kt` (UI: селектор режима, пресеты выдержки, EV активен везде кроме `manual`, поля «интервал замера»/«скорость ISO», пресеты плавности, индикатор детекта мерцания)
- Test: `ManualExposureTest.kt` + `IsoRampTest.kt` (математика ведения: clamp шага по ramp·dt, мёртвая зона, края isoRange, большая ступень света разгоняется без скачка, EV-сдвиг уставки, compat-маппинг)

1. `exposureMode: ExposureMode` (`auto|manualShutter|manualIso|manual`) + `meterIntervalSec` (по умолчанию 5, 0 = замер только вручную/по кнопке).
2. Metering-цикл по схеме раздела «Непрерывный автозамер»: доп. ImageReader → одноразовый AE-запрос мимо стрима → пересчёт ISO/выдержки → плавное применение. Fallback-блинк — если доп. выход не встал в сессию RootEncoder.
3. `manual`: оба ручных, EV скрыт; UI-слайдеры/пресеты активны по режиму.
4. Детект мерцания (`STATISTICS_SCENE_FLICKER`) → предупреждение + подсказка пресета.

## Task 4: UI админа — панель «Камеры»

**Files:**
- Modify: `components/settings/video-settings.tsx` (+ `camera-remote-settings.tsx` рядом)

1. Список камер: online по last_seen_at; бейджи «ждёт применения» (pending) / «локальная правка принята» (adopt).
2. Форма: селектор exposureMode (4) + слайдеры по режиму (EV везде кроме manual; диапазоны из cameraCaps; до первого heartbeat — безопасные дефолты), фокус/ББ/картинка, resolution/courtCode (confirm с предупреждением о перезапуске стрима), «Сбросить к авто».
3. Поллинг статуса 5с; «применено в HH:MM:SS» после подтверждения версии. platform/gateway — серым «только локально».

## Task 5: Приёмка

0. ~~Спайк «как это делает стоковая камера»~~ — **ВЫПОЛНЕН 2026-09-02**: аппарат-путь подтверждён (см. раздел «Непрерывный автозамер»); остаток спайка — проверить паттерн из нашего агента (AE ON + 1/50 + ISO -1) на стримящей сессии RootEncoder: убедиться, что HAL принимает -1 и ISO в `CaptureResult` меняется при свете; заодно проверить, что `manualShutter` не конфликтует с фикс fps 30.
1. Витест: sanitize/merge/resolveSettingsSync (adopt/push/no-op/hash-эхо).
2. JUnit: парсер, формулы экспозиции, compat.
3. Живой e2e на подключённом телефоне:
   - PUT ISO/насыщенности → logcat «applied v{n}» → health подтверждает;
   - локальная правка на телефоне → ≤10с сервер adopt → UI показывает фактические;
   - PUT в момент между локальной правкой и heartbeat → сервер показывает «конфиг с телефона принят», повторный PUT применяется;
   - exposureMode manualShutter с выдержкой 1/50: фикс выдержки в CaptureResult, ISO живёт и меняется от замер-цикла (logcat); EV-шаг сдвигает ISO ×2; посветить фонариком/закрыть ладонью объектив → ISO подстраивается в течение 1-2 циклов;
   - resolution → перезапуск стрима → новый SDP в MediaMTX.

## Риски / решения

- **R1: кривой конфиг/чёрный экран** — «Сбросить к авто» + локальный UI телефона (platformUrl/gateway не управляются удалённо — escape-hatch).
- **R2: смена courtCode → новый stream_key** — перезапуск стрима, активная запись не переезжает (confirm-диалог с предупреждением).
- **R3: полу-авто отстаёт от света между замерами** — интервал 5с по умолчанию (настраивается удалённо), сглаживание ±1EV за цикл; в `auto` (дефолт) проблемы нет вовсе.
- **R4: нет caps до первого heartbeat** — дефолтные диапазоны в sanitize, сервер не клампит жёстко (клампит телефон по факту).
- **R5: два админа** — последняя PUT-запись выигрывает по version; для клуба ок.
