# QR-Gated Recording + Retention + Downloads — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Запись матча на диск стартует только по QR-сессии игрока («отсканировал → записать матч»), останавливается при завершении матча, хранится по ретенции тарифа (7/30 дней), скачивается игроком. Итог: при ~30% адопшене 2 ТБ диска хватает на 30 дней ретенции для клуба из 3–10 кортов (экономика: матч 1.5 ч @ 8 Мбит/с ≈ 5.4 ГБ).

**Architecture:** Камера продолжает стримить SRT постоянно (live-превью + heartbeat-мониторинг), но MediaMTX пишет на диск только пока активна `recording_session`. Гейтинг — через MediaMTX Control API (runtime path override с `record: true` на точном имени `court-{key}-main`; exact-match имеет приоритет над regex `~^court-`). Управляющий вызов встраивается в существующие `startRecording`/`updateRecording` (`lib/video-registry.ts`). Игроковый флоу сидит на существующем Quick Play по QR (`/c/{short_code}` → court session). Ретенция — `recordDeleteAfter` на path override по тарифу + worker для очистки БД. Скачивание — прокси-роут через платформу с проверкой прав.

**Tech Stack:** MediaMTX 1.20 (Control API :9997, Playback API :9996), Next.js App Router, Supabase (recording_sessions, court_sessions, video_sources), Node worker (cron), Caddy (HTTPS на VPS), DeluxHost STORAGE-3 (2 vCore / 4 ГБ / 2 ТБ HDD + NVMe-системник).

**Status:** Выполнен (2026-09-02), Tasks 1–9. Живые проверки на реальной камере: полный e2e (QR-сессия → запись с ретенцией 30d из тарифа → стоп → скачивание валидного MP4), негативные кейсы (камера offline 409, тариф starter 403, нет сессии 400), watchdog зависшей записи (override погашен, статус failed), автоудаление сегментов по recordDeleteAfter (тест 1m: старые удалены, свежие на месте). Попутно исправлен баг: сервер-резолв сессии передавал пустой courtSessionId в insert (uuid-ошибка). Task 8 — Caddyfile + docker-compose под Storage VPS (HDD-том, наружу только 443+8890/udp) + README §E. Долгосрочное наблюдение экономики (сутки адопшена) — в пилоте.

**Ссылки на план-4:** §15 (QR self-service), §88 (zero-friction provisioning), §134 (старт записи), §148 (ретенция 7/30/90), §192/§193 (сегментная запись, pre-roll), §55 (тарифы).

---

## Контекст: почему меняем

Сейчас `video/mediamtx.yml` пишет **всё** (`record: true` на `~^court-`), пока камера стримит: 3 корта × 14 ч = 151 ГБ/день → 7 дней ретенции = 1 ТБ, 30 дней = 4.5 ТБ. Экономика «евро за терабайт в месяц» работает только если пишем **выбранные матчи** (~4–6 матчей/день = 20–35 ГБ/день). QR-гейт — ключевой рычаг стоимости.

**Текущее состояние кода:**
- `startRecording` (`lib/video-registry.ts:228`) создаёт строку в БД, но **не управляет MediaMTX** — запись на диске идёт независимо.
- `POST /api/video/recordings` — только для стаффа (`settings-auth`), игрокового флоу нет.
- Quick Play по QR уже есть: `POST /api/v1/courts/{code}/quick-play` → court session с участниками.
- `recordDeleteAfter: 7d` — один на все пути, без тарифов.
- Кнопки «Скачать» нет; VOD доступен через Playback API-ссылку без гейтов прав.
- Тарифная сетка (`lib/billing-plans.ts`): Club 30д/50 ГБ — 50 ГБ ≈ 9 матчей, цифра нереалистична.

---

## Task 1: MediaMTX-клиент и гейтинг на уровне конфига

**Files:**
- Modify: `video/mediamtx.yml`
- Create: `lib/mediamtx-client.ts`
- Test: `lib/__tests__/mediamtx-client.test.ts` (или рядом по конвенции)
- Modify: `.env.example` (если есть) / README

1. В `mediamtx.yml` поменять `~^court-` → `record: false`. Регекс-путь остаётся fallback (публикация работает, live-HLS работает, записи нет).
2. Написать тонкий клиент Control API (база `MEDIAMTX_CONTROL_URL`, дефолт `http://localhost:9997`):
   - `enableRecording(streamKey, opts: { retention })` — `POST /v3/config/paths/{streamKey}` c `{"record": true, "recordDeleteAfter": retention}` (создаёт точный override; exact-match приоритетнее regex);
   - `disableRecording(streamKey)` — `DELETE /v3/config/paths/{streamKey}` (возврат к regex-fallback);
   - `getPath(name)` / `listPaths()` — для верификации и дашборда;
   - таймауты 3 с, ретраи 2×, понятные ошибки (`MediaMTXUnavailable`).
