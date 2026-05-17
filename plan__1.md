# План исправлений: логика счёта, смены правил, scoreboard, JSON

Дата: 2026-05-17
Ветка: Nivki_RSP_1

---

## 📋 Сводный статус (что именно пофикшено)

| Пункт | Описание | Статус | Где сделано |
|-------|----------|--------|-------------|
| A1 | Дропдаун «Сеты» мутирует состояние, обходит диалог | ✅ Исправлено | Этап 1 |
| A2 | Смена правил не пересчитывает `isCompleted`/`winner` | ✅ Исправлено | Этап 1 |
| A3 | `newSets === played` применяется молча | ✅ Исправлено | Этап 1 |
| A4 | `pendingRuleChange` хранит устаревший снимок | ✅ Исправлено | Этап 4 |
| A5 | `winSetInSettings` не меняет стороны корта | ✅ Исправлено | Этап 3 |
| A6 | `handleScoreDecrease` не обновляет `localMatchState` | ✅ Исправлено | Этап 1 |
| A7 | vMix-эндпоинт отдаёт только 3 сета | ✅ Исправлено | Этап 1 + 2 |
| B1 | Двойная смена сторон в конце «нечётного» сета | ✅ Исправлено | Этап 1 |
| B2 | Неверно расположен null-guard в ScoreBoard | ✅ Исправлено | Этап 1 |
| B3 | `isSetPoint` игнорирует `gamesPerSetOverrides` | ✅ Исправлено | Этап 3 |
| B4 | Дубли `switchServer` в трёх файлах | ✅ Исправлено | Этап 3 |
| B5 | «Сет N+1» после завершения матча | ✅ Исправлено | Этап 4 |
| C1 | Единый движок мутации | ✅ Сделано | Этап 3 |
| C2 | Единый проектор `lib/match-view.ts` | ✅ Сделано | Этап 2 |
| C3 | Хук `useMatch` (владелец состояния) | ✅ Сделано (ядро) | Этап 8 |
| i18n | Тест ключей перевода + фикс `common.rightSide` | ✅ Сделано | Этап 7 |

**Вывод: все ошибки A1–A7 и B1–B5 исправлены; унификация C1–C3 выполнена.**
C3 сделан в объёме «ядро»: канонический матч теперь во владении хука
`useMatch`; `ScoreControls` больше не держит свою копию. Анти-flicker буфер
`localMatchState` в `ScoreBoard` намеренно оставлен (детали — Этап 8).

Автоматизация (Этапы 5–8): `npm run check` — 45 тестов + typecheck PASS;
`npm run e2e` — 9 тестов PASS.

---

## Часть A. Подтверждённые ошибки (приоритет)

### A1. 🔴 Дропдаун «Сеты»/«Супер-сет» мутирует состояние и обходит диалог подтверждения — ✅ ИСПРАВЛЕНО (Этап 1)
**Где:** `components/match-settings.tsx:840-859`
**Суть:** `const updatedMatch = { ...match }` — поверхностная копия, поэтому
`updatedMatch.settings === match.settings`. Строки вида
`updatedMatch.settings.isSuperSet = true` мутируют исходный объект `match.settings`.
В результате `classifyRuleChange(match.settings, updatedMatch.settings, ...)`
сравнивает объект сам с собой → `diffKeys` возвращает `[]` → scope `"safe"` →
`doCommit` применяется без диалога, даже когда правило `restart-required`.

**Исправление:**
- Заменить на глубоко-независимую копию settings:
  `const updatedMatch = { ...match, settings: { ...match.settings } }`.
- Все присваивания делать в новый объект `updatedMatch.settings`.
- Проверить, что `requestRuleChange` после этого корректно классифицирует
  переход на супер-сет как `restart-required`.

### A2. 🔴 Смена правил не пересчитывает `isCompleted` / `winner` — ✅ ИСПРАВЛЕНО (Этап 1)
**Где:** `components/match-settings.tsx` → `commitRuleChange` (стр. 130-136);
`lib/scoring-logic.ts` → `normalizeMatchState` (стр. 560-566).
**Суть:** изменение `sets` или final-set-формата меняет `getSetsToWin`
(`lib/match-format-rules.ts:98`), но завершённость матча нигде не пересчитывается.
Матч, уже выигранный по новым правилам, продолжается (или наоборот).

**Исправление:**
- Добавить в `lib/scoring-logic.ts` функцию
  `recomputeMatchCompletion(match): Match` — пересчёт `score.teamA/teamB`
  (из `score.sets` по `winner`), затем `isCompleted` / `winner` через
  `getSetsToWin(settings)`. Реиспользовать ту же логику, что в
  `match-settings.tsx` `updateSetScore`/`saveSetScore` (сейчас она там
  продублирована — вынести).
- Вызывать `recomputeMatchCompletion` внутри `commitRuleChange` после
  `normalizeMatchState`.

