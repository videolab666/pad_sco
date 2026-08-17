# Padel Club Platform — полный структурный план продукта

> Цель: превратить существующее приложение подсчёта очков и вывода табло в полноценную multi-tenant платформу для падел-клубов, ежедневных игр, тренировок, турниров, трансляций, рекламы и управления оборудованием.

## 1. Что уже есть

- Подсчёт очков в паделе.
- Вывод счёта на физическое/экранное табло.
- Рекламный контент на табло в режиме простоя.
- База игроков.
- JSON для vMix.
- API.
- Публичная web-страница scorebug.
- Настраиваемый дизайн scorebug.
- TypeScript + Supabase.
- Возможность подключения физических кнопок управления счётом.

---

# 2. Позиционирование продукта

Не только **Padel Scoreboard**, а **Padel Club Platform**.

Основные направления:

1. **PLAY** — матчи, счёт, корты, физические контроллеры.
2. **CONNECT** — игроки, профили, QR, check-in.
3. **COMPETE** — рейтинги, лиги, Americano, Mexicano, турниры.
4. **BROADCAST** — scorebug, vMix, API, live-страницы, трансляции.
5. **MONETIZE** — реклама, спонсоры, рекламные кампании.
6. **MANAGE** — CRM клуба, расписание, устройства, сотрудники, аналитика.
7. **INTEGRATE** — внешние booking/CRM/API системы.
8. **OPERATE** — мониторинг, диагностика, обновления, offline-first.

---

# 3. Multi-tenant структура

Базовая иерархия:

```text
Platform
└── Organization / Customer
    ├── Club / Venue
    │   ├── Courts
    │   ├── Devices
    │   ├── Displays
    │   ├── Players
    │   ├── Staff
    │   ├── Sessions
    │   ├── Bookings
    │   ├── Matches
    │   ├── Tournaments
    │   └── Advertising
    └── Club / Venue #2
```

Один клиент может иметь несколько клубов/локаций.

---

# 4. Учётные записи, роли и разные интерфейсы

Да — нужна единая система аккаунтов, RBAC/permissions и интерфейс, адаптированный под роль.

## 4.1 Platform Super Admin

Интерфейс владельца SaaS:

- все клиенты;
- клубы;
- тарифы;
- лицензии;
- устройства;
- online/offline статус;
- версии приложений;
- ошибки;
- логи;
- remote diagnostics;
- управление подписками;
- usage;
- support;
- feature flags;
- remote configuration.

## 4.2 Organization Owner

- все свои клубы;
- финансовая/операционная статистика;
- сотрудники;
- рекламные кампании;
- турниры;
- игроки;
- настройки бренда;
- интеграции;
- API;
- роли и разрешения.

## 4.3 Club Manager / Administrator

Главный рабочий интерфейс клуба:

- карта всех кортов;
- текущие матчи;
- следующие бронирования;
- check-in;
- запуск/завершение session;
- управление игроками;
- реклама;
- турниры;
- устройства;
- оперативные уведомления.

## 4.4 Reception

Упрощённый интерфейс:

- расписание;
- корты;
- кто пришёл;
- check-in;
- добавить гостя;
- создать session;
- запустить игру;
- перенести игроков;
- посмотреть статус корта.

## 4.5 Tournament Director

- турниры;
- участники;
- посев;
- группы;
- сетки;
- расписание;
- назначение кортов;
- результаты;
- live-состояние;
- управление трансляцией.

## 4.6 Referee / Court Operator

Только конкретный матч/корт:

- A+;
- B+;
- undo;
- serve;
- side switch;
- correction;
- timeout;
- match controls.

## 4.7 Coach

- свои тренировки;
- игроки;
- court session;
- таймеры;
- упражнения;
- заметки;
- история тренировок;
- статистика игроков.

## 4.8 Player

Player Portal / PWA:

- профиль;
- QR;
- предстоящие игры;
- check-in;
- история матчей;
- рейтинг;
- статистика;
- пары;
- head-to-head;
- турниры;
- лиги;
- достижения;
- share-карточки.

## 4.9 Guest

Игрок может участвовать без обязательной регистрации.

Позже гостевой профиль можно связать с полноценным аккаунтом.

## 4.10 Permissions

Не ограничиваться жёсткими ролями.

Пример:

```text
matches.read
matches.control
matches.correct
players.manage
bookings.manage
tournaments.manage
advertising.manage
devices.manage
club.settings
billing.manage
api.manage
```

---

# 5. Главная сущность — Court Session

Booking нельзя приравнивать к Match.

```text
Booking
   ↓
Court Session
   ├── Participants
   ├── Format / Rotation
   ├── 0..N Matches
   ├── Timers
   └── Devices
```

Пример:

```text
Booking:       18:00–20:00
Court Session: 18:04–19:52

Participants: 7

Match #1: 18:08–18:31
Match #2: 18:34–18:57
Match #3: 19:00–19:24
...
```

Court Session поддерживает:

- 1 игрока;
- 2 игроков;
- 3 игроков;
- стандартные 4;
- 5–8 игроков с заменами;
- большие группы;
- тренировки;
- open play;
- турниры.

Типы:

```text
match
training
open_play
group_session
americano
mexicano
king_of_court
tournament
custom
```

---

# 6. Participants вместо предположения «всегда четыре игрока»

SessionParticipant:

- player;
- guest;
- coach;
- expected;
- checked_in;
- playing;
- waiting;
- left.

Отдельно:

- booking participants;
- session participants;
- match participants.

Игрок может быть участником session, но не конкретного матча.

---

# 7. Сценарии по количеству игроков

## 1 игрок

- индивидуальная тренировка;
- ball machine;
- подача;
- таймер;
- упражнения;
- статистика тренировки без обычного match score.

## 2 игрока

- singles;
- тренировка;
- упражнения;
- таймер.

## 3 игрока

- 2×1;
- тренировка;
- rotation;
- custom format.

## 4 игрока

- стандартный padel.

## 5–8+

- waiting list;
- автоматическая/ручная ротация;
- несколько матчей внутри одной session;
- open play;
- Americano/Mexicano;
- King of the Court.

---

# 8. Форматы игры

Поддержать:

- Standard Padel;
- Golden Point / No-Ad;
- Advantage;
- Fast4;
- Tie-break;
- Super Tie-break;
- custom set rules;
- singles;
- training;
- timed match;
- Americano;
- Mexicano;
- King of the Court;
- Winner Stays;
- Loser Leaves;
- round robin;
- groups;
- knockout;
- leagues;
- ladder;
- custom club formats.

---

# 9. Rotation Engine

Для 5–8+ игроков:

- manual;
- random;
- balanced by rating;
- winner stays;
- loser rotates;
- 1 player rotates;
- 2 players rotate;
- fixed duration;
- after set;
- after X games;
- after match;
- King of the Court.

Показывать на табло:

```text
PLAYING
Alex / Max
vs
Denis / Oleg

WAITING
Ivan
Roman
Petro

NEXT ROTATION
...
```

---

# 10. Americano

Создание события:

- количество игроков;
- количество кортов;
- длительность;
- количество раундов;
- points per round;
- ограничения пар;
- автоматическое расписание.

Система автоматически:

- создаёт пары;
- назначает соперников;
- распределяет корты;
- минимизирует повторения;
- принимает результаты;
- считает индивидуальные очки;
- формирует leaderboard;
- назначает следующий раунд.

---

# 11. Mexicano

Аналогично Americano, но пары/соперники следующих раундов формируются на основе текущего рейтинга/результатов.

Нужно:

- dynamic pairing;
- balancing;
- автоматическое расписание следующего тура;
- live leaderboard;
- tie-breaking rules.

---

# 12. King of the Court

- несколько кортов;
- court hierarchy;
- победитель двигается вверх;
- проигравший вниз;
- timed rounds;
- automatic rotation;
- live ranking.

---

# 13. Booking Integration Layer

Не строить собственную booking-систему как обязательное ядро.

Сделать универсальный слой:

```text
External Booking System
        ↓
Booking Adapter
        ↓
Normalized Booking
        ↓
Supabase
        ↓
Court Session
```

Booking приносит:

- где;
- когда;
- кто;
- статус.

Твоя система отвечает за:

- session;
- check-in;
- match;
- scoreboard;
- devices;
- statistics;
- tournament;
- broadcast.

## Методы интеграции

1. Webhooks.
2. REST API.
3. Polling.
4. CSV import.
5. Manual entry.

События:

```text
booking.created
booking.updated
booking.cancelled
booking.checked_in
```

---

# 14. External Identity Mapping

Игрок во внешней booking CRM должен связываться с внутренним player_id.

```text
External User
     ↓
integration_mapping
     ↓
Player
```

Сопоставление:

- external ID;
- телефон;
- email;
- ручное подтверждение;
- merge duplicates.

---

# 15. QR и self-service

QR можно размещать:

- на корте;
- на табло;
- возле reception;
- в booking confirmation.

Сценарий:

```text
SCAN
 ↓
определение Court
 ↓
текущая Booking
 ↓
"This is your booking?"
 ↓
Check-in
 ↓
выбор участников
 ↓
формат
 ↓
START
```

Если booking отсутствует:

```text
Quick Play
→ выбрать игроков/гостей
→ формат
→ Start
```

---

# 16. Автоматическое состояние табло

Пример state machine:

```text
IDLE
 ↓
ADVERTISEMENT
 ↓
UPCOMING BOOKING
 ↓
CHECK-IN
 ↓
PLAYERS READY
 ↓
WARM-UP
 ↓
MATCH
 ↓
SET BREAK
 ↓
MATCH RESULT
 ↓
NEXT SESSION / ADVERTISEMENT
```

---

# 17. Таймеры

Нужен универсальный Timer Engine.

## Court/session

- время аренды;
- remaining booking time;
- elapsed session;
- overtime.

## Match

- match duration;
- set duration;
- game duration.

## Training

- workout timer;
- interval timer;
- repetitions;
- work/rest.

## Tournament

- warm-up;
- timed round;
- court change;
- next round countdown.

## Дополнительно

- timeout;
- medical timeout;
- break;
- set break;
- changeover;
- countdown до следующего бронирования.

Таймеры могут выводиться на scoreboard/TV.

---

# 18. Физические кнопки

Устройство не должно знать бизнес-логику.

Пример:

```json
{
  "device_id": "court-03-controller",
  "action": "TEAM_A_POINT"
}
```

Backend:

```text
Device
 ↓
Court
 ↓
Active Session
 ↓
Active Match
 ↓
Score Engine
```

Actions:

- A+;
- B+;
- undo;
- redo;
- serve;
- switch sides;
- start;
- pause;
- finish;
- rotation;
- custom buttons.

Long press / combinations можно назначать отдельно.

---

# 19. Device Management

Сущности:

- controllers;
- displays;
- Android boxes;
- Raspberry Pi;
- tablets;
- streaming computers;
- other devices.

Хранить:

- device ID;
- club;
- venue;
- court;
- type;
- firmware/app version;
- IP/local info;
- last seen;
- battery/power status, если доступно;
- health;
- configuration.

---

# 20. Remote Management

SaaS dashboard:

```text
Club Kyiv

Court 1   🟢
Court 2   🟢
Court 3   🔴 Display offline
Court 4   🟢
```

Удалённые действия:

- reload;
- restart app;
- reconnect;
- test scoreboard;
- test buttons;
- diagnostics;
- logs;
- update configuration;
- software/firmware update;
- screenshot/health state, где допустимо.

---

# 21. Offline-first

Критично для коммерческого продукта.

Если интернет исчез:

- физические кнопки работают;
- матч продолжается;
- scoreboard продолжает работать;
- события сохраняются локально;
- после восстановления выполняется sync.

Нужно продумать conflict resolution.

---

# 22. Event-sourced Match Engine

Не хранить только итоговое состояние.

Пример событий:

```text
MATCH_STARTED
POINT_TEAM_A
POINT_TEAM_B
UNDO
SERVE_CHANGED
SIDE_SWITCHED
GAME_COMPLETED
SET_COMPLETED
TIMEOUT_STARTED
MATCH_COMPLETED
```

`match_events` — источник истины.

`match_state` — быстро читаемый projection/cache.

Преимущества:

- undo;
- redo;
- audit;
- replay;
- восстановление;
- offline sync;
- исправление ошибок;
- статистика;
- realtime broadcast.

---

# 23. Realtime

Supabase Realtime/WebSocket:

```text
score.changed
serve.changed
timer.changed
rotation.changed
game.finished
set.finished
match.finished
court.state.changed
```

Один event должен обновлять:

- физическое табло;
- web scoreboard;
- scorebug;
- vMix;
- public live page;
- admin dashboard;
- player app.

---

# 24. Scoreboard / Display Engine

Настраиваемые layouts:

- club branding;
- tournament branding;
- sponsor branding;
- minimal score;
- full score;
- training timer;
- Americano leaderboard;
- upcoming match;
- winner;
- court information.

Настройки:

- цвета;
- шрифты;
- логотип;
- фон;
- animations;
- sponsor placement;
- responsive layout;
- portrait/landscape.

---

# 25. Advertising / Digital Signage

Существующую рекламу в idle превратить в полноценный продукт.

## Assets

- PNG/JPG/WebP;
- video;
- animations;
- HTML templates;
- sponsor logos;
- club announcements.

## Campaign

- advertiser;
- assets;
- start/end date;
- schedule;
- courts;
- venues;
- priority;
- frequency;
- duration;
- targeting.

Пример:

```text
Sponsor A
Courts: 1–6
Time: 18:00–22:00
Campaign: 01.09–30.09
```

## Когда показывать

- idle;
- before match;
- after match;
- between games;
- between sets;
- during court change;
- before next booking;
- tournament breaks.

Не мешать непосредственно игре.

---

# 26. Advertising Analytics

Считать:

- impressions;
- duration;
- courts;
- sessions;
- matches;
- venue;
- date/time;
- total screen time.

Sponsor Report:

```text
Campaign: Sponsor XYZ
Impressions: 18,421
Screen time: 37h
Courts: 1–8
Matches reached: 327
```

Это позволяет клубу монетизировать табло.

---

# 27. Player CRM

Не просто таблица игроков.

Профиль:

- имя;
- фото;
- контакты;
- preferred language;
- club membership;
- level;
- rating;
- handedness (опционально);
- preferred side;
- history;
- partners;
- tournaments;
- leagues;
- achievements;
- notes/flags с правильными permissions;
- external IDs.

---

# 28. Player Statistics

- matches;
- wins/losses;
- win rate;
- sets;
- games;
- tie-breaks;
- golden points;
- super tie-breaks;
- streak;
- comeback wins;
- longest match;
- average duration;
- frequent partners;
- frequent opponents.

---

# 29. Pair Statistics

Пара — отдельная аналитическая сущность:

- games together;
- W/L;
- pair rating;
- best results;
- head-to-head;
- tournament history.

---

# 30. Head-to-Head

Игрок против игрока или пара против пары.

Пример:

```text
Alex / Max
vs
Denis / Oleg

Matches: 7
Wins: 5–2
Sets: 11–6
```

---

# 31. Rating Engine

Не привязывать архитектуру к одной формуле.

Поддержать:

- Elo;
- Glicko/Glicko-2;
- club custom rating;
- tournament points;
- separate Americano rating;
- optional external rating.

Rating Engine должен быть заменяемым.

---

# 32. Balanced Match

По рейтингу игроков система предлагает наиболее равные команды.

Для 4 игроков:

```text
Alex 1842
Max 1604
Denis 1780
Oleg 1661
```

→ оптимальная разбивка.

Для 5–8 игроков — оптимизация ротаций и пар.

---

# 33. Club Ranking

Leaderboard:

- overall;
- men/women/mixed, если клуб использует категории;
- level;
- age category;
- period;
- tournament;
- season;
- Americano;
- league.

---

# 34. Achievements / Engagement

Опционально:

- win streak;
- 100 matches;
- tournament winner;
- Americano champion;
- tie-break master;
- club veteran.

Не превращать это в обязательную часть ядра.

---

# 35. Tournament Engine

Форматы:

- knockout;
- round robin;
- groups + playoff;
- double elimination;
- Americano;
- Mexicano;
- King of Court;
- custom.

---

# 36. Tournament Workflow

```text
Create Tournament
 ↓
Registration
 ↓
Players / Teams
 ↓
Seeding
 ↓
Draw
 ↓
Schedule
 ↓
Court Assignment
 ↓
Matches
 ↓
Results
 ↓
Next Round
 ↓
Final
```

После окончания матча:

- результат сохраняется;
- bracket обновляется;
- следующий матч определяется;
- court может получить следующий match автоматически.

---

# 37. Multi-court Tournament Control

Dashboard:

```text
Court 1   LIVE   SF #1
Court 2   LIVE   SF #2
Court 3   READY  Match #34
Court 4   DELAY  7 min
```

Функции:

- assign;
- move match;
- delay;
- hold;
- call players;
- start;
- finish;
- override result.

---

# 38. Public Live Tournament Page

Публичная страница:

- Live Courts;
- Schedule;
- Results;
- Groups;
- Bracket;
- Players;
- Rankings;
- Watch Live.

---

# 39. Broadcast

Сохранить и расширить существующие возможности:

- JSON;
- vMix;
- browser source;
- customizable scorebug;
- OBS/browser compatibility;
- multiple courts;
- tournament graphics.

---

# 40. Broadcast API

REST:

```text
GET /clubs/{id}/courts
GET /courts/{id}/state
GET /matches/{id}
GET /matches/{id}/score
GET /players/{id}
GET /tournaments/{id}
```

Realtime/WebSocket.

Webhooks:

```text
match.started
score.changed
game.finished
set.finished
match.completed
court.changed
```

---

# 41. CRM клуба

Минимальная CRM вокруг спортивного процесса:

- players/customers;
- guests;
- memberships;
- tags;
- levels;
- attendance;
- visit history;
- match history;
- tournaments;
- leagues;
- coaches;
- communication preferences;
- notes;
- consent/privacy settings.

Не обязательно сразу заменять полноценную коммерческую CRM клуба — предусмотреть интеграции.

---

# 42. Coaches / Training

Training Session:

- coach;
- players;
- court;
- duration;
- timer;
- drill;
- notes;
- result;
- optional statistics.

Можно показывать на экране:

```text
FOREHAND DRILL
03:42

WORK 45 sec
REST 15 sec
Round 4 / 10
```

---

# 43. Notifications

Каналы позже можно подключать через adapters:

- email;
- push;
- Telegram;
- SMS;
- WhatsApp, если доступно через провайдера.

События:

- booking soon;
- court ready;
- players called;
- next tournament match;
- match result;
- tournament result;
- device offline — только staff.

---

# 44. Player PWA

На первом этапе PWA вместо обязательных native приложений.

Разделы:

- Home;
- QR;
- upcoming;
- check-in;
- current match;
- history;
- statistics;
- rating;
- leaderboard;
- tournaments;
- leagues;
- profile.

---

# 45. Social / Share

Автогенерация карточки результата:

```text
REJO PADEL

Alex / Max
6:4 3:6 10:7
Denis / Oleg

Court 4
1h 24m
```

Share:

- Instagram;
- Telegram;
- messaging apps;
- download image.

---

# 46. Club Dashboard

Главный экран должен давать состояние клуба за несколько секунд.

Пример:

```text
COURT 1
LIVE · 01:12:43
Ivan / Petro  6–4 3–2  Max / Denis

COURT 2
AVAILABLE
Next booking 18:30

COURT 3
AMERICANO
Round 4/8 · 06:14 remaining

COURT 4
TRAINING
23 min remaining
```

---

# 47. Court State Machine

Например:

```text
offline
available
reserved
upcoming
check_in
warmup
playing
paused
rotation
finished
cleaning
maintenance
```

Состояния должны быть расширяемыми.

---

# 48. Audit Log

Для коммерческого продукта обязательно фиксировать:

- кто изменил счёт;
- кто исправил результат;
- кто удалил match;
- кто изменил booking;
- кто изменил campaign;
- кто менял permissions/settings.

---

# 49. Supabase / Data Model — предварительно

```text
organizations
clubs
venues
courts

users
profiles
roles
permissions
user_roles

players
club_players
player_external_ids

bookings
booking_participants

court_sessions
session_participants

matches
match_participants
match_events
match_state

ratings
rating_events

tournaments
tournament_entries
tournament_rounds
tournament_matches

leagues
league_entries

devices
device_assignments
device_status
device_commands

display_profiles
scoreboard_themes

advertisers
advertising_assets
advertising_campaigns
advertising_schedules
advertising_impressions

integrations
integration_mappings
webhook_events

notifications
audit_log
```

---

# 50. Supabase Security

Критично сразу проектировать RLS.

Принцип:

```text
User
 ↓
Organization Membership
 ↓
Club Permissions
 ↓
Resource Access
```

Игрок не должен иметь возможность изменить score прямым запросом к Supabase.

Критические команды должны проходить через доверенный server/Edge Function/API слой.

---

# 51. API Architecture

TypeScript domain modules:

```text
Auth
Organizations
Clubs
Courts
Bookings
Sessions
Players
Matches
Scoring
Rotations
Ratings
Tournaments
Advertising
Devices
Integrations
Broadcast
Notifications
Analytics
```

Не помещать всю бизнес-логику в frontend или SQL triggers.

---

# 52. Integration Adapter Pattern

Например:

```ts
interface BookingProvider {
  getBookings(...): Promise<NormalizedBooking[]>
  getBooking(...): Promise<NormalizedBooking>
  handleWebhook(...): Promise<void>
}
```

Аналогично:

- notification provider;
- payment provider;
- broadcast provider;
- external rating provider.

---

# 53. Reliability

Нужно предусмотреть:

- idempotency;
- duplicate webhook protection;
- retries;
- event ordering;
- offline queue;
- optimistic UI;
- reconnect;
- conflict handling;
- health checks.

Особенно для `POINT`/`UNDO`.

---

# 54. Analytics клуба

Club analytics:

- court utilization;
- sessions/day;
- matches/day;
- peak hours;
- average session;
- players active;
- returning players;
- tournament participation;
- advertising impressions;
- device uptime.

Если booking integration предоставляет данные — occupancy/utilization можно считать точнее.

---

# 55. SaaS / Billing

Архитектурно предусмотреть:

- subscriptions;
- plans;
- limits;
- trials;
- per-club;
- per-court;
- add-ons;
- feature flags.

Возможная упаковка:

## STARTER

- scoreboard;
- physical buttons;
- players;
- history;
- basic themes.

## CLUB

- multi-court;
- booking integration;
- player CRM;
- ratings;
- advertising;
- remote management;
- QR/check-in.

## PRO / TOURNAMENT

- tournament engine;
- Americano/Mexicano;
- leagues;
- vMix/broadcast;
- API/webhooks;
- public live pages;
- advanced sponsor analytics.

Можно также продавать отдельные add-ons.

---

# 56. White Label

Для крупных клубов:

- logo;
- domain;
- colors;
- scoreboard themes;
- public pages;
- player PWA branding;
- sponsor packages.

---

# 57. Локализация

Сразу не зашивать текст в компоненты.

Минимально предусмотреть:

- Ukrainian;
- English;

далее:

- Spanish;
- Swedish;
- Italian;
- French и т.д.

Padel — международный рынок.

---

# 58. Приоритет реализации

## Phase 1 — превратить scoreboard в Club Product

1. Organizations / Clubs / Courts.
2. Auth + roles + permissions.
3. Court Session.
4. Flexible participants.
5. Match events/state.
6. Device → Court → Session → Match.
7. Multi-court dashboard.
8. Player history.
9. QR / Quick Play.
10. Offline/reconnect foundation.

## Phase 2 — ежедневная ценность клубу

1. Booking Integration Layer.
2. Check-in.
3. Player CRM.
4. Rating Engine.
5. Club leaderboard.
6. Balanced teams.
7. Rotation Engine.
8. Timers.
9. Advertising Manager.
10. Advertising analytics.
11. Remote device management.

## Phase 3 — social play

1. Americano.
2. Mexicano.
3. King of Court.
4. Open Play.
5. leagues/ladder.
6. Player PWA.
7. achievements/share cards.

## Phase 4 — Tournament Platform

1. Tournament engine.
2. Registration.
3. Seeding.
4. Brackets/groups.
5. Multi-court scheduler.
6. Automatic next match.
7. Public live pages.
8. Broadcast integration.

## Phase 5 — масштабирование SaaS

1. Billing.
2. Plans/features.
3. White label.
4. Advanced analytics.
5. More booking integrations.
6. Monitoring/observability.
7. Fleet management.
8. Internationalization.

---

# 59. Главный пользовательский сценарий клуба

```text
Игрок бронирует корт
        ↓
Booking Integration
        ↓
Court Session подготовлена
        ↓
Игрок приходит
        ↓
QR / Check-in
        ↓
Система знает участников
        ↓
Выбор Standard / Americano / Training / ...
        ↓
Start
        ↓
Физические кнопки
        ↓
Score Engine
        ↓
Realtime
 ┌──────┼────────┬─────────┬─────────┐
 TV   Scorebug  vMix    Live Page   PWA
        ↓
Match Finished
        ↓
History + Statistics + Rating
        ↓
Result / Share
        ↓
Display → Advertising
```

---

# 60. Ключевой принцип продукта

Система не должна быть построена вокруг предположения:

> «На корте всегда четыре человека, которые играют один стандартный матч».

Правильная модель:

> **Club → Court → Session → Participants → Activities/Matches**

Booking, Match, Training, Tournament, Americano и Advertising — разные связанные сущности.

Это позволит одной архитектуре обслуживать обычную аренду, тренировки, open play, 1–8+ игроков, Americano/Mexicano, турниры, трансляции и коммерческую рекламу без переделки ядра.

---

# 61. Payments / Memberships / Packages

Даже если платформа не становится полноценной системой бронирования и эквайринга, она должна понимать коммерческий статус игрока.

Сущности:

```text
Player
├── Membership
├── Subscription
├── Package / Credits
├── Balance
├── Benefits
└── Payment Status
```

Возможные модели:

- месячный/годовой абонемент;
- 10 тренировок;
- пакет часов корта;
- unlimited membership;
- guest;
- corporate membership;
- tournament entry;
- coaching package;
- promotional credits.

Пример отображения для reception:

```text
Alex Petrenko
Membership: ACTIVE
Package: Training 8 / 10
Court credits: 4h 30m
Valid until: 31.12.2026
```

На первом этапе платформа может только синхронизировать эти данные из внешней CRM/booking/payment-системы. Архитектура не должна требовать собственного эквайринга.

---

# 62. Двусторонняя Booking Integration

Integration Layer должен поддерживать не только:

```text
Booking Provider → Padel Platform
```

но архитектурно и:

```text
Padel Platform → Booking Provider
```

если внешний provider разрешает запись.

Возможные обратные события:

- player checked in;
- no-show;
- session started;
- session completed;
- court became available;
- session extended;
- court unavailable;
- maintenance started;
- tournament reserved court;
- booking participant changed.

Пример:

```text
Booking Court 3: 18:00–20:00
Match finished: 19:31
Session closed: 19:34

→ provider может открыть оставшееся окно,
  если его API и правила клуба это допускают.
```

Обязательны capability flags, поскольку разные providers имеют разные возможности:

```text
can_read_bookings
can_write_bookings
can_update_status
can_manage_participants
can_block_court
supports_webhooks
supports_incremental_sync
```

---

# 63. Open Match / Looking for Players

Одна из ключевых social-функций.

Игрок или клуб создаёт открытую игру:

```text
OPEN MATCH

Today 19:00–20:30
Court 2
Level: 3.0–3.5

Alex     3.42
Denis    3.37
OPEN
OPEN
```

Другие игроки могут:

- Join;
- Request to Join;
- Leave;
- Invite friend;
- join waiting list.

Настройки:

- public/private;
- minimum/maximum rating;
- gender/category при необходимости;
- age category;
- preferred side;
- club members only;
- approval required;
- price/share of booking;
- maximum participants.

Open Match должен связываться с Booking и Court Session, но не быть ими.

---

# 64. Matchmaking Engine

Цель:

> «Хочу сыграть сегодня после 18:00».

Matchmaking может учитывать:

- club/venue;
- доступные корты;
- временное окно;
- player rating;
- rating confidence;
- preferred side;
- preferred format;
- обычных партнёров;
- предыдущих соперников;
- доступность игроков;
- membership;
- open matches.

Результат:

```text
Suggested Match
19:30–21:00 · Court 4

Alex   3.42
Max    3.38
Ivan   3.51
Oleg   3.36

Estimated balance: 94%
```

В дальнейшем matchmaking может оптимизировать загрузку клуба в непиковые часы.

---

# 65. Attendance / No-show

Для Booking и Session хранить attendance отдельно от результата матча.

Статусы:

```text
expected
confirmed
checked_in
late
playing
completed
left
cancelled
no_show
```

Метрики:

- attendance rate;
- cancellation rate;
- no-show rate;
- average arrival time;
- late arrivals;
- participation frequency.

Политики клуба должны быть конфигурируемыми, а не зашитыми в код.

---

# 66. Court Access / Smart Access

Архитектурно предусмотреть интеграцию с:

- smart locks;
- electronic doors;
- turnstiles;
- PIN panels;
- QR readers;
- NFC/RFID;
- external access-control systems.

Пример workflow:

```text
Booking 22:00–23:30
        ↓
Player QR / PIN
        ↓
Booking validated
        ↓
Access Granted
        ↓
Court Session prepared
        ↓
Lights ON
        ↓
Scoreboard READY
```

После окончания разрешение может автоматически истечь.

Нельзя напрямую связывать access hardware с Booking Provider — доступ должен проходить через общий authorization/integration слой.

---

# 67. Court IoT Layer

Создать универсальную модель устройств и capabilities.

Возможные устройства:

- physical score controller;
- scoreboard display;
- Android TV box;
- tablet;
- Raspberry Pi;
- smart lock;
- lights;
- camera;
- streaming encoder;
- speaker;
- environmental sensor;
- occupancy sensor.

Пример capabilities:

```text
score_input
display
video_capture
audio_output
door_control
light_control
temperature
occupancy
remote_restart
```

Это позволит добавлять новые типы hardware без изменения модели Court.

---

# 68. Camera / Video Integration

Court может иметь несколько video sources.

```text
Court
├── Camera 1
├── Camera 2
├── Camera 3
├── Encoder
├── Recording Service
└── Streaming Output
```

Match связывается с:

```text
recording_id
recording_started_at
recording_ended_at
stream_url
vod_url
```

Player Portal может показывать:

```text
Match Result
6:4 3:6 10:7

[Watch Match]
[Highlights]
```

