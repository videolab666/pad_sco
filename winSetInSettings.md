# План рефакторинга: `winSetInSettings` / `endTiebreak` в `match-settings.tsx`

Дата: 2026-05-17
Статус: **✅ ВЫПОЛНЕНО** (2026-05-17)

> **Итог реализации.** Экспортирована чистая `commitSetWin(match, team)` в
> `lib/scoring-logic.ts` (общее ядро с движковым `winSet`; сохранение счёта
> тай-брейка читает оба источника — `currentSet.tiebreak` и `currentGame`).
> `winSetInSettings` удалена, `endTiebreak` переписан тонкой обёрткой.
>
> **Отклонение от плана (в лучшую сторону):** при отказе от `confirm()`
> операция **отменяется целиком** (`return` без `updateMatch`) — это проще и
> чище, чем «оставить матч без завершения, но со следующим сетом», и тоже
> устраняет описанный баг (повисшее состояние). Матч просто остаётся в
> тай-брейке, пользователь решает позже.
>
> Проверка: `npm run check` — 71 тест + typecheck PASS; `npm run e2e` — 9 PASS.
> Добавлен сьют `commitSetWin` (5 тестов). Дальнейшее — план ниже (исторический).

---

## 1. Контекст

В [components/match-settings.tsx](components/match-settings.tsx) есть две
функции для ручного завершения тай-брейка из панели настроек матча:

- `endTiebreak(winner)` (стр. ~263-279) — кнопка «завершить тай-брейк вручную»:
  фиксирует счёт тай-брейка, помечает победителя, вызывает `winSetInSettings`.
- `winSetInSettings(team, updatedMatch)` (стр. ~283-340) — «засчитать сет»:
  пишет сет в `score.sets`, увеличивает счётчик сетов, проверяет завершение
  матча, создаёт следующий сет (в т.ч. супер-тай-брейк), выставляет
  `shouldChangeSides`, вызывает `updateMatch`.

`winSetInSettings` — это **дубль** движковой функции `winSet`
([lib/scoring-logic.ts](lib/scoring-logic.ts)), которая делает то же самое для
обычного хода игры. Это нарушает принцип «один движок — один источник правды».

## 2. Проблема

Логика «засчитать выигранный сет» существует в **двух** реализациях:

| Аспект | движок `winSet` (scoring-logic) | `winSetInSettings` (match-settings) |
|--------|----------------------------------|--------------------------------------|
| Запись сета в `score.sets` | да | да |
| `score[team]++` | да | да |
| Сохранение счёта тай-брейка | из `currentSet.isTiebreak` + `currentGame` | из `currentSet.tiebreak` (готовый объект) |
| Проверка завершения матча | ставит `isCompleted`/`winner` молча | показывает `confirm()` браузера |
| Создание следующего сета | да | да |
| Супер-тай-брейк после сета | `shouldStartMatchTiebreakAfterSet` | `shouldStartMatchTiebreakAfterSet` |
| Смена сторон | флаг `shouldChangeSides` по чётности геймов | то же (фикс A5) |
| Тип | чистая (возвращает match) | мутирует + вызывает `updateMatch` |

**Риск:** при изменении правил подсчёта (новый вид спорта, формат) легко
поправить движок и забыть `winSetInSettings` — счёт «вручную» и «по ходу игры»
разойдутся.

### Ключевое расхождение — сохранение счёта тай-брейка
- Движок `winSet`: `if (currentSet.isTiebreak) setToSave.tiebreak = { из currentGame }`.
- `winSetInSettings`: `if (currentSet.tiebreak) setToSave.tiebreak = { ...currentSet.tiebreak }`.

`endTiebreak` перед вызовом делает `currentSet.tiebreak = tiebreakScore` и
`currentSet.isTiebreak = false`. Поэтому если просто заменить `winSetInSettings`
на движковый `winSet`, тай-брейк **не сохранится** (`isTiebreak` уже `false`).
Объединённая функция обязана учитывать **оба** источника.

## 3. Предлагаемое решение

Вынести единую **чистую** функцию `commitSetWin(match, team)` в
`lib/scoring-logic.ts` и сделать `endTiebreak` тонкой обёрткой над ней.
`confirm()` и `updateMatch` остаются в компоненте (это UI-эффекты, не логика).

### `commitSetWin(match, team)` — контракт
- Чистая: deep-clone входа, возвращает новый `match`, ничего не мутирует и не
  вызывает `updateMatch`.