### A3. 🟡 Случай `newSets === played` классифицируется как `future-only` — ✅ ИСПРАВЛЕНО (Этап 1)
**Где:** `lib/match-rule-change.ts:183-192` (`classifyKey`, case `"sets"`).
**Суть:** `restart-required` только при `newSets < played`. При
`newSets === played` (матч по новым правилам уже должен быть завершён)
изменение применяется молча.

**Исправление:** в case `"sets"` добавить ветку — если по новым настройкам
`getSetsToWin` достигнут какой-либо командой → `restart-required` (или хотя бы
`current-set`). После A2 пересчёт завершённости снимет часть риска, но
классификацию всё равно поправить, чтобы показать диалог.

### A4. 🟡 `pendingRuleChange` хранит устаревший снимок матча — ✅ ИСПРАВЛЕНО (Этап 4)
**Где:** `components/match-settings.tsx:75, 160-180`.
**Суть:** пока открыт диалог, очки, набранные локально/через realtime, теряются:
`applyPendingNow`/`applyPendingRestart` коммитят старый `updatedMatch`.

**Исправление:** хранить в `pendingRuleChange` только `settings` + `classification`,
а в момент применения брать **актуальный** `match` (из пропа) и накладывать на
него сохранённые `settings`. Re-классифицировать перед коммитом; если scope
вырос — повторно показать диалог.

### A5. 🟡 `winSetInSettings` не меняет стороны корта в конце сета — ✅ ИСПРАВЛЕНО (Этап 3)
**Где:** `components/match-settings.tsx:268-313` (вызывается из `endTiebreak`).
**Суть:** ручное завершение тай-брейка не выполняет смену сторон в конце сета,
в отличие от движкового `winSet` (`lib/scoring-logic.ts:318-323`).

**Исправление:** см. часть B — удалить `winSetInSettings`/`endTiebreak`-дубль и
использовать движок. Если оставить временно — добавить ту же смену сторон.

### A6. 🟡 `handleScoreDecrease` (ветка без истории) не обновляет `localMatchState` — ✅ ИСПРАВЛЕНО (Этап 1)
**Где:** `components/score-board.tsx:268-303`.
**Суть:** вызывает `updateMatch`, но не `setLocalMatchState`; при активном
`isProcessingClick` (~500 мс) `displayMatch` показывает старый счёт.

**Исправление:** добавить `setLocalMatchState(updatedMatch)` перед `updateMatch`,
как в `handleScoreClick`.

### A7. 🟡 vMix-эндпоинт `/api/vmix/[id]` отдаёт только 3 сета — ✅ ИСПРАВЛЕНО (Этап 1 + 2)
**Где:** `app/api/vmix/[id]/route.ts:66-73`.
**Суть:** для матчей из 5 сетов теряются сеты 4-5. Court-эндпоинт делает
динамически `max(5, totalSets)` (`app/api/court/[number]/route.ts:235-239`).
Также `teamX_current_set` в vmix-эндпоинте показывает счёт последнего сета и
после завершения матча (court-эндпоинт это закрывает проверкой `!isCompleted`).

**Исправление:** см. часть B — оба эндпоинта строить из общего проектора.
Минимально: переписать vmix-эндпоинт на динамический список сетов и guard
`!isCompleted` для текущего сета.

---

## Часть B. Ошибки, найденные при повторной проверке

### B1. 🔴 Двойная смена сторон в конце «нечётного» сета — ✅ ИСПРАВЛЕНО (Этап 1)
**Где:** `lib/scoring-logic.ts` — `winGame:199-203` ставит `shouldChangeSides=true`
при нечётном числе геймов в сете; `winSet:318-323` дополнительно сам меняет
`courtSides`. Потребитель флага — `components/score-controls.tsx:28-32` —
в `useEffect` вызывает `changeSides()`, который меняет `courtSides` ещё раз.
**Эффект:** сет 6:3 (9 геймов, нечёт) → `winSet` поменял стороны + флаг →
`ScoreControls` поменял повторно → стороны фактически **не сменились**.
Сет 6:4 (10 геймов, чёт) → меняются один раз. Поведение несогласованно.

**Исправление:** одна точка ответственности за смену сторон.
- Вариант (рекомендуется): `winSet` **не** трогает `courtSides` напрямую;
  смену сторон в конце сета выражать через `shouldChangeSides` по корректному
  теннисному правилу (после сета меняемся, если сумма геймов сета нечётная;
  при чётной — после первого гейма следующего сета). Всю смену сторон проводит
  единый обработчик `shouldChangeSides`.
- Убедиться, что `winGame` не выставляет флаг, когда гейм одновременно
  завершает сет, если решение о конце сета принимает `winSet`.
- Покрыть тестом в `test/scoring-logic-regression.ts`.