Video subsystem должен быть адаптером, чтобы не зависеть от конкретного производителя камер/NVR/streaming service.

---

# 69. Match Timeline

Event sourcing должен иметь пользовательское представление.

Пример:

```text
18:04 Match Started
18:14 Game 1–0
18:28 Game 3–2
18:46 Set 6–4
19:21 Set 3–6
19:38 Super Tie-break 10–7
19:39 Match Finished
```

Timeline полезен:

- player;
- administrator;
- tournament director;
- broadcaster;
- support;
- video subsystem;
- debugging.

---

# 70. Automatic Video Markers / Highlights

Score Engine уже знает важные события:

- break point;
- golden point;
- set point;
- match point;
- tie-break;
- super tie-break;
- set won;
- match won;
- comeback.

На основании этого создавать video markers:

```text
01:12:37 MATCH_POINT
01:13:04 MATCH_WON
```

Если recording provider поддерживает clipping:

```text
clip_start = event_time - 15 sec
clip_end   = event_time + 10 sec
```

Позже можно добавить computer vision, но первая версия highlights не требует AI.

---

# 71. Advertising Proof of Play

Рекламная аналитика должна фиксировать реальное воспроизведение.

Событие:

```text
ad_id
campaign_id
asset_id
display_id
court_id
venue_id

started_at
ended_at
actual_duration
expected_duration

playback_completed
device_online
session_id
match_id (optional)
```

Это позволяет формировать коммерческий Proof-of-Play отчёт.

Пример:

```text
Sponsor XYZ
Campaign: Summer 2026

Plays: 8,421
Completed: 8,193
Screen time: 31h 42m
Displays: 12
Courts: 8
```

---

# 72. Advertising Frequency / Share of Voice

Campaign Engine должен поддерживать:

- priority;
- rotation weight;
- minimum interval;
- maximum impressions;
- daily cap;
- per-display cap;
- share of voice;
- date/time targeting;
- court/venue targeting.

Пример:

```text
Sponsor A     50%
Sponsor B     30%
Club Content  20%
```

И:

```text
max 1 play / 5 min
max 30 plays / display / day
```

---

# 73. Promotions / CTA

Display Network должен продавать не только стороннюю рекламу, но и услуги клуба.

Примеры:

```text
AMERICANO FRIDAY
7 / 12 registered

[QR: JOIN]
```

```text
COACHING
Tomorrow 09:00
2 places remaining
```

```text
Court available 14:00–15:30
SCAN TO BOOK
```

CTA может вести на:

- tournament registration;
- booking;
- open match;
- coaching;
- membership;
- club website.

---

# 74. Club Content Manager

Не объединять весь экранный контент под сущностью Advertising.

Content Types:

```text
advertisement
announcement
event
promotion
informational
emergency
sponsor
club_branding
```

Примеры:

- правила клуба;
- tournament announcement;
- Happy Birthday;
- restaurant promotion;
- Court 3 maintenance;
- lost item;
- emergency information.

---

# 75. Universal Scheduling Engine

Сделать единый Scheduler вместо нескольких независимых систем расписаний.

Правило:

```text
Target
Schedule
Conditions
Priority
Action
```

Пример:

```text
Mon–Fri
17:00–22:00
Venue Kyiv
Courts 1–8
```

Scheduler смогут использовать:

- advertising;
- club content;
- tournament;
- device actions;
- lighting;
- notifications;
- automations.

---

# 76. Automation & Orchestration Engine

Один из ключевых архитектурных модулей.

Модель:

```text
TRIGGER
   ↓
CONDITIONS
   ↓
ACTIONS
```

Пример:

```text
WHEN match.finished
THEN show_result for 30 sec
THEN show_campaign "Sponsor A"
THEN show_next_booking
```

Другой:

```text
WHEN booking.starts_in = 10 min
AND court.state = idle

THEN display upcoming booking
```

Другой:

```text
WHEN device.offline > 2 min
THEN notify club_manager
```

Triggers:

- booking created/updated/starting;
- player checked in;
- session started/finished;
- match started;
- point;
- game/set/match finished;
- timer;
- tournament round;
- court state;
- device online/offline;
- advertising event;
- schedule.

Actions:

- change display;
- create session;
- create match;
- start timer;
- notify;
- change court state;
- play campaign;
- assign next match;
- control IoT device;
- invoke integration;
- emit webhook.

Не давать пользовательским workflows возможность обходить security/permissions.

---

# 77. Court Workflow Templates

Сохранённые сценарии работы Court.

## Normal Booking

```text
Advertising
→ Upcoming Booking
→ Check-in
→ Warm-up
→ Match
→ Result
→ Advertising
```

## Tournament

```text
Tournament Branding
→ Player Call
→ Warm-up
→ Match
→ Result
→ Next Match
```

## Training

```text
Coach Branding
→ Drill
→ Timer
→ Rest
→ Next Drill
```

Клуб может создавать собственные workflow presets.

---

# 78. Custom Scoring Rules / Presets

Не добавлять enum на каждый клубный формат.

Сделать `ScoringPreset`.

Параметры могут описывать:

- points;
- games;
- sets;
- advantage/no-ad;
- tie-break threshold;
- tie-break target;
- super tie-break;
- timed round;
- score cap;
- win-by-two;
- number of sets.

Пример:

```text
Preset:
"REJO Friday Cup"

Sets: 1
Games: Fast4
No-Ad: yes
Tie-break: 3–3
```

Валидация должна запрещать логически невозможные комбинации.

---

# 79. Seasons

Сущность:

```text
Season
```

Примеры:

```text
Winter 2026
Spring 2027
Club Championship 2027
```

Используется для:

- ratings;
- leagues;
- leaderboards;
- achievements;
- statistics.

Поддержать:

- lifetime;
- current season;
- rolling period;
- custom period.

---

# 80. Skill Levels / Divisions

У каждого клуба может быть собственная система уровней.

Примеры:

```text
Beginner
D
C
C+
B
B+
A
Pro
```

или:

```text
1.0–5.0
```

Level System должен быть конфигурируемым.

Не смешивать:

```text
skill_level
```

и:

```text
rating
```

Rating может вычисляться автоматически, level может назначаться клубом/тренером.

---

# 81. League Engine

Полноценные клубные лиги:

- seasons;
- divisions;
- fixtures;
- standings;
- points rules;
- rescheduling;
- playoffs;
- promotion/relegation.

Пример:

```text
Division A
Division B
Division C
```

После сезона:

```text
Top 2 → Promotion
Bottom 2 → Relegation
```

League Engine должен использовать тот же Match Engine.

---

# 82. Corporate / Club Events

Отдельная сущность `Event`.

Event может объединять:

- participants;
- bookings;
- courts;
- tournament;
- schedule;
- branding;
- advertising;
- content;
- staff.

Пример:

```text
Adidas Corporate Padel Day
10:00–18:00

Courts: 1–8
Players: 64
Brand Theme: Adidas
Tournament: Americano
```

---

# 83. CRM Segmentation

Player CRM должна поддерживать динамические/ручные сегменты.

Примеры:

```text
New Players
Inactive 30 Days
VIP
Beginners
Tournament Players
Coaching Clients
Morning Players
Americano Players
```

Сегменты можно использовать для:

- analytics;
- invitations;
- promotions;
- notifications;
- event targeting.

---

# 84. Privacy / Consent

Для международного продукта privacy должна быть частью data model.

Отдельные consent flags:

- public name;
- profile photo;
- public rating;
- match history;
- tournament participation;
- public live scoreboard;
- video/stream appearance;
- marketing communication.

Хранить:

```text
consent_type
status
version
granted_at
revoked_at
source
```

---

# 85. Data Export / Deletion / Anonymization

Предусмотреть:

- Export My Data;
- Delete Account;
- anonymize player;
- organization export;
- club export.

Удаление Player не должно уничтожать историческую целостность турниров и матчей.

Возможная модель:

```text
Player deleted
→ personal fields anonymized
→ match participant preserved as historical anonymous participant
```

---

# 86. Backups / Disaster Recovery

Помимо offline-first:

- database backups;
- point-in-time recovery;
- configuration backups;
- tournament recovery;
- advertising campaign recovery;
- device configuration recovery.

Нужно определить:

- RPO;
- RTO;
- recovery procedure;
- periodic restore tests.

---

# 87. Observability

Создать отдельный telemetry layer.

```text
Logs
Metrics
Traces
Errors
Device Telemetry
Audit
```

Ключевые метрики:

- API latency;
- Realtime latency;
- point-to-display latency;
- webhook delay;
- error rate;
- device uptime;
- reconnect count;
- offline queue size;
- sync failures.

Пример продуктового SLO:

```text
Button Press
→ Score Event
→ Display Updated

P95 < target latency
```

---

# 88. Device Provisioning

Подключение оборудования должно быть zero-friction.

Пример:

На новом scoreboard:

```text
PAIR DEVICE

A7K9Q2
```

В Admin:

```text
Add Device
→ Enter A7K9Q2
→ Assign Court 4
→ Done
```

Provisioning должен:

- выдавать credentials;
- привязывать tenant;
- привязывать court;
- загружать configuration;
- назначать software channel.

---

# 89. Zero-Touch Configuration / Updates

Устройства получают централизованно:

- configuration;
- theme;
- credentials;
- endpoints;
- software updates;
- firmware updates, если поддерживается.

Update channels:

```text
stable
beta
development
```

Нужны:

- staged rollout;
- rollback;
- version compatibility;
- update status.

---

# 90. Club Onboarding Wizard

Цель — новый клуб должен подключаться без ручного сопровождения разработчиком.

```text
Create Organization
→ Create Venue
→ Add Courts
→ Add Displays
→ Pair Devices
→ Import Players
→ Connect Booking
→ Upload Logo
→ Select Theme
→ Test Court
→ Ready
```

Показывать onboarding progress.

---

# 91. Demo / Sales Mode

Предусмотреть полноценный демонстрационный tenant.

Например:

```text
DEMO PADEL CLUB

6 Courts
40 Demo Players
2 Live Matches
1 Americano
1 Tournament
Advertising Campaign
Ratings
Booking Schedule
```

Demo reset:

```text
Reset Demo Data
```

Это позволяет демонстрировать продукт без реального клуба.

---

# 92. Import / Migration

Для продаж критически важен простой импорт существующих данных.

Импорт:

- players CSV/XLSX;
- ratings;
- memberships;
- teams;
- historical matches;
- tournament participants;
- external IDs.

Workflow:

```text
Upload
→ Column Mapping
→ Validation
→ Duplicate Detection
→ Preview
→ Import
```

Импорт должен быть reversible или иметь staging.

---

# 93. Support Tools

Platform Super Admin:

- tenant diagnostics;
- user lookup;
- device lookup;
- match event inspection;
- integration status;
- webhook history;
- retry failed jobs;
- session diagnostics.

Опционально:

```text
View as Club Admin
```

или controlled impersonation.

Обязательно:

- permission check;
- reason;
- audit log;
- visible support session marker.

---

# 94. Feature Flags

Feature Flag Service:

```text
feature
enabled
scope
configuration
```

Scope:

- global;
- plan;
- organization;
- club;
- user;
- beta cohort.

Примеры:

```text
mexicano_v2
video_highlights
advanced_ads
booking_provider_x
new_score_engine
```

Использовать для безопасного rollout.

---

# 95. Product Analytics

Отдельно от Club Analytics.

Метрики владельца SaaS:

- active organizations;
- active venues;
- active courts;
- matches/day;
- sessions/day;
- matches/court;
- QR usage;
- physical controller usage;
- booking integration adoption;
- Americano/Mexicano usage;
- tournament usage;
- advertising adoption;
- player PWA usage;
- retention клуба;
- feature adoption.

Не собирать лишние персональные данные только ради аналитики.

---

# 96. Unified Domain Event Bus

Чтобы Automation, Broadcast, Advertising, Video и Analytics не связывались напрямую друг с другом, нужен общий event layer.

Пример:

```text
Match Engine
    ↓
Domain Event
    ↓
Event Bus
 ┌──────┬──────────┬───────────┬─────────┐
Realtime Automation Broadcast  Video   Analytics
```

Примеры событий:

```text
court.session.started
player.checked_in

match.started
match.point_scored
match.game_completed
match.set_completed
match.completed

device.online
device.offline

booking.created
booking.updated

tournament.round_completed
```

События должны иметь:

```text
event_id
event_type
schema_version
organization_id
club_id
aggregate_id
occurred_at
actor
payload
correlation_id
```

---

# 97. Idempotency / Event Ordering

Особенно важно для физических кнопок и нестабильного интернета.

Каждая команда устройства:

```text
command_id
device_id
sequence_number
created_at
action
```

Backend должен уметь распознать повторную отправку.

```text
same command_id
→ do not score twice
```

Для offline controllers нужен локальный sequence number.

---

# 98. Conflict Resolution

Пример:

- controller offline;
- referee одновременно исправил score через web;
- controller возвращается с queued events.

Нельзя просто применить всё подряд.

Нужна стратегия:

- server revision;
- event sequence;
- optimistic concurrency;
- conflict state;
- manual resolution для сложных случаев.

Критические конфликты должны попадать в Admin UI.

---

# 99. Command vs Event

Архитектурно различать:

```text
COMMAND:
"Add point to Team A"

EVENT:
"Point was awarded to Team A"
```

Device/API отправляет command.

Domain logic проверяет:

- permissions;
- active match;
- current state;
- idempotency;
- scoring rules.

После этого создаётся event.

Это защищает Score Engine от некорректных прямых изменений.

---

# 100. API Versioning

Публичный API должен иметь стабильную версионность.

Например:

```text
/api/v1/...
```

Нужно определить:

- backwards compatibility;
- deprecation;
- API keys;
- scopes;
- rate limits;
- webhook versions.

---

# 101. API Keys / Integration Accounts

Не использовать обычные user tokens для серверных интеграций.

Сущности:

```text
service_accounts
api_keys
api_scopes
```

Scopes:

```text
scores:read
matches:read
matches:write
players:read
courts:read
webhooks:manage
```

Keys должны иметь:

- expiration;
- rotation;
- revoke;
- last used;
- audit.

---

# 102. Webhook Delivery System

Для внешних интеграций:

```text
Webhook Endpoint
Subscriptions
Delivery Attempts
Retry Queue
Dead Letter
```

Хранить:

- event;
- endpoint;
- HTTP result;
- attempts;
- next retry;
- delivery status.

Подписывать webhook payload secret/key.

---

# 103. Background Jobs

Не выполнять тяжёлые процессы внутри пользовательского request.

Job Queue для:

- imports;
- exports;
- rating recalculation;
- tournament generation;
- advertising reports;
- video clipping;
- notifications;
- integration sync;
- webhook retries.

---

# 104. Search

По мере роста CRM понадобится единый поиск:

```text
Search:
Alex
```

Результаты:

```text
Players
Bookings
Sessions
Matches
Tournaments
Devices
```

Поиск должен быть tenant-aware.

---

# 105. Tags / Custom Fields

Клубы неизбежно захотят свои поля.

Не добавлять колонку в schema под каждый запрос.

Поддержать ограниченные custom fields для:

- player;
- booking;
- event;
- organization.

И tags:

```text
VIP
Coach
Corporate
Junior
Morning Group
```

С типами и validation.

---

# 106. Club Branding System

Brand profile:

```text
logo
secondary_logo
colors
fonts
court naming
scoreboard theme
public page theme
email theme
sponsor areas
```