3. Юнит-тесты с замоканным `fetch`: создание/удаление override, формат retention (`7d`/`30d`), обработка 4xx/5xx и таймаута.
4. **Проверить вручную (риск №1):** MediaMTX v1.20 применяет runtime path override к **уже активному** публикатору (камера стримит, мы создаём override → recorder стартует; удаляем → стопается). `pathDefaults` должны наследоваться runtime-путём (recordPath/Format/SegmentDuration). Если наследования нет — дублировать параметры в override явно. Если toggle на лету не работает — fallback: перезапустить только path через API или согласовать рестарт стрима (задел в `StreamRecoveryPolicy`).

## Task 2: `startRecording`/`updateRecording` управляют диском

**Files:**
- Modify: `lib/video-registry.ts`
- Test: расширенные тесты video-registry

1. `startRecording`: после вставки строки вызвать `enableRecording(streamKey, retention)`. Статус `recording` — только если MediaMTX подтвердил; иначе `failed` с причиной в `metadata.gatewayError`. `retention` берётся из тарифа клуба (v1: параметр, дефолт `7d`).
2. Защита от дублей: активная `recording_session` на source → `VideoValidationError` (409).
3. `updateRecording(→ ready|failed)`: `disableRecording(streamKey)`, фиксировать `ended_at`, `storage_key` — реальный каталог записей из recordPath.
4. Идемпотентность и падение платформы: при старте (heartbeat/lazy) сверять активные сессии в БД с overrides в MediaMTX (лечить расхождения — «сессия active, а override нет» → пере-включить или фейлить).

## Task 3: Игроковый API записи по QR-сессии

**Files:**
- Create: `app/api/v1/courts/[code]/recording/route.ts` (POST старт, DELETE стоп)
- Modify: `lib/court-session.ts` (хук завершения)

1. `POST /api/v1/courts/{code}/recording` — тело `{ courtSessionId }`:
   - проверка feature-флага `video_recording` по тарифу клуба;
   - court session должна быть активной; источник корта — `online` по последнему heartbeat (иначе 409 «камера offline»);
   - вызывает `startRecording({ streamKey, courtSessionId })`, участников сессии фиксирует в `metadata.participants`;
   - доступ: v1 — любой, кто открыл QR корта (как Quick Play); идемпотентен (повторный POST при активной записи возвращает её).
2. `DELETE /api/v1/courts/{code}/recording` — стоп: `updateRecording(→ ready)`.
3. Автостоп: при переводе court session в финальный статус (`updateSessionStatus`) останавливать связную запись (best-effort, ошибка — в лог, не рвать завершение матча).
4. Watchdog от забытых записей: worker (Task 5) фейлит сессии длиннее `MAX_RECORDING_DURATION` (дефолт 3 ч).

## Task 4: UI «Записать матч» на QR-странице корта

**Files:**
- Modify: `app/c/[code]/play/page.tsx` (и/или компонент записи)
- Modify: строки локалей `values*/strings`

1. Кнопка «● Записать матч» после старта Quick Play: старт → индикатор идущей записи (таймер) → «Стоп». Стейт — из `GET /api/video/recordings?active=true&court=` (или扩展 игроковый GET).
2. Камера offline / тариф без видео — кнопка скрыта/disabled с пояснением.
3. После `ready` — карточка «Матчер записан» со ссылкой на VOD (существующий `buildVodUrl` из `lib/video-public.ts`) и кнопкой «Скачать» (Task 6).
4. Список записей сессии игрока: последние N записей корта с таймлайном (готовность, ретенция до какой даты).

## Task 5: Ретенция по тарифу + worker очистки

**Files:**
- Modify: `video/mediamtx.yml` (fallback `recordDeleteAfter: 7d`)
- Create: `scripts/retention-worker.mjs`
- Modify: `scripts/clip-worker.mjs` (клипы: `90d`)

1. Файлы: MediaMTX сам удаляет сегменты по `recordDeleteAfter` path-override (7d/30d из Task 2) — источник истины по файлам.
2. Worker (cron/systemd timer, раз в час):
   - помечает `recording_sessions` → `expired` когда `ended_at + retention` прошло (retention из тарифа клуба, не из файла);
   - watchdog из Task 3 (долгие active);
   - чистит orphan-каталоги в `recordings/` без активной сессии старше fallback-ретенции;
   - метрики в лог: ГБ/день по кортам, число записанных/сыгранных матчей (адопшн).
3. Клипы (`video/clips`): удалять старше 90d.
4. Дашборд админа (минимально): endpoint `GET /api/video/stats` — адопшн %, ГБ/день, топ кортов; страница в staff-зоне.

## Task 6: Скачивание записи игроком

**Files:**
- Create: `app/api/v1/video/recordings/[id]/download/route.ts`
- Modify: UI из Task 4