### B2. 🟡 Неверно расположен null-guard в ScoreBoard — ✅ ИСПРАВЛЕНО (Этап 1)
**Где:** `components/score-board.tsx:171-175`.
**Суть:** `const { teamA, teamB } = displayMatch` и
`const currentSet = displayMatch.score.currentSet` выполняются **до**
`if (!displayMatch) return null`. При `displayMatch == null` — краш, guard мёртв.

**Исправление:** перенести `if (!displayMatch) return null` (а также проверку
`displayMatch.score?.currentSet`) выше деструктуризации.

### B3. 🟡 `isSetPoint` игнорирует `gamesPerSetOverrides` и тай-брейк — ✅ ИСПРАВЛЕНО (Этап 3)
**Где:** `lib/scoring-logic.ts:441-453` (`wouldWinSet` внутри `isSetPoint`).
**Суть:** берётся `settings.gamesPerSet || 6` без учёта пер-сетовых
переопределений и порога тай-брейка → индикатор «SET POINT» врёт на нестандартных
сетах. Влияет на scoreboard и на JSON court-эндпоинт (`is_set_point`).

**Исправление:** вычислять цель гейма через тот же helper, что и `winGame`
(вынести расчёт `gamesNeededToWin`/`tiebreakAt` в общую функцию
`getSetTargets(match, setIndex)` и использовать в `winGame`, `isSetPoint`,
`isGamePoint`).

### B4. 🟢 Дубли `switchServer` в трёх файлах — ✅ ИСПРАВЛЕНО (Этап 3)
**Где:** `lib/scoring-logic.ts:339`, `components/score-board.tsx:336`,
`components/score-controls.tsx:86`. Три почти идентичные реализации — риск
расхождения при правках.

**Исправление:** экспортировать единый `switchServer` из `lib/scoring-logic.ts`
и импортировать его в компоненты.

### B5. 🟢 `currentSetIndex + 1` показывает «Сет N+1» после завершения матча — ✅ ИСПРАВЛЕНО (Этап 4)
**Где:** `components/score-board.tsx:861`.
**Суть:** после завершения `sets.length` включает все сеты, заголовок
показывает несуществующий следующий сет.

**Исправление:** при `match.isCompleted` показывать номер последнего сыгранного
сета.

---

## Часть C. Унификация — один источник истины для счёта

Сейчас логика счёта размазана и расходится:

| Слой | Файлы | Проблема |
|------|-------|----------|
| Мутация счёта | `scoring-logic.ts` (движок) + дубли `winSetInSettings`, `endTiebreak`, `switchServer` ×3 | разные реализации |
| Проекция для отображения | `score-board.tsx` (`getServeSide`, `getCurrentGameScore`, `allSets`), `full-screen-scoreboard.tsx`, `court-svg-preview.tsx`, `court-visualization.tsx`, `app/vmix/[id]`, `app/court-vmix/[number]`, `app/fullscreen-scoreboard/[number]` | формат очков/подачи продублирован в ~7 местах |
| JSON | `app/api/vmix/[id]`, `app/api/court/[number]` | расчёт `teamX_game_score` и список сетов inline, эндпоинты расходятся (см. A7) |
| Состояние | `localMatchState` (score-board), `localMatch` (score-controls) | независимые копии одного матча |

**Предлагаемая архитектура — два чистых модуля + один хук:**

### C1. `lib/scoring-logic.ts` — единственный модуль *мутации* — ✅ СДЕЛАНО (Этап 3)
- Оставить движком всё изменение счёта.
- Удалить дубли из компонентов (A5, B4): `winSetInSettings`, `endTiebreak`,
  `switchServer` в `score-board.tsx`/`score-controls.tsx` → вызывать экспортируемые
  функции движка.
- Добавить `recomputeMatchCompletion` (A2) и `getSetTargets` (B3).

### C2. Новый `lib/match-view.ts` — единственный модуль *проекции* (чистые функции) — ✅ СДЕЛАНО (Этап 2)
Вход — объект `match`, выход — всё, что нужно любому представлению:
```
getGameScoreDisplay(match, team)   // "0/15/30/40/Ad" или очки тай-брейка
getServeSideForDisplay(match)      // "L" / "R"
getSetsForDisplay(match)           // массив сетов вкл. текущий/будущие
getCompletedSetsCount(match)
buildScoreboardModel(match)        // агрегат для ScoreBoard / FullScreen
buildVmixPayload(match)            // ровно то, что отдаёт JSON
```
- `ScoreBoard`, `FullScreenScoreboard`, `court-svg-preview`, vmix-страницы и
  **оба JSON-эндпоинта** строят вывод только через эти функции.
- Это закрывает A7 и расхождение JSON автоматически: и `/api/vmix/[id]`, и
  `/api/court/[number]` вызывают `buildVmixPayload`.

### C3. Хук `useMatch(matchId)` — единственный владелец состояния — ✅ СДЕЛАНО (Этап 8)
- Внутри: загрузка, подписка realtime, ревизии (как в `page.tsx` сейчас),
  оптимистичные обновления.