Tournament/Event может временно override Club Brand.

Приоритет:

```text
Platform Default
→ Organization
→ Club
→ Event/Tournament
→ Match override
```

---

# 107. Display Layout Zones

Вместо монолитного scoreboard предусмотреть layout zones.

Например:

```text
┌──────────────────────────────┐
│ Event / Club Header          │
├──────────────────────────────┤
│                              │
│       SCORE AREA             │
│                              │
├───────────────┬──────────────┤
│ Sponsor Zone  │ Timer / Info │
└───────────────┴──────────────┘
```

Zones могут иметь разные content policies.

Это позволит показывать sponsor logo во время игры без запуска полноэкранной рекламы.

---

# 108. Display Priority System

Если одновременно хотят отображаться:

- emergency message;
- match;
- tournament branding;
- advertisement;
- upcoming booking;

нужны чёткие priorities.

Например:

```text
Emergency
Match Critical State
Match
Tournament
Upcoming Booking
Club Content
Advertising
Idle
```

Automation Engine не должен ломать этот порядок.

---

# 109. Emergency Override

Club Manager должен иметь кнопку:

```text
SHOW ON ALL DISPLAYS
```

Для срочного сообщения.

Scope:

- display;
- court;
- venue;
- organization.

Emergency override должен иметь TTL, чтобы экран не остался заблокирован навсегда.

---

# 110. Court Maintenance

Court — не только available/booked.

Maintenance:

```text
scheduled
in_progress
completed
cancelled
```

Причины:

- glass;
- surface;
- lighting;
- scoreboard;
- cleaning;
- camera;
- other.

Maintenance может:

- блокировать booking;
- менять display;
- уведомлять staff;
- исключать court из tournament scheduler.

---

# 111. Tasks / Internal Operations

Лёгкий operations слой:

```text
Task
Assignee
Court
Priority
Due Time
Status
```

Примеры:

```text
Replace button Court 4
Clean Court 2
Check TV Court 6
```

Не превращать это в полноценный project manager.

---

# 112. Kiosk Mode

Для reception/tablet:

- fullscreen;
- restricted navigation;
- auto-login device session;
- large controls;
- quick player lookup;
- QR scanner;
- quick court actions.

Отдельный device identity вместо хранения полного admin session на публичном устройстве.

---

# 113. Public Spectator Mode

Публичный экран клуба:

```text
LIVE NOW
NEXT MATCHES
TOURNAMENT TABLE
CLUB RANKING
ADVERTISING
```

Можно использовать TV в lounge/reception независимо от court scoreboard.

---

# 114. Venue Wall / Video Wall

Один общий экран:

```text
Court 1   6:4 2:1
Court 2   3:6 5:4
Court 3   TB 5:3
Court 4   Available
```

Полезно:

- reception;
- spectator zone;
- tournament control room.

---

# 115. Multi-language Player Names / Transliteration

Для международных турниров предусмотреть:

- original display name;
- Latin transliteration;
- short display name;
- scoreboard abbreviation.

Например:

```text
Олександр Петренко
Oleksandr Petrenko
O. PETRENKO
```

---

# 116. Notification Preferences

Player/staff выбирает:

- channels;
- categories;
- quiet hours;
- language.

Например:

```text
Tournament calls → Push + Telegram
Marketing → Email
Match results → Push
```

Critical staff alerts имеют отдельную политику.

---

# 117. Rate Limiting / Abuse Protection

Защитить:

- public API;
- QR endpoints;
- login;
- join requests;
- score commands;
- device pairing;
- webhook endpoints.

Особенно score-changing endpoints.

---

# 118. Security Model

Кроме Supabase RLS:

- MFA для staff/admin;
- optional SSO для крупных клиентов;
- session management;
- device authentication;
- service accounts;
- secret rotation;
- least privilege;
- audit trail.

Platform Super Admin должен иметь максимально строгую защиту.

---

# 119. Environments

Разделить:

```text
development
staging
production
```

Для device fleet дополнительно:

```text
test club
demo club
```

Нельзя тестировать новый Score Engine на реальном турнире.

---

# 120. Database Migration Strategy

Поскольку продукт будет быстро расти:

- versioned migrations;
- backwards-compatible rollout;
- data migrations;
- rollback plan;
- schema validation.

Особенно осторожно с Match Events — исторические события должны оставаться читаемыми после обновления схемы.

---

# 121. Event Schema Versioning

Каждое долгоживущее событие:

```text
event_type
schema_version
payload
```

Например:

```text
match.point_scored v1
```

Новые версии backend должны уметь читать старую историю или иметь migration/upcaster layer.

---

# 122. Data Ownership Boundaries

Чётко определить:

- Organization owns club business data.
- Player account может существовать между клубами.
- Club-specific rating принадлежит контексту клуба.
- Global profile и club profile не должны смешиваться.

Возможная модель:

```text
Global User
   ↓
Player Identity
   ↓
Club Player Profile
```

Это особенно важно, если игрок играет в нескольких клубах.

---

# 123. Global vs Club Rating

Архитектурно предусмотреть несколько рейтингов:

```text
Global Rating
Club Rating
League Rating
Season Rating
Format Rating
```

Не обязательно запускать global rating сразу.

Но schema не должна предполагать один `players.rating`.

---

# 124. Player Merge / Duplicate Resolution

CRM неизбежно получит:

```text
Alex Petrenko
Oleksandr Petrenko
Олександр Петренко
+380...
```

Нужен merge workflow:

```text
Potential Duplicate
→ Compare
→ Merge
→ Preserve External IDs
→ Re-link Matches
```

Merge должен быть audited и желательно reversible.

---

# 125. Hardware-Agnostic Protocol

Physical Controller Protocol не должен зависеть от ESP32/конкретной платы.

Пример message envelope:

```text
protocol_version
device_id
command_id
sequence
timestamp
action
payload
```

Transport может быть:

- HTTP;
- WebSocket;
- MQTT;
- local gateway;
- USB bridge.

Это позволит менять hardware без изменения Score Engine.

---

# 126. Local Court Gateway

Для серьёзной offline/reliability версии можно предусмотреть локальный gateway на venue.

```text
Cloud
  ↕
Venue Gateway
  ↕
Courts / Buttons / Displays
```

При падении интернета локальная сеть продолжает:

- score;
- displays;
- timers;
- device communication;
- queued events.

После восстановления gateway синхронизируется с Supabase/cloud.

Не обязательно реализовывать в первой версии, но архитектурно оставить возможность.

---

# 127. Финальная расширенная продуктовая цепочка

```text
BOOKING
   ↓
ACCESS
   ↓
CHECK-IN
   ↓
COURT SESSION
   ↓
PLAYERS / ROTATION
   ↓
MATCH / TRAINING / AMERICANO / MEXICANO
   ↓
PHYSICAL INPUT
   ↓
SCORE ENGINE
   ↓
DOMAIN EVENTS
   ↓
┌──────────┬───────────┬──────────┬────────────┬──────────┐
│ Display  │ Broadcast │ Video    │ Automation │ Analytics│
└──────────┴───────────┴──────────┴────────────┴──────────┘
   ↓
RESULT
   ↓
RATING / CRM / LEAGUE
   ↓
PLAYER PWA / SHARE
   ↓
ADVERTISING / PROMOTION
   ↓
NEXT SESSION
```

---

# 128. Расширенный принцип архитектуры

Основное ядро продукта должно состоять не из страниц UI, а из независимых domain-модулей:

```text
Identity
Organizations
Players
Bookings
Courts
Sessions
Scoring
Competitions
Devices
Displays
Advertising
Automation
Integrations
Video
Analytics
Billing
```

UI для Super Admin, Club Manager, Reception, Tournament Director, Coach, Referee и Player является разным представлением одних и тех же защищённых domain-сущностей.

Главные архитектурные правила:

1. Booking ≠ Session.
2. Session ≠ Match.
3. Participant ≠ всегда зарегистрированный Player.
4. На Court может быть 1–8+ участников.
5. Один Session может содержать 0..N Matches.
6. Hardware не знает правил падела.
7. Commands проходят через domain validation.
8. Events являются основой realtime и интеграций.
9. Display не является частью Score Engine.
10. Booking Provider не является источником внутренней domain-модели.
11. CRM может интегрироваться с внешней CRM.
12. Rating не должен храниться одним числом в Player.
13. Automation связывает модули через события, а не через жёсткие зависимости.
14. Offline/recovery проектируются с самого начала.
15. Все tenant boundaries защищаются RLS + server-side authorization.
16. Каждая важная административная операция audit-able.
17. Любое внешнее оборудование подключается через capability/protocol abstraction.
18. Клуб должен иметь возможность быть подключён и настроен без участия разработчика.

Итоговая цель — не просто scoreboard и не только tournament software, а **Padel Club Operating Platform**: единая операционная система корта, клуба, игроков, соревнований, трансляций, рекламы и подключённого оборудования.

---

# 129. Video Platform — отдельный продуктовый модуль

Video subsystem стоит рассматривать не как «прикрепить URL записи к матчу», а как полноценный модуль платформы.

Цели:

1. автоматически записывать каждую Court Session / Match;
2. синхронизировать video timeline со Score Engine;
3. создавать highlights без обязательного computer vision;
4. давать игроку VOD сразу после игры;
5. использовать одно видео одновременно для архива, трансляции, тренерского анализа и social clips;
6. в дальнейшем добавить AI-анализ без замены camera/recording architecture.

Главный принцип:

```text
Camera / Encoder
      ↓
Video Source
      ↓
Recording Session
      ↓
Video Timeline
      ↕
Domain Events / Match Events
      ↓
Markers
      ↓
Clips / Highlights
      ↓
VOD / Player PWA / Social / Coach
```

Video subsystem не должен быть частью Score Engine. Он подписывается на domain events.

---

# 130. Video Source abstraction

Не привязывать платформу к Raspberry Pi, DJI или конкретной IP-камере.

```text
VideoSource
├── source_type
├── protocol
├── capabilities
├── court_id
├── device_id
├── stream_profile
└── health
```

`source_type`:

```text
raspberry_csi
usb_camera
action_camera
mirrorless
ip_camera
nvr
rtsp_encoder
hdmi_encoder
software_encoder
custom
```

Возможные protocols:

```text
RTSP
RTMP
SRT
WebRTC
HLS
NDI
USB/UVC
HDMI capture
local file
vendor API
```

Capabilities:

```text
live_stream
local_record
remote_record_start
remote_record_stop
pre_record
high_fps
4k
ptz
zoom
audio
timecode
snapshot
health
storage_status
```

---

# 131. Court Video Configuration

Один Court может иметь несколько источников:

```text
Court 3
├── Main Wide Camera
├── Tactical Camera
├── Player Camera A
├── Player Camera B
└── Audio Source
```

Для первой коммерческой версии достаточно одной фиксированной wide camera на Court.

Но schema должна поддерживать:

```text
camera_role:
main
wide
tactical
closeup
player_a
player_b
overhead
custom
```

---

# 132. Recording Session

Не связывать video file напрямую только с Match.

```text
Court Session
      ↓
Recording Session
      ↓
0..N Matches
```

Это особенно важно для:

- 5–8 игроков с ротациями;
- Americano;
- Mexicano;
- тренировок;
- open play;
- нескольких матчей в одной аренде.

Recording Session:

```text
id
organization_id
venue_id
court_id
court_session_id

source_id

started_at
ended_at

recording_status
storage_provider
storage_key

duration
resolution
fps
codec
bitrate

audio
file_size

time_sync_offset
health
```

---

# 133. Recording State Machine

```text
IDLE
→ ARMING
→ RECORDING
→ FINALIZING
→ UPLOADING
→ PROCESSING
→ READY
```

Ошибки:

```text
SOURCE_OFFLINE
STORAGE_FULL
UPLOAD_FAILED
CORRUPTED
PROCESSING_FAILED
```

UI клуба должен показывать состояние записи отдельно от состояния матча.

---

# 134. Когда начинать запись

Configurable policy:

```text
on_booking_checkin
on_session_start
on_warmup
on_match_start
manual
scheduled
always_record_when_occupied
```

Рекомендуемый сценарий:

```text
Player Check-in
      ↓
Court Session READY
      ↓
Camera pre-record / recording starts
      ↓
Warm-up
      ↓
Match
```

Так начало первого розыгрыша не будет потеряно.

---

# 135. Когда заканчивать запись

Policy:

```text
match_finished + grace period
session_finished
booking_end
manual
court_idle_for_N_minutes
```

Например:

```text
Match Finished
→ keep recording 120 sec
→ if new Match starts, continue same Recording Session
→ otherwise finalize
```

---

# 136. Time Synchronization — критический компонент

Score Events и Video должны находиться на общей временной шкале.

Использовать:

- server timestamps;
- monotonic local clock;
- NTP;
- periodic clock offset measurement;
- recording start timestamp;
- source-specific offset calibration.

Нельзя рассчитывать highlights только по времени получения event сервером.

Для каждого marker желательно хранить:

```text
event_occurred_at
video_timecode
recording_offset_ms
sync_confidence
```

Пример:

```text
match.point_scored
server time: 19:13:04.217

Recording start: 18:00:00.000
calculated video position:
01:13:04.180
```

---

# 137. Video Marker Engine

Marker — отдельная сущность.

```text
video_markers
```

Поля:

```text
id
recording_id
match_id
event_id

marker_type
occurred_at
video_position_ms

importance
confidence

pre_roll_ms
post_roll_ms

metadata
```

Marker types:

```text
MATCH_START
GAME_POINT
BREAK_POINT
GOLDEN_POINT
GAME_WON
SET_POINT
SET_WON
TIEBREAK_START
SUPER_TIEBREAK
MATCH_POINT
MATCH_WON
COMEBACK
MANUAL_HIGHLIGHT
CUSTOM
```

---

# 138. Highlights без AI

Это первая версия, которую можно сделать быстро и надёжно.

Score Engine уже знает наиболее важные моменты.

Пример:

```text
MATCH_POINT
video position = 01:13:04

clip:
00:01:12:44 → 00:01:13:14
```

То есть:

```text
20 sec pre-roll
10 sec post-roll
```

Для `SET_WON`:

```text
15 sec before
8 sec after
```

Для `MATCH_WON`:

```text
20–30 sec before
15–30 sec after
```

Значения должны быть configurable.

---

# 139. Manual Highlight Button

Добавить action:

```text
HIGHLIGHT
```

Его можно вызвать:

- физической кнопкой;
- referee UI;
- coach UI;
- mobile admin;
- API.

Нажатие создаёт marker:

```text
MANUAL_HIGHLIGHT
```

Это позволяет оператору отметить красивый rally без AI.

Возможный physical control:

```text
double press / long press
→ MARK HIGHLIGHT
```

При этом scoring actions и highlight action должны быть различимы и защищены от случайного вызова.

---

# 140. Highlight Importance Score

Не каждый point нужно превращать в clip.

Вычислять importance:

```text
normal point        1
game point          2
break point         3
golden point        4
set point           5
tie-break point     5
match point         7
match won           8
manual highlight   10
```

Дополнительные modifiers:

- comeback;
- long game;
- deciding set;
- super tie-break;
- tournament stage;
- final.

После матча можно выбрать Top N markers.

---

# 141. Clip Generation Pipeline

```text
Marker
  ↓
Clip Request
  ↓
Find source recording
  ↓
Calculate IN / OUT
  ↓
Extract
  ↓
Optional transcode
  ↓
Optional graphics
  ↓
Thumbnail
  ↓
Ready
```

