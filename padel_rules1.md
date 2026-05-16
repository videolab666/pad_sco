# Анализ: Правила падела — APK (Double Yellow) vs Ваш проект

## Краткое резюме

APK "Padel v4.60" от Double Yellow — зрелое Android-приложение с ~15 видами спорта, глубокой моделью правил и множеством настроек. Ваш проект (Next.js/React) — веб-приложение для подсчёта с базовой реализацией теннис/падел правил. Между ними **значительная разница** в количестве и детализации поддерживаемых правил.

---

## 1. Сравнительная таблица возможностей

| Правило / Функция | APK (Double Yellow) | Ваш проект | Статус |
|---|---|---|---|
| **Golden Point (Punto de Oro)** | ✅ 4 варианта: None, OnFirstDeuce, OnSecondDeuce, OnThirdDeuce | ⚠️ Есть `scoringSystem: "no-ad"` = аналог OnFirstDeuce | **ЧАСТИЧНО** |
| **Golden Game** | ✅ `startTiebreakOneGameEarly` — тайбрейк на 5-5 вместо 6-6 | ✅ Есть `goldenGame` — решающий гейм при N-1:N | **ЕСТЬ** |
| **Подача: смена I/O (Inside/Outside)** | ✅ `DoublesServe.I/O` — каждый подающий знает свою сторону (Ad/Deuce) | ❌ Нет понятия I/O стороны подачи | **НЕТ** |
| **Подача: ротация A1→B1→A2→B2** | ✅ `DoublesServeSequence.A1B1A2B2` с 6 вариантами | ⚠️ Базовая ротация (A→B, смена playerIndex) | **ЧАСТИЧНО** |
| **Смена сторон: после нечётных геймов** | ✅ Настраиваемо: AfterOddGames, AfterEvenGames, BetweenSets | ✅ После нечётных геймов (хардкод) | **ЕСТЬ** |
| **Смена сторон в тайбрейке** | ✅ Каждые 6 или 4 очка, или после 1-го очка | ✅ Каждые 6 очков (хардкод) | **ЕСТЬ** |
| **Форматы тайбрейка** | ✅ 5 вариантов: TwoClearPoints, SelectOneOrTwo, SelectOneTwoOrThree, SelectOneOrThree, SuddenDeath | ⚠️ Только TwoClearPoints (до N с разницей 2) | **ЧАСТИЧНО** |
| **Финальный сет** | ✅ 7 вариантов: TieBreakTo7/10, NoGames_TieBreak, GamesTo12ThenTieBreak, NoTieBreak | ✅ `finalSetTiebreak` + `finalSetTiebreakLength` (число) | **ЕСТЬ** |
| **Super Set (до 8 геймов)** | ✅ Через FinalSetFinish.GamesTo12ThenTieBreak | ✅ `isSuperSet` + `superSetTarget` | **ЕСТЬ** |
| **Формат матча** | ✅ Любой best-of-N, любой games-per-set | ✅ Любой best-of-N, любой games-per-set + per-set overrides | **ЕСТЬ** |
| **Разные games-per-set для разных сетов** | ✅ Через `getNrOfGamesToWinSet(setIndex)` | ✅ `gamesPerSetOverrides` | **ЕСТЬ** |
| **Система подсчёта** | ✅ Classic (0-15-30-40-Ad) + Golden Point варианты | ✅ Classic / No-Ad / Fast4 | **ЕСТЬ** |
| **Сторона подачи (R/L)** | ✅ Чередуется каждое очко | ✅ Чередуется каждое очко | **ЕСТЬ** |
| **New Balls** | ✅ AfterFirst7ThenEach9, AfterFirst9ThenEach11, etc. | ❌ Нет | **НЕТ** |
| **Handicap** | ✅ SameForAllGames, DifferentForAllGames | ❌ Нет | **НЕТ** |
| **Windbreak** | ❌ Это ваше расширение (не в APK) | ✅ Настройка `windbreak` | **ВАШЕ** |
| **Речь/звук** | ✅ TTS: "deuce", "golden point", "game ball" | ✅ Звуковые эффекты (базовые) | **ЧАСТИЧНО** |

---

## 2. КЛЮЧЕВЫЕ ОТЛИЧИЯ — что нужно добавить

### 2.1 Golden Point (Punto de Oro) — РАСШИРЕНИЕ

**APK** определяет 4 уровня:

```
GoldenPointFormat.None(-1)        — стандартный Ad/Deuce
GoldenPointFormat.OnFirstDeuce(0) — на первом 40-40 = решающее очко (WPT/Padel стандарт)
GoldenPointFormat.OnSecondDeuce(1) — на втором 40-40 = решающее очко
GoldenPointFormat.OnThirdDeuce(2)  — на третьем 40-40 = решающее очко
```