- Экспортирует `match` + действия (`applyPoint`, `undo`, `switchServer`,
  `changeSides`, `applyRuleChange`).
- `ScoreBoard` и `ScoreControls` перестают держать `localMatchState`/`localMatch`
  — берут состояние из хука. Это убирает класс рассинхронов A6 и «мерцания».

### Поэтапный порядок внедрения
1. **Этап 1 (быстрые фиксы, без рефакторинга):** A1, A2, A3, A6, B1, B2 + точечно A7.
   Каждое — минимальная правка, можно отдельными коммитами.
2. **Этап 2 (проекция):** создать `lib/match-view.ts`, перевести на него JSON-эндпоинты
   и `ScoreBoard`. Покрыть тестами.
3. **Этап 3 (мутация):** удалить дубли (A5, B4, B3 helper), всё через движок.
4. **Этап 4 (состояние):** хук `useMatch`, убрать локальные копии (A4 решается здесь).

### Тесты
- Расширить `test/scoring-logic-regression.ts`: смена сторон в конце сета (B1),
  пересчёт завершённости при смене `sets` (A2), классификация `newSets === played` (A3).
- Добавить тест на эквивалентность `buildVmixPayload` для обоих эндпоинтов.

---

## Сводка приоритетов (исходная) — все пункты закрыты
- 🔴 Сразу: A1, A2, B1 — ✅ все исправлены (Этап 1)
- 🟡 Затем: A3, A4, A5, A6, A7, B2, B3 — ✅ все исправлены (Этапы 1–4)
- 🟢 В рамках рефакторинга: B4, B5 — ✅ исправлены (Этапы 3–4);
  часть C — C1, C2, C3 ✅ все сделаны (Этапы 2, 3, 8)

---

## Статус реализации

### Этап 1 — быстрые фиксы — ✅ ВЫПОЛНЕН (2026-05-17)
| Пункт | Статус | Что сделано |
|-------|--------|-------------|
| A1 | ✅ | `match-settings.tsx`: дропдаун «Сеты» теперь клонирует `settings` (`{ ...match, settings: { ...match.settings } }`) — `classifyRuleChange` снова видит реальный diff, диалог не пропускается |
| A2 | ✅ | `scoring-logic.ts`: добавлена `recomputeMatchCompletion`; вызывается в `commitRuleChange` после `normalizeMatchState` |
| A3 | ✅ | `match-rule-change.ts`: case `"sets"` — если по новым настройкам команда уже набрала `getSetsToWin`, scope = `current-set` (диалог) |
| A6 | ✅ | `score-board.tsx`: `handleScoreDecrease` (ветка без истории) теперь делает `setLocalMatchState` |
| B1 | ✅ | `scoring-logic.ts`: `winSet` больше не свопает `courtSides` напрямую — выставляет `shouldChangeSides` по чётности геймов сета (убрана двойная смена сторон) |
| B2 | ✅ | `score-board.tsx`: null-guard перенесён до деструктуризации `displayMatch` |
| A7 | ✅ | `app/api/vmix/[id]/route.ts`: список сетов строится динамически (`max(5, totalSets)`) + текущий сет добавляется только при `!isCompleted` |

Проверка: `npx tsc --noEmit` — без ошибок.

### Этап 2 — единый проектор счёта — ✅ ВЫПОЛНЕН (2026-05-17)
| Что | Статус | Детали |
|-----|--------|--------|
| `lib/match-view.ts` | ✅ | Новый модуль чистых функций-проекций: `getGameScoreDisplay`, `getServeSide`, `getTeamDisplayName`, `isTeamServing`, `getSetScoreColumns`, `getDisplaySets`, `getSetCount`, `buildVmixFlatData` |
| `/api/vmix/[id]` | ✅ | Плоский payload строится через `buildVmixFlatData(match)` — убран дублированный inline-код |
| `/api/court/[number]` | ✅ | База — `buildVmixFlatData(match)`, поверх неё court-специфичные поля; колонки сетов — `getSetScoreColumns` |
| `ScoreBoard` | ✅ | `getCurrentGameScore` → `getGameScoreDisplay`, `getServeSide` → общий `getServeSide` из проектора |

Результат: формат счёта гейма, сторона подачи и список сетов считаются в одном
месте — scoreboard и оба JSON-эндпоинта больше не могут разойтись.
Проверка: `npx tsc --noEmit` — без ошибок.

### Этап 3 — устранение дублей мутации — ✅ ВЫПОЛНЕН (2026-05-17)
| Пункт | Статус | Детали |
|-------|--------|--------|
| B4 | ✅ | `switchServer` экспортирован из `scoring-logic.ts`; удалены копии в `score-board.tsx` и `score-controls.tsx` — одна реализация |
| B3 | ✅ | Новый `getSetTargets(match)` в движке; используется в `winGame` и в `isSetPoint` — индикатор «SET POINT» теперь учитывает `gamesPerSetOverrides` и games-to-12 |
| A5 | ✅ | `winSetInSettings` (ручное завершение тай-брейка) выставляет `shouldChangeSides` так же, как движок (согласовано с B1) |

