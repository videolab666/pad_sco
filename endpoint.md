# Анализ логики Game Point / Set Point / Match Point / Tiebreak / End Match

## Системы подсчёта и файлы

В проекте **два параллельных движка** подсчёта очков:

| Движок | Файл | Используется |
|--------|------|-------------|
| A | `lib/scoring-logic.ts` → `applyScoreIncrement()` | `app/fullscreen-scoreboard/`, `app/vmix/` |
| B | `components/score-board.tsx` → `handleScoreClick()` | `components/score-board.tsx` (основное табло) |

Они расходятся в поведении — это корневая архитектурная проблема.

---

## A. Game Point

### Classic (движок A — scoring-logic.ts строки 64–83)

| Счёт | Ожидание | Факт в scoring-logic.ts | Факт в score-board.tsx |
|------|----------|--------------------------|------------------------|
| 40 vs 0/15/30 | Game Point → winGame | ✅ winGame | ✅ winGame |
| 40 vs 40 (deuce) | → Ad | ❌ **winGame** (строка 76) | ✅ Ad |
| Ad vs любой | Game Point → winGame | ✅ winGame | ✅ winGame |
| любой vs Ad | Deuce | ✅ 40/40 | ✅ 40/40 |

**КРИТИЧЕСКИЙ БАГ (scoring-logic.ts строка 74–76):**
```
} else if (currentGame[otherTeam] === 40) {
  // No-Ad / Golden Point behavior: next point wins the game
  return winGame(team, updatedMatch);   ← должно быть currentGame[team] = "Ad"
```
При счёте 40–40 в Classic fullscreen-scoreboard и vmix сразу завершают гейм вместо перехода в Ad.

### No-Ad (scoring-logic.ts строки 84–93, score-board.tsx)

- 40–40 → следующее очко завершает гейм ✅
- Game Point индикатор в score-board.tsx (строки 771–784) при 40–40 возвращает `null` — правильно

### Fast4 (scoring-logic.ts строки 94–104)

- Идентично No-Ad ✅
- gamesNeededToWin = 4 (не 6) ✅

### Tiebreak (scoring-logic.ts строки 20–58)

- Regular tiebreak: Game Point при ≥ 6 очков с разрывом ≥ 2 ✅
- Championship tiebreak: до 10 очков ✅
- Super tiebreak (финальный сет): до `finalSetTiebreakLength` (обычно 10) ✅

**БАГ — Game Point индикатор для Championship Tiebreak (score-board.tsx строки 758–764, vmix/page.tsx строки 113–127):**
```
// Жёстко зашито 6, но для championship нужно 9
if (currentGame.teamA >= 6 && currentGame.teamA >= currentGame.teamB + 1)
```
При счёте 9–8 в Championship Tiebreak индикатор Game Point не показывается.

---

## B. Set Point

### Функция isSetPointIndicator (score-board.tsx строки 816–872)

Логика: Set Point = Game Point + следующий выигранный гейм завершит сет.

| Формат | Условие Set Point | Верно? |
|--------|------------------|--------|
| Classic 6 геймов | 5-x (x≤4), 6-5 | ✅ |
| Fast4 | 3-x (x≤2), 4-3 | ✅ |
| Tiebreak 6-6 | Game Point в тайбрейке | ✅ |
| Super Set | 7-x (x≤6), 8-7 | частично ✅ |

**БАГ — Set Point при 6–6 без tiebreak (режим "без тайбрейка"):**
Если `tiebreakEnabled = false` и счёт стал 6–6, игра должна продолжаться до разницы 2 гейма. Set Point должен быть при 7–6, 8–7 и т.д. — проверка этого сценария в isSetPointIndicator отсутствует (строки не охватывают score > 6).

**БАГ — vmix/page.tsx (строки 204–227):**
```
if (teamAGames === 5 && teamBGames <= 4) return "teamA"
if (teamAGames === 6 && teamBGames === 5) return "teamA"
// → не обрабатывается 7-6, 8-7 при игре без тайбрейка
```

---

## C. Match Point

### Функция isMatchPointIndicator (score-board.tsx строки 874–906)

Match Point = Set Point + команда на расстоянии 1 сета от победы.

| Формат (sets) | setsToWin | Match Point при |
|---------------|-----------|-----------------|
| 1 | 1 | Set Point в 1-м сете |
| 2 | 2 | Set Point при счёте сетов 1–0 |
| 3 | 2 | Set Point при счёте сетов 1–0 или 1–1 |
| 5 | 3 | Set Point при счёте сетов 2–0, 2–1 и т.д. |

**БАГ — подсчёт выигранных сетов (score-board.tsx строки 884–885):**
```
// ❌
const teamASets = match.score.sets.filter((set) => set.teamA > set.teamB).length;

// ✅ правильнее
const teamASets = match.score.sets.filter((set) => set.winner === "teamA").length;
```
В случае Golden Game сет может завершиться при 6–5 (победитель имеет меньше геймов чем ожидается), и `set.teamA > set.teamB` может дать неверный результат.

Аналогичная ошибка в vmix/page.tsx строки 247–248.

---

## D. Tiebreak

### Когда начинается

