# План переноса недостающих функций SCORE TENNIS: Padel/Tennis

> **Version 2** — переписан с учётом критического ревью.
> **Для реализации:** выполнять по задачам, TDD-стилем. После каждого блока запускать `npm run test` и `npm run typecheck`.

**Цель:** закрыть максимум недостающих функций падела и тенниса из APK `Padel v4.60`, не ломая текущий Next/React/TypeScript scoring engine.

**Scope (явно):** реализуем только Padel + Tennis. Squash / Table Tennis / Badminton / Racketlon / Racquetball **намеренно вне scope этого плана** — будут отдельным эпиком.

**Архитектура:** не переписывать `lib/scoring-logic.ts` целиком. Добавить расширения как чистые модули: события матча, тайминги, расширенные tie-break правила, статистику розыгрышей, жеребьевку, новые мячи, handicap, richer undo, doubles serve sequence. UI — тонкие компоненты поверх существующих `ScoreBoard`, `ScoreControls`, `MatchSettings`, `match-view` и vMix JSON projection.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Supabase/localStorage sync (через `lib/match-sync.ts` + `lib/match-operation-log.ts`), existing shadcn/ui components, lucide-react icons.

---

## 0. Главные правки против v1 (что и почему изменено)

1. **Task 0 (Unify types) добавлен** — без унификации `Match` и `Player` в `lib/types.ts` все TS-таски сломают сборку.
2. **`structuredClone` заменён на `JSON.parse(JSON.stringify(...))`** — единый стиль с текущим `applyScoreIncrement`. Supabase всё равно сериализует через JSON, никаких Date/Map не теряем.
3. **`crypto.randomUUID()` обёрнут в `safeUuid()`** с fallback'ом на математический PRNG — `crypto.randomUUID` недоступен в небезопасных контекстах (http://).
4. **Doubles serve sequence: исправлена математика "then"-циклов** — `A2B1B2_then_A1A2B1B2` это intro 3 гейма + 4-гейм цикл, а не 7-цикл.
5. **Rich Undo: APK-стиль replay вместо `beforeMatch` снапшотов** — снапшоты в каждом event раздувают storage. Сохраняем seed snapshot + reverse-применяем последний event.
6. **New Balls: проверка `wouldBeTiebreakAtNextGame`** вместо текущего `isTiebreak`.
7. **Power Play: добавлена явная проверка `isPossibleGameBallFor`** перед активацией.
8. **Realtime sync: `events[]` реконсилируется через `match-operation-log`** — переиспользуем существующий журнал операций, а не дублируем.
9. **Rule-change classification матрица для всех новых ключей** добавлена в Task 1.
10. **Database migration (Supabase) описан явно** — все новые поля идут в существующие jsonb-колонки (`settings`, плюс одна новая `extras`).
11. **Timer multi-device sync**: `startedAt + durationSec` достаточно для восстановления; pause/resume через event-протокол.
12. **EndMatch reasons (Retired/Conduct/Time)**, **AdjustScore dialog**, **Match share URL** — добавлены явные таски.
13. **Существующий `feed-import/` упомянут**; ResultPoster (POST результата) — отдельный low-priority Task 16.
14. **Локализация** — список ключей перечислен в каждом UI-таске.

---

## 1. Главный принцип переноса

APK хранит почти все как mutable `Model`, `ScoreLine`, `GameTiming`, listeners. В вебе — иммутабельно:

- `Match` — каноничный snapshot.
- Каждое действие — `MatchEvent`.
- `applyScoreIncrement()` дополняется метаданными, не превращается в монолит.
- Вычисления для vMix/API/UI — через pure projection в `lib/match-view.ts`.
- Supabase/localStorage хранят полный snapshot; старые матчи backfill-ятся дефолтами.

```ts
type TeamKey = "teamA" | "teamB"

type MatchEventType =
  | "point"
  | "undo"
  | "manual-score-edit"
  | "timer"
  | "timeout"
  | "new-balls"
  | "toss"
  | "rally-stat"
  | "conduct"
  | "appeal"
  | "power-play"
  | "broken-equipment"
  | "end-match-manual"
  | "match-end"

interface MatchEvent {
  id: string
  type: MatchEventType
  at: string
  setIndex: number
  gameIndex: number
  pointIndex?: number
  actor?: TeamKey
  payload: Record<string, unknown>
}
```