Проверка: `npx tsc --noEmit` — без ошибок.

### Этап 4 — остаточные баги и тесты — ✅ ВЫПОЛНЕН (2026-05-17)
| Пункт | Статус | Детали |
|-------|--------|--------|
| A4 | ✅ | `pendingRuleChange` хранит только `settings` (не снимок матча); `buildPendingMatch` накладывает их на актуальный `match` — очки, набранные при открытом диалоге, не теряются |
| B5 | ✅ | `score-board.tsx`: после завершения матча показывается номер последнего сыгранного сета (`displaySetNumber`), а не следующего |
| Тесты | ✅ | `test/scoring-logic-regression.ts` расширен проверками B1 (смена сторон), A2 (`recomputeMatchCompletion`), A3 (классификация смены сетов), B3 (`getSetTargets`) |

Проверка: `npx tsc --noEmit` — без ошибок; `scoring-logic`, `match-sync`,
`rule-change-realtime` регресс-тесты — все проходят.

### Решение по хуку `useMatch`
На Этапе 4 хук был отложен; выполнен на **Этапе 8** (см. ниже) после того,
как появилась страховка из тестов (компонентные + E2E).

### Осталось (необязательное, архитектурное)
- Перевести на `lib/match-view.ts` также `full-screen-scoreboard.tsx`,
  `app/vmix/[id]`, `app/court-vmix/[number]`, `court-svg-preview.tsx`.
- Таблица сетов `allSets` в `ScoreBoard` (сейчас смесь `match`/`displayMatch`).

## Итог
Все ошибки из частей A и B исправлены и покрыты проверками. Введён единый
проектор счёта (`lib/match-view.ts`) и единый движок мутаций (`scoring-logic.ts`
с экспортируемыми `switchServer`, `getSetTargets`, `recomputeMatchCompletion`).
Дальнейшая унификация состояния — опциональный архитектурный шаг.

---

## Этап 5 — автоматизация проверок — ✅ ВЫПОЛНЕН (2026-05-17)

Подготовка к масштабированию на много видов спорта: единый запуск проверок,
тестовый фреймворк, покрытие кода с порогами, логирование.

| Что | Файл | Детали |
|-----|------|--------|
| Фреймворк | `vitest.config.ts` | Vitest 4 + v8-coverage; `environment: node`; alias `@/`; авто-поиск `test/**/*.test.ts` |
| Оркестратор | `scripts/check.mjs` | `npm run check`: typecheck → тесты+покрытие → лог в `logs/check-<дата>.log` → сводка → ненулевой код при ошибке |
| npm-скрипты | `package.json` | `typecheck`, `test`, `test:watch`, `test:coverage`, `check` |
| Обёртки | `test/scoring-logic.test.ts`, `test/rule-change.test.ts`, `test/match-sync.test.ts` | Подключают существующие `*-regression.ts` в Vitest-сьют |
| Новые сьюты | `test/match-view.test.ts`, `test/tennis-utils.test.ts`, `test/scoring-indicators.test.ts` | Эталонные `describe/it/expect`-тесты; подняли покрытие |
| Документация | `test/README.md` | Как добавить тесты нового вида спорта |
| Прочее | `match-sync-regression.ts`, `.gitignore` | `export main()` + guard прямого запуска; `logs/` в .gitignore |

**Результат:** `npm run check` — 32 теста проходят, typecheck чистый.
Покрытие (порог-ратчет в `vitest.config.ts`): statements 72% / branches 60% /
functions 87% / lines 76%.

**Как добавить вид спорта:** положить `test/<sport>.test.ts` — Vitest подхватит
сам; держать логику в `lib/` и добавить файл в `coverage.include`. Подробно — в
`test/README.md`.

**Возможные следующие шаги (по желанию):** git pre-commit хук на `npm run check`;
GitHub Actions / CI; поднять пороги покрытия по мере роста тестов.

---

## Этап 6 — компонентные и E2E-тесты — ✅ ВЫПОЛНЕН (2026-05-17)

Добавлены два новых слоя проверок поверх unit-тестов.

| Слой | Файлы | Детали |
|------|-------|--------|
| Компонентные | `test/components/score-board.test.tsx` | React-компоненты в jsdom (Vitest + Testing Library); реальный клик по счёту → движок → `updateMatch`. Входит в `npm run check` |
| E2E + API | `playwright.config.ts`, `e2e/smoke.spec.ts`, `e2e/api-smoke.spec.ts` | Playwright поднимает `next dev` + Chromium; прокликивание страниц + проверка JSON-эндпоинтов. Команда `npm run e2e` |