**Ваш проект**: `scoringSystem: "no-ad"` — это эквивалент `OnFirstDeuce`, но без вариантов.

**Что нужно**:
- Добавить поле `goldenPointFormat` в `MatchSettings`: `"none" | "first-deuce" | "second-deuce" | "third-deuce"`
- В scoring-logic.ts: вместо бинарного "no-ad" использовать счётчик deuce
- **Ключевой нюанс из APK**: при использовании турнирного фида, автоматически ставится `OnFirstDeuce` (строка PreferenceValues.java:1092)

### 2.2 Сторона подачи (Inside/Outside) для дублей

**APK** отслеживает `DoublesServe.I` (Inside/Ad court) и `DoublesServe.O` (Outside/Deuce court):
- Подающий 1 из команды A всегда подаёт с одной стороны (I)
- Подающий 2 из команды A всегда подаёт с другой стороны (O)
- Подающий 1 из команды B подаёт с той же стороны, что и Подающий 1 из A (I)
- И так далее по циклу: I → I → O → O → I → I → O → O

**Ваш проект**: ротация A1→B1→A2→B2 есть, но нет I/O отслеживания.

**Что нужно**:
- Добавить `doublesServeSide: "I" | "O"` в состояние матча
- Показывать в UI не только R/L сторону, но и с какой половины корта подаёт игрок

### 2.3 Форматы тайбрейка — РАСШИРЕНИЕ

**APK** имеет 5 форматов:

| Формат | Описание | Используется в |
|--------|----------|----------------|
| `TwoClearPoints` | Стандартный — до 7 с разницей 2 | Почти везде |
| `SelectOneOrTwo` | Принимающий выбирает +0 или +1 к счёту | Редко |
| `SelectOneTwoOrThree` | +0, +1 или +2 | Редко |
| `SelectOneOrThree` | +0 или +2 | Редко |
| `SuddenDeath` | Без разницы в 2 очка | Редко |

**Ваш проект**: только TwoClearPoints.

**Что нужно**: добавить `tiebreakFormat: "two-clear" | "sudden-death"` как минимум. Остальные экзотические — по желанию.

### 2.4 Ранний старт тайбрейка (аналог Golden Game)

**APK**: `startTiebreakOneGameEarly = true` → тайбрейк на 5-5 вместо 6-6.

**Ваш проект**: есть `tiebreakAt: "6-6"` (настраиваемый), что уже покрывает эту функциональность.

**Разница**: APK делает это через boolean-флаг, у вас через выбор счёта. **Ваш подход лучше** — он гибче.

### 2.5 Финальный сет — РАСШИРЕНИЕ

**APK** определяет 7 вариантов через `FinalSetFinish`:

```
TieBreakTo7           — играть сет как обычно, при 6-6 тайбрейк до 7
TieBreakTo10          — играть сет как обычно, при 6-6 тайбрейк до 10
NoGames_TieBreakTo7   — вместо 3-го сета сразу тайбрейк до 7 (match tiebreak)
NoGames_TieBreakTo10  — вместо 3-го сета сразу тайбрейк до 10
GamesTo12ThenTieBreakTo7  — играть до 12 геймов, затем тайбрейк до 7
GamesTo12ThenTieBreakTo10 — играть до 12 геймов, затем тайбрейк до 10
NoTieBreak            — без тайбрейка, играть до разницы в 2 гейма
```

**Ваш проект**: `finalSetTiebreak: boolean` + `finalSetTiebreakLength: number` — покрывает大部分 случаев, но нет:
- `NoGames_*` (match tiebreak вместо 3-го сета) — **ВАЖНО для падела!**
- `GamesTo12ThenTieBreak` — это формат WPT (World Padel Tour)
- `NoTieBreak` в финальном сете

**Что нужно**: добавить поле `finalSetType: "normal" | "match-tiebreak" | "games-to-12"` в MatchSettings.

---

## 3. ЧТО НЕ НУЖНО добавлять (squash/other sports)

APK поддерживает squash-специфичные функции, которые **не нужны** для падела:
- English scoring (hand-in/hand-out) — только squash
- Conduct calls (warning/stroke/conduct) — squash
- Shot statistics (forehand/backhand) — squash
- New balls tracking — больше для тенниса, в паделе редко используется

---

## 4. Архитектурные различия

### APK (Java/Kotlin)
```
Model (abstract)
  → GSMModel (Game-Set-Match: tennis/padel/badminton/tabletennis)
    → PadelModel (SportType.Padel, defaults goldenPoint=None)
```
Вся логика в GSMModel. PadelModel — тонкая обёртка. Поведение настраивается через PreferenceValues.