---

## 2. Утилиты, общие для всех тасков

### 2.1 `lib/utils/safe-uuid.ts` — Crypto fallback

```ts
export function safeUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    try { return globalThis.crypto.randomUUID() } catch { /* fall through */ }
  }
  // RFC4122 v4 fallback (Math.random based — fine for client IDs, not for security)
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
```

### 2.2 Клонирование

Везде используем `JSON.parse(JSON.stringify(match))`, как в существующем `applyScoreIncrement`. Не `structuredClone` — не теряем `Date` (его и так нет в snapshot — только ISO-строки).

---

## 3. Task 0 — Унификация типов `Match` и `Player`

**Без этого все TS-расширения сломают сборку.**

**Файлы:**

- Modify: `lib/types.ts`
- Test: `test/match-types-shape.test.ts`

**Что меняем:**

В текущем `lib/types.ts` форма `Match` использует устаревшие поля `sets: {number, pointsA, pointsB}[]`, `currentSet: number`, `currentPoint: number`. В коде же фактически используется `score.sets: SavedSet[]`, `score.currentSet: CurrentSet` (см. `lib/scoring-logic.ts`).

**Шаги:**

1. Экспортировать `TeamKey = "teamA" | "teamB"` из `types.ts`.
2. Согласовать `Match` с реальной формой:
   ```ts
   export interface SavedSet {
     teamA: number
     teamB: number
     winner: TeamKey
     tiebreak?: { teamA: number; teamB: number }
   }

   export interface CurrentGame {
     teamA: number | string
     teamB: number | string
     deuceCount?: number
   }

   export interface CurrentSet {
     teamA: number
     teamB: number
     games: { winner: TeamKey }[]
     currentGame: CurrentGame
     isTiebreak: boolean
     isSuperTiebreak?: boolean
     tiebreak?: { teamA: number; teamB: number }
   }

   export interface MatchScore {
     teamA: number
     teamB: number
     sets: SavedSet[]
     currentSet: CurrentSet
   }
   ```
3. Удалить устаревшие поля `Match.sets/.currentSet/.currentPoint` — проверить через TS компиляцию, нет ли реальных потребителей.
4. Расширить `Player` дополнительными опциональными полями (`country`, `club`, `avatar`, `seed`, `abbreviation`, `teamId`).
5. Все опциональные новые поля (`events`, `timing`, `rallyStats`, …) — задаются в отдельном `ExtendedMatchState` (Task 1).

**Acceptance:**

- `npm run typecheck` проходит.
- `npm run test` — все существующие тесты зелёные.

---

## 4. Task 1 — Extended state + backfill + rule-change matrix

**Файлы:**

- Modify: `lib/types.ts`
- Create: `lib/match-extended-state.ts`
- Modify: `lib/match-storage.ts` (вызов backfill в `getMatch`)
- Modify: `lib/match-supabase.ts` (вызов backfill в `matchFromRow`)
- Modify: `lib/match-rule-change.ts` (добавить новые keys в `RULE_KEYS` + классификации)
- Test: `test/match-extended-state.test.ts`

### 4.1 Расширение `Match` (опциональные поля)