**Логирование:** при падении E2E — trace, скриншот и видео в
`logs/playwright-results`, HTML-отчёт в `logs/playwright-report`
(`npm run e2e:report`).

**Результат проверки (2026-05-17):**
- `npm run check` — 35 тестов (unit + компонентные) + typecheck, PASS;
- `npm run e2e` — 8 тестов (3 UI smoke + 5 API), PASS.

**Что покрыто:** рантайм `ScoreBoard` (рендер + клик по счёту), загрузка
страниц в реальном браузере (`/`, `/new-match`), навигация, парольный экран,
поведение `/api/court/[number]` и `/api/vmix/[id]` (валидация, 404, формат JSON).

**Сознательно не сделано:** полный E2E-сценарий «создать матч → набрать счёт»
через форму `/new-match` — форма сложная (Radix Select, выбор игроков из
ростера), надёжный селектор-сценарий без живой отладки хрупок. Само
взаимодействие со счётом уже покрыто компонентным тестом `ScoreBoard`. При
необходимости такой сценарий добавляется отдельным `e2e/match-flow.spec.ts`.

**Установка:** `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/*`,
`@playwright/test` — все в `devDependencies`. Из-за конфликта peer-зависимостей
(`react-day-picker` ↔ React 19) установка требует флага `--legacy-peer-deps`.

---

## Этап 7 — проверка ключей перевода — ✅ ВЫПОЛНЕН (2026-05-17)

Повод: рантайм-предупреждение `Translation key not found: common.rightSide`.
Причина — `score-board.tsx` обращался к `t("common.leftSide/rightSide")`, а
ключи лежат в неймспейсе `match`. `t()` принимает любую строку — типы такое
не ловят.

| Что | Файл | Детали |
|-----|------|--------|
| Фикс | `components/score-board.tsx` | `common.leftSide/rightSide` → `match.leftSide/rightSide` (4 места) |
| Тест | `test/translations-keys.test.ts` | Сканирует весь UI-код, извлекает ключи `t("...")`, проверяет наличие в `translations.ts` |

Тест нашёл **36 пред­существующих** пропущенных ключей (30 в `vmixSettings.*`
из `app/vmix-settings/[id]/page.tsx`, 6 — неверные неймспейсы/опечатки). Они
занесены в baseline `KNOWN_MISSING`: тест падает на **новых** пропусках и на
**устаревших** записях baseline (ратчет — список только сокращается).

`npm run check` — 38 тестов, PASS.

**Технический долг (`KNOWN_MISSING`):** 36 ключей. Рекомендуется отдельной
задачей: 6 «дешёвых» (неверный неймспейс — правится в компоненте), 30
`vmixSettings.*` — добавить переводы в `translations.ts` для ru/en/uk.

---

## Этап 8 — хук `useMatch` (C3) — ✅ ВЫПОЛНЕН (2026-05-17)

Единый владелец канонического состояния матча. Реализован в объёме «ядро».

| Что | Файл | Детали |
|-----|------|--------|
| Новый хук | `hooks/use-match.ts` | Владеет `match`/`loading`/`error`; инкапсулирует загрузку, realtime-подписку, событие `match-updated`, оптимистичный `updateMatch` + storage-quota fallback |
| Страница | `app/match/[id]/page.tsx` | ~170 строк inline-логики состояния заменены на `useMatch(matchId)`; страница только потребляет состояние |
| `ScoreControls` | `components/score-controls.tsx` | Удалена собственная копия `localMatch` (была чистой избыточностью) — компонент работает напрямую с `match` из хука |
| Тесты | `test/use-match.test.tsx`, `test/components/score-controls.test.tsx` | 7 новых тестов: загрузка/ошибка/`updateMatch`/подписка хука; рендер и смена сторон в `ScoreControls` |
| E2E | `e2e/smoke.spec.ts` | + сценарий `/match/<неизвестный-id>` — прогоняет `useMatch` в реальном браузере (загрузка → not found → error card) |

**Проверка:** `npm run check` — 45 тестов + typecheck PASS; `npm run e2e` —
9 тестов PASS.

### Что сознательно НЕ тронуто
- **`localMatchState` в `ScoreBoard`** оставлен. Это не дубль владения, а
  намеренный анти-flicker буфер на время 500 мс debounce и realtime-эхо.
  Его удаление — косметика (мерцание), не баг; требует живой проверки на двух
  устройствах и риск регрессии только что внесённых фиксов A6/B2. `ScoreBoard`
  читает `match` из единого источника (хука) — это и есть цель C3.
- **`useState`-поля настроек в `MatchSettings`** — это нормальное состояние
  контролируемых инпутов формы, не рассинхрон.

### Требуется ручная проверка (realtime нельзя проверить статикой)
- Открыть матч в **двух браузерах**: счёт, набранный в одном, появляется во
  втором; нет мерцания/отката счёта.
- Быстрые клики по счёту — нет рассинхрона.
- Смена правил во время игры (диалог) при втором открытом устройстве.

