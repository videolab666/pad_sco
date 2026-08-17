# Логика подсчёта: Game Point / Set Point / Match Point / Tiebreak / End Match

> Актуализировано в рамках Шага 0 (plan-4 §248). Исторический раздел про
> «два параллельных движка» удалён: унификация завершена. Старый анализ
> багов сохранён ниже со статусами — половина была исправлена ранее,
> часть выводов старого анализа была некорректной (помечено).

## Архитектура подсчёта — один движок

```text
UI-клик / физическая кнопка / внешний API
        ↓
lib/apply-point.ts → applyPointWithExtras()     — оркестратор
        ↓
lib/scoring-logic.ts → applyScoreIncrement()    — канонический движок
        ↓
журнал point-событий, тайминги гейма, гандикап, Power Play,
pending tiebreak choice (см. apply-point.ts)
```

| Слой | Файл | Ответственность |
|------|------|-----------------|
| Оркестратор | `lib/apply-point.ts` | единственная точка входа UI для очка: движок + журнал, тайминги, гандикап, Power Play, выбор тайбрейка |
| Движок | `lib/scoring-logic.ts` | `applyScoreIncrement`, `winGame`/`winSet`, `commitSetWin`, нормализация после смены правил |
| Индикаторы | `lib/scoring-logic.ts` | `isGamePoint` / `isSetPoint` / `isMatchPoint` — один источник для UI и JSON |
| Проекция | `lib/match-view.ts` | отображение счёта и vMix JSON из одного проектора |
| Компонент | `components/score-board.tsx` | `handleScoreClick` → `applyPointWithExtras`; собственной логики счёта нет |

Внешние команды (`lib/remote-commands.ts`) проходят через тот же движок.

---

## Статус исторических багов (из предыдущей версии документа)

| # | Утверждение старого анализа | Статус | Где в коде сейчас |
|---|---------------------------|--------|-------------------|
| 1 | 40–40 в Classic → winGame вместо Ad | ✅ исправлено: 40–40 → `Ad`; при `goldenPointFormat` first/second/third-deuce — решающее очко. Регрессионный тест: `test/scoring-logic-regression.ts` (блок Classic deuce regression) | `applyScoreIncrement` |
| 2 | Super Set не завершается при 9–8 | ⚠️ анализ был некорректен: Super Set — «до 8 геймов с разницей 2», счёт 9–8 по этим правилам и не завершает сет. Код самосогласован: `>= 8 && diff >= 2` | `winGame` (isSuperSet) |
| 3 | Game Point для Championship Tiebreak жёстко зашито 6 | ✅ исправлено: `getTiebreakPointsToWin` учитывает `isSuperTiebreak` (finalSetTiebreakLength) и `tiebreakLength` | `isGamePoint` |
| 4 | Match Point считает сеты по геймам вместо `winner` | ✅ исправлено: `sets.filter(s => s.winner === team)` | `isMatchPoint` |
| 5 | Set Point не работает при счёте > 6 без тайбрейка | ✅ исправлено: обобщённая формула `wouldWinSet` (`a >= gamesNeededToWin && a - b >= 2`) покрывает 7–6, 8–7 и далее | `isSetPoint` |
| 6 | Golden Game триггерится при 6–5 вместо 5–5 | ⚠️ анализ спорный: завершение сета 6–5 при golden game соответствует правилам («при 5–5 играется один решающий гейм, победитель берёт сет 6–5»), что и делает код; индикатор Set Point при 5–5 учитывает golden | `winGame` / `wouldWinSet` |
| 7 | Дублирование движка в двух файлах | ✅ устранено: `score-board.tsx` → `applyPointWithExtras` → `applyScoreIncrement` | `lib/apply-point.ts` |

---

## A. Game Point — актуальное поведение

