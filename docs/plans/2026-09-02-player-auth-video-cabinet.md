# Player Auth + Personal Video Cabinet — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Игрок регистрируется/входит (Google, e-mail magic link, позже Apple) и получает личный кабинет: его записи матчей, просмотр и скачивание **только своих** видео. Сейчас identity — `?player_id=` в URL (`/me`) без какой-либо авторизации, скачивание любого матча — по непредсказуемому UUID.

**Architecture:** Supabase Auth (GoTrue) — уже в проекте: env `NEXT_PUBLIC_SUPABASE_*`, `@supabase/ssr`, фабрика клиентского инстанса `createClientSupabaseClient` (lib/supabase.ts) есть, `supabase.auth` пока не используется нигде. Связка auth-пользователь ↔ игрок: `players.user_id` (миграция), авто-создание профиля игрока при первом входе. «Мои записи» — из `recording_sessions.metadata.participants[].playerId` (уже пишется при QR-старте, Task 3 плана 2026-09-02). Права на скачивание: участник записи (playerId match) или запись без участников-игроков (гостевая, ссылка и так непредсказуемая — v1).

**Tech Stack:** Supabase Auth (Google OAuth + Email Magic Link; Apple — при наличии Apple Developer $99/год, Phase 2; Telegram — Phase 2, у Supabase нет нативного провайдера), @supabase/ssr (cookie-сессии), Next.js App Router (server components / route handlers), PWA-friendly UI.

**Status:** Выполнен (2026-09-02), Tasks 1–8, Apple пропущен по решению (Phase 2). Живой e2e (поддельная cookie-сессия через admin-юзеров + password grant): вход → авто-профиль игрока → Quick Play с playerId → запись → «Мои записи» (3 шт) → скачивание: гость 401 / чужой 403 / участник 200×2. Попутно найдено и закрыто: (1) у players.id нет DB-default — генерируем UUID; (2) PostgREST не принимает contains по пути metadata->participants — contains на весь metadata; (3) рассинхрон часов БД/приложения/gateway (+13с) ломал окно VOD → единый источник времени = часы gateway: mediaStartedAt/mediaEndedAt из HTTP-заголовка Date ответа enable/disableRecording, окно строится в домене gateway (lead 1с + pad 6с, фолбэк lead 4с). Google OAuth — ручной чек-лист docs/auth-setup.md (email magic link уже работает из коробки, проверено 200).

**Ссылки на план-4:** §15 (QR self-service), §27 (CONNECT — игроки/профили), §101 (api_keys), §146 (VOD), §55/§94 (тарифы/фичи). Предыдущий план: `2026-09-02-qr-gated-recording-retention-downloads.md`.

---

## Контекст: что уже есть

- `lib/supabase.ts` — `createClientSupabaseClient()` (браузер, anon key, единый синглтон — GoTrueClient уже живёт в нём) и `createServerSupabaseClient()` (service role, без cookie). **Cookie-серверного клиента нет** — добавляем.
- `players` — id/name/avatar/dyId… (lib/types.ts), email/user_id НЕТ; локальное хранилище + синк (`lib/player-storage.ts`).
- `/me?player_id=` — кабинет игрока по URL-параметру, без auth.
- `recording_sessions.metadata.participants[] = {name, playerId}` — пишется QR-роутом записи (plan 2026-09-02 Task 3).
- Скачивание `GET /api/v1/video/recordings/{id}/download` — без проверки прав (R4 прошлого плана).

## Продуктовые решения (зафиксировать)

- **Провайдеры v1:** Google OAuth + Email Magic Link (безпарольный — самое простое для «не тех» людей; iPhone-пользователи нормально проходят через Google-аккаунт или почту). Apple Sign-In — Phase 2 (нужен Apple Developer-аккаунт). SMS OTP — не берём (платный Twilio). Telegram — Phase 2 (кастомный flow через Edge Function + бот).
- **Первый вход = создание профиля игрока** (имя из OAuth-метаданных / локальной части email). Клейм существующего «одноимённого» локального игрока НЕ делаем автоматически (коллизии имён) — кнопка «это я» в кабинете, Phase 2.
- **Гостевые записи** (матч без единого залогиненного игрока) остаются доступны по ссылке-UUID — на корте QR-флоу не должен ломаться требованием логина.

## Task 1: Cookie-сессия и серверный auth-хелпер

**Files:**
- Create: `lib/auth.ts`
- Test: `test/auth.test.ts` (чистые части)

1. Серверный cookie-клиент по канону `@supabase/ssr` для App Router: `getAuthUser()` — из `cookies()` route-handler'а; в server components — свой вариант (обе обёртки над одной фабрикой).
2. `getPlayerForUser(userId)` — player по `players.user_id` (service role).
3. Чистый хелпер `isRecordingParticipant(metadata, playerId)` — матч по `metadata.participants[].playerId` (JSONB contains, для API и download-гейта).
4. Юнит-тесты: participant-матч (есть/нет/пустые/гостевая запись).

## Task 2: Миграция players.user_id + профиль при входе

**Files:**
- Create: `supabase/migrations/20260903000000_add_players_user_id.sql`
- Modify: `lib/player-storage.ts` (или новый `lib/player-profile.ts`)