## Финальный итог
Все пункты плана (A1–A7, B1–B5, C1–C3) закрыты. Дополнительно построена
автоматизация проверок (Этапы 5–8): `npm run check` и `npm run e2e`.

---

## Этап 9 — vMix-табло: индикаторы и счёт сетов — ✅ ВЫПОЛНЕН (2026-05-17)

Повод: на `court-vmix` показывался «SET POINT» на завершённом матче и
неверные «лишние» числа.

| Проблема | Причина | Фикс |
|----------|---------|------|
| «SET POINT» на завершённом матче | `getImportantPoint`/`isGamePoint`/`isSetPoint`/`isMatchPoint` не проверяли `isCompleted` | Гард `isCompleted` в `isGamePoint` и `getImportantPoint` (`scoring-logic.ts`) — каскадно чинит все индикаторы и JSON |
| Устаревший счёт гейма в колонке очков у проигравшего | Тернарник: победитель → трофей, проигравший уходил в else и показывал `getCurrentGameScore` | `court-vmix`: при `isCompleted` проигравший — пусто |
| Супер-тай-брейк показывался как `0⁵`/`1¹⁰` | `0`/`1` — артефакт «геймов»; рендер не различал супер-тай-брейк | Новый `getSetCellDisplay` в `match-view.ts`: супер-тай-брейк → очки тай-брейка (`5`/`10`) без индекса |
| Надстрочный индекс на обеих командах | Каждая команда показывала свой счёт тай-брейка | `getSetCellDisplay`: индекс только у проигравшего сет (стандарт тенниса) |

Применено во **всех трёх** vMix-табло: `court-vmix`, `vmix/[id]`,
`fullscreen-scoreboard` (через общий `getSetCellDisplay` + локальный
`renderSetCell`).

### Полная ревизия логики правил
Проверены все индикаторы и движок:
- **game point** (classic / no-ad / fast4) — корректно: классика на 40-40 без
  golden point не game point (нужно преимущество); на Ad — game point; с
  golden point на 40-40 → «both»; no-ad/fast4 на 40-40 → «both»;
- **set point** — найдена и исправлена ошибка: `wouldWinSet` игнорировал
  `goldenGame`. Теперь при счёте `gamesNeededToWin-1` всухую (напр. 5-5)
  следующий гейм корректно отмечается как set point. `wouldWinSet` приведён
  в точное соответствие с `winGame` (super set / golden game / fast4 / обычный);
- **match point** — корректно (надстройка над `isSetPoint`; проверка
  `setsToWin-1` выигранных сетов; учёт match-tiebreak формата);
- **tiebreak** — корректно (game point в тай-брейке = set point; маржа
  sudden-death=1 / иначе 2; длина супер-тай-брейка из `getFinalSetTiebreakLength`);
- **завершённый матч** — индикаторы молчат (Этап 9, гард `isCompleted`);
- движок `applyScoreIncrement`/`winGame`/`winSet` — без замечаний.

`npm run check` — 55 тестов + typecheck PASS; `npm run e2e` — 9 PASS.
Добавлены тесты: `getSetCellDisplay` (4), индикаторы завершённого матча (3),
golden-game set point (2).

---

## Этап 10 — один движок счёта для всех экранов — ✅ ВЫПОЛНЕН (2026-05-17)

Повод: вопрос «у меня куча разных движков?». Аудит показал: **мутация** уже
была единой (`scoring-logic.ts`), но **проекция** (вывод счёта на экран) была
продублирована.

### Что было продублировано
| Логика | Копий | Где |
|--------|-------|-----|
| `getCurrentGameScore` | 4 | court-vmix, vmix/[id], fullscreen-scoreboard (page + component) |
| `isServing` (по `currentServer`) | 6 | те же + score-board, court-visualization |
| `getServeSide` | 2 | score-board (уже делегировал), court-svg-preview |
| flat-JSON inline | 1 | `/api/match/[id]` строил payload вручную |

### Стало — два единых источника правды
- **`lib/scoring-logic.ts`** — мутация (`applyScoreIncrement`, `winGame`,
  `winSet`, `switchServer`) + индикаторы (`isGamePoint`/`isSetPoint`/
  `isMatchPoint`/`getImportantPoint`, `getSetTargets`).
- **`lib/match-view.ts`** — проекция: `getGameScoreDisplay`, `getServeSide`,
  `isPlayerServing` (новая), `isTeamServing`, `getSetCellDisplay`,
  `getDisplaySets`, `getSetScoreColumns`, `buildVmixFlatData`.

### Кто теперь через единый источник
| Экран / эндпоинт | Источник |
|------------------|----------|
| `/match/[id]` (управление, ScoreBoard/ScoreControls) | scoring-logic + match-view |
| `/match/[id]/view` (→ FullScreenScoreboard) | match-view |
| `/court-vmix/[number]` | scoring-logic + match-view |
| `/fullscreen-scoreboard/[number]` | scoring-logic + match-view |
| `/vmix/[id]` | scoring-logic + match-view |
| `/api/vmix/[id]`, `/api/court/[number]`, `/api/match/[id]` | `buildVmixFlatData` (match-view) |
| court-svg-preview, court-visualization (главная) | match-view |