По возможности использовать keyframe-aware extraction / stream copy, а перекодирование делать только когда необходимо.

---

# 142. Highlight Overlays

На generated clip можно автоматически наложить:

- club logo;
- tournament logo;
- player names;
- score;
- match result;
- sponsor;
- QR;
- platform watermark, если тариф это предусматривает.

Пример:

```text
┌────────────────────────────┐
│ REJO PADEL                 │
│                            │
│       VIDEO                │
│                            │
│ Alex / Max      5  40      │
│ Denis / Oleg    4  30      │
│             MATCH POINT    │
└────────────────────────────┘
```

Score для overlay берётся из match projection на момент marker.

---

# 143. Vertical Social Clips

Автоматически создавать:

```text
16:9 master
9:16 social
1:1 optional
```

Для 9:16 в первой версии:

- fixed crop preset;
- court-specific crop;
- manual crop template.

Позже:

- player/ball tracking;
- dynamic crop;
- AI reframing.

---

# 144. Match Highlight Reel

Кроме отдельных clips:

```text
Match Highlights
```

Автоматически собрать:

1. intro;
2. лучшие markers;
3. match point;
4. result;
5. sponsor/outro.

Например:

```text
60 sec
90 sec
3 min
```

---

# 145. Tournament Highlights

Можно автоматически создавать:

```text
Round Highlights
Quarterfinal Highlights
Semifinal Highlights
Final Highlights
Tournament Recap
```

Markers фильтруются по tournament context.

---

# 146. VOD Player

Player PWA / public page:

```text
[ Full Match ]

Timeline:
00:12:43  Break Point
00:31:18  Set Point
00:46:02  Set Won
01:12:44  Match Point
01:13:04  Match Won
```

Нажатие marker делает seek в соответствующее место.

Это даёт ценность даже до AI highlights.

---

# 147. Video Privacy

Запись должна учитывать privacy/consent.

Configurable policy:

```text
club_default_recording_policy
player_video_consent
public/private VOD
retention period
download allowed
share allowed
```

Уровни:

```text
private_match
participants_only
club_members
public
```

---

# 148. Video Retention

Поскольку storage со временем станет существенной статьёй затрат:

```text
Original:
7 / 30 / 90 days

Highlights:
long-term

Tournament Finals:
long-term

Premium Player:
extended storage
```

Retention policy зависит от тарифа клуба/игрока.

---

# 149. Local Recording + Deferred Upload

Для экономии bandwidth и надёжности:

```text
Camera
 ↓
Local Recorder
 ↓
SSD / SD
 ↓
Match Finished
 ↓
Background Upload
```

Если интернет пропал, запись продолжается локально.

Upload queue возобновляется после reconnect.

---

# 150. Edge Recording Architecture

Предпочтительная архитектура для Raspberry/embedded camera:

```text
Camera Sensor
    ↓
Local Hardware Encoder
    ↓
┌───────────────┬─────────────────┐
│ Local Record  │ Live Stream     │
└───────────────┴─────────────────┘
        ↓
Local Ring Buffer
        ↓
Cloud / VPS / Object Storage
```

Ring buffer позволяет иметь pre-roll даже если постоянная запись не включена.

---

# 151. Pre-record Ring Buffer

Например:

```text
last 30 sec
```

всегда находятся в локальном circular buffer.

При событии:

```text
MATCH_POINT / HIGHLIGHT
```

можно сохранить предыдущие 15–30 секунд.

Это позволяет в будущем иметь highlight-only тариф без постоянного хранения полного VOD.

---

# 152. Camera Health Monitoring

Для каждой камеры:

```text
online
fps
bitrate
resolution
dropped_frames
temperature
storage_free
recording_status
last_frame_at
stream_latency
```

Admin:

```text
Court 1 Camera   🟢 1080p50
Court 2 Camera   🟢 1080p50
Court 3 Camera   🟠 Dropped frames
Court 4 Camera   🔴 Offline
```

---

# 153. Camera Image Profiles

У каждого Court должны храниться presets:

```text
exposure
shutter
ISO/gain
white_balance
focus
HDR
sharpness
noise_reduction
crop
rotation
```

Для спортивной камеры важно уметь зафиксировать параметры, чтобы автоматика не меняла картинку во время матча.

Profiles:

```text
Indoor LED
Indoor Dark
Outdoor Day
Outdoor Evening
Tournament Broadcast
```

---

# 154. Sports-specific Camera Requirements

Для падела важнее не максимальные megapixels, а:

1. 50/60 fps минимум;
2. короткая выдержка;
3. достаточная светочувствительность;
4. широкий динамический диапазон;
5. контролируемый угол обзора;
6. отсутствие постоянного autofocus hunting;
7. стабильная работа часами;
8. локальная запись;
9. удалённое управление;
10. предсказуемая задержка.

Целевой базовый профиль:

```text
1920×1080
50 fps (EU)
H.264/H.265
fixed/manual exposure where possible
1/100–1/250 shutter depending on light
```

Для premium:

```text
4K 50/60
```

4K полезен не только для просмотра, но и для digital crop / vertical highlights.

---

# 155. Camera Hardware Tiers

Платформа должна поддерживать несколько hardware tiers.

## Tier A — Low-cost Embedded

```text
Raspberry Pi
+ CSI camera
+ local encoding
```

Цель:

- минимальная цена;
- полная интеграция;
- remote control;
- recording;
- streaming;
- automation.

## Tier B — Action Camera

```text
DJI / Insta360 / similar
```

Цель:

- лучшее изображение out-of-box;
- 4K;
- минимум разработки hardware.

Минус — vendor limitations/API/continuous-operation вопросы.

## Tier C — Mirrorless / Broadcast

```text
Sony / Canon / Panasonic
+ HDMI encoder/capture
```

Цель:

- максимальное качество;
- premium courts;
- finals / broadcast.

---

# 156. Hardware Strategy для первой коммерческой версии

Не выбирать одну камеру навсегда.

Поддержать два официальных reference kit:

```text
PADel CAM BASIC
Raspberry Pi + CSI
```

и:

```text
PADEL CAM PRO
Action / HDMI camera
```

Платформа видит обе как `VideoSource`.

Так можно продавать клубу камеры разных классов без изменения backend.

---

# 157. Будущий AI Video Layer

AI должен добавляться поверх уже существующих recording + marker pipelines.

Возможные функции:

- player detection;
- ball detection;
- court calibration;
- rally start/end;
- rally duration;
- serve detection;
- winner/error classification;
- automatic highlight score;
- dynamic crop;
- player tracking;
- heatmaps;
- shot placement;
- tactical analytics.

Но AI не должен быть необходим для базовой записи и highlights.

---

# 158. Hybrid Highlight Engine

Идеальная будущая модель:

```text
Score Events
    +
Manual Markers
    +
Video AI
    +
Tournament Context
    ↓
Highlight Ranking
```

Например:

```text
Match Point          +7
Rally 18 sec         +4
AI excitement        +2
Tournament Final     +3
Manual Highlight    +10
```

→ Top Highlights.

---

# 159. Video Monetization

Возможные коммерческие модели:

```text
Basic
Live camera only

Recording
Full Match VOD

Highlights
Automatic clips

Player Premium
Longer retention + downloads

Tournament Media
All matches + branded highlights

Sponsor Video
Sponsor overlays/outros
```

Видео может стать самостоятельным add-on, а не просто затратой на storage.

---

# 160. Video MVP

Первую версию не перегружать AI.

## MVP 1

1. одна camera на Court;
2. start/stop recording по Court Session;
3. local recording;
4. запись metadata;
5. Match ↔ Recording linkage;
6. timeline synchronization;
7. score event markers;
8. manual highlight marker;
9. VOD player;
10. automatic match-point clip.

## MVP 2

1. все critical markers;
2. Top Highlights;
3. branded overlay;
4. 9:16 export;
5. match highlight reel;
6. upload/storage policies.

## MVP 3

1. AI rally detection;
2. automatic reframing;
3. player/ball tracking;
4. advanced analytics.

---

# 161. Практический hardware shortlist — август 2026

Этот раздел фиксирует направление исследования, а не жёсткую зависимость продукта от конкретных моделей.

## Raspberry Pi Camera Module 3 / Sony IMX708

Плюсы:

- очень низкая цена;
- 11.9 MP;
- BSI Sony IMX708;
- autofocus;
- HDR mode;
- до 2304×1296 примерно 56 fps;
- 1536×864 до 120 fps;
- стандартный и Wide варианты;
- полное программное управление;
- идеальная интеграция с local recorder.

Минусы:

- маленький sensor;
- rolling shutter;
- штатная optics существенно уступает mirrorless;
- low-light и highlight roll-off ограничены.

**Кандидат №1 для максимально дешёвого integrated court camera kit.**

## Raspberry Pi HQ Camera / Sony IMX477

Плюсы:

- 12.3 MP;
- 1/2.3" BSI;
- C/CS или M12 lenses;
- можно поставить качественный F1.2/F1.4 объектив;
- ручной focus — плюс для фиксированного Court;
- 2028×1080 50 fps;
- лучше контролируется оптика.

Минусы:

- sensor всё ещё намного меньше APS-C;
- rolling shutter;
- камера + хороший lens стоят дороже Camera Module 3.

**Очень интересный вариант, если цель — добиться максимально «камерной» картинки из Raspberry Pi.**

## Raspberry Pi Global Shutter / IMX296

Плюсы:

- настоящий global shutter;
- движение без rolling-shutter distortion;
- 1456×1088 60 fps;
- C/CS lenses;
- хорош для CV/ball tracking.

Минусы:

- только 1.58 MP;
- недостаточная детализация для красивого 4K/VOD;
- больше machine-vision camera, чем spectator camera.

**Использовать скорее как будущую analytics camera, а не основную красивую камеру трансляции.**

## Raspberry Pi AI Camera / IMX500

Плюсы:

- on-sensor AI;
- 12.3 MP;
- inference без нагрузки на основной CPU;
- интересен для будущего detection.

Минусы:

- full resolution только около 10 fps;
- 2028×1520 около 30 fps;
- $70 list price;
- не лучший выбор именно для основной 50/60fps спортивной записи.

**Сильнее как analytics sensor, чем как основная spectator camera.**

## DJI Osmo Action 5 Pro

Плюсы:

- 1/1.3" sensor;
- заявленный DJI dynamic range до 13.5 stops;
- 4K50/60;
- 4K100/120;
- хороший готовый ISP;
- low-light заметно лучше дешёвых CSI modules;
- компактность;
- готовый корпус;
- pre-record;
- H.265;
- до 120 Mbps.

Минусы:

- сверхширокая фиксированная optics;
- сложнее сделать полностью headless/remote fleet management;
- vendor API/stream workflow нужно отдельно проверить;
- continuous power/heat/storage надо тестировать именно в режиме клуба.

**Очень сильный готовый вариант по image quality / цене, если удастся удобно автоматизировать recording/stream extraction.**

## Insta360 Ace Pro 2

Плюсы:

- 1/1.3" sensor;
- сильная готовая processing pipeline;
- хороший consumer image quality.

Минусы:

- цена обычно выше DJI;
- f/2.6;
- те же вопросы автоматизации и vendor integration.

## Sony ZV-E10 II / APS-C

Плюсы:

- APS-C 23.3×15.5 mm;
- 26 MP;
- 4K50/60;
- 10-bit;
- сменная optics;
- настоящий большой шаг к mirrorless/broadcast image quality.

Минусы:

- кратно дороже;
- нужен объектив;
- питание;
- HDMI/encoder/capture;
- mounting/protection.

**Premium reference, а не массовая камера на каждый Court.**

---

# 162. Предварительный вывод по camera hardware

Для продукта разумно исследовать три линии параллельно:

```text
LOW COST
Pi 5 / embedded compute
+ Camera Module 3 Wide или HQ IMX477
```

```text
BEST VALUE IMAGE
DJI Osmo Action 5 Pro class
```

```text
PREMIUM
APS-C mirrorless
+ HDMI/encoder
```

Отдельно:

```text
ANALYTICS
Global Shutter / AI Camera
```

Главный вопрос для action-camera варианта — не только качество картинки, а возможность надёжно:

- питать 8–12 часов;
- запускать/останавливать запись программно;
- получать live stream;
- скачивать/забирать recording;
- определять health;
- восстанавливаться после power/network failure.

Если эти требования плохо решаются, Raspberry Pi camera может оказаться коммерчески лучшим вариантом несмотря на более слабую картинку, потому что весь lifecycle устройства находится под контролем платформы.

---

# 163. Camera Proof-of-Concept Test

Перед выбором reference hardware провести реальный A/B test на одном Court.

Одинаковая позиция:

```text
Camera Module 3 Wide
HQ IMX477 + suitable lens
DJI Action class
APS-C reference camera
```

Снять:

1. яркий indoor court;
2. тёмный indoor court;
3. игрок в дальнем конце;
4. быстрый smash;
5. мяч возле стекла;
6. LED lighting/flicker;
7. backlight;
8. 60–90 min continuous recording.

Оценивать:

```text
Detail
Motion blur
Rolling shutter
Noise
Dynamic range
White balance
Skin tones
Court visibility
Ball visibility
Heat
Stability
Power
Integration complexity
Total hardware cost
```

После теста выбрать `Basic` и `Pro` reference kit на основании реального материала, а не только характеристик сенсора.

---

# 164. Reference Video Hardware v1 — OPPO Find X3 Pro

На текущем этапе основной reference hardware для дешёвой Court Camera:

```text
OPPO Find X3 Pro
```

Причина выбора — исключительно сильное соотношение цена / возможности на вторичном рынке.

Текущий ориентир закупки:

```text
≈ 3000 грн / устройство
```

Допускаются аппараты:

- с повреждённым/выгоревшим экраном;
- с косметическими дефектами;
- с повреждённой задней крышкой;
- с изношенным аккумулятором;

при условии полной исправности:

- ultrawide camera;
- SoC;
- USB-C;
- внутреннего накопителя;
- Android;
- аппаратного video encoder.

Главная камера для Court:

```text
Sony IMX766 Ultra-Wide
50 MP
1/1.56"
≈15 mm FF equivalent
f/2.2
PDAF
```

Целевой стандарт платформы:

```text
≈16 mm FF equivalent
```

Поэтому изображение с ~15 mm можно слегка crop'нуть до ~16 mm с минимальной потерей разрешения.

---

# 165. Почему OPPO подходит как Camera Node

Телефон рассматривается не как consumer smartphone, а как готовая embedded computing platform.

В одном корпусе уже находятся:

```text
Camera Sensor
ISP
CPU
GPU
NPU
Hardware Video Encoder
Local Storage
Wi-Fi
USB
Display
Battery / UPS
Android
```

Архитектура:

```text
IMX766 Ultra-Wide
        ↓
Qualcomm ISP
        ↓
Camera2 / Camera HAL
        ↓
Hardware H.264/H.265 Encoder
        ↓
┌──────────────┬─────────────────┐
│ Local Record │ Live / Network  │
└──────────────┴─────────────────┘
        ↓
Padel Camera Agent
        ↓
Padel Platform
```

Главное преимущество по сравнению с отдельным camera module + SBC — практически вся hardware platform уже оплачена стоимостью б/у телефона.

---

# 166. OPPO Camera Proof-of-Concept — обязательная проверка

Перед закупкой нескольких телефонов необходимо проверить конкретный OPPO Find X3 Pro.

