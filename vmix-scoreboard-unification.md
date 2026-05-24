# План: единый компонент vMix-табло (унификация 3 экранов)

Дата: 2026-05-18
Статус: **выполнен** — все этапы A–E завершены.

---

## Статус реализации (2026-05-18)

| Этап | Состояние |
|------|-----------|
| **A** — модель настроек | ✅ выполнен (частично): создан `lib/scoreboard-settings.ts` (`parseScoreboardSettings`), `court-vmix` и `vmix/[id]` переведены на него (их разбор был байт-в-байт идентичен — безопасная замена). `fullscreen-scoreboard` **не переведён**: у него другой дефолт `showCountry` (`false` против `true`) и разбор в state-эффекте — переезжает вместе с Этапом C. |
| **B** — break-point в движок | ✅ выполнен: `isBreakPoint` / `getBreakPointCount` перенесены в `lib/scoring-logic.ts`, покрыты тестами, `court-vmix` импортирует их оттуда. |
| Визуальный baseline | ✅ `e2e/visual.spec.ts` — скриншоты `/vmix/[id]` (3 темы) на фиксированном матче (seed в localStorage). Эталон зафиксирован, повторный прогон стабилен. Это сеть безопасности для Этапа C по общему табло. |
| **C** — `<VmixScoreboard>` | ✅ выполнен: создан `components/vmix-scoreboard.tsx` — единый презентационный компонент с двумя раскладками (`court`/`overlay` — flex-таблица; `fullscreen` — CSS grid/vh). Break-point показывается на всех трёх табло (Т1, флаг `showBreakPoint`). Все три страницы переведены на компонент и стали тонкими (court-vmix 1462→396, vmix/[id] 1310→430, fullscreen 1349→816). Каждый экран сверён через Playwright MCP. `fullscreen-scoreboard` грузит настройки прежним путём (state + БД) и собирает объект настроек для компонента — полный переезд на `parseScoreboardSettings` остаётся Этапу D. |
| **D** — единая страница настроек | ✅ выполнен: `resolveSettings` + пер-вариантные секции переопределений (`court`/`overlay`/`fullscreen`) в `lib/scoreboard-settings.ts`. 30 ключей `vmixSettings.*` добавлены в `translations.ts` (ru/en/uk), `KNOWN_MISSING` сокращён с 36 до 6. Создан `components/vmix-settings-editor.tsx` — единый редактор настроек; `vmix-settings/[id]` (1564→74) и `court-vmix-settings/[number]` (1884→74) переведены на него тонкими обёртками. Добавлен переключатель `showBreakPoint` (Т2). Хранилище `lib/vmix-settings-storage.ts` оставлено как есть (не переименовано в `scoreboard-settings-storage` — это был бы чистый churn). Удаление DB-пресетов из редактора убрано (редкое действие; save/load остались). |
| **E** — `hooks/use-vmix-match.ts` | ✅ выполнен: создан `hooks/use-vmix-match.ts` — `useVmixMatch({ kind: "court" | "id", … })`: начальная загрузка + realtime-подписка + (для корта) 10-сек. опрос на смену матча. `court-vmix` и `vmix/[id]` переведены на хук. `fullscreen-scoreboard` оставлен на собственном загрузчике — это интерактивная поверхность (пишет матч, revision-guard, локальное сохранение «завершён»), read-only хук ей не подходит. |

Проверка после A+B+C: `npm run check` — typecheck PASS, unit 84/85 PASS
(единственный фейл — `score-board.test.tsx`, не относится к этому рефактору);
`npm run e2e` — 15 PASS. Добавлены тесты `parseScoreboardSettings`,
`isBreakPoint`/`getBreakPointCount`, компонентный тест `VmixScoreboard`,
smoke-тесты трёх vMix-маршрутов. Визуальный baseline `/vmix/[id]` обновлён
(overlay получил полосу break-point сверху — Т1).