Каждый экран держит только тонкий локальный алиас (`const getCurrentGameScore =
(team) => getGameScoreDisplay(match, team)` и т.п.) — он лишь связывает локальный
`match`; вся логика — в едином модуле.

`npm run check` — 55 тестов + typecheck PASS; `npm run e2e` — 9 PASS.

---

## Этап 11 — устранение оставшихся дублей-функций — ✅ ВЫПОЛНЕН (2026-05-17)

Три унификации после аудита «что ещё можно свести в одну функцию».

| # | Что было | Стало |
|---|----------|-------|
| 1 | `getTotalSets`/`getSetsToWin`/`getCurrentSetNumber` — 76 строк байт-в-байт скопированы между `/api/court` и `/api/match` | `getMatchTotalSets`/`getMatchSetsToWin`/`getCurrentSetNumber` в `lib/match-view.ts`; роуты импортируют |
| 2 | Преобразования матч⇄row Supabase — 6 функций в 4 файлах (3 копии match→row, 3 расходящиеся row→match) | `lib/match-supabase.ts` — `matchToRow`/`matchFromRow`; 4 файла делегируют. Объединённый `matchFromRow` — надмножество, **починил расхождение**: `server-match-storage` терял `code`/`revision` |
| 3 | Свап сторон корта `{teamA: x==="left"?...}` — 4 копии | `swapCourtSides(sides)` в `lib/scoring-logic.ts`; score-board, score-controls, court-svg-preview используют |
| — | `getImportantEvent`/`getImportantEventText` — 2 копии обёртки | `getImportantEventType(match, label)` в `lib/match-view.ts` |

Проверка: `npm run check` — 66 тестов + typecheck PASS; `npm run e2e` — 9 PASS.
Добавлены тесты: `match-supabase` (8), `getSetCellDisplay`/метаданные сетов/
`getImportantEventType` в match-view, `swapCourtSides`.

Остался один известный дубль — `winSetInSettings`/`endTiebreak` — закрыт на
Этапе 12.

---

## Этап 12 — `winSetInSettings` → единый `commitSetWin` — ✅ ВЫПОЛНЕН (2026-05-17)

Реализован план [winSetInSettings.md](winSetInSettings.md).

| Что | Стало |
|-----|-------|
| `winSetInSettings` (дубль движкового `winSet`) | удалена |
| `commitSetWin(match, team)` | новая чистая функция в `lib/scoring-logic.ts` — общее ядро с `winSet`; сохраняет счёт тай-брейка из обоих источников (`currentSet.tiebreak` и `currentGame`) |
| `endTiebreak` | тонкая обёртка над `commitSetWin`; `confirm()` остался UI |
| Баг с `confirm()` | исправлен — отказ отменяет операцию целиком (`return`), а не оставляет повисшее состояние |

Это был последний дубль логики подсчёта. Теперь **вся** логика «засчитать
сет» — в одном месте (`scoring-logic.ts`).

`npm run check` — 71 тест + typecheck PASS; `npm run e2e` — 9 PASS.
Добавлен сьют `commitSetWin` (5 тестов).

---

## Этап 13 — оптимизации после аудита качества — ✅ ВЫПОЛНЕН (2026-05-18)

Безопасные пункты из качественного аудита (#1-#3); #4 вынесен в план.

| # | Что сделано |
|---|-------------|
| 1 | Удалены 2 мёртвых импорта `getTennisPointName`; в `.gitignore` добавлены `/.kilo/`, `/.tmp-test/`, `/ts-errors*`, `/SCORE TENNIS/` (мусор/декомпилированный APK) |
| 2 | `buildCourtVmixPayload(match, courtNumber)` в `lib/match-view.ts` — GET-обработчики `/api/court/[number]` и `/api/match/[id]` были ~90% идентичны, теперь оба строят payload одним билдером. `/api/court` ужат 157→50 строк |
| 3 | `next.config.mjs`: `compiler.removeConsole` — debug-`console.*` вырезаются из production-сборки (≈90 вызовов), `error`/`warn` остаются; dev не трогается. Ноль правок в коде |
| 4 | План унификации трёх vMix-табло (~4250 строк дублей) → [vmix-scoreboard-unification.md](vmix-scoreboard-unification.md) |

Проверка: `npm run check` — 71 тест + typecheck PASS; `npm run e2e` — 9 PASS.

Крупнейшая оставшаяся оптимизация — единый `<VmixScoreboard>` для трёх табло
(пункт #4, план готов): большой рефактор вёрстки с обязательной ручной
визуальной сверкой каждого экрана.