### Ваш проект (TypeScript/React)
```
scoring-logic.ts — единый файл с applyScoreIncrement()
```
Вся логика в одном файле. Настройки через MatchSettings.

**Преимущество вашего подхода**: проще, понятнее.
**Недостаток**: сложнее добавлять новые вариации правил.

---

## 5. Приоритетный план добавлений

### Приоритет 1 (Критично для падела):
1. **Golden Point Format** — добавить `goldenPointFormat: "none" | "first-deuce" | "second-deuce" | "third-deuce"` вместо текущего `scoringSystem: "no-ad"`. Это главный падел-стандарт (WPT/FIP).
2. **Match Tiebreak (NoGames)** — вместо 3-го сета играть тайбрейк до 10. Это стандарт Premier Padel и WPT.
3. **Super Set для финального сета** — уже есть `isSuperSet`, но стоит добавить связку с `finalSetType`.

### Приоритет 2 (Улучшения):
4. **DoublesServe I/O** — отслеживание стороны подачи каждого игрока в дубле.
5. **Sudden Death тайбрейк** — без разницы в 2 очка (редко, но бывает).
6. **NoTiebreak для финального сета** — играть до разницы в 2 гейма.

### Приоритет 3 (Опционально):
7. **SelectOneOrTwo/Three тайбрейк** — экзотические форматы, редко используются.
8. **New Balls tracking** — можно пропустить.
9. **Handicap** — можно пропустить.

---

## 6. Нюансы реализации Golden Point

### Как это работает в APK (ключевой код):

```java
// GSMModel.java:906-960 (упрощённо)
int onDeuceNumber = m_goldenPointFormat.onDeuceNumber(); // -1=none, 0=1st, 1=2nd, 2=3rd

if (onDeuceNumber >= 0) {
    int maxScore = getMaxScore(map);
    int deuceThreshold = nrOfPointsToWinGame - 1; // 3 (уровень 40)
    
    if (maxScore >= deuceThreshold) {
        int diffScore = getDiffScore(map);
        Player leader = getLeaderInGivenGame(map);
        
        if (maxScore >= nrOfPointsToWinGame + onDeuceNumber) {
            // Мы на правильном deuce (1-м, 2-м или 3-м)
            if (diffScore >= 1) {
                // Golden Point: 1 очко разницы = win
                return new Player[]{leader};
            }
        }
    }
}
```

### Как это нужно реализовать у вас:

В `scoring-logic.ts`:

```typescript
// Вместо текущего no-ad:
} else if (scoringSystem === "classic") {
    // ... 0→15→30→40 ...
    } else if (currentGame[team] === 40) {
      if (currentGame[otherTeam] < 40) {
        return winGame(team, updatedMatch);
      } else if (currentGame[otherTeam] === 40) {
        // Проверяем Golden Point
        const gpf = updatedMatch.settings.goldenPointFormat || "none";
        if (gpf === "first-deuce") {
          return winGame(team, updatedMatch); // Punto de Oro!
        }
        // second-deuce, third-deuce — нужен счётчик deuce
        const deuceCount = updatedMatch.deuceCount || 0;
        const requiredDeuce = gpf === "second-deuce" ? 1 : gpf === "third-deuce" ? 2 : 999;
        if (deuceCount >= requiredDeuce) {
          return winGame(team, updatedMatch);
        }
        currentGame[team] = "Ad";
      } else if (currentGame[otherTeam] === "Ad") {
        currentGame[team] = 40;
        currentGame[otherTeam] = 40;
        // Увеличиваем счётчик deuce
        updatedMatch.deuceCount = (updatedMatch.deuceCount || 0) + 1;
      }
    }
```

### Match Tiebreak — что нужно:

В `winSet()` — при переходе к решающему сету:
```typescript
if (isThirdSetTiebreak) {
  updatedMatch.score.currentSet = {
    teamA: 0, teamB: 0,
    games: [],
    currentGame: { teamA: 0, teamB: 0 },
    isTiebreak: true,
    isSuperTiebreak: true,  // до 10 (или finalSetTiebreakLength)
  };
}
```
**У вас это УЖЕ реализовано**. Разница только в UI — нужно добавить выбор "Match tiebreak" (без обычных геймов в 3-м сете).

---

## 7. Итого

| Что | Сложность | Влияние |
|-----|-----------|---------|
| Golden Point Format | Средняя | ВЫСОКОЕ — стандарт WPT/FIP |
| Match Tiebreak (no games) | Низкая | ВЫСОКОЕ — стандарт Premier Padel |
| Doubles Serve I/O | Средняя | СРЕДНЕЕ — для корректного отображения |
| Sudden Death TB | Низкая | НИЗКОЕ — редко используется |
| Games-to-12 final set | Низкая | СРЕДНЕЕ — формат WPT |
| No-tiebreak final set | Низкая | НИЗКОЕ |