| Режим | Условие |
|-------|---------|
| Regular Tiebreak | `tiebreakEnabled` + score равен `tiebreakAt` (по умолчанию 6-6) |
| Fast4 Tiebreak | score 4-4 |
| Final Set Tiebreak | `finalSetTiebreak` + решающий сет + score = tiebreakAt |
| Super Tiebreak | `isSuperTiebreak: true` → до `finalSetTiebreakLength` очков (обычно 10) |

(scoring-logic.ts строки 156–175)

### Смена подачи в тайбрейке

```
После каждого нечётного суммарного очка: 1, 3, 5, 7...
(scoring-logic.ts строка 49–53)
```
✅ Правильно по правилам паделя/тенниса.

### Смена сторон в тайбрейке

```
Каждые 6 суммарных очков: после 6, 12, 18...
(scoring-logic.ts строка 54–57)
```
✅ Правильно.

### Хранение в JSON

```json
{
  "currentSet": {
    "isTiebreak": true,
    "isSuperTiebreak": true,
    "currentGame": { "teamA": 5, "teamB": 4 }
  }
}
```
После завершения тайбрейка сет сохраняется в `score.sets[]` с полем `tiebreak: { teamA, teamB }` ✅

---

## E. End Match

### Логика (scoring-logic.ts строки 200–229, score-board.tsx строки 549–655)

| Формат | Завершение |
|--------|-----------|
| sets = 1 | score[team] = 1 |
| sets = 2 | score[team] = 2 |
| sets = 3 | score[team] ≥ 2 (first to 2) |
| sets = 5 | score[team] ≥ 3 |

Формула: `setsToWin = Math.ceil(settings.sets / 2)` ✅

В score-board.tsx перед финальной записью показывается диалог подтверждения (`showMatchEndDialog`). Матч не помечается `isCompleted` до подтверждения пользователем ✅

### Super Set (scoring-logic.ts строки 132–154)

| Счёт | Ожидание | Факт |
|------|----------|------|
| 8-8 | Tiebreak | ✅ |
| 9-7, 9-6... | Победа | ✅ |
| 9-8 | Победа | ❌ **НЕТ** |
| 10-8, 10-9... | Победа | ✅ (через `>= 8 && diff >= 2`) |

**БАГ при Super Set 9–8:**
```
// ❌ teamBScore < 8 → false при 8
(teamAScore === 9 && teamBScore < 8)

// ✅ должно быть
(teamAScore === 9 && teamBScore <= 7)
// или просто: teamAScore >= 8 && teamAScore - teamBScore >= 2 (уже есть выше)
```
При счёте 9–8 условие `teamBScore < 8` = `false`, поэтому матч не завершается. Однако следующая строка `(teamAScore >= 8 && teamAScore - teamBScore >= 2)` при 10–8 уже сработает. Итог: сет продолжается при 9–8 (ждёт 10–8) — это баг.

---

## F. Golden Game

### Логика (scoring-logic.ts строки 177–182)

```
if (settings.goldenGame) {
  if ((teamA === 6 && teamB === 5) || (teamA === 5 && teamB === 6)) {
    winSet(команда с большим счётом)
  }
}
```

**БАГ — неправильный триггер:**
- Правила Golden Game в паделе: при счёте **5–5** играется один решающий гейм, победитель выигрывает сет 6–5
- Текущая логика срабатывает при **6–5** и завершает сет в пользу ведущего
- Это неверно: при 6–5 сет должен завершаться в любом случае (разница 2 гейма не нужна при 6+), а Golden Game должен предотвращать тайбрейк/продолжение при 5–5

---

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
      {
        "teamA": 6,
        "teamB": 4,
        "winner": "teamA",
        "tiebreak": null
      }
    ],
    "currentSet": {
      "teamA": 3,
      "teamB": 2,
      "currentGame": {
        "teamA": 40,
        "teamB": 30
      },
      "games": [
        { "winner": "teamA" },
        { "winner": "teamB" }
      ],
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
    "isSuperSet": false,
    "goldenGame": false,
    "windbreak": false
  },
  "currentServer": {
    "team": "teamA",
    "playerIndex": 0
  },
  "courtSides": {
    "teamA": "left",
    "teamB": "right"
  },
  "shouldChangeSides": false
}
```

---

## Сводка ошибок

| # | Ошибка | Файл | Строка | Критичность |
|---|--------|------|--------|-------------|
| 1 | 40–40 в Classic → winGame вместо Ad | scoring-logic.ts | 74–76 | 🔴 КРИТИЧНО |
| 2 | Super Set не завершается при 9–8 | scoring-logic.ts | 142–147 | 🔴 КРИТИЧНО |
| 3 | Game Point для Championship Tiebreak жёстко зашито 6 вместо 9 | score-board.tsx, vmix | 758, 113 | 🟠 ВЫСОКАЯ |
| 4 | Match Point считает сеты по геймам вместо `winner` | score-board.tsx, vmix | 884, 247 | 🟠 ВЫСОКАЯ |
| 5 | Set Point не работает при счёте > 6 без тайбрейка | score-board.tsx, vmix | 816–872, 204 | 🟠 ВЫСОКАЯ |
| 6 | Golden Game триггерится при 6–5 вместо 5–5 | scoring-logic.ts | 177–182 | 🟡 СРЕДНЯЯ |
| 7 | Дублирование движка подсчёта в двух файлах | scoring-logic.ts vs score-board | везде | 🟡 СРЕДНЯЯ |