- Делает: `score[team]++`; `setToSave = { teamA, teamB, winner: team }`;
  **сохранение тай-брейка из обоих источников** —
  `currentSet.tiebreak` (готовый объект) ИЛИ `currentSet.isTiebreak` +
  `currentGame`; `push` в `score.sets`; пересчёт `isCompleted`/`winner` через
  `getSetsToWin`; создание следующего `currentSet` (обычный или
  супер-тай-брейк через `shouldStartMatchTiebreakAfterSet`); `shouldChangeSides`
  по чётности геймов завершённого сета.
- НЕ показывает `confirm()` — просто выставляет `isCompleted`/`winner`, как
  движковый `winSet`.

### Внутренний `winSet` движка
Текущий внутренний `winSet(team, updatedMatch)` (мутирующий, для
`winGame`/`applyScoreIncrement`) — оставить как есть ИЛИ переписать так, чтобы
он делегировал в общую логику. Минимальный вариант: `commitSetWin` — это
deep-clone + тело `winSet`; `winSet` остаётся внутренней мутирующей обёрткой.
Главное — **тело логики в одном месте**.

## 4. Шаги реализации

1. **scoring-logic.ts** — добавить расширение в `winSet`/новую функцию:
   - научить сохранение тай-брейка читать `currentSet.tiebreak`, если он уже
     задан (для пути `endTiebreak`), иначе — из `currentGame` при `isTiebreak`;
   - экспортировать чистую `commitSetWin(match, team): Match`.
2. **match-settings.tsx** — переписать `endTiebreak`:
   - построить `updatedMatch` (как сейчас: зафиксировать `currentSet.tiebreak`,
     `isTiebreak = false`, `currentSet[winner]++`);
   - `const result = commitSetWin(updatedMatch, winner)`;
   - если `result.isCompleted` — показать `confirm()`; при отказе — откатить
     `isCompleted`/`winner` (или не коммитить завершение, оставив сет);
   - `updateMatch(result)`.
3. **Удалить** `winSetInSettings` (единственный вызов — из `endTiebreak`).
4. Проверить `startTiebreak` (рядом) — он не трогается, но убедиться, что
   связка start/end по-прежнему согласована.

## 5. Тонкости и риски

- **`confirm()` при завершении матча.** Сейчас `winSetInSettings` спрашивает
  подтверждение и при отказе — НЕ завершает матч, но сет уже записан и
  `nextCurrentSet` НЕ создаётся (функция выходит `return` внутри `if`). Это,
  кстати, **баг текущего кода**: при отказе от подтверждения сет в `score.sets`
  есть, а нового `currentSet` нет → состояние повисает. Новый код это
  исправляет: `commitSetWin` всегда даёт согласованный `match`, а `confirm()`
  лишь решает, коммитить ли `isCompleted`.
- **Откат при отказе.** Если матч по `commitSetWin` завершён, а пользователь
  нажал «отмена» — нужно отдать `match` с `isCompleted = false`,
  `winner = null`, но со следующим сетом. Решение: `commitSetWin` всегда строит
  следующий сет; при «отмена» компонент просто ставит `isCompleted = false`.
- **Контролируемый риск:** путь `endTiebreak` интерактивный (кнопка + confirm),
  unit-тестами целиком не покрывается — нужна ручная проверка.

## 6. Тесты

- `test/scoring-logic-regression.ts` / новый сьют: `commitSetWin`
  - обычный сет 6-4 → запись, `score`, следующий сет, `shouldChangeSides`;
  - тай-брейк-сет с `currentSet.tiebreak` (путь `endTiebreak`) → `setToSave.tiebreak`
    сохранён;
  - тай-брейк-сет с `isTiebreak` + `currentGame` (путь движка) → тоже сохранён;
  - победный сет → `isCompleted`/`winner`;
  - сплит 1-1 в формате match-tiebreak → следующий сет = супер-тай-брейк.
- Ручная проверка: кнопка «завершить тай-брейк» в настройках — счёт тай-брейка
  виден в таблице сетов; завершающий сет с `confirm()` → и «ОК», и «отмена».

## 7. Критерии готовности

- [ ] `commitSetWin` экспортирована, логика «засчитать сет» — в одном месте.
- [ ] `winSetInSettings` удалена; `endTiebreak` — тонкая обёртка.
- [ ] Счёт тай-брейка сохраняется для обоих путей (движок и ручное завершение).
- [ ] Исправлен баг «отказ от confirm → нет следующего сета».
- [ ] `npm run check` и `npm run e2e` — зелёные; добавлены тесты `commitSetWin`.
- [ ] Ручная проверка кнопки «завершить тай-брейк».

## 8. Оценка

Небольшой-средний рефакторинг (1 функция в движке + переписать 2 функции в
компоненте). Главная ценность — устранение последнего дубля логики подсчёта и
попутное исправление бага с `confirm()`.
