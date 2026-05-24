# Scoreboard Slow-Network Flicker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Устранить визуальный «откат» счёта на медленном интернете: клик → показывается новое значение → возврат к старому → опять новое; иногда «пачкой» или с неверной цифрой.

**Architecture:** Гонка возникает между **локальным оптимистичным обновлением** (через `updateMatch` → `enqueueOperation`) и **эхом Supabase Realtime**. Защита уже спроектирована (двойной щит: `pendingCount > 0` и `revision <= prev.revision`), но в трёх местах щит дырявый. План — закрыть каждую дыру отдельной задачей с тестом, делать маленькие коммиты.

**Tech Stack:** Next.js 14 + React 18, TypeScript, Supabase (Postgres + Realtime), Vitest + jsdom + Testing Library, lz-string.

**Reference:** анализ причин — в [vmix-scoreboard-unification.md](vmix-scoreboard-unification.md) и в исходниках [hooks/use-match.ts](hooks/use-match.ts) (последний фикс — коммит `6cd772f`), [lib/match-sync.ts](lib/match-sync.ts), [lib/match-operation-log.ts](lib/match-operation-log.ts).

---

## Корневые причины (что чиним и почему)

1. **`async` колбэк реалтайма + `await import(...)`** в [app/fullscreen-scoreboard/[number]/page.tsx:499-525](app/fullscreen-scoreboard/[number]/page.tsx#L499-L525) и [app/fullscreen-scoreboard/[number]/page.tsx:577-607](app/fullscreen-scoreboard/[number]/page.tsx#L577-L607). За время `await` `drainMatch` успевает завершиться, `pendingCount` падает до 0 — щит №1 «сломан». Эхо со старым счётом перезаписывает оптимистичный стейт. Тот же баг был починен в `hooks/use-match.ts` коммитом `6cd772f`, но во fullscreen-scoreboard остался.

2. **Локальная ревизия не растёт после оптимистичного обновления.** [hooks/use-match.ts:139-174](hooks/use-match.ts#L139) делает `setMatch(updatedMatch)`, но `updatedMatch.revision` не инкрементируется. После клика `prev.revision === N`, хотя локально мы уже «впереди». Если эхо несёт `revision = N` (старый снапшот), щит №2 (`updatedMatch.revision <= prev.revision`) пройдёт как `N <= N → true` — эхо отбросится верно. Но если эхо несёт `revision = N+1` (наше же подтверждение), оно перезаписывает — это ОК, **если** счёт совпадает. На «честных» гонках с двумя клиентами или повторных эхо щит ненадёжен.

3. **`useEffect` слепо синхронизирует `localMatchState` с `match`** в [components/score-board.tsx:70-75](components/score-board.tsx#L70-L75). Если в окно реалтайма пробралось эхо со старым счётом, `localMatchState` затирается. Следующий клик берёт стейл-базу через `latestMatchRef.current` и применяет инкремент к старому значению — выходит «неправильно».

---

## Подготовка

Перед началом работы создать рабочий бранч.

```powershell
git checkout -b fix/scoreboard-flicker-slow-network
```

Запустить unit-тесты для базовой линии:

```powershell
pnpm vitest run test\use-match.test.tsx test\components\score-board.test.tsx
```

Ожидаемо: все existing тесты зелёные.

---

## Task 1: Синхронный колбэк реалтайма в fullscreen-scoreboard (первичная подписка)

**Files:**
- Modify: `app/fullscreen-scoreboard/[number]/page.tsx:8` (импорт)
- Modify: `app/fullscreen-scoreboard/[number]/page.tsx:499-525` (первичный subscribe callback)

**Why:** На медленном интернете `await import("@/lib/match-sync")` отдаёт управление event loop'у. Между чтением `payload` и проверкой `pendingCount` успевает завершиться drain, и проверка возвращает `false` — щит №1 пропускает старое эхо. После этого UI откатывается на устаревший серверный счёт.

**Step 1: Подтверждаем баг — handcraft reproduction в чек-листе**

Открыть DevTools → Network → throttling: «Slow 3G». На странице `/fullscreen-scoreboard/<court>` сделать 3–5 быстрых кликов по `+A`. Зафиксировать в issue/блокноте: «вижу мигание 0→15→0→15 при slow 3G».

Этот шаг — чтобы при последующей проверке Step 7 было с чем сравнивать.

**Step 2: Поднять импорт `getMatchSyncState` на верх файла**

В `app/fullscreen-scoreboard/[number]/page.tsx` после `import { subscribeToMatchUpdates } from "@/lib/match-storage"` (строка 8) добавить:

```ts
import { getMatchSyncState } from "@/lib/match-sync"
```

**Step 3: Сделать первичный колбэк синхронным**

Заменить блок `unsubscribe = subscribeToMatchUpdates(matchData.id, async (updatedMatch: any) => { … })` (строки 499–551) на синхронный вариант:

```ts
unsubscribe = subscribeToMatchUpdates(matchData.id, (updatedMatch: any) => {
  if (!updatedMatch) {
    loadMatch()
    return
  }

  let hasPendingOperations = false
  try {
    const syncState = getMatchSyncState(matchData.id)
    hasPendingOperations = syncState && syncState.pendingCount > 0
  } catch (e) {
    console.error("Ошибка при получении состояния синхронизации:", e)
  }

  if (hasPendingOperations) return

  setMatch((prev: any) => {
    if (
      prev &&
      typeof prev.revision === "number" &&
      typeof updatedMatch.revision === "number" &&
      updatedMatch.revision <= prev.revision
    ) {
      return prev
    }
    return updatedMatch
  })
  setError("")

  if (isCompletedMatch && updatedMatch.isCompleted !== true) {
    setIsCompletedMatch(true)
    setMatch((prev: any) => (prev ? { ...prev, isCompleted: true } : updatedMatch))
    logEvent(
      "warn",
      "Realtime update tried to reset isCompleted to false, preserving local completed state",
      "fullscreen-scoreboard",
      { matchId: updatedMatch.id },
    )
  } else {
    setIsCompletedMatch(updatedMatch.isCompleted === true)
  }

  logEvent("debug", "Fullscreen Scoreboard: получено обновление матча", "fullscreen-scoreboard", {
    matchId: updatedMatch.id,
    scoreA: updatedMatch.score.teamA,
    scoreB: updatedMatch.score.teamB,
    isCompleted: updatedMatch.isCompleted,
  })
})
```

Ключевые отличия от старого кода: callback больше не `async`, нет `await import(...)`, `getMatchSyncState` импортирован сверху.

**Step 4: Проверить TypeScript**

```powershell
pnpm tsc --noEmit
```

Ожидаемо: 0 ошибок.

**Step 5: Прогнать smoke-тесты**

```powershell
pnpm vitest run test\use-match.test.tsx
```

Ожидаемо: PASS — поведение `useMatch` не задето.

**Step 6: Запустить dev-сервер и проверить вручную**

```powershell
pnpm dev
```

Открыть `http://localhost:3000/fullscreen-scoreboard/1` (с активным матчем на корте 1). В DevTools Network включить «Slow 3G». 3–5 быстрых кликов `A` или `B`. Ожидаемо: счёт растёт монотонно, без отката.

**Step 7: Коммит**

```powershell
git add app/fullscreen-scoreboard/[number]/page.tsx
git commit -m "fix(fullscreen): make realtime callback synchronous to close pendingCount guard"
```

---

## Task 2: Тот же фикс для re-subscription после смены матча на корте

**Files:**
- Modify: `app/fullscreen-scoreboard/[number]/page.tsx:577-607` (re-subscribe в интервале)

**Why:** Когда на корте появляется новый матч (через polling каждые 10 с), создаётся новая подписка с тем же `async + await import` паттерном. Тот же баг в той же форме.

**Step 1: Заменить вторую `subscribeToMatchUpdates` на синхронный колбэк**

В блоке проверки `isCompletedMatch && newMatchData.id !== lastMatchId` (примерно строки 561–608) заменить:

```ts
unsubscribe = subscribeToMatchUpdates(newMatchData.id, async (updatedMatch: any) => {
  if (updatedMatch) {
    let hasPendingOperations = false;
    try {
      const { getMatchSyncState } = await import("@/lib/match-sync");
      const syncState = getMatchSyncState(newMatchData.id);
      hasPendingOperations = syncState && syncState.pendingCount > 0;
    } catch (e) { … }
    if (hasPendingOperations) return;
    setMatch((prev: any) => { … })
    setIsCompletedMatch(updatedMatch.isCompleted === true)
    setError("")
  }
})
```

на:

```ts
unsubscribe = subscribeToMatchUpdates(newMatchData.id, (updatedMatch: any) => {
  if (!updatedMatch) return

  let hasPendingOperations = false
  try {
    const syncState = getMatchSyncState(newMatchData.id)
    hasPendingOperations = syncState && syncState.pendingCount > 0
  } catch (e) {
    console.error("Ошибка при получении состояния синхронизации:", e)
  }

  if (hasPendingOperations) return

  setMatch((prev: any) => {
    if (
      prev &&
      typeof prev.revision === "number" &&
      typeof updatedMatch.revision === "number" &&
      updatedMatch.revision <= prev.revision
    ) {
      return prev
    }
    return updatedMatch
  })
  setIsCompletedMatch(updatedMatch.isCompleted === true)
  setError("")
})
```

**Step 2: Проверить TypeScript**

```powershell
pnpm tsc --noEmit
```

**Step 3: Коммит**

```powershell
git add app/fullscreen-scoreboard/[number]/page.tsx
git commit -m "fix(fullscreen): close pendingCount guard on court-change re-subscription"
```

---

## Task 3: Поднимать `revision` локально при оптимистичном `updateMatch`

**Files:**
- Modify: `hooks/use-match.ts:139-174` (`updateMatch`)
- Test: `test/use-match.test.tsx` (новый тест на бамп revision)

**Why:** Сейчас `applyScoreIncrement` правит только score-поля. `revision` остаётся прежним до прихода серверного эха. Это значит: щит №2 (`updatedMatch.revision <= prev.revision`) защищает только если сервер шлёт нам **более высокий** номер. Если по какой-то причине эхо приходит с тем же или меньшим номером (отсутствие миграции колонки `revision`, ретрансляция WS, дублирующее событие), щит пропускает. Локальный бамп закрывает этот сценарий: после оптимистики `prev.revision = N+1`, любое эхо `< N+1` отсекается.

**Step 1: Написать failing-тест**

В `test/use-match.test.tsx` (около строки 75, после теста «applies updateMatch optimistically and persists it») добавить:

```ts
it("bumps revision locally on optimistic update so stale realtime echoes are ignored", async () => {
  getMatch.mockResolvedValue(sampleMatch({ revision: 5 }))
  persistMatch.mockResolvedValue(undefined)
  const { result } = renderHook(() => useMatch("m1"))
  await waitFor(() => expect(result.current.loading).toBe(false))

  // Caller passes a match without bumping revision (the scoring engine doesn't).
  await act(async () => {
    await result.current.updateMatch(sampleMatch({ revision: 5 }))
  })

  // After the optimistic apply the local revision must be ahead of the server.
  expect(result.current.match.revision).toBeGreaterThan(5)
})
```

**Step 2: Запустить тест — должен упасть**

```powershell
pnpm vitest run test\use-match.test.tsx -t "bumps revision locally"
```

Ожидаемо: FAIL — `expected 5 to be greater than 5`.

**Step 3: Внести минимальную правку в `updateMatch`**

В `hooks/use-match.ts:139-146` заменить:

```ts
const updateMatch = useCallback(
  async (updatedMatch: any) => {
    try {
      updatedMatch.history = []
      setMatch(updatedMatch)
      await persistMatch(updatedMatch)
```

на:

```ts
const updateMatch = useCallback(
  async (updatedMatch: any) => {
    try {
      updatedMatch.history = []
      // Локальный bump ревизии перед записью в стейт. Без него щит
      // updatedMatch.revision <= prev.revision не отсечёт повторное / устаревшее
      // эхо Supabase Realtime, и UI «откатится» на старый счёт (slow-network flicker).
      const prevRevision = typeof updatedMatch.revision === "number" ? updatedMatch.revision : 0
      updatedMatch.revision = prevRevision + 1
      setMatch(updatedMatch)
      await persistMatch(updatedMatch)
```

**Step 4: Запустить тест — должен пройти**

```powershell
pnpm vitest run test\use-match.test.tsx
```

Ожидаемо: PASS (все тесты файла).

**Step 5: Проверить, что серверный sync engine это не ломает**

В [lib/match-sync.ts:188](lib/match-sync.ts#L188) `syncMatchToServer` принимает `match` и кладёт его в `enqueueOperation`. Затем в [lib/match-operation-log.ts:146-159](lib/match-operation-log.ts#L146-L159) `record.revision += 1` — то есть record.revision увеличивается **независимо** от поля `match.revision` в payload. А `applyRevisioned` использует `record.lastSyncedRevision` и `record.revision`, не `payload.revision`. Значит локальный bump поля на снапшоте безопасен.

Прочитать [lib/match-sync.ts:255-260](lib/match-sync.ts#L255-L260) и убедиться: `baseRevision = record.lastSyncedRevision`, `targetRevision = record.revision` — ни одно не берётся из `payload.revision`. ОК.

**Step 6: Прогнать полный тестовый набор для затронутых файлов**

```powershell
pnpm vitest run test\use-match.test.tsx test\components\score-board.test.tsx test\components\score-controls.test.tsx
```

Ожидаемо: PASS.

**Step 7: Коммит**

```powershell
git add hooks/use-match.ts test/use-match.test.tsx
git commit -m "fix(use-match): bump local revision on optimistic update to harden echo guard"
```

---

## Task 4: ScoreBoard не должен слепо затирать `localMatchState` устаревшим `match`

**Files:**
- Modify: `components/score-board.tsx:70-75`
- Test: `test/components/score-board.test.tsx` (новый тест)

**Why:** Сейчас useEffect срабатывает на любое изменение `match` prop и безусловно делает `setLocalMatchState(match) + latestMatchRef.current = match`. Если в системе по какой-то причине проскочило старое эхо (например, ревизия в payload не сравнима — `undefined` из старого матча в localStorage), оптимистичная локальная картинка стирается. Следующий клик возьмёт её как базу → «неправильно».

После Task 3 у локального стейта всегда есть `revision`. Можно использовать его как сравнение.

**Step 1: Написать failing-тест**

В `test/components/score-board.test.tsx` (после существующих тестов в describe) добавить:

```ts
it("does not regress local optimistic state when a stale match prop arrives", () => {
  const updateMatch = vi.fn()
  // Стартуем с revision=5.
  const initial = makeMatch({ revision: 5 })
  const { rerender } = render(<ScoreBoard match={initial} updateMatch={updateMatch} />)

  // Клик — компонент должен показать 15 (оптимистично).
  const zeros = screen.getAllByRole("button", { name: "0" })
  fireEvent.click(zeros[0])

  // Симулируем приход устаревшего prop (revision меньше или равна последней увиденной).
  rerender(<ScoreBoard match={makeMatch({ revision: 5 })} updateMatch={updateMatch} />)

  // Оптимистичный 15 не должен откатиться к 0.
  expect(screen.queryAllByRole("button", { name: "15" }).length).toBeGreaterThanOrEqual(1)
  expect(screen.queryAllByRole("button", { name: "0" }).length).toBeLessThan(2)
})
```

**Step 2: Запустить тест — должен упасть**

```powershell
pnpm vitest run test\components\score-board.test.tsx -t "does not regress local optimistic state"
```

Ожидаемо: FAIL — текущая реализация перерисовывает 0 после rerender.

**Step 3: Перестроить useEffect — сравнивать ревизии**

В `components/score-board.tsx:70-75` заменить:

```ts
useEffect(() => {
  if (match) {
    setLocalMatchState(match)
    latestMatchRef.current = match
  }
}, [match])
```

на:

```ts
useEffect(() => {
  if (!match) return
  // Игнорируем приходящий снапшот, если у нас локально более новый оптимистичный
  // стейт. Без этой проверки задержавшееся эхо Supabase Realtime / отстающий
  // localMatchState затирает свежий клик и счёт «откатывается».
  const localRev =
    typeof latestMatchRef.current?.revision === "number" ? latestMatchRef.current.revision : -Infinity
  const incomingRev = typeof match.revision === "number" ? match.revision : -Infinity
  if (latestMatchRef.current && incomingRev < localRev) return
  setLocalMatchState(match)
  latestMatchRef.current = match
}, [match])
```

**Step 4: Запустить тест — должен пройти**

```powershell
pnpm vitest run test\components\score-board.test.tsx
```

Ожидаемо: PASS — все тесты файла (включая существующие).

**Step 5: Проверить, что settings-revision сброс не сломан**

В [components/score-board.tsx:80-89](components/score-board.tsx#L80-L89) есть отдельный useEffect, который при изменении `settings` сбрасывает `localMatchState`. Прочитать его и убедиться, что он по-прежнему работает (он использует `settingsSignature`, не `match`). Никаких правок не требуется.

**Step 6: Коммит**

```powershell
git add components/score-board.tsx test/components/score-board.test.tsx
git commit -m "fix(score-board): ignore incoming match prop with stale revision"
```

---

## Task 5: Полный регресс — unit + e2e smoke

**Files:**
- Run: все vitest-наборы
- Run: e2e smoke (если запускается локально)

**Step 1: Полный unit-прогон**

```powershell
pnpm vitest run
```

Ожидаемо: 100% PASS, без skip'ов в затронутых файлах.

**Step 2: TypeScript**

```powershell
pnpm tsc --noEmit
```

Ожидаемо: 0 ошибок.

**Step 3: Lint**

```powershell
pnpm lint
```

Ожидаемо: новые ворнинги отсутствуют. Если линтер ругается на `latestMatchRef.current?.revision` — игнорировать его через `// eslint-disable-next-line` только в этой строке.

**Step 4: Smoke e2e (если Playwright настроен)**

```powershell
pnpm exec playwright test e2e/smoke.spec.ts
```

Ожидаемо: PASS.

**Step 5: Финальная ручная проверка под «Slow 3G»**

Сценарии:
1. `/match/<id>` — счёт-доска. Кликнуть `+1` команды A 5 раз быстро. Счёт должен расти 0→15→30→40→game→0, без возврата.
2. `/fullscreen-scoreboard/<court>` — нажать клавишу `A` пять раз. Тот же критерий.
3. Открыть две вкладки на тот же матч (одна — `/match/<id>`, вторая — `/court-vmix/<court>` или `/vmix/<id>` для зрителя). Кликнуть в первой. Во второй счёт должен прийти через ≤ 5 секунд без откатов.

**Step 6: Финальный коммит зачистки (если что-то осталось)**

```powershell
git status
```

Если есть незакоммиченные файлы (например, обновления snapshot'ов от Playwright):

```powershell
git add <файлы>
git commit -m "chore: update visual baselines after flicker fix"
```

---

## Не делаем (за рамками этого плана)

- **Не** меняем `lib/match-sync.ts` — его двухщитовая модель уже корректна, просто требовался правильный её вызов.
- **Не** трогаем `applyRevisioned` идемпотентность (line 371 — отдельный известный артефакт «cross-device race-then-take-server-snapshot», требует отдельного обсуждения).
- **Не** добавляем visual debounce / loading spinner — основная проблема пользовательская не в индикации, а в самой подмене значения.
- **Не** переписываем `subscribeToMatchUpdates` на push-only без поллинга — это отдельная задача, не относящаяся к flicker.

---

## Acceptance criteria

- На «Slow 3G» (DevTools throttling) серия из 5 быстрых кликов в [/match/[id]](app/match/[id]/page.tsx) и в [/fullscreen-scoreboard/[number]](app/fullscreen-scoreboard/[number]/page.tsx) даёт монотонно растущий счёт без визуальных откатов.
- Vitest, tsc, lint — зелёные.
- Открытые во второй вкладке зрительские экраны (`court-vmix`, `vmix`) получают финальный счёт без промежуточных «миганий».
- В git-истории — 4 атомарных коммита (Task 1, 2, 3, 4) плюс опциональный коммит зачистки.