## Camera HAL / Camera2

Проверить:

1. видит ли Camera2 ultrawide IMX766;
2. какие physical camera IDs доступны;
3. доступна ли physical ultrawide camera стороннему приложению;
4. доступные resolution/FPS combinations;
5. 3840×2160 @ 50 fps;
6. 3840×2160 @ 60 fps;
7. 3840×2160 @ 30 fps как fallback;
8. 1920×1080 @ 50/60 fps;
9. возможность отключить EIS;
10. возможность фиксировать focus;
11. manual focus;
12. exposure control;
13. shutter control;
14. ISO control;
15. AE lock;
16. AWB lock;
17. manual WB, если доступен.

Особенно важно:

> Поддержка 4K60 штатным приложением не гарантирует, что тот же режим будет доступен стороннему Camera2-приложению именно для ultrawide physical camera.

Это считается главным software/hardware risk первого прототипа.

---

# 167. Целевые Video Profiles OPPO

## Standard Court

```text
Source:
3840×2160
50 fps
Ultra-Wide ≈15 mm

Crop:
≈16 mm FF equivalent

Codec:
H.265 / HEVC

Master bitrate:
примерно 30–50 Mbps
```

Почему 50 fps:

- европейское питание/освещение;
- спортивное движение;
- удобнее согласовать shutter с 50 Hz lighting;
- меньше риск LED flicker.

## Fallback

```text
3840×2160
30 fps
```

если HAL не позволяет 4K50/60.

## Low-bandwidth / Live Proxy

```text
1920×1080
50 fps

H.264 / H.265
примерно 6–12 Mbps
```

Точные bitrate будут определены после A/B тестов.

---

# 168. 4K Master + Digital Crop

4K используется не только ради конечного 4K-файла.

Основная ценность:

```text
4K Ultra-Wide Master
        ↓
Lens Correction
        ↓
Crop ≈16 mm
        ↓
┌────────────┬────────────┬─────────────┐
│ 16:9 VOD   │ Broadcast  │ 9:16 Social│
└────────────┴────────────┴─────────────┘
```

В будущем:

```text
4K Master
   ↓
AI Player / Ball Tracking
   ↓
Dynamic Digital PTZ
   ↓
1080p output
```

То есть широкоугольный 4K master позволяет виртуально менять framing без физической PTZ-камеры.

---

# 169. Camera2 вместо consumer Camera App

Для Court Camera необходимо собственное Android-приложение:

```text
Padel Camera Agent
```

На первом этапе предпочтительно использовать Camera2 API для максимального контроля camera pipeline.

Цель:

```text
Camera2
├── physical camera selection
├── fixed FPS
├── fixed/limited exposure
├── shutter
├── ISO
├── focus lock/manual focus
├── AWB lock
└── MediaCodec output
```

Consumer auto-processing не должен бесконтрольно менять картинку во время матча.

Для каждого Venue/Court можно хранить Camera Profile.

---

# 170. Court Camera Profiles

Примеры:

```text
Indoor LED Bright
Indoor LED Dark
Outdoor Day
Outdoor Evening
Tournament
```

Поля:

```text
resolution
fps
codec
bitrate

shutter
ISO / ISO range
focus
white_balance

EIS
crop
rotation
lens_correction

live_profile
recording_profile
```

Профили должны обновляться удалённо.

---

# 171. Recording + Streaming

Желательно избежать двойного тяжёлого encode.

Предпочтительная схема:

```text
Camera
   ↓
Hardware Encoder
   ↓
Encoded Stream
   ├── Local Recorder
   └── Network Output
```

То есть один encoded master может одновременно:

- писаться локально;
- передаваться по сети.

Если необходим отдельный low-resolution live stream:

```text
4K Master Encode
+
1080p Proxy Encode
```

нужно отдельно проверить:

- SoC load;
- encoder capabilities;
- temperature;
- dropped frames;
- battery temperature.

---

# 172. Active Cooling

Для стационарного Court Camera Node внешний вид и шум менее критичны, чем thermal stability.

Reference design:

```text
┌───────────────────────┐
│ OPPO Find X3 Pro      │
│                 ● CAM │
└───────────────────────┘
          │
    thermal interface
          │
████ aluminium plate ████
          ↑
        airflow
          ↑
      92/120 mm FAN
```

Предпочтительно:

```text
92 mm
или
120 mm PC fan
```

вместо маленьких высокооборотных 30–40 mm вентиляторов.

Преимущества:

- большой airflow;
- низкие обороты;
- меньший шум;
- дешёвые;
- доступные;
- высокая надёжность.

---

# 173. Cooling Control

MVP:

```text
Camera Active
→ FAN ON
```

или постоянная работа на невысоких оборотах.

Расширенная версия:

```text
< 40°C
→ 30%

40–45°C
→ 50%

45–50°C
→ 70%

> 50°C
→ 100%
```

Camera Agent должен мониторить доступные thermal metrics:

```text
battery_temperature
SoC_temperature
encoder_state
dropped_frames
actual_fps
```

Не полагаться только на один температурный sensor.

---

# 174. Mechanical Camera Mount

Крепление должно выполнять сразу несколько функций:

1. фиксировать телефон;
2. точно задавать угол;
3. обеспечивать охлаждение;
4. защищать от случайного доступа;
5. не закрывать ultrawide camera;
6. обеспечивать доступ USB-C;
7. позволять быстро заменить телефон.

Предпочтительная конструкция:

```text
Court Mount
    ↓
Adjustable Bracket
    ↓
Aluminium Backplate
    ↓
Phone Clamp
    ↓
Fan
```

Нужно предусмотреть calibration marks, чтобы после замены устройства восстановить одинаковый framing.

---

# 175. Phone Hardware Controller

Поскольку smartphone не гарантированно автоматически загружается после полного отключения, вводится отдельный аппаратный controller.

Пример:

```text
ESP32 / small MCU
```

или более простая специализированная timer/watchdog схема.

Функции:

```text
Power-Key Control
Hardware Watchdog
Fan Control
Power Monitoring
Optional Temperature Sensor
Status LEDs
```

Это отдельное устройство:

```text
Padel Camera Controller
```

---

# 176. Hardware Auto-Power

Контроллер подключается параллельно physical Power button телефона через безопасный электронный ключ/оптопару/транзисторную схему.

Сценарий:

```text
Mains / DC Power Appears
        ↓
Camera Controller Boots
        ↓
Wait
        ↓
Check Phone Heartbeat
        ↓
Phone Alive?
 ├── YES → do nothing
 └── NO
       ↓
     POWER KEY pulse
       ↓
     Phone Boots
```

Это позволяет не зависеть от того, умеет ли конкретная прошивка OPPO автоматически загружаться при появлении USB питания.

---

# 177. Hardware Watchdog

Software watchdog недостаточен для полностью unattended устройства.

Camera Agent периодически отправляет heartbeat локальному Camera Controller.

Например:

```text
heartbeat every 5–10 sec
```

Controller:

```text
Heartbeat OK
→ nothing

Heartbeat Missing
→ wait grace period
→ recovery
```

Recovery stages:

```text
Stage 1
request software recovery

Stage 2
short Power-Key action if applicable

Stage 3
long Power-Key hold
→ forced restart

Stage 4
wait
→ normal Power-Key pulse
```

Точная последовательность определяется тестами OPPO.

Controller не должен делать reboot при кратковременном network failure.

Heartbeat должен быть локальным, а не зависеть от VPS/Supabase.

---

# 178. Phone Alive Detection

Контроллер может определять состояние телефона несколькими способами.

Варианты:

```text
GPIO/USB heartbeat from Camera Agent
USB state
power consumption
local network heartbeat
dedicated audio/USB accessory channel
```

Наиболее надёжный вариант для custom hardware:

```text
Camera Agent
→ USB/serial/BLE/local link
→ Camera Controller
```

или другой локальный heartbeat, не требующий Internet.

---

# 179. Camera Controller + Fan

Один MCU может управлять:

```text
Power Button
Fan PWM
Power Status
Temperature
Watchdog
```

Схема:

```text
              OPPO
                │
       ┌────────┴────────┐
       │ Camera Controller│
       ├─────────────────┤
       │ Power Key        │
       │ Watchdog         │
       │ Fan PWM          │
       │ Temp             │
       │ Power Detect     │
       │ Status LED       │
       └────────┬────────┘
                │
             120mm FAN
```

Таким образом добавление аппаратного auto-power почти не увеличивает сложность, если controller всё равно нужен для охлаждения/watchdog.

---

# 180. Phone Power Architecture

Предпочтительно телефон постоянно остаётся включённым.

Ночью:

```text
Android       ON
Camera Agent  ON
Camera        OFF
Encoder       OFF
Display       OFF
Network       ON
```

Это:

- уменьшает количество boot cycles;
- позволяет мгновенно получать команды;
- сохраняет remote monitoring;
- делает аккумулятор локальным UPS.

---

# 181. Battery as UPS

Аккумулятор телефона — полезная часть architecture.

```text
220V lost
     ↓
Phone continues on battery
     ↓
Recording continues
     ↓
Camera Agent emits:
POWER_LOST
```

После восстановления питания:

```text
POWER_RESTORED
```

можно продолжить работу без reboot.

Для Club Admin:

```text
Court 4 Camera
External Power: OFF
Battery: 68%
Estimated runtime: ...
```

---

# 182. Battery Protection

Нельзя годами держать старый Li-ion аккумулятор горячим при 100%.

Предусмотреть:

- системный charge limit, если доступен;
- smart charging;
- внешний power controller;
- thermal monitoring.

Целевой диапазон можно определить экспериментально, например:

```text
40–80%
```

Не считать эти значения окончательными до тестов конкретного телефона.

При обнаружении:

- swelling;
- abnormal temperature;
- rapid degradation;

устройство должно выводиться из эксплуатации.

---

# 183. Ethernet + Power

Для стационарной камеры Ethernet предпочтительнее Wi-Fi.

Reference connection:

```text
OPPO USB-C
      ↓
USB-C PD + Ethernet Adapter
      ├── Power
      └── Gigabit Ethernet
              ↓
            Switch
```

Необходимо проверить на Find X3 Pro:

1. Ethernet через USB OTG;
2. одновременное питание;
3. стабильность 4K streaming;
4. reconnect после отключения кабеля;
5. поведение после reboot;
6. DHCP;
7. статическую конфигурацию при необходимости.

---

# 184. Wi-Fi Fallback

Wi-Fi остаётся fallback transport.

Priority:

```text
Ethernet
   ↓ unavailable
Wi-Fi
   ↓ unavailable
Offline Local Mode
```

Camera Agent не должен прекращать запись при смене network transport.

---

# 185. Automatic Camera Agent Startup

После Android boot:

```text
Android Boot
     ↓
Padel Camera Agent
     ↓
Device Authentication
     ↓
Load Local Configuration
     ↓
Network Connect
     ↓
Backend Sync
     ↓
Camera Node READY
```

Использовать Android mechanisms:

- boot receiver;
- persistent/foreground components;
- dedicated-device configuration;
- kiosk/device-owner where appropriate.

Нужно учитывать ограничения современных Android на background camera/foreground services.

---

# 186. Dedicated Device Mode

OPPO после provisioning перестаёт рассматриваться как пользовательский телефон.

Желательный режим:

```text
Dedicated Device / Kiosk
```

Задачи:

- запрет случайного выхода;
- скрытие лишнего UI;
- запрет посторонних приложений;
- автоматический Camera Agent;
- controlled settings;
- remote configuration;
- минимизация background software;
- predictable updates.

Root/custom firmware не является обязательным для MVP.

---

# 187. Root / Custom Firmware — optional

Исследовать только если stock Android мешает:

- auto startup;
- camera access;
- thermal behavior;
- unattended updates;
- power management;
- kiosk;
- Camera HAL access.

Возможный будущий вариант:

```text
Minimal Android Build
├── Camera HAL
├── Network
├── Camera Agent
├── Watchdog
└── Updater
```

Но product architecture не должна требовать root.

Аппаратный Camera Controller решает наиболее критическую проблему auto-power независимо от прошивки.

---

# 188. Device Provisioning

Первый запуск:

```text
PAIR CAMERA

K7F-92Q
```

Club Admin:

```text
Devices
→ Add Camera
→ K7F-92Q
→ Venue
→ Court 4
→ Main Camera
```

Backend выдаёт:

```text
device_id
device_credentials
configuration
```

Телефон не должен иметь hardcoded `court_id`.

---

# 189. Remote Configuration

После каждого запуска:

```text
Camera Agent
→ load last-known local config
→ connect backend
→ fetch current config
```

Config:

```text
organization
venue
court
camera_role

resolution
fps
codec
bitrate

camera_profile

recording_policy
retention
prebuffer

live_stream
upload_policy

fan_policy
health_policy
```

Перенос камеры Court 4 → Court 7 выполняется через Dashboard без переустановки APK.

---

# 190. Offline Boot

Backend не должен быть необходим для физического запуска камеры.

Хранить локально:

```text
device identity
last-known court assignment
camera profile
recording policy
network config
```

Сценарий:

```text
Phone Reboot
Internet OFF
      ↓
Camera Agent Starts
      ↓
Loads Cached Configuration
      ↓
READY LOCAL
```

После появления сети:

```text
sync configuration
sync telemetry
sync queued events
upload pending files
```

---

# 191. Offline Recording

При потере Internet:

```text
Network OFF
     ↓
Recording CONTINUES
     ↓
Local Events CONTINUE
     ↓
Markers cached
     ↓
Upload queued
```

Нельзя ставить recording lifecycle в зависимость от Supabase realtime connection.

---

# 192. Local Recording / Segments

Для надёжности длинные записи желательно хранить сегментированно.

Например:

```text
recording/
  segment_0001
  segment_0002
  segment_0003
```

Преимущества:

- crash не уничтожает весь матч;
- проще resume upload;
- проще highlights;
- проще ring buffer;
- проще storage cleanup.

Container/segment duration определить после тестов.

---

# 193. Ring Buffer

Camera Agent может постоянно держать:

```text
30–60 sec
```

предыдущего видео.

Схема:

```text
Segment N-3
Segment N-2
Segment N-1
Segment N
```

старые сегменты автоматически удаляются.

При:

```text
MANUAL_HIGHLIGHT
MATCH_POINT
SET_POINT
```

нужные segments получают retention lock.

---

# 194. Camera Agent Health

Отправлять:

```text
device_online
camera_open
recording
actual_fps
target_fps
bitrate
dropped_frames

storage_free
storage_total

battery_level
battery_temperature
external_power

network_type
network_quality

app_version
android_version

last_frame_at
last_heartbeat_at
```

Admin Dashboard должен сразу показывать деградацию камеры до начала матча.

---

# 195. Recovery Ladder

Автоматическое восстановление выполнять постепенно:

```text
Problem detected
      ↓
Restart camera session
      ↓ failed
Restart encoder
      ↓ failed
Restart Camera Agent service
      ↓ failed
Restart application
      ↓ failed
Android reboot
      ↓ failed
Hardware watchdog / Power Key
```

Не использовать hardware reboot для каждой мелкой ошибки.

---

# 196. Remote Device Actions

Super Admin / authorized Club Admin:

```text
Restart Camera
Restart Agent
Start Test Recording
Stop Recording
Take Snapshot
Run Network Test
Run Storage Test
Apply Camera Profile
Enable/Disable Camera
Reboot Device
```