---

## 8. Дополнение из `C:\WORK\SCORE TENNIS`

Источник: декомпилированные ресурсы APK `Padel v4.60` в папке `C:\WORK\SCORE TENNIS\decompiled_res\resources\res`.

### 8.1 Настройки формата матча из `preferences.xml`

В экране `MatchFormat` приложение хранит и показывает такие ключи:

- `numberOfPointsToWinGame` — количество очков для выигрыша гейма.
- `numberOfGamesToWinMatch` — количество геймов/сетов для выигрыша матча в модели GSM.
- `tieBreakFormat` — формат тайбрейка, enum `TieBreakFormat`, по умолчанию `TwoClearPoints`.
- `finalSetFinish` — правило завершения решающего сета, enum `FinalSetFinish`, по умолчанию `TieBreakTo7`.
- `useHandInHandOutScoring` — английский hand-in/hand-out scoring, для падела обычно не нужен.
- `playAllGames` — доигрывать все геймы даже после формального победителя.
- `usePowerPlay`, `numberOfPowerPlaysPerPlayerPerMatch` — Power Play как отдельная опция.
- `handicapFormat`, `allowNegativeHandicap` — гандикап.

### 8.2 Форматы финального сета (`finalSetFinishDisplayValues`)

APK поддерживает 7 вариантов:

| Значение в UI APK | Смысл для нашей модели |
|---|---|
| `Games as normal - TieBreak To 7` | Решающий сет играется обычными геймами, при равенстве включается тайбрейк до 7. |
| `Games as normal - TieBreak To 10` | То же, но тайбрейк до 10. |
| `No Games - Match TieBreak To 7` | Вместо решающего сета сразу match tiebreak до 7. |
| `No Games - Match TieBreak To 10` | Вместо решающего сета сразу match tiebreak до 10. |
| `Games To 12 - If equal, TieBreak To 7` | Решающий сет до 12 геймов, затем тайбрейк до 7. |
| `Games To 12 - If equal, TieBreak To 10` | Решающий сет до 12 геймов, затем тайбрейк до 10. |
| `No Tie-Break` | Без тайбрейка, играть до преимущества в 2 гейма. |

Практический вывод для проекта: варианты `2 + tiebreak`, `4 + tiebreak`, `6 + tiebreak` должны означать match tiebreak после равенства по обычным сетам, а не тайбрейк сразу после первого сета.

### 8.3 Форматы тайбрейка (`tiebreakFormatDisplayValues`)

APK показывает 5 вариантов:

| Значение в UI APK | Смысл |
|---|---|
| `Two points` | Стандарт: победа с разницей 2 очка. |
| `Receiver selects 1 or 2` | Принимающий выбирает 1 или 2 очка. |
| `Receiver selects 1,2 or 3` | Принимающий выбирает 1, 2 или 3 очка. |
| `Receiver selects 1 or 3` | Принимающий выбирает 1 или 3 очка. |
| `Sudden death` | Внезапная смерть, без требования разницы 2. |

В текущем проекте реализован только стандарт `Two points`.

### 8.4 Golden Point (`goldenPointFormatDisplayValues`)

APK использует 4 уровня Golden Point:

| Значение в UI APK | Смысл |
|---|---|
| `Off` | Обычная система с advantage. |
| `Pro (On First Deuce)` | Golden Point на первом deuce. |
| `Amateur (On Second Deuce)` | Golden Point на втором deuce. |
| `Star (On Third Deuce)` | Golden Point на третьем deuce. |

В проекте `scoringSystem: "no-ad"` соответствует варианту `Pro (On First Deuce)`, но без выбора второго/третьего deuce.

### 8.5 Последовательности подачи в дубле (`doublesServeSequence`)

APK содержит варианты ротации:

- `A1/B1/A2/B2`
- `A2/B1/B2 then A1/A2/B1/B2`
- `A1/B1/B2 then A1/A2/B1/B2`
- `A1/A2/B1/B2`
- `A1/B1/A1/B1`

В проекте сейчас фактически используется базовая ротация `A1 -> B1 -> A2 -> B2`.

### 8.6 Официальные URL правил (`OfficialRulesURLs_default__TennisPadel`)

В английских ресурсах APK:

- `https://www.padelfip.com/wp-content/uploads/2017/06/Rules-of-Padel.pdf`
- `http://www.padel.com/`

В испанских ресурсах APK список шире:

- `https://www.padelfip.com/wp-content/uploads/2021/05/2-Reglamento-Juego.pdf`
- `https://www.padelfip.com/wp-content/uploads/2017/06/Rules-of-Padel.pdf`
- `https://www.padelfip.com/es/rules/`
- `https://www.Padel.com/`