```ts
export type NewBallsMode =
  | "off"
  | "after-first-7-then-each-9"
  | "after-first-9-then-each-11"
  | "after-first-11-then-each-13"
  | "before-set-3"

export type HandicapFormat = "none" | "same-for-all-games" | "different-for-all-games"

export type TiebreakFormatExt =
  | "two-clear"
  | "sudden-death"
  | "receiver-select-1-or-2"
  | "receiver-select-1-2-or-3"
  | "receiver-select-1-or-3"

export type DoublesServeSequence =
  | "A1B1A2B2"
  | "A1A2B1B2"
  | "A1B1A1B1"
  | "A2B1B2_then_A1A2B1B2"
  | "A1B1B2_then_A1A2B1B2"

export type EndMatchReason = "completed" | "retired-injury" | "conduct" | "time-up"

export interface ExtendedMatchState {
  events?: MatchEvent[]
  timing?: MatchTiming
  rallyStats?: RallyStat[]
  newBalls?: { mode: NewBallsMode; lastChangeAtStartOfGame: number; pendingInGames: number | null }
  handicap?: { format: HandicapFormat; sameForAllGames?: { teamA: number; teamB: number }; perGame?: Record<string, { teamA: number; teamB: number }> }
  toss?: TossState
  powerPlay?: PowerPlayState
  timeouts?: Record<TeamKey, TimeoutRecord[]>
  officialCalls?: OfficialCall[]
  endMatchReason?: EndMatchReason
  shareUrl?: string
  matchMetadata?: MatchMetadata
  pendingTiebreakChoice?: { baseTarget: number; options: number[]; receiverTeam: TeamKey }
}
```

### 4.2 Backfill (idempotent)

```ts
export function backfillExtendedMatchState(match: any): any {
  if (!match) return match
  if (!match.events) match.events = []
  if (!match.timing) match.timing = { games: [] }
  if (!match.rallyStats) match.rallyStats = []
  if (!match.newBalls) match.newBalls = { mode: "off", lastChangeAtStartOfGame: 0, pendingInGames: null }
  if (!match.handicap) match.handicap = { format: "none" }
  if (!match.timeouts) match.timeouts = { teamA: [], teamB: [] }
  if (!match.officialCalls) match.officialCalls = []
  if (!match.settings) match.settings = {}
  if (!match.settings.doublesServeSequence) match.settings.doublesServeSequence = "A1B1A2B2"
  return match
}
```

### 4.3 Rule-change classification матрица

Добавить в `lib/match-rule-change.ts` (extend `RULE_KEYS` и `getRuleChangeScope`):

| Новый ключ | Scope | Reason |
|---|---|---|
| `doublesServeSequence` | `future-only` | Изменение порядка подачи в парах эффективно с нового гейма |
| `newBalls.mode` | `safe` | Только индикатор, не влияет на счёт |
| `handicap.format` | `current-set` если match started | Меняет старт-счёт следующего гейма |
| `handicap.sameForAllGames` | `current-set` если match started | То же |
| `handicap.perGame` | `safe` (per-game override на будущие геймы) | — |
| `startTiebreakOneGameEarly` | `future-only` | С нового сета |
| `playAllGames` | `safe` | Только условие завершения, не меняет уже сыгранное |
| `tiebreakFormat: receiver-select-*` | `current-set` если идёт tiebreak | Поднимает pending choice |
| `timerSeconds.*` | `safe` | Только дефолты длительности |

### 4.4 Database migration

**Supabase:** все новые поля идут в существующие jsonb-колонки. Один новый столбец `extras jsonb default '{}'::jsonb` для `events/timing/rallyStats/newBalls/handicap/toss/powerPlay/timeouts/officialCalls`.

SQL (см. `supabase/migrations/<timestamp>_extras.sql`):

```sql
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '{}'::jsonb;
```

В `matchToRow / matchFromRow` маппинг — выделить новые поля в `extras` при сохранении и развернуть обратно при чтении.

**Acceptance:**

- Старый матч без новых полей получает defaults.
- Новые поля сохраняются и читаются без потерь.
- `events` не теряются при realtime reconcile (проверяется отдельным тестом из Task 2).

---

## 5. Task 2 — Event journal (через operation log)

**Важно:** не дублируем `lib/match-operation-log.ts`. `events[]` — это **проекция/расширение** журнала операций, специфичная для UI/audit.

**Файлы:**

- Create: `lib/match-events.ts`
- Modify: `components/score-board.tsx` (запись event на каждый клик)
- Test: `test/match-events.test.ts`

**Логика:**