1. `ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;` + уникальный частичный индекс (`WHERE user_id IS NOT NULL`) + колонки `email TEXT`, `avatar_url TEXT` (из OAuth).
2. `ensurePlayerForUser({ userId, email, name, avatarUrl })` — upsert по user_id: создать при первом входе (name = user_metadata.full_name || email-префикс).
3. Применить миграцию через `scripts/apply-migration.mjs`.

## Task 3: Включение провайдеров в Supabase (ручной чек-лист + env)

1. Supabase Dashboard → Authentication: включить **Google** (OAuth client ID/secret из Google Cloud Console, redirect `https://<project>.supabase.co/auth/v1/callback`) и **Email Magic Link** (дефолтный SMTP хватит для старта; прод — свой SMTP).
2. Site URL / Redirect URLs: добавить домены приложения (`http://localhost:3000/**` для dev, прод-домен) — иначе magic link и OAuth-редирект упадут.
3. Зафиксировать чек-лист в `docs/` (или README auth-раздел): пошагово, без secrets.

## Task 4: /login + выход + шапка

**Files:**
- Create: `app/login/page.tsx` (+ компонент кнопок)
- Modify: шапка/меню (где уместно — `/me`, главная) — «Войти»/профиль

1. Кнопки «Продолжить с Google» и «Email-ссылка» (input + кнопка → `signInWithOtp({ email, options: { emailRedirectTo } })` → экран «проверьте почту»).
2. `handleCallback`: после редиректа от Supabase (`/auth/callback`) — сессия в cookie, `ensurePlayerForUser`, redirect на исходную страницу (`?next=`).
3. Создать `app/auth/callback/route.ts` (exchangeCodeForSession).
4. Выход: `signOut()` + очистка локального состояния.
5. Всё — client components через существующий `createClientSupabaseClient()`; никаких новых зависимостей.

## Task 5: Quick Play подхватывает залогиненного игрока

**Files:**
- Modify: `app/c/[code]/play/page.tsx`

1. Если в сессии Supabase есть юзер → его player подставляется в слоты (первый слот, имя заблокировано/предзаполнено), participant уходит с `playerId` = его player.id.
2. Гость без входа — как сейчас (имя → поиск по базе → guest).

## Task 6: «Мои записи» — API + кабинет

**Files:**
- Create: `app/api/v1/me/recordings/route.ts`
- Modify: `app/me/page.tsx` (вкладка/секция «Мои видео»)

1. `GET /api/v1/me/recordings` — по cookie-юзеру: player по user_id → `recording_sessions` где `metadata->participants @> [{playerId}]` (PostgREST `.contains('metadata->participants', [{playerId}])`) + статус `ready`, последние 20. Ответ: `{startedAt, endedAt, durationSec, vodUrl, downloadUrl, courtName}` (VOD-урл собирается как в обзорном роуте).
2. Секция в `/me`: список «Мои матчи» — смотреть/скачать; пустое состояние с подсказкой («записывай матчи кнопкой на корте — они появятся здесь»).
3. Идёмпотно к `?player_id=`-флоу: при залогиненном юзере кабинет всегда по auth-профилю, URL-параметр игнорируется.

## Task 7: Права на скачивание — «своё, не чужое»

**Files:**
- Modify: `app/api/v1/video/recordings/[id]/download/route.ts`

1. Есть cookie-юзер → его playerId; запись с `participants[].playerId`: доступ только участнику (403 иначе).
2. Запись без игроков-участников (гостевая) — доступ по UUID-ссылке как сейчас.
3. Не залогинен + запись с участниками → 401 с подсказкой «войдите, чтобы скачать свой матч».
4. Обзорный `/api/v1/video/courts/{code}` — НЕ гейтить (корт-страница публичная, VOD-просмотр остаётся публичным; закрываем только скачивание). Отметить как продуктовое решение.

## Task 8: Приёмка

1. Юнит: `isRecordingParticipant` (все ветки), `ensurePlayerForUser` SQL-склейка (чистая часть).
2. Живой e2e (dev): magic link на свой email → вход → профиль игрока создан → Quick Play с автоподстановкой → запись → `/me` показывает матч → скачивание ок; второй аккаунт → чужой матч не скачивается (403).
3. Google OAuth — вручную с телефона (Android + iPhone Safari), чек-лист в отчёте.
4. Гость без входа: QR-флоу не ломается, гостевая запись качается по ссылке.
5. Regression: `typecheck` + `vitest` зелёные; QR-флоу записи (план 2026-09-02) не задет.

## Риски / открытые вопросы

- **R1:** Supabase Auth включён на проекте? Проверить Dashboard (Auth → провайдеры); проект может иметь выключенные signup'ы — включить Email.
- **R2:** Magic link в мобильной почте открывается в браузере по умолчанию — PWA-обработка deep-link (`emailRedirectTo` на домен, не на localhost, в проде).
- **R3:** Локальные игроки (localStorage) не связаны с профилями — после входа дубликаты имён в списках; смягчение — сортировка «мой профиль первым», полный мёрж — Phase 2.
- **R4:** RLS не трогаем (таблицы под service role) — права проверяются в API-слое, консистентно с текущим кодом.
- **R5:** Apple/Telegram — отложено; при появлении Apple Developer — отдельная мини-задача (провайдер уже в Supabase).