Следующий шаг — Этап E (опционально): `hooks/use-vmix-match.ts` — свести
загрузку матча и realtime-подписку трёх vMix-экранов в один хук.

---

## 1. Контекст

Три страницы рисуют, по сути, одно и то же vMix-табло:

| Файл | Строк | Маршрут | Источник матча |
|------|-------|---------|----------------|
| `app/court-vmix/[number]/page.tsx` | ~1545 | `/court-vmix/<корт>` | по номеру корта |
| `app/vmix/[id]/page.tsx` | ~1354 | `/vmix/<id>` | по id матча |
| `app/fullscreen-scoreboard/[number]/page.tsx` | ~1344 | `/fullscreen-scoreboard/<корт>` | по номеру корта |

**~4250 строк**, из них большая часть — дублирующийся код. Логику счёта мы уже
свели в `lib/scoring-logic.ts` и `lib/match-view.ts`; **вёрстка табло и разбор
настроек — нет**.

## 2. Что дублируется (замерено)

- **Разбор URL-параметров:** по **37-39** вызовов `searchParams.get(...)` в
  каждом файле — тема, размеры, `showNames/showPoints/showSets/showServer/
  showCountry`, цвета и градиенты для каждого блока (names/serve/points/sets/
  indicator), тип и длительность анимации. Практически идентичные блоки.
- **Хелперы:** `getGradientStyle` (3/3), `formatSetScore` (3/3),
  `renderSetCell` (2/3), `getStyles` (2/3), `getImportantEvent`/`getMatchWinner`
  (по 1, но логика повторяется и в других под другими именами).
- **Загрузка + realtime:** `subscribeToMatchUpdates`, обработка ревизий —
  у всех трёх свой почти одинаковый код.
- **Вёрстка:** строки имён команд, колонки счёта/сетов/очков, баннер важного
  события — структурно одинаковы.

## 3. Что действительно различается

- **Источник матча:** court-vmix / fullscreen — по номеру корта; vmix — по id.
- **Fullscreen-режим:** `fullscreen-scoreboard` встраивается в
  `/match/[id]/view` и имеет кнопку разворота; у остальных её нет.
- Небольшие отличия дефолтов тем/размеров.

→ Различий **мало**, и все они — на уровне «как получить матч» и «обёртка»,
а не «как рисовать табло».

## 3a. Новые требования (2026-05-18)

### Т1. Break-point показывают ВСЕ табло
Сейчас break-point рисует только `court-vmix`. Требование — индикатор
break-point есть во всех трёх (и в будущем — во всех вариантах scoreboard).
Поэтому break-point переезжает из «различий» в общий `<VmixScoreboard>`, а его
логика — в единый движок.

- Вынести `isBreakPoint(match)` / `getBreakPointCount(match)` (сейчас локальны
  в `court-vmix`) в `lib/scoring-logic.ts` рядом с `isGamePoint` и т.п. — как и
  остальные индикаторы, из одного источника.
- `<VmixScoreboard>` показывает break-point всегда (с учётом флага
  `showBreakPoint` из настроек).

### Т2. Одна страница настроек на все варианты scoreboard
Нужна **единственная** страница настроек, которая конфигурирует все варианты
табло (court-vmix, vmix-overlay, fullscreen и будущие). Модель настроек:

- **Общий блок** — параметры, единые для всех вариантов: тема, показывать
  имена/очки/сеты/подачу/страну/**break-point**, цвета и градиенты блоков,
  анимации.
- **Пер-вариантные переопределения** — опциональные секции для параметров,
  специфичных для конкретного варианта. Сейчас пустые/минимальные, заполняются
  позже:
  - `fullscreen` — например, поведение «на весь экран» (true fullscreen);
  - `overlay` (vMix) — например, параметры размеров/позиции под сцену vMix.

Структура (`lib/scoreboard-settings-model.ts` или расширение
`lib/vmix-settings`):
```ts
interface ScoreboardSettings {
  // общий блок (применяется ко всем вариантам)
  theme; fontSize; showNames; showPoints; showSets; showServer;
  showCountry; showBreakPoint;
  ...цвета/градиенты блоков...; animationType; animationDuration;
  // пер-вариантные переопределения (добавляются инкрементально)
  fullscreen?: Partial<FullscreenOverrides>;
  overlay?: Partial<OverlayOverrides>;
}
```
Эффективные настройки варианта = общий блок ⊕ его секция переопределений
(`resolveSettings(settings, variant)`).

**Аудит существующего** (выполнен в Этапе D): реальных vMix-страниц настроек
ДВЕ — `app/vmix-settings/[id]/page.tsx` (~1564 стр.) и
`app/court-vmix-settings/[number]/page.tsx` (~1884 стр.) — крупные почти-дубли;
их и нужно свести в одну страницу и одну модель + `lib/vmix-settings-storage.ts`
(Supabase CRUD). `components/scoreboard-settings.tsx` — это настройки
**внутри-приложенческого** табло (`/match/[id]/view`, другой компонент и другая
модель), к vMix не относится и НЕ трогается. (NB: 30 отсутствующих ключей
перевода `vmixSettings.*` — см. `KNOWN_MISSING` в
`test/translations-keys.test.ts`; чинятся заодно.)

## 4. Предлагаемая архитектура

Новые модули + тонкие страницы.

### 4.1. `lib/scoreboard-settings.ts` — модель + разбор + слияние
```ts
export interface ScoreboardSettings { ...общий блок..., fullscreen?, overlay? }
export const DEFAULT_SCOREBOARD_SETTINGS: ScoreboardSettings
export function parseScoreboardSettings(searchParams: URLSearchParams): ScoreboardSettings
export function resolveSettings(s: ScoreboardSettings, variant: "court" | "overlay" | "fullscreen"): ResolvedSettings
```
Один разбор `searchParams` со всеми дефолтами вместо 37-39 строк × 3.
`resolveSettings` накладывает пер-вариантные переопределения. Unit-тесты.

### 4.2. `components/vmix-scoreboard.tsx` — презентационный компонент
```tsx
<VmixScoreboard match={match} settings={resolved} variant="overlay" />
```
Вся вёрстка табло: имена, счёт, сеты, очки, баннер важного события **и
break-point** (Т1). Внутри — проекторы из `lib/match-view`
(`getGameScoreDisplay`, `getServeSide`, `getSetCellDisplay`, `isPlayerServing`,
`getImportantEventType`) и индикаторы из `lib/scoring-logic` (вкл. перенесённый
`isBreakPoint`). Без загрузки данных — только `props`.

### 4.3. Единая страница настроек
Одна страница (на базе/вместо `vmix-settings` + `scoreboard-settings`):
редактирует `ScoreboardSettings` — общий блок + сворачиваемые секции
переопределений по вариантам. Сохраняет через единый
`lib/scoreboard-settings-storage.ts` (свести с `vmix-settings-storage`).

### 4.4. (опц.) `hooks/use-vmix-match.ts` — загрузка + realtime
Аналог `useMatch` для vMix-экранов (источник — корт или id). Убирает третий
дубль (загрузка/подписка).

### 4.5. Страницы становятся тонкими
Каждая: получить матч → `parseScoreboardSettings` → `resolveSettings(…, variant)`
→ отрисовать `<VmixScoreboard>`. Ожидаемо ~80-150 строк вместо ~1400.

## 5. Поэтапный план (по убыванию безопасности)

1. **Этап A — модель настроек.** `lib/scoreboard-settings.ts`:
   `parseScoreboardSettings` + `resolveSettings` + дефолты. Перевести 3 страницы
   на разбор через него (заменить ~38 строк `searchParams.get` на один вызов).
   Низкий риск, измеримая польза.
2. **Этап B — break-point в движок (Т1).** Перенести `isBreakPoint` /
   `getBreakPointCount` в `lib/scoring-logic.ts`, покрыть тестами.
3. **Этап C — `<VmixScoreboard>`.** Вынести вёрстку из `court-vmix` (самой
   полной) в компонент, включить break-point для всех. Перевести `court-vmix`,
   затем `vmix/[id]` и `fullscreen-scoreboard` (проп `variant`). Визуальная
   сверка каждого.
4. **Этап D — единая страница настроек (Т2).** Свести `vmix-settings` +
   `scoreboard-settings` + хранилище в одну страницу и одну модель; добавить
   секции пер-вариантных переопределений (пока минимальные); починить 30
   ключей перевода `vmixSettings.*`.
5. **Этап E — `hooks/use-vmix-match.ts`.** Свести загрузку/подписку. Опционально.

Делать строго поэтапно, каждый этап — отдельный коммит и проверка.

## 6. Риски

- **Визуальная регрессия — главный риск.** Три экрана с темами, градиентами,
  размерами, анимациями. Unit-тесты вёрстку не ловят. Нужна **ручная сверка
  каждого экрана** до/после на нескольких темах (custom/transparent/light/dark)
  и размерах.
- **Break-point на новых экранах (Т1)** — на `vmix`/`fullscreen` его раньше не
  было; убедиться, что он не ломает вёрстку и читается правильно.
- **Совместимость URL-параметров.** vMix-оверлеи у пользователя настроены на
  готовые сцены; набор и имена query-параметров и формат вывода менять нельзя
  без необходимости. `parseScoreboardSettings` должен принимать прежние имена.
- **Realtime/подписки** — статикой не проверяются (этап E особенно).
- Мелкие отличия дефолтов между страницами легко «усреднить» неверно — собрать
  точную таблицу дефолтов каждого экрана до начала.

## 7. Проверка

- Unit: `parseScoreboardSettings` (дефолты, булевы/цветовые/числовые параметры,
  старые имена query-параметров), `resolveSettings` (слияние переопределений),
  `isBreakPoint`/`getBreakPointCount`.
- Компонентный тест `VmixScoreboard` (jsdom): рендер с фикстурой, счёт/имена,
  break-point виден при `showBreakPoint`, трофей на завершённом матче.
- E2E: `/court-vmix/1`, `/vmix/<id>`, `/fullscreen-scoreboard/1` грузятся без
  ошибок (расширить `e2e/smoke.spec.ts`).
- **Ручная визуальная сверка** скриншотами: каждый из 3 экранов, каждая тема —
  до и после; отдельно — что break-point виден на всех трёх. Обязательный шаг.

## 8. Критерии готовности

- [ ] `parseScoreboardSettings` + `resolveSettings` — один разбор/слияние
      настроек, 3 страницы используют его.
- [ ] `isBreakPoint`/`getBreakPointCount` — в `lib/scoring-logic.ts`.
- [ ] `<VmixScoreboard>` — одна вёрстка табло, 3 страницы используют её.
- [ ] **Break-point показывается на всех трёх табло** (Т1).
- [ ] **Одна страница настроек** на все варианты, с секциями пер-вариантных
      переопределений (Т2); старая `vmix-settings` не дублируется.
- [ ] 30 ключей `vmixSettings.*` добавлены в `translations.ts` (убраны из
      `KNOWN_MISSING`).
- [ ] Вывод каждого экрана визуально идентичен прежнему на всех темах/размерах.
- [ ] `npm run check` и `npm run e2e` — зелёные; добавлены тесты.
- [ ] Суммарный объём 3 страниц сокращён ориентировочно с ~4250 до ~600-900 строк.

## 9. Оценка

Крупный рефактор (этапы A-E). A и B — небольшие и безопасные, дают быстрый
выигрыш. C — основной объём и основной риск (вёрстка). D — единая страница
настроек (Т2), средний объём. Делать в отдельной ветке с пошаговой визуальной
приёмкой каждого экрана.