```ts
import { safeUuid } from "./utils/safe-uuid"

export function appendMatchEvent(match: any, event: Omit<MatchEvent, "id" | "at">): any {
  if (!match) return match
  const next = JSON.parse(JSON.stringify(match))
  if (!next.events) next.events = []
  next.events.push({ id: safeUuid(), at: new Date().toISOString(), ...event })
  return next
}

/** Last 50 events kept in payload-rich form; older events are trimmed to lite. */
export function trimEventHistory(match: any, keepRich = 50): any {
  if (!match?.events || match.events.length <= keepRich) return match
  const next = JSON.parse(JSON.stringify(match))
  const cutoff = next.events.length - keepRich
  for (let i = 0; i < cutoff; i++) {
    const e = next.events[i]
    e.payload = { compacted: true, type: e.type, actor: e.actor }
  }
  return next
}
```

**Realtime reconcile:** в `match-sync.ts` при merge снэпшота сохранять локальный `events[]` если remote `events.length < local.length` (lossy guard — мерж по `event.id`).

**Acceptance:**

- Undo использует `events`, а не только React state.
- После reload можно отменить последний point.
- vMix получает `last_event_type`.

---

## 6. Task 3 — Timing

**Файлы:**

- Create: `lib/match-timing.ts`
- Create: `components/match-timer-panel.tsx`
- Modify: `components/score-board.tsx` (вызывать `ensureCurrentGameTiming` + `addPointTiming`)
- Modify: `lib/match-view.ts` (новые проекции)
- Test: `test/match-timing.test.ts`

**Логика — без изменений против v1.** Использует `JSON.parse(JSON.stringify(...))`.

**Acceptance:**

- Первое очко создаёт `GameTiming`.
- Второе очко добавляет score timing.
- Новый гейм закрывает предыдущий timing.
- Undo удаляет последний point timing.
- `matchEndedAt` фиксируется при completed match.

---

## 7. Task 4 — Timers (warmup/pause/injury/timeout)

**Multi-device семантика:**

- `activeTimer.startedAt` (ISO) — абсолютная отметка старта.
- `activeTimer.durationSec` — длительность.
- Pause/resume → события `timer` с action `pause` / `resume`. UI вычисляет `remaining = durationSec - (now - startedAt - sum(paused))`.
- Любое устройство видит ту же абсолютную ось времени через Supabase realtime → таймер консистентен между устройствами.

**Файлы:** см. v1 (без изменений), плюс:

- `components/timer-controls.tsx` — кнопки start/pause/resume/stop
- `components/timer-display.tsx` — live countdown через `setInterval` локально, основываясь на ISO `startedAt`.

**Локализация ключей** (`lib/translations.ts`):

```
timer.types.warmup
timer.types.pause-between-games
timer.types.injury.self
timer.types.injury.blood
timer.types.injury.opponent
timer.types.injury.contributed
timer.types.toweling-down
timer.types.timeout
timer.start
timer.pause
timer.resume
timer.stop
timer.remaining
```

---

## 8. Task 5 — New Balls (исправлен tiebreak check)

**Логика (исправленная):**