| Ситуация | Поведение | Источник |
|----------|-----------|----------|
| Classic: 40 vs 0/15/30 | следующее очко выигрывает гейм | `applyScoreIncrement` |
| Classic: 40–40, golden none | → `Ad` | — |
| Classic: 40–40, golden first/second/third-deuce | решающее очко (по `deuceCount`) | `isGoldenPointActive` |
| Classic: Ad | следующее очко выигрывает гейм | — |
| Classic: соперник на Ad | очко возвращает 40–40, `deuceCount++` | — |
| No-Ad / Fast4: 40–40 | следующее очко выигрывает гейм (no-ad по умолчанию включает first-deuce golden) | `getDefaultGoldenPointForScoringSystem` |
| Tiebreak: ≥ pointsToWin−1 с нужным margin | Game Point | `isGamePoint` (tiebreak-ветка) |

Индикатор при завершённом матче всегда выключен (`isGamePoint` guard).

## B. Set Point

`isSetPoint` = Game Point + выигранный гейм завершит сет по `wouldWinSet`,
который зеркалит условия `winGame`: super set (до 8, diff 2), golden game
(ровно gamesNeededToWin при разнице 1), fast4 (diff ≥ 1), классика (diff ≥ 2).
Целевые значения — из `getSetTargets` (per-set overrides, games-to-12).

## C. Match Point

`isMatchPoint` = Set Point + команда в одном сете от победы
(`setsToWin = ceil(sets / 2)`, завершённые сеты считаются по `set.winner`).

## D. Tiebreak

| Режим | Условие старта |
|-------|----------------|
| Regular | `tiebreakEnabled` + счёт `tiebreakAt` (6-6) |
| Fast4 | 4-4 |
| Final Set game tiebreak | решающий сет + `usesFinalSetGameTiebreak` |
| Match/super tiebreak | после сплита сетов (`shouldStartMatchTiebreakAfterSet`) — до `finalSetTiebreakLength` |

- Победа: ≥ pointsToWin с разницей ≥ 2 (`tiebreakFormat: "sudden-death"` → 1).
- Смена подачи после каждого нечётного суммарного очка (1, 3, 5…).
- Смена сторон каждые 6 суммарных очков.

## E. End Match

- `setsToWin = ceil(settings.sets / 2)`.
- Перед финальной записью — диалог подтверждения; матч не помечается
  `isCompleted` до подтверждения (`score-board.tsx`).

## F. Golden Point / Golden Game

- Golden Point управляется `goldenPointFormat`: `none | first-deuce | second-deuce | third-deuce`
  (счётчик `deuceCount` растёт при каждом возврате из Ad в 40–40).
- Golden Game: при `gamesNeededToWin−1` : `gamesNeededToWin−1` (например 5–5)
  играется решающий гейм; победитель берёт сет.

## G. Структура JSON

```json
{
  "id": "...",
  "isCompleted": false,
  "winner": null,
  "score": {
    "teamA": 1,
    "teamB": 0,
    "sets": [
      { "teamA": 6, "teamB": 4, "winner": "teamA", "tiebreak": null }
    ],
    "currentSet": {
      "teamA": 3,
      "teamB": 2,
      "currentGame": { "teamA": 40, "teamB": 30 },
      "games": [ { "winner": "teamA" }, { "winner": "teamB" } ],
      "isTiebreak": false,
      "isSuperTiebreak": false,
      "tiebreak": null
    }
  },
  "settings": {
    "sets": 3,
    "scoringSystem": "classic",
    "tiebreakEnabled": true,
    "tiebreakAt": "6-6",
    "tiebreakType": "regular",
    "finalSetTiebreak": true,
    "finalSetTiebreakLength": 10,
    "goldenPointFormat": "none",
    "isSuperSet": false,
    "goldenGame": false,
    "windbreak": false
  },
  "currentServer": { "team": "teamA", "playerIndex": 0 },
  "courtSides": { "teamA": "left", "teamB": "right" },
  "shouldChangeSides": false
}
```

Индикаторы для внешних потребителей отдаёт `lib/match-view.ts`
(`is_match_point` / `is_set_point` / `is_game_point`).