1. `GET /api/v1/video/recordings/{id}/download`:
   - запись в статусе `ready`;
   - права: участник court session из `metadata.participants` (v1 — игрок, открывший QR-страницу корта; стабильно после появления профилей — по player_id);
   - ответ: прокси-стрим из Playback API с `Content-Disposition: attachment` (не 302 — ссылка Playback без авторизации);
   - лимит длительности/повторы — v1 без лимита.
2. Кнопка «Скачать» в карточке записи (Task 4) и в списке записей.
3. После скачивания подсказка: «Файл удалится с сервера через N дней, скачанный остаётся у вас».

## Task 7: Тарифная сетка под реальную ёмкость

**Files:**
- Modify: `lib/billing-plans.ts`
- Modify: UI тарифов/лендинг, если цифры захардкожены

Пересчёт из модели «матч = 5.4 ГБ; корт = ~1.3 записанных матча/день при 30% адопшене»:

| Тариф | Ретенция полных матчей | Хранилище | Обоснование |
|---|---|---|---|
| Starter | — | — | видео выключено (как сейчас) |
| Club | 30 дней | **2 ТБ** | 10 кортов × 6.8 ГБ/день × 30 дн ≈ 2 ТБ |
| Pro | 30 дней; 90 дней — только избранные (финалы, highlights) | **5 ТБ** | 90d для всего на 50 кортах = 30 ТБ — неэкономично; long-term только для VIP-контента |

1. Обновить `limits` (`videoRetentionDays`, `storageGb`) и описания фич.
2. `video_highlights` (Pro) уточнить: «хайлайты хранятся 90 дней».
3. Квота хранилища клуба: worker из Task 5 пишет `storageUsedGb` в `clubs.metadata`; при превышении — мягкий гейт (предупреждение админу, новые записи блокируются с понятной ошибкой).

## Task 8: Инфраструктура на Storage VPS

**Files:**
- Modify: `video/docker-compose.yml` (том recordings → HDD-маунт, HLS/temp → NVMe)
- Create: `video/Caddyfile` (443 → HLS :8888, Playback :9996; Control API :9997 наружу НЕ выставлять)
- Modify: `video/README.md` (deploy-инструкция на DeluxHost STORAGE-3)

1. DeluxHost STORAGE-3 (2 vCore / 4 ГБ / 2 ТБ HDD + NVMe): Docker, `docker-compose up`, каталог записей на HDD-томе, temp/HLS-кэш на NVMe.
2. Домен `video.<club>` → Caddy → автоматический HTTPS; наружу только 443. `webrtcAdditionalHosts`/публичный хост — при необходимости.
3. Env платформы: `GATEWAY_PUBLIC_URL=https://video.<club>`, `PLAYBACK_PUBLIC_URL=https://video.<club>`, `MEDIAMTX_CONTROL_URL` — внутренний (docker network/localhost).
4. Камеры: `gatewayHost` → домен gateway. Симулятор (`scripts/camera-simulator.mjs`) — для приёмки.
5. Резервное копирование БД не трогаем (Supabase), записи не бэкапим (ретенция короткая — потеря допустима, зафиксировать в README).

## Task 9: End-to-End приёмка

1. Симулятор стримит на VPS → запись НЕ идёт (файлов нет) — «тишина по умолчанию».
2. QR корта → Quick Play → «Записать матч» → сегменты появляются, размер соответствует ~3.6 ГБ/ч ±20%.
3. Завершение матча → запись `ready`, файл финализирован, VOD открывается, скачивается с корректным именем/заголовком.
4. Камера offline при попытке старта → внятная ошибка, файлы не пишутся.
5. Забытая запись (форс-мажор) → watchdog фейлит через 3 ч.
6. Ретенция: на тестовом стенде `recordDeleteAfter: 2m` → файлы удаляются, БД помечает `expired`.
7. Экономика: сутки на стенде — ГБ/день сходится с моделью (при тестовом адопшене пересчитать на 30%).
8. Тарифный гейт: starter-клуб не видит кнопку; club — видит.

---

## Риски / открытые вопросы

- **R1 (главный):** применение runtime path override к активному стриму в MediaMTX 1.20 — проверить в Task 1 до остального. Fallback: явные параметры в override или рестарт пути.
- **R2:** расхождение БД ↔ MediaMTX при падении платформы между start/stop — лечится сверкой (Task 2.4) и watchdog (Task 3).
- **R3:** HDD VPS («fair use» трафика) — мониторить исходящий; при росте переезд на дедик, код не меняется.
- **R4:** права на скачивание v1 мягкие (кто на QR-странице) — ужесточить при профиле игрока (`player_pwa`).
- **R5:** оплата за матч (€4–5 с игрока) — вне этого плана (Stripe v2, §55); сейчас флоу бесплатный для пилота.