Критические действия должны попадать в Audit Log.

---

# 197. Automatic Operational Workflow

Обычный день:

```text
PHONE ALWAYS ONLINE
Camera OFF
Display OFF
        ↓
Booking starts in N minutes
        ↓
Automation Engine
        ↓
PREPARE CAMERA
        ↓
Open Camera
Stabilize Exposure
Lock WB / Focus
Start Ring Buffer
        ↓
Court Session START
        ↓
RECORD
        ↓
Match Events
        ↓
Markers
        ↓
Session END
        ↓
Grace Period
        ↓
Finalize
        ↓
Background Upload
        ↓
Camera OFF
        ↓
Agent remains ONLINE
```

---

# 198. Failure Scenarios

## Internet lost

```text
Record locally
Queue events
Reconnect
Sync
```

## Backend unavailable

```text
Use cached configuration
Continue local operation
```

## App crash

```text
Android/service watchdog
→ restart
```

## Camera HAL crash

```text
close/reopen camera
→ restart service if needed
```

## Android freeze

```text
hardware watchdog
→ Power-Key recovery
```

## 220V failure

```text
battery UPS
→ continue
→ POWER_LOST event
```

## Battery depleted + phone OFF

```text
power restored
→ Camera Controller boots
→ detects no heartbeat
→ Power-Key pulse
→ Android boot
→ Camera Agent autostart
```

---

# 199. OPPO Reference Hardware BOM — предварительно

Целевой бюджет одного Court Camera Node:

```text
Used OPPO Find X3 Pro       ~3000 грн
USB-C PD + Ethernet          ~500–800
Power supply                 ~300–500
92/120mm fan                 ~150–300
MCU / Camera Controller      ~150–400
Mount / aluminium plate      ~300–700
Cables / misc                ~200–400
────────────────────────────────────
Estimated total             ~4600–6100 грн
```

Цены предварительные и требуют проверки после выбора конкретных компонентов.

При этом устройство включает:

```text
50MP IMX766 ultrawide
large 1/1.56" sensor
ISP
Snapdragon 888
hardware video encode
local storage
Wi-Fi
Ethernet via adapter
battery UPS
Android
NPU/GPU/CPU
active cooling
hardware watchdog
```

---

# 200. OPPO vs Dedicated STARVIS Platform

На текущем этапе:

| | OPPO Find X3 Pro | IMX585 + Compute |
|---|---|---|
| Sensor | IMX766 1/1.56" | IMX585 1/1.2" |
| FOV | ~15 mm ready | lens selectable |
| 4K | yes | yes |
| ISP | included | required |
| Encoder | included | required |
| Compute | Snapdragon 888 | SBC required |
| NPU | included | depends on SBC |
| Storage | included | add |
| Network | included | add/included |
| UPS | battery included | add |
| Display | included | optional |
| Cooling | add fan | add |
| Auto-power | hardware controller | normal embedded boot |
| Estimated total | ~4.6–6.1k грн | likely ~9–16k+ грн |
| Image potential | very high/value | potentially higher |
| Integration control | Android/HAL dependent | very high |

На текущем этапе:

```text
OPPO = reference Basic / Value Camera
IMX585 = future Industrial / Pro Camera candidate
```

---

# 201. Go / No-Go Criteria для OPPO

OPPO становится официальным reference camera hardware только если PoC подтверждает:

```text
[ ] Ultrawide accessible from Camera2
[ ] Required resolution/FPS available
[ ] Stable hardware encode
[ ] ≥3h continuous recording
[ ] No unacceptable thermal throttling with fan
[ ] No significant dropped frames
[ ] USB Ethernet stable
[ ] Power + Ethernet simultaneous
[ ] Agent autostart reliable
[ ] Hardware Power-Key controller works
[ ] Recovery after power loss works
[ ] Offline recording works
[ ] Files survive app/device crash acceptably
[ ] Camera settings remain predictable
[ ] Image quality acceptable on real padel court
```

Отдельный желательный критерий:

```text
[ ] 4K50/60 ultrawide available to custom app
```

Если доступно только 4K30, провести реальный sports-image test прежде чем отказываться от платформы.

---

# 202. Следующий hardware prototype

Первый полноценный prototype:

```text
OPPO Find X3 Pro
      +
USB-C Ethernet / Power
      +
120mm Fan
      +
Aluminium Mount
      +
ESP32 / MCU Camera Controller
      +
Padel Camera Agent
```

Испытание:

```text
3h
6h
10h
```

Проверить:

- continuous recording;
- actual FPS;
- dropped frames;
- temperature;
- battery;
- storage;
- network;
- automatic reconnect;
- Camera HAL recovery;
- app crash recovery;
- forced Android reboot;
- full power loss;
- automatic hardware power-on;
- offline mode;
- upload resume.

Только после этого закупать партию одинаковых устройств.

---

# 203. Текущее решение по Video Hardware

До результатов PoC принять рабочую гипотезу:

> **Основной бюджетный Court Camera Node строится вокруг б/у OPPO Find X3 Pro с ultrawide IMX766, активным охлаждением и отдельным аппаратным Camera Controller.**

При этом Video Platform остаётся hardware-agnostic.

```text
VideoSource abstraction
        ↓
OPPO сегодня
        ↓
IMX585 / IP camera / other hardware завтра
```

Никакая бизнес-логика Recording, Highlights, Match Timeline, Advertising, Player PWA или Tournament Engine не должна зависеть от OPPO.

Это позволяет использовать чрезвычайно выгодное hardware решение сейчас, не превращая его в архитектурную зависимость продукта.

---

# 204. Open-source Building Blocks / Build vs Buy

Цель — максимально сократить собственную разработку инфраструктуры, сохранив наше domain-ядро. Стратегия: **library > framework, adapter > hard dependency, Postgres/Supabase > новый сервис**.

# 205. License Policy

Для компонентов, которые встраиваются в коммерческий продукт, разрешены только permissive-лицензии:

```text
MIT
Apache-2.0
BSD-2-Clause
BSD-3-Clause
ISC
```

Без отдельного юридического решения исключить:

```text
GPL / AGPL / LGPL / MPL / SSPL / BSL
Commons Clause
fair-code / Sustainable Use
source-available
custom enterprise/open-core code
```

Для каждой зависимости фиксировать `name`, `version`, `repository`, `license`, способ использования и transitive licenses. Добавить `THIRD_PARTY_LICENSES.md`, `third-party-licenses.json` и CI-проверку лицензий.

# 206. Что остаётся собственным ядром

Не отдавать сторонним библиотекам архитектурный контроль над:

```text
Score Engine
Court Session
Match Events
Participants
Club / Venue / Court
Domain Event contract
Device → Court → Session binding
Display priorities
Advertising domain
Automation domain
Normalized Booking model
Video Marker domain
```

OSS используется через adapters.

# 207. Share Cards §45

`@resvg/resvg-js` не включать: MPL-2.0 не соответствует strict permissive-only policy. Satori также не считать approved без отдельной проверки конкретной версии.

Сделать собственный `ShareCardRenderer`:

```text
MatchResultCardModel
      ↓
TS/JS SVG template
      ↓
SVG
      ↓
Rasterizer adapter
      ↓
PNG/WebP
```

Так renderer можно заменить без изменений domain/API.

# 208. next-intl §57 — APPROVED

License: `MIT`.

Заменяет самописные `lib/translations.ts`, pluralization и locale maps. Использовать namespaces, ICU messages, locale routing, Server/Client Components.

```text
messages/uk/common.json
messages/uk/club.json
messages/uk/scoreboard.json
messages/uk/tournament.json
messages/en/...
```

# 209. cmdk §104 — APPROVED

License: `MIT`.

Использовать для глобальной Command Palette (`Ctrl/Cmd+K`): Players, Courts, Bookings, Matches, Tournaments, Devices, Actions. `cmdk` — только UI; Search Service остаётся нашим.

# 210. Fuse.js §124 — APPROVED

License: `Apache-2.0`.

Использовать для fuzzy player lookup, typo tolerance, transliteration variants и duplicate candidate ranking. Не выполнять автоматический merge только по fuzzy score.

# 211. FullCalendar §46 — APPROVED только Standard Core

Standard/core и React connector — MIT. Premium plugins имеют отдельную custom license — не использовать.

Подходит для bookings, courts, tournaments, training, maintenance. Перед использованием resource timeline отдельно проверять, не Premium ли это plugin.

# 212. Tables / Reports

`TanStack Table` — MIT: leaderboards, standings, device fleet, audit, imports.

`Recharts` — MIT: utilization, rating history, sponsor impressions, device uptime, matches/day.

# 213. Import §92

`PapaParse` — MIT: CSV import/export, workers, delimiter detection.

`SheetJS Community Edition` — Apache-2.0. Использовать только CE; не зависеть от Pro.

```text
Upload → Parse → Column Mapping → Validation → Duplicate Detection → Preview → Staging → Commit
```

# 214. RootEncoder §129–203 — APPROVED / HIGH PRIORITY

License: `Apache-2.0`.

Базовая библиотека OnePlus Camera Agent. Уже закрывает Camera2/MediaCodec, H.264/H.265, RTMP/RTSP/SRT/UDP и запись во время streaming.

Сами пишем только OnePlus HAL probing, 4K50/60 profile, provisioning, Court binding, recording policy, Supabase, health, offline queue, video markers и hardware-watchdog bridge.

# 215. Android Camera2 samples

Официальные Google samples использовать как Apache-2.0 reference для physical camera IDs, exposure/ISO/AWB/focus, high-speed sessions и CameraCharacteristics. Не переносить sample app как архитектуру продукта.

# 216. MediaMTX — APPROVED / HIGH PRIORITY

License: `MIT`.

Основной кандидат на Local Venue Media Gateway:

```text
OnePlus cameras
    ↓ SRT/RTSP
MediaMTX
 ├─ segmented recording
 ├─ playback
 ├─ HLS
 ├─ WebRTC preview
 └─ upstream/broadcast
```

Закрывает большую часть Local Court Gateway, edge recording и segmented recording. Собственный media server не писать.

# 217. go2rtc

Оставить как lightweight bridge/reference. Перед production use отдельно проверить license конкретной версии. Предварительно MediaMTX предпочтительнее как основной Venue Gateway из-за record/playback pipeline.

# 218. FFmpeg §141–143

Использовать как внешний media worker для `-ss/-to`, crop, scale, overlay, drawtext, concat, thumbnails и transcode.

Не bundle случайные GPL-enabled builds. Зафиксировать controlled build/configuration и license manifest конкретной сборки.

```text
VideoMarker → ClipRequest → FFmpeg Worker → Clip/Thumbnail → Storage
```

# 219. VOD Player §146

`hls.js` — Apache-2.0, основной вариант для MVP.

`Shaka Player` — Apache-2.0, если позже понадобится DASH/HLS и более сложный adaptive playback.

Timeline markers рисуем сами, не зависим от малоактивных marker plugins.

# 220. OBS §39

`obs-websocket-js` — MIT. Сделать отдельный `OBSBroadcastAdapter` для scenes, sources, start/stop stream/record и browser sources. vMix остаётся отдельным adapter.

# 221. MQTT transport §125

`mqtt.js` — MIT. Использовать как transport между gateway/backend и устройствами.

```text
court/4/controller/events
court/4/controller/commands
court/4/camera/health
```

Domain Event Bus от MQTT не зависит.

# 222. MQTT broker

Eclipse Mosquitto имеет dual license `EPL-2.0 OR EDL-1.0` (SPDX также указывает BSD-3-Clause совместимый вариант). Использовать только permissive distribution option и документировать это.

EMQX 5.9+ перешёл на BSL 1.1 — **не использовать**.

# 223. ESP firmware

ESPHome production runtime не использовать из-за GPL obligations.

Production firmware писать на `ESP-IDF` (Apache-2.0): GPIO, debounce, long/double press, HTTP/MQTT, OTA, watchdog, NVS.

# 224. Feature Flags §94

Сначала сделать Supabase-native:

```text
feature_flags
feature_flag_targets
```

Unleash server сейчас AGPL — исключить.

GrowthBook — open-core: часть MIT, enterprise directories отдельно лицензируются. Целый server не делать core dependency; отдельные SDK допустимы только после package-level audit.

# 225. Product Analytics §95

`Umami` — MIT, предпочтительный self-host MVP.

PostHog — MIT core + отдельно лицензированный `ee/`; не делать обязательной embedded dependency. Для старта достаточно:

```text
Umami + our product_events table
```

# 226. Observability §87

`OpenTelemetry JS` — Apache-2.0. Использовать traces/metrics/logs/correlation IDs. Не смешивать operational telemetry с business Domain Events.

# 227. Notifications §43

Novu — open-core (MIT core + enterprise commercial code). Не делать обязательным.

Свой `NotificationService` + adapters:

```text
Email
Telegram
Push
SMS later
```

# 228. Automation §76

n8n не встраивать: fair-code и слишком тяжёлый runtime.

Domain model остаётся нашим:

```text
Trigger → Conditions → Actions
```

Rule-evaluation library подключать только после permissive audit.

# 229. brackets-manager.js §35–38 — APPROVED / HIGH PRIORITY

License: `MIT`.

Поддерживает round-robin, single/double elimination, BYE, seeding, multiple stages, match states и standings.

Использовать через `TournamentEngineAdapter`; наши Tournament/Stage/Match/CourtAssignment остаются собственными сущностями.

# 230. OpenSkill.js §31–32 — APPROVED / HIGH PRIORITY

License: `MIT`.

Использовать как заменяемый rating engine для 2v2, team rating, asymmetric teams, Americano/Mexicano и matchmaking. В БД сохранять свои `rating_events` и projections, а не структуру библиотеки.

# 231. PowerSync §21/§98 — CONDITIONAL APPROVAL

PowerSync JavaScript SDK — Apache-2.0. Очень интересен для offline-first PWA/React/React Native и Supabase/Postgres.

Approved пока только client SDK. Server-side sync/deployment licensing проверить отдельно до принятия всей инфраструктуры.

Даже с PowerSync score commands сохраняют нашу idempotency/revision/conflict logic.

# 232. Basejump / Supabase Multi-Tenant

Basejump starter/patterns полезны для accounts, teams, permissions, billing и RLS testing; отдельные starter repos MIT.

Использовать как reference/migrations/tests, а не как обязательный framework, потому что наша модель сложнее обычного SaaS:

```text
Organization → Venue → Court
Staff
Global Player Identity
Club Player Profile
Devices
```

# 233. Search architecture

Small/local datasets: Fuse.js.

Server search: Postgres `pg_trgm` + FTS через Supabase. Elasticsearch/Meilisearch пока не нужны.

# 234. Deduplication

```text
exact phone
exact email
external ID
normalized name
transliteration
Fuse score
→ Merge Candidate
→ Admin confirm
→ transaction + audit
```

# 235. Рекомендованный video OSS stack

```text
ONEPLUS CAMERA NODE
Camera2
   ↓
RootEncoder
   ↓ SRT/RTSP
MEDIAMTX VENUE GATEWAY
   ├─ Local segmented recording
   ├─ HLS
   ├─ WebRTC preview
   └─ upstream stream
          ↓
VIDEO WORKERS / FFmpeg
          ↓
VOD / CLIPS
          ↓
hls.js
```

Нашими остаются Recording Session, synchronization, markers, highlight ranking и clip orchestration.

# 236. Что в Video MVP не писать с нуля

Не писать:

```text
Android H264/H265 encode
RTSP/SRT/RTMP protocol stack
media server
HLS distribution
WebRTC gateway
segment recording
basic VOD playback
OBS websocket protocol
```

Писать:

```text
OnePlus HAL probing
Camera Profiles
Provisioning
Court binding
Recording policy
Offline state
Hardware watchdog link
Match↔Video time sync
Markers
Highlight ranking
Clip orchestration
Player VOD UX
```

# 237. Approved UI/Productivity stack

```text
next-intl          MIT
cmdk               MIT
Fuse.js            Apache-2.0
FullCalendar Core  MIT
TanStack Table     MIT
Recharts           MIT
PapaParse          MIT
SheetJS CE         Apache-2.0
hls.js             Apache-2.0
Shaka Player       Apache-2.0
obs-websocket-js   MIT
mqtt.js            MIT
```

# 238. Approved backend/domain helpers

```text
brackets-manager.js   MIT
OpenSkill.js          MIT
tournicano            proprietary — algorithms; signed permission on file (PDF); adapter + модификация кода; §205 exception «отдельное юридическое решение» выполнено
Padel-Americano       MIT — Whist-расписания для Americano (8/12/16 игроков)
PowerSync JS SDK      Apache-2.0 (client approved; server TBD)
OpenTelemetry JS      Apache-2.0
MediaMTX              MIT
RootEncoder           Apache-2.0
```

# 239. Explicitly excluded сейчас

```text
@resvg/resvg-js   MPL-2.0     EXCLUDE
ESPHome runtime   GPL         EXCLUDE production
EMQX >= 5.9       BSL-1.1     EXCLUDE
Unleash server    AGPL        EXCLUDE
n8n               fair-code   EXCLUDE embedded
Lago              AGPL        EXCLUDE
MinIO             AGPL        EXCLUDE
```

Open-core (`GrowthBook`, `PostHog`, `Novu`) не использовать как mandatory embedded core; только отдельные конкретные permissive SDK после проверки.

# 240. Что не нужно на первых фазах

```text
Keycloak
CasparCG
PeerTube
Elasticsearch
Kafka
Kubernetes
generic BPM suites
large MDM platform
```

# 241. Top-5 OSS по экономии человеко-недель

1. **RootEncoder + MediaMTX** — Android encode, protocols, gateway, recording, HLS/WebRTC.
2. **brackets-manager.js** — tournament stages/brackets/progression.
3. **OpenSkill.js** — rating mathematics/team matchmaking.
4. **PowerSync JS SDK** — local DB/offline/reactive sync (после server licensing/architecture check).
5. **Basejump patterns + Supabase RLS** — organizations/memberships/permissions/billing/RLS tests.

# 242. Внедрение по фазам

## Foundation
`next-intl`, TanStack Table, cmdk, Fuse.js, OpenTelemetry, Basejump references.

## Club Product
FullCalendar Core, PapaParse, SheetJS CE, PowerSync PoC.

## Competition
OpenSkill.js, brackets-manager.js, tournicano (https://github.com/alimfeld/tournicano/ — proprietary, signed permission on file, APPROVED), Padel-Americano (https://github.com/ptzimmerman/Padel-Americano — MIT, Whist-расписания).

## Video — вести раньше из-за текущего запроса
RootEncoder, MediaMTX, hls.js, controlled FFmpeg build, obs-websocket-js.

## Advertising/Analytics
Recharts, Umami, собственный Proof-of-Play DB.

## Hardware Fleet
ESP-IDF, MQTT.js, Mosquitto, OpenTelemetry/device telemetry.

# 243. Accelerated Video Sprints

```text
A: OnePlus 8/9 Pro + Camera2 probe + RootEncoder + 4K UW + 3h/6h stability
B: MediaMTX + SRT/RTSP + segments + browser preview
C: Recording Session + time sync + markers + manual highlight
D: FFmpeg clip worker + match-point clip + VOD + hls.js timeline
E: 9:16 + score/sponsor overlay + highlight reel
```

# 244. Dependency Approval Workflow

Перед новой dependency:

```text
1. Нужна ли она вообще?
2. Активен ли project?
3. License?
4. Transitive licenses?
5. Security history?
6. Можно ли спрятать за adapter?
7. Что будет, если project умрёт?
8. Можно ли заменить реализацию без migration domain model?
```

Правильный пример:

```text
RatingService → OpenSkillAdapter → OpenSkill
```

а не imports OpenSkill по всему приложению.

# 245. Финальная OSS стратегия

> **Не собирать платформу из готовых SaaS-продуктов. Собирать собственное domain-ядро из небольших permissive OSS building blocks.**

Текущий рекомендуемый набор:

```text
TypeScript / Next.js
Supabase / Postgres
next-intl
TanStack Table
Recharts
FullCalendar Core
Fuse.js
PapaParse / SheetJS CE
OpenSkill.js
brackets-manager.js
tournicano algorithms (Americano/Mexicano, permission on file)
OnePlus Camera Agent
RootEncoder
MediaMTX
controlled FFmpeg build
hls.js
obs-websocket-js
ESP-IDF
MQTT.js
Mosquitto
OpenTelemetry
Umami
```

---

# 246. Court Entity — управление, имена, идентификация

Court перестаёт быть числом 1..10 и становится полноценной сущностью, управляемой из UI клуба без разработчика.

## Требования

- Club Manager может: создать корт, переименовать, изменить свойства, удалить/заархивировать.
- Имя корта — свободный текст: номер, «Центральний», имя спонсора, «Court A».
- Количество кортов в клубе не ограничено `MAX_COURTS`.
- Court CRUD входит в Шаг 1 Development Order (§248) — первая видимая пользователем фича мульти-арендного каркаса.

## Модель

```text
courts
├── id            UUID, PK
├── club_id       FK clubs
├── name          display name, свободный текст (выводится на scoreboard/vMix)
├── slug          URL-safe, уникален в пределах клуба, редактируемый
├── short_code    глобально уникальный короткий код, immutable
├── legacy_number int, nullable — для существующих кортов 1..10
├── sort_order    порядок на dashboard
├── status        active | archived | maintenance (§110)
└── created_at / updated_at
```

## Правила

```text
short_code:
- 6–8 символов base62 (nanoid (MIT) или собственный генератор)
- без визуально двусмысленных символов (0/O, 1/l/I)
- immutable: печатается в QR на корте и привязывается к оборудованию
- глобально уникален, не в пределах клуба — см. §247
- генерация с проверкой коллизий; reserved words исключить

slug:
- редактируемый, человекочитаемый alias
- при смене старый slug сохраняется в court_slug_history
  и продолжает резолвиться — старые ссылки не ломаются

удаление:
- только soft delete / archive
- hard delete запрещён при наличии матчей/сессий/записей/рекламы
- archived-корт исчезает из dashboard и планировщиков,
  история остаётся доступной
```

## Миграция существующих данных

```text
court_number 1..10 → создать courts:
  name = "1".."10"
  slug = "1".."10"
  short_code = сгенерировать
  legacy_number = исходное число

матчи: court_number → court_id (FK)
legacy-роуты продолжают работать (§247)
```

---

# 247. Уникальные короткие ссылки и мульти-клубовый broadcast

## Проблема

Superadmin может одновременно транслировать корты из разных клубов (vMix/OBS browser sources, video wall, spectator screens). `/court/3` неоднозначен: «3» есть в каждом клубе. Ссылка на корт должна быть глобально уникальной и по возможности короткой — без `?club=` параметров.

## Принципы

```text
- глобально уникальный short_code в URL (§246)

- canonical-роуты, короткие:

  /c/{short_code}                    fullscreen scoreboard
  /api/v1/courts/{short_code}        court state JSON
  /api/v1/courts/{short_code}/vmix   vMix payload
  /watch/{short_code}                public live page (future, §38)

- alias-роуты человекочитаемые:

  /{club-slug}/{court-slug}          → alias/redirect на canonical

- QR на корте = /c/{short_code} — вечная ссылка:
  переименование корта и смена slug её не меняют
```

## Superadmin Broadcast Wall

Расширение §114 (Venue Wall) до кросс-клубового режима:

```text
- multi-select кортов любых клубов
- сетка готовых URL для vMix/OBS browser sources
- единый wall-режим: несколько кортов на одном экране
- каждый корт идентифицируется только short_code —
  конфликтов между клубами нет
```

## Legacy-совместимость

```text
/fullscreen-scoreboard/[number]   — работает в рамках default club, deprecated
/api/court/[number]               — работает в рамках default club, deprecated
новые ссылки всегда canonical /c/{short_code}
```

---

# 248. Development Order — с чего начать (на базе текущего кода)

Детализация §242 применительно к существующей кодовой базе.

Уже есть и переиспользуется:

```text
- чистые доменные модули: scoring-logic / match-view / match-undo / match-timing
- идемпотентные команды + revision-конфликты: match_operations
- offline-очередь синхронизации: match-sync
- ~438 тестов с coverage-ratchet, Playwright e2e
- lib/dy/* — готовый архитектурный образец Booking Adapter
```

## Шаг 0 — фундамент (≈ неделя, перед любыми новыми фичами)

```text
1. Устранить второй движок: handleScoreClick в score-board.tsx
   перевести на lib/scoring-logic.ts; закрыть задокументированный
   deuce-баг регрессионным тестом
2. SETTINGS_PASSWORD без дефолта "111": env обязателен, fail-closed
3. Закоммитить текущий WIP (страны/аватары/имена) отдельной веткой
4. THIRD_PARTY_LICENSES.md + third-party-licenses.json + CI-проверка (§205)
```

DoD:

```text
- lint / test / coverage / e2e smoke зелёные
- один код-путь счёта; раздел про «два параллельных движка»
  в endpoint.md удалён
- запуск без SETTINGS_PASSWORD падает с понятной ошибкой
```

## Шаг 1 — Org / Club / Court + Auth + Court CRUD

§3, §49–50, §246, §247.

```text
1. Миграции: organizations, clubs, courts (модель §246)
2. Default organization/club; существующие корты 1..10 импортированы
3. Court Management UI: create / rename / edit / archive
   — первая видимая пользователем фича
4. short_code + canonical-роуты /c/{code} рядом с legacy
5. Supabase Auth + RLS User→Org→Club→Resource (паттерны Basejump §232)
6. password-cookie удалён; X-API-Key остаётся для машинных интеграций
```

DoD:

```text
- старые vMix/TV URL работают без изменений
- новый корт создаётся из UI; scoreboard открывается по /c/{code}
- корты из двух разных клубов открываются одновременно в двух
  browser sources без конфликтов (superadmin broadcast, §247)
- переименование корта не ломает QR (short_code immutable)
- RLS-тест: игрок не может изменить матч прямым запросом
```

## Шаг 2 — Court Session + Participants + Multi-court Dashboard

§5, §6, §46.

```text
1. court_sessions + session_participants; матч получает session_id
2. Quick Play / QR → session без booking (§15)
3. Club Dashboard по реестру кортов
   (зачаток: getOccupiedCourts / getFreeCourts)
```

DoD:

```text
- матч всегда принадлежит session
- dashboard показывает все корты клуба со статусами в реальном времени
- quick play по QR корта запускает session
```

## Шаг 3 — единый command pipeline + match_events

§22, §99.

```text
UI-клик, физическая кнопка и внешний API идут одним код-путём
через lib/remote-commands.ts:

command → validation → idempotency → event → projection
```

DoD:

```text
- undo/redo идентичны из любого клиента
- match_events — источник истины; snapshot — проекция
- score-board.tsx не содержит собственной логики счёта
- ДОЛГ slice 1B: снять pre-step3 write-политики на matches/players
  (миграция 20260817030000) после перевода клиентской записи на серверный
  command pipeline — сейчас клиент пишет напрямую REST с anon-ключа
```

## Шаг 4 — Device Registry

§18, §19, §88.

```text
таблица devices + pairing-коды (A7K9Q2) + собственные device-ключи
вместо общего API key; все действия устройств — в audit
```

DoD:

```text
- новое устройство подключается без разработчика
- команды устройства идемпотентны и атрибутируемы
```

## Шаг 5 — Booking Adapter

§13, §14. Архитектурный образец уже есть: `lib/dy/*`.

```text
BookingProvider adapter → NormalizedBooking → session candidate
external_id mapping + merge candidates (§14, §124)
первый провайдер: Playtomic (или второй источник по dy-образцу)
```

DoD:

```text
- внешние брони появляются как candidates в dashboard
- повторный импорт не создаёт дубликаты
```

## Параллельный трек — Video Sprint A (§243)

```text
OnePlus/OPPO PoC (Camera2 probe, 4K ultrawide, 3h/6h stability)
не зависит от бэкенда — начинать сразу, параллельно Шагам 0–2

MediaMTX + SRT можно поднять на любом VPS на первой неделе
```

## Не начинать с

```text
PowerSync          — после единого движка и событийной модели (§231)
next-intl          — текущий translations.ts работает (§208 позже)
рейтинги/Americano — фаза Competition после Court Session
billing / white label / automation engine (§242)
```

---

# 249. Кандидаты на включение — не отражены в approved-наборе

Все — library-level, без новых сервисов, соответствуют стратегии §245.
Включать через §244 Dependency Approval Workflow.

## Готовые к audit (лицензия проверена)

| Библиотека | Лицензия | Что закрывает |
|---|---|---|
| nanoid | MIT | генерация short_code (§246) — нужна уже в Шаге 1 |
| TanStack Query | MIT | optimistic UI, reconnect, кэш (§53); PWA и dashboards |
| CASL (`@casl/ability`) | MIT | permissions `matches.read/...` на клиенте и сервере (§4.10) |
| XState v5 | MIT | Court FSM (§47), Recording FSM (§133), состояния табло (§16) |
| pg-boss | MIT | Postgres job queue поверх Supabase, без Redis: клипы, импорты, rating recalc (§103) |
| rrule.js | MIT | recurrence для Universal Scheduler (§75) |
| json-rules-engine | MIT | TRIGGER → CONDITIONS → ACTIONS (§76, §228) |
| rate-limiter-flexible | ISC | rate limiting с Postgres backend (§117) |
| qrcode | MIT | генерация QR (§15, §73) |
| jsQR | Apache-2.0 | сканирование QR камерой (§15) |
| Standard Webhooks JS SDK | MIT | подпись webhook payload по спецификации (§102) |
| date-fns | MIT | date math для таймеров/расписаний (§17) |
| Serwist | MIT | service worker / offline для Next.js App Router PWA (§44) |
| WorkManager (AndroidX) | Apache-2.0 | фоновая очередь upload Camera Agent с retry/constraints (§149) |
| OkHttp | Apache-2.0 | networking Camera Agent |

## Проверить лицензию перед audit

| Сущность | Статус | Примечание |
|---|---|---|
| munkres-js | TBD | assignment solver — если паринга tournicano не хватит для Mexicano |
| html-to-image | TBD | клиентский рендер share-карточек — альтернатива серверному rasterizer (§207) |
| pg_cron | входит в Supabase | DB-level периодика (retention, cleanup) — не новая зависимость |

## Исключено при проверке

| Библиотека | Лицензия | Причина |
|---|---|---|
| web-push | MPL-2.0 | не проходит §205; push-канал — собственный adapter (RFC 8030/VAPID) или провайдер; для staff проще Telegram Bot API |
| sharp | Apache-2.0 npm, но binary тянет libvips (LGPL) | формально не проходит §205; см. §207 |