```ts
const NEW_BALLS_RULES = {
  "after-first-7-then-each-9": { first: 7, each: 9, set: null },
  "after-first-9-then-each-11": { first: 9, each: 11, set: null },
  "after-first-11-then-each-13": { first: 11, each: 13, set: null },
  "before-set-3": { first: null, each: null, set: 3 },
} as const

export function totalGamesPlayed(match: any): number {
  const completed = (match.score?.sets ?? []).reduce(
    (sum: number, s: any) => sum + (s.teamA ?? 0) + (s.teamB ?? 0), 0)
  const current = match.score?.currentSet
  return completed + (current?.teamA ?? 0) + (current?.teamB ?? 0)
}

/**
 * Returns the number of games remaining until the next ball change:
 *  - null    → не применимо (off, completed, mid-game)
 *  - 0       → меняем сейчас (новый гейм только что начался)
 *  - 1, 2, … → через N геймов
 *
 * Особый кейс: если замена попадает на старт tie-break game, переносим на +2
 * геймов (как в APK newBallsInXgames()).
 */
export function newBallsInXGames(match: any): number | null {
  const mode = match.newBalls?.mode ?? "off"
  if (mode === "off" || match.isCompleted) return null

  // Mid-game (хоть одно очко в текущем гейме) — не применимо.
  const cg = match.score?.currentSet?.currentGame
  if (typeof cg?.teamA === "number" && cg.teamA > 0) return null
  if (typeof cg?.teamB === "number" && cg.teamB > 0) return null
  if (cg?.teamA === "Ad" || cg?.teamB === "Ad") return null

  const rule = NEW_BALLS_RULES[mode as keyof typeof NEW_BALLS_RULES]
  if (rule.set) {
    return match.score.sets.length + 1 === rule.set ? 0 : null
  }

  const total = totalGamesPlayed(match)
  let nextAt = match.newBalls?.lastChangeAtStartOfGame || 0
  if (nextAt === 0) nextAt = rule.first!
  while (nextAt < total) nextAt += rule.each!

  const remaining = nextAt - total
  // Если замена попадает на старт tie-break — переносим на +2 геймов.
  // Игра, начинающаяся в tie-break — это игра, где currentSet.isTiebreak уже true
  // или 6-6 (или per-set эквивалент) с tiebreakEnabled.
  if (remaining === 0 && wouldNextGameBeTiebreak(match)) return 2
  return remaining
}

function wouldNextGameBeTiebreak(match: any): boolean {
  const cs = match.score?.currentSet
  if (!cs) return false
  if (cs.isTiebreak) return true
  if (!match.settings?.tiebreakEnabled) return false
  const tbAt = Number.parseInt(String(match.settings?.tiebreakAt ?? "6-6").split("-")[0] || "6", 10)
  return cs.teamA === tbAt && cs.teamB === tbAt
}
```

**Файлы:** см. v1.

---

## 9. Task 6 — Tiebreak format расширения

Без изменений против v1, кроме явного указания, что `pendingTiebreakChoice` живёт в `ExtendedMatchState` (Task 1).

---

## 10. Task 7 — Handicap

Без изменений против v1.

---

## 11. Task 8 — Toss (атомарно)

**Изменение против v1:** `applyTossWinner` и `applyTossSide` слиты в одну атомарную функцию `commitToss(match, { winner, choice, teamOnLeft })`. Это убирает половинчатое состояние при reload между шагами.

```ts
export interface TossState {
  winner?: TeamKey
  winnerChoice?: TossChoice
  receiverSide?: TossSide
  completedAt?: string
}

export function commitToss(
  match: any,
  params: { winner: TeamKey; choice: TossChoice; teamOnLeft: TeamKey },
): any {
  const { winner, choice, teamOnLeft } = params
  const server = choice === "serve" ? winner : winner === "teamA" ? "teamB" : "teamA"
  const next = JSON.parse(JSON.stringify(match))
  next.currentServer = { team: server, playerIndex: 0 }
  next.courtSides = {
    teamA: teamOnLeft === "teamA" ? "left" : "right",
    teamB: teamOnLeft === "teamB" ? "left" : "right",
  }
  next.toss = {
    winner,
    winnerChoice: choice,
    receiverSide: teamOnLeft === winner ? null : (next.courtSides[winner === "teamA" ? "teamB" : "teamA"]),
    completedAt: new Date().toISOString(),
  }
  return appendMatchEvent(next, {
    type: "toss",
    setIndex: next.score.sets.length,
    gameIndex: next.score.currentSet.games.length,
    payload: { winner, choice, teamOnLeft },
  })
}
```

UI — multi-step dialog, но commit идёт одним вызовом `commitToss` в конце.

---

## 12. Task 9 — Rally Stats

Без изменений против v1.

---

## 13. Task 10 — Rich Undo (replay-стиль)

**Изменение против v1:** не храним `beforeMatch` в каждом event. Вместо этого:

1. При `createMatch` сохраняем `seedSnapshot` (Match сразу после создания, **до** первого point).
2. Undo == replay всех событий до `events[events.length - 1 - n]` от `seedSnapshot`.

```ts
import { applyScoreIncrement } from "./scoring-logic"

export function undoLastScoringEvent(match: any): any {
  const events = match.events ?? []
  const seed = match.seedSnapshot
  if (!seed || events.length === 0) return match

  // Найти индекс последнего "сcorable" события (point / manual-edit / toss).
  const undoableTypes = new Set(["point", "manual-score-edit", "toss"])
  let lastIdx = -1
  for (let i = events.length - 1; i >= 0; i--) {
    if (undoableTypes.has(events[i].type)) { lastIdx = i; break }
  }
  if (lastIdx < 0) return match

  // Replay все события КРОМЕ undone и предыдущих undo-маркеров.
  let replayed = JSON.parse(JSON.stringify(seed))
  for (let i = 0; i < lastIdx; i++) {
    const ev = events[i]
    if (ev.type === "point" && ev.actor) {
      replayed = applyScoreIncrement(replayed, ev.actor as TeamKey)
    }
    // ... аналогично для других undoable типов (manual-score-edit, toss).
  }

  // Сохранить весь events[], плюс пометить undo-событие.
  replayed.events = [...events, {
    id: safeUuid(),
    at: new Date().toISOString(),
    type: "undo",
    setIndex: replayed.score.sets.length,
    gameIndex: replayed.score.currentSet.games.length,
    payload: { undoneEventId: events[lastIdx].id },
  }]
  replayed.seedSnapshot = seed
  return replayed
}

export function undoBackOneGame(match: any): any {
  let cur = match
  const startedGame = match.score.currentSet.games.length
  for (let safety = 0; safety < 50; safety++) {
    const prev = cur
    cur = undoLastScoringEvent(cur)
    if (cur === prev) break
    if (cur.score.currentSet.games.length < startedGame) break
    // Когда мы переходим на предыдущий сет:
    if (cur.score.sets.length < match.score.sets.length) break
  }
  return cur
}
```

**Storage cost:** один полный snapshot (`seedSnapshot`) + N компактных events ≈ N×100 байт. Это управляемо в localStorage даже для 500-очковых матчей.

---

## 14. Task 11 — Doubles Serve Sequence (исправлена математика)

**Критическая правка:** "then"-паттерны — это `intro + cycle`, не один большой цикл.

```ts
export type DoublesServeSequence =
  | "A1B1A2B2"
  | "A1A2B1B2"
  | "A1B1A1B1"
  | "A2B1B2_then_A1A2B1B2"
  | "A1B1B2_then_A1A2B1B2"

type ServerSpec = { team: TeamKey; playerIndex: 0 | 1 }

const SIMPLE_CYCLES: Record<string, ServerSpec[]> = {
  A1B1A2B2: [
    { team: "teamA", playerIndex: 0 },
    { team: "teamB", playerIndex: 0 },
    { team: "teamA", playerIndex: 1 },
    { team: "teamB", playerIndex: 1 },
  ],
  A1A2B1B2: [
    { team: "teamA", playerIndex: 0 },
    { team: "teamA", playerIndex: 1 },
    { team: "teamB", playerIndex: 0 },
    { team: "teamB", playerIndex: 1 },
  ],
  A1B1A1B1: [
    { team: "teamA", playerIndex: 0 },
    { team: "teamB", playerIndex: 0 },
  ],
}

// Intro (первые N геймов) + body (повторяющийся цикл) для "then"-вариантов.
const INTRO_PLUS_CYCLE: Record<string, { intro: ServerSpec[]; body: ServerSpec[] }> = {
  A2B1B2_then_A1A2B1B2: {
    intro: [
      { team: "teamA", playerIndex: 1 },
      { team: "teamB", playerIndex: 0 },
      { team: "teamB", playerIndex: 1 },
    ],
    body: [
      { team: "teamA", playerIndex: 0 },
      { team: "teamA", playerIndex: 1 },
      { team: "teamB", playerIndex: 0 },
      { team: "teamB", playerIndex: 1 },
    ],
  },
  A1B1B2_then_A1A2B1B2: {
    intro: [
      { team: "teamA", playerIndex: 0 },
      { team: "teamB", playerIndex: 0 },
      { team: "teamB", playerIndex: 1 },
    ],
    body: [
      { team: "teamA", playerIndex: 0 },
      { team: "teamA", playerIndex: 1 },
      { team: "teamB", playerIndex: 0 },
      { team: "teamB", playerIndex: 1 },
    ],
  },
}

export function getServerForGameNumber(seq: DoublesServeSequence, gameNumber: number): ServerSpec {
  if (gameNumber < 0) gameNumber = 0
  const simple = SIMPLE_CYCLES[seq]
  if (simple) return simple[gameNumber % simple.length]
  const compound = INTRO_PLUS_CYCLE[seq]
  if (compound) {
    if (gameNumber < compound.intro.length) return compound.intro[gameNumber]
    const inBody = (gameNumber - compound.intro.length) % compound.body.length
    return compound.body[inBody]
  }
  return SIMPLE_CYCLES.A1B1A2B2[gameNumber % 4]
}
```

**Unit-тесты обязательно:**

- `A2B1B2_then_A1A2B1B2` для геймов 0..10 (intro 0,1,2 → body на 3,4,5,6 → повтор 7,8,9,10).
- `A1A2B1B2` — каждый игрок подаёт ровно 1 гейм из 4.

**Integration:** `switchServer()` в `scoring-logic.ts` ОСТАЁТСЯ дефолтным (A1B1A2B2). Новая логика подключается только если `match.settings.doublesServeSequence` ≠ "A1B1A2B2". `winGame` вызывает `getServerForGameNumber(seq, currentSet.teamA + currentSet.teamB)` после инкремента счётчиков, и подменяет `currentServer`.

---

## 15. Task 12 — Power Play (с проверкой game ball)

```ts
import { isGamePoint } from "./scoring-logic"

export function toggleNextRallyPowerPlay(match: any, team: TeamKey): { match: any; refused?: string } {
  const gp = isGamePoint(match)
  if (gp === team || gp === "both") {
    // APK правило: нельзя активировать PP на game ball
    return { match, refused: "power-play.refused.game-ball" }
  }
  const next = JSON.parse(JSON.stringify(match))
  if (!next.powerPlay) next.powerPlay = { maxPerTeam: 2, used: { teamA: 0, teamB: 0 }, activeFor: [] }
  if (next.powerPlay.used[team] >= next.powerPlay.maxPerTeam) {
    return { match, refused: "power-play.refused.no-budget" }
  }
  if (next.powerPlay.activeFor.includes(team)) {
    next.powerPlay.activeFor = next.powerPlay.activeFor.filter((t: TeamKey) => t !== team)
  } else {
    next.powerPlay.activeFor.push(team)
  }
  return { match: next }
}

export function consumePowerPlayAfterPoint(match: any, scoringTeam: TeamKey): any {
  if (!match.powerPlay?.activeFor?.length) return match
  const next = JSON.parse(JSON.stringify(match))
  for (const team of next.powerPlay.activeFor as TeamKey[]) {
    next.powerPlay.used[team] = (next.powerPlay.used[team] ?? 0) + 1
  }
  next.powerPlay.activeFor = []
  return next
}
```

---

## 16. Task 13 — Timeouts, Official Calls, EndMatch reasons

Объединён в один таск (judicial layer).

**Файлы:**

- Create: `lib/timeouts.ts`
- Create: `lib/match-official-calls.ts`
- Create: `lib/match-end-reason.ts`
- Create: `components/official-call-dialog.tsx`
- Create: `components/end-match-dialog.tsx` (Retired / Conduct / Time)
- Modify: `components/score-controls.tsx`
- Test: `test/timeouts.test.ts`, `test/match-official-calls.test.ts`, `test/match-end-reason.test.ts`

**EndMatchReason:**

```ts
export type EndMatchReason = "completed" | "retired-injury" | "conduct" | "time-up"

export function endMatchManually(match: any, reason: Exclude<EndMatchReason, "completed">, winnerTeam: TeamKey): any {
  const next = JSON.parse(JSON.stringify(match))
  next.isCompleted = true
  next.winner = winnerTeam
  next.endMatchReason = reason
  if (next.timing) next.timing.matchEndedAt = new Date().toISOString()
  return appendMatchEvent(next, {
    type: "end-match-manual",
    setIndex: next.score.sets.length,
    gameIndex: next.score.currentSet.games.length,
    payload: { reason, winnerTeam },
  })
}
```

---

## 17. Task 14 — vMix/API projection

Без изменений против v1, но `last_event_type`, `match_duration`, `current_game_duration`, `active_timer_type/remaining`, `new_balls_in_games`, stats — все читаются из проекций, не хардкодятся.

---

## 18. Task 15 — Match share URL + AdjustScore dialog

**Файлы:**

- Modify: `lib/match-storage.ts` (записывать `shareUrl` в `extras`)
- Create: `components/adjust-score-dialog.tsx`
- Test: `test/adjust-score.test.ts`

**AdjustScore** — ручная корректировка точечного очка/гейма/сета. Записывает event `manual-score-edit` с before/after.

**Match share URL** — уже частично есть (`getMatchShareUrl`), теперь сохраняется в `match.shareUrl` и попадает в vMix projection.

---

## 19. Task 16 (опциональный, Low priority) — ResultPoster

Отдельная подсистема (выход за рамки первого slice'а). Принципы:

- `lib/result-poster.ts` — POST JSON на сконфигурированный URL.
- HTTP Basic Auth из настроек (env vars или Settings UI).
- Auto-post on match complete (опционально, через настройку).
- Retry с backoff, dead-letter в `match-operation-log`.

---

## 20. Test matrix

**Unit:**

```bash
npm run test -- test/match-extended-state.test.ts
npm run test -- test/match-events.test.ts
npm run test -- test/match-timing.test.ts
npm run test -- test/new-balls.test.ts
npm run test -- test/doubles-serve-sequence.test.ts
npm run test -- test/toss.test.ts
npm run test -- test/tiebreak-format.test.ts
npm run test -- test/handicap.test.ts
npm run test -- test/match-undo.test.ts
npm run test -- test/match-timers.test.ts
npm run test -- test/rally-stats.test.ts
npm run test -- test/power-play.test.ts
npm run test -- test/timeouts.test.ts
npm run test -- test/match-official-calls.test.ts
npm run test -- test/match-end-reason.test.ts
npm run test -- test/adjust-score.test.ts
```

**Regression:** должны быть зелёными без изменений:

```bash
npm run test -- test/scoring-logic.test.ts
npm run test -- test/scoring-logic-regression.ts
npm run test -- test/rule-change-realtime-regression.ts
npm run test -- test/match-sync.test.ts
npm run test -- test/match-view.test.ts
```

---

## 21. Order of execution (foundational first)

1. **Task 0** — Types unification
2. **Task 1** — Extended state + backfill + rule-change matrix
3. **Task 2** — Event journal
4. **Task 3** — Timing
5. **Task 5** — New Balls
6. **Task 8** — Toss
7. **Task 11** — Doubles serve sequence (с правильной математикой)
8. **Task 14** — vMix projection (после events/timing/new-balls)
9. **Task 6** — Tiebreak format select
10. **Task 9** — Rally stats
11. **Task 10** — Rich undo (replay-стиль)
12. **Task 4** — Timers
13. **Task 13** — Timeouts/Calls/EndMatch
14. **Task 12** — Power Play
15. **Task 7** — Handicap
16. **Task 15** — Share URL + AdjustScore
17. **Task 16** — ResultPoster (optional)

---

## 22. Definition of done

- Все существующие тесты остаются зелёными.
- `npm run typecheck` без ошибок.
- Старые матчи открываются без миграционных ошибок (backfill подкидывает defaults).
- Новые поля сохраняются и читаются через Supabase + localStorage.
- Operator может: scored normally, Golden Point/final-set как раньше, выбранный tie-break format, run timers, record timeout, track new balls, run server/side toss одним диалогом, record rally winner/error, undo last point after reload, undo full game, see match duration, expose new data to vMix/API.
- Browser UI не замедляется: scoring click не блокируется stats unless `recordRallyStats` enabled.
