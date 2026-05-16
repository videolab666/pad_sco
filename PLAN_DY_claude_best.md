# План: интеграция публичных фидов double-yellow.be в padel-score1

> Цель: добавить (к существующему функционалу `new-match`) возможность импортировать матчи и
> игроков из публичных фидов сервиса `tennispadel.double-yellow.be` — так же, как это сделано в
> Android-приложении Score Tennis/Padel: **выбор платформы → выбор турниров/лиг → турниры по
> странам → выбор матча (или игроков)**.
>
> Методика самих фидов подробно описана в `C:\WORK\SCORE TENNIS\TEST_FEED_claude_best.md` —
> этот план опирается на неё. Решение: пока используем сервер `double-yellow.be` напрямую
> (через серверный прокси на нашем бэкенде, чтобы не упереться в CORS).

---

## 1. Что уже есть в проекте (точки интеграции)

| Что | Файл | Важное |
|---|---|---|
| Создание матча | [app/new-match/page.tsx](app/new-match/page.tsx) | Состояния `teamAPlayer1/2`, `teamBPlayer1/2` хранят **id** игроков; `matchFormat` = `singles`/`doubles`; `matchRound`; `matchType` = `tennis`/`padel` |
| Выбор игрока | [components/player-selector.tsx](components/player-selector.tsx) | Combobox по массиву `players: {id,name}[]` |
| Хранилище игроков | [lib/player-storage.ts](lib/player-storage.ts) | `getPlayers()`, `addPlayer({id,name})`; localStorage-ключ `padel-tennis-players` + таблица Supabase `players`; событие `players-updated` |
| Создание матча | [lib/match-storage.ts](lib/match-storage.ts) | `createMatch(match)` |
| i18n | [lib/translations.ts](lib/translations.ts) + `contexts/language-context` | `t("ключ")`, языки `ru/en/uk`, тип `TranslationKeys` |
| UI-кит | `components/ui/*` | shadcn/Radix: `Dialog`, `Command`, `Tabs`, `ScrollArea`, `Accordion`, `Badge`, `Skeleton` — всё уже есть |
| API-роуты | `app/api/*/route.ts` | Паттерн Next route handlers |

**Модель игрока:** `{ id: string, name: string }`. Расширим её необязательным полем
`dyId?: string` (внешний id из фида) — для дедупликации повторных импортов.

---

## 2. Архитектура решения

```
┌─────────────────────────────────────────────────────────────┐
│  Браузер (клиент)                                            │
│  app/new-match/page.tsx                                      │
│    └─ <ImportFromFeedDialog>  ← новый компонент-мастер       │
│         step 1: платформа → step 2: турнир → step 3: матч/игроки
└───────────────────────────┬─────────────────────────────────┘
                            │ fetch /api/dy/*  (наш бэкенд)
┌───────────────────────────▼─────────────────────────────────┐
│  Next.js route handlers  app/api/dy/route.ts                 │
│  серверный прокси → tennispadel.double-yellow.be             │
│  (обходит CORS, кэширует, валидирует хост)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ GET (без авторизации)
┌───────────────────────────▼─────────────────────────────────┐
│  tennispadel.double-yellow.be                                │
│  /feed/feeds.php → /feed/inc/feeds.*.json → /{prov}/{id}/...  │
└──────────────────────────────────────────────────────────────┘
```

**Почему прокси, а не прямой fetch из браузера:** double-yellow.be — сторонний сервис,
CORS-заголовки не гарантированы; плюс прокси даёт нам кэш, единый таймаут и нормализацию.

---

## 3. Новые файлы (полный список)

```
lib/dy/
  dy-types.ts          — TypeScript-типы фидов
  dy-config.ts         — базовый URL, белый список путей, настройки фильтра дат
  dy-client.ts         — клиентские функции: дергают /api/dy/* и нормализуют ответ
  dy-normalize.ts      — нормализация: даты, группировка по странам, парсинг пар (slash)
  dy-import.ts         — импорт игроков из фида в локальное хранилище (дедуп по dyId/имени)

app/api/dy/
  route.ts             — серверный прокси-роут (один универсальный GET)

components/feed-import/
  import-from-feed-dialog.tsx   — корневой мастер (Dialog + шаги)
  step-select-platform.tsx      — шаг 1: список типов фидов (платформы)
  step-select-tournament.tsx    — шаг 2: турниры/лиги, группировка по странам
  step-select-match.tsx         — шаг 3a: категория → матч
  step-select-players.tsx       — шаг 3b: категория → игроки (мультивыбор)
  feed-platform-card.tsx        — карточка платформы (иконка base64, цвета BGColor/TextColor)
  feed-tournament-item.tsx      — строка турнира (Name, страна, даты, бейдж "идёт сейчас")
```

**Изменяемые файлы:**
```
app/new-match/page.tsx   — кнопка "Импорт из турнира" + обработка результата мастера
lib/player-storage.ts    — поддержка поля dyId (необязательно, не ломает старое)
lib/translations.ts      — новые ключи раздела feedImport (ru/en/uk)
```

---

## 4. Слой данных

### 4.1 `lib/dy/dy-config.ts`

```ts
export const DY_BASE = "https://tennispadel.double-yellow.be"

// Какой Sequence использовать как основной список платформ
export const DY_SEQUENCE_KEY = "Sequence-TennisPadel"

// Фильтр турниров по датам (аналог настроек Android-приложения)
export const DY_FILTER = {
  wasBusyDaysBack: 3,      // турнир закончился не более N дней назад
  willStartDaysAhead: 30,  // начнётся не позже чем через N дней
  maxDurationDays: 30,     // для НЕ-лиг: отбросить турниры длиннее N дней
}

// Разрешённый хост для прокси (защита от SSRF)
export const DY_ALLOWED_HOST = "tennispadel.double-yellow.be"
```

### 4.2 `lib/dy/dy-types.ts`

```ts
/** Корневой ответ /feed/feeds.php */
export interface DyFeedsRoot {
  FeedMetaData: DyFeedMetaData
  [typeKeyOrUrl: string]: unknown   // "<type>" массив | "<type>.URL" строка
}

export interface DyFeedMetaData {
  [k: string]: unknown              // Sequence-*, а также объекты-описания типов
}

/** Описание одного типа фида (платформы) в FeedMetaData */
export interface DyFeedType {
  key: string                       // напр. "rankedin.tennis.tournament"
  displayName: string               // локализованный DisplayName
  shortDescription?: string
  imageBase64?: string              // FeedKeys.Image — PNG base64
  imageUrl?: string
  bgColor: string                   // "#FFFFFF"
  textColor: string                 // "#000000"
  subFeedUrl?: string               // значение "<key>.URL"
  embedded?: DyTournament[]         // встроенный массив, если ".URL" нет
  isLeague: boolean                 // ключ содержит "league"
}

/** Турнир из под-фида inc/feeds.*.json */
export interface DyTournament {
  Name: string
  FeedMatches: string               // относительный путь
  FeedPlayers?: string
  ValidFrom?: string                // YYYY-MM-DD или YYYYMMDD
  ValidTo?: string
  Country?: string
  CountryCode?: string
  Region?: string
  Section?: string
  Organization?: string
}

/** Матч в ответе /{provider}/{id}/matches */
export interface DyMatch {
  id: number | string
  date: string                      // "YYYY-MM-DD" | "0001-01-01" (не назначен)
  time: string                      // "HH:MM" | "00:00"
  A: DySide
  B: DySide
  court?: string
  result?: string
  round?: string
  division?: string
}
export interface DySide { name: string; id: number | string }

/** Игрок в ответе /{provider}/{id}/players */
export interface DyPlayer { id: number | string; name: string }

/** Категории → элементы (и служебный config) */
export type DyMatchesResponse = Record<string, DyMatch[] | DyConfig>
export type DyPlayersResponse = Record<string, DyPlayer[]>
export interface DyConfig { [k: string]: unknown }
```

### 4.3 `app/api/dy/route.ts` — серверный прокси

Один универсальный GET. Принимает `?url=<полный URL>` ИЛИ `?path=<путь>`. Проверяет хост,
ставит таймаут, кэширует ответ в памяти процесса (Map с TTL), возвращает JSON как есть.

```ts
import { type NextRequest, NextResponse } from "next/server"
import { DY_BASE, DY_ALLOWED_HOST } from "@/lib/dy/dy-config"

const cache = new Map<string, { at: number; body: string }>()
const TTL_MS = 5 * 60 * 1000   // 5 минут (можно дифференцировать: список 60м, матчи 30м)

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")
  const path = req.nextUrl.searchParams.get("path")
  let target = raw ?? (path ? `${DY_BASE}/${path.replace(/^\//, "")}` : null)
  if (!target) return NextResponse.json({ error: "no url" }, { status: 400 })

  // достроить относительный путь фида (как prefixWithBaseIfRequired в Android)
  if (!/^https?:\/\//.test(target)) target = `${DY_BASE}/${target.replace(/^\//, "")}`

  let u: URL
  try { u = new URL(target) } catch { return NextResponse.json({ error: "bad url" }, { status: 400 }) }
  if (u.hostname !== DY_ALLOWED_HOST)               // защита от SSRF
    return NextResponse.json({ error: "host not allowed" }, { status: 403 })

  const hit = cache.get(u.href)
  if (hit && Date.now() - hit.at < TTL_MS)
    return new NextResponse(hit.body, { headers: { "content-type": "application/json" } })

  const ctrl = new AbortController()
  const tm = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(u.href, { signal: ctrl.signal })
    const text = await r.text()
    if (!r.ok) return NextResponse.json({ error: `upstream ${r.status}` }, { status: 502 })
    // лёгкая валидация: не HTML-ошибка
    if (/^\s*<(?:!doctype|html)/i.test(text) || text.includes("Undefined index"))
      return NextResponse.json({ error: "bad upstream content" }, { status: 502 })
    cache.set(u.href, { at: Date.now(), body: text })
    return new NextResponse(text, { headers: { "content-type": "application/json" } })
  } catch {
    return NextResponse.json({ error: "fetch failed/timeout" }, { status: 504 })
  } finally { clearTimeout(tm) }
}
```

### 4.4 `lib/dy/dy-client.ts` — клиентские функции

```ts
import { DY_SEQUENCE_KEY } from "./dy-config"
import type { DyFeedType, DyTournament, DyMatchesResponse, DyPlayersResponse } from "./dy-types"

const proxy = (urlOrPath: string) =>
  `/api/dy?url=${encodeURIComponent(urlOrPath)}`

async function getJson<T>(urlOrPath: string): Promise<T> {
  const r = await fetch(proxy(urlOrPath))
  if (!r.ok) throw new Error(`dy fetch ${r.status}`)
  return r.json() as Promise<T>
}

/** Шаг 1: список платформ (типов фидов) в порядке Sequence-TennisPadel */
export async function getPlatforms(): Promise<DyFeedType[]> {
  const root = await getJson<Record<string, any>>("/feed/feeds.php")
  const meta = root.FeedMetaData ?? {}
  const seq: string[] = meta[DY_SEQUENCE_KEY] ?? meta["Sequence"] ?? []
  const lang = "en" // или из языка приложения — DisplayName-<lang>
  return seq
    .filter((k) => k !== "FeedMetaData" && !k.startsWith("-"))
    .map((key) => {
      const d = meta[key] ?? {}
      return {
        key,
        displayName: d[`DisplayName-${lang}`] ?? d.DisplayName ?? key,
        shortDescription: d.ShortDescription,
        imageBase64: d.Image,
        imageUrl: d.ImageURL,
        bgColor: d.BGColor ?? "#FFFFFF",
        textColor: d.TextColor ?? "#000000",
        subFeedUrl: typeof root[`${key}.URL`] === "string" ? root[`${key}.URL`] : undefined,
        embedded: Array.isArray(root[key]) ? (root[key] as DyTournament[]) : undefined,
        isLeague: /league/i.test(key),
      } as DyFeedType
    })
    // только те, у кого есть откуда брать турниры
    .filter((p) => p.subFeedUrl || p.embedded)
}

/** Шаг 2: турниры выбранной платформы */
export async function getTournaments(platform: DyFeedType): Promise<DyTournament[]> {
  if (platform.subFeedUrl) return getJson<DyTournament[]>(platform.subFeedUrl)
  return platform.embedded ?? []
}

/** Шаг 3: матчи и игроки конкретного турнира */
export const getMatches = (t: DyTournament) => getJson<DyMatchesResponse>(t.FeedMatches)
export const getTournamentPlayers = (t: DyTournament) =>
  t.FeedPlayers ? getJson<DyPlayersResponse>(t.FeedPlayers) : Promise.resolve({})
```

### 4.5 `lib/dy/dy-normalize.ts` — нормализация

```ts
import { DY_FILTER } from "./dy-config"
import type { DyTournament, DyMatch } from "./dy-types"

/** Поддержать оба формата дат: 2026-05-18 и 20260518 */
export function parseDyDate(s?: string): Date | null {
  if (!s) return null
  const m1 = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  const m2 = /^(\d{4})(\d{2})(\d{2})$/.exec(s)
  const m = m1 ?? m2
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return d.getFullYear() < 2000 ? null : d   // "0001-01-01" → null
}

const dayDiff = (a: Date, b: Date) =>
  Math.round((a.getTime() - b.getTime()) / 86_400_000)

/** Фильтр "актуальные турниры" — как ShowFeedsAdapter в Android */
export function filterActiveTournaments(list: DyTournament[], isLeague: boolean): DyTournament[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return list.filter((t) => {
    const from = parseDyDate(t.ValidFrom)
    const to = parseDyDate(t.ValidTo) ?? from
    if (!from && !to) return true                      // нет дат — показываем
    const dTo = to ? dayDiff(to, today) : 0
    const dFrom = from ? dayDiff(from, today) : 0
    if (dTo < -DY_FILTER.wasBusyDaysBack) return false  // давно закончился
    if (dFrom > DY_FILTER.willStartDaysAhead) return false // слишком далеко в будущем
    if (!isLeague && from && to && dayDiff(to, from) > DY_FILTER.maxDurationDays) return false
    return true
  })
}

/** Идёт ли турнир прямо сейчас (для бейджа "* ") */
export function isRunningNow(t: DyTournament): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const from = parseDyDate(t.ValidFrom)
  const to = parseDyDate(t.ValidTo) ?? from
  return !!from && !!to && from <= today && today <= to
}

/** Группировка турниров по странам (внутри — по региону) */
export function groupByCountry(list: DyTournament[]): Record<string, DyTournament[]> {
  const groups: Record<string, DyTournament[]> = {}
  for (const t of list) {
    const key = t.Section || t.Country || "—"
    ;(groups[key] ??= []).push(t)
  }
  // турниры "идут сейчас" — наверх
  for (const k of Object.keys(groups))
    groups[k].sort((a, b) => Number(isRunningNow(b)) - Number(isRunningNow(a)))
  return groups
}

/** Категории матчей (ключи верхнего уровня кроме "config") */
export const matchCategories = (resp: Record<string, unknown>) =>
  Object.keys(resp).filter((k) => k !== "config" && Array.isArray(resp[k]))

/** Раскладка стороны матча в игроков: учитываем парный разряд (slash) */
export function splitSide(side: { name: string; id: number | string }) {
  const names = String(side.name).split("/").map((s) => s.trim()).filter(Boolean)
  const ids = String(side.id).split("/").map((s) => s.trim()).filter(Boolean)
  return names.map((name, i) => ({ name, dyId: ids[i] ?? ids[0] ?? "" }))
}
```

### 4.6 `lib/dy/dy-import.ts` — импорт игроков в локальное хранилище

```ts
import { v4 as uuidv4 } from "uuid"
import { getPlayers, addPlayer } from "@/lib/player-storage"

export interface ImportedPlayer { id: string; name: string }

/**
 * Гарантирует наличие игрока в локальном пуле.
 * Дедуп: сначала по dyId, потом по имени (без регистра). Возвращает локальный id.
 */
export async function ensureLocalPlayer(feedPlayer: { name: string; dyId?: string }): Promise<ImportedPlayer> {
  const players = await getPlayers()
  const byDyId = feedPlayer.dyId
    ? players.find((p: any) => p.dyId && String(p.dyId) === String(feedPlayer.dyId))
    : undefined
  const byName = players.find(
    (p: any) => p.name.trim().toLowerCase() === feedPlayer.name.trim().toLowerCase(),
  )
  const existing = byDyId ?? byName
  if (existing) return { id: existing.id, name: existing.name }

  const newPlayer = { id: uuidv4(), name: feedPlayer.name.trim(), dyId: feedPlayer.dyId }
  await addPlayer(newPlayer)         // addPlayer уже пишет в localStorage + Supabase
  return { id: newPlayer.id, name: newPlayer.name }
}

/** Массовый импорт (для шага "выбрать игроков из турнира") */
export async function importPlayers(list: { name: string; dyId?: string }[]) {
  const result: ImportedPlayer[] = []
  for (const p of list) result.push(await ensureLocalPlayer(p))
  return result
}
```

> ⚠️ Чтобы `dyId` сохранялся в Supabase — добавить в таблицу `players` колонку
> `dy_id text` (nullable). Если менять схему БД нельзя — `dyId` можно хранить только в
> localStorage, дедуп тогда работает по имени. План это допускает (поле необязательное).

---

## 5. UI — мастер импорта (повторяет логику Android-приложения)

### 5.1 Корневой компонент `import-from-feed-dialog.tsx`

`Dialog` (или `Sheet` на мобильном) с конечным автоматом шагов:

```
type Step = "platform" | "tournament" | "mode" | "match" | "players"
```

Props:
```ts
interface ImportFromFeedDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** результат для режима "матч" — заполняет форму new-match */
  onPickMatch: (data: {
    teamA: ImportedPlayer[]   // 1–2 игрока
    teamB: ImportedPlayer[]
    format: "singles" | "doubles"
    round?: string            // из category/round, если распознали
    court?: string
    sourceMatchId: string     // dy id матча — сохранить в match для связи
    tournamentName: string
  }) => void
  /** результат для режима "игроки" — просто добавлены в пул */
  onImportPlayers?: (players: ImportedPlayer[]) => void
}
```

Внутреннее состояние: `step`, `platform`, `tournament`, `category`, `loading`, `error`,
`search`.  Кнопка "Назад" возвращает на предыдущий шаг (как `onBackPressed` в Android).

### 5.2 Шаг 1 — `step-select-platform.tsx`  («выбор платформы»)

- Вызывает `getPlatforms()`.
- Рисует сетку карточек `feed-platform-card` — иконка (`<img src={"data:image/png;base64,"+imageBase64}>`),
  `displayName`, фон `bgColor`, текст `textColor`.
- Лиги визуально помечаются бейджем "Лига" (`isLeague`).
- Клик → `onSelect(platform)` → шаг 2.
- Состояния: `Skeleton` при загрузке, `Alert` при ошибке, кнопка "Обновить".

### 5.3 Шаг 2 — `step-select-tournament.tsx`  («турниры по странам»)

- `getTournaments(platform)` → `filterActiveTournaments(list, platform.isLeague)` →
  `groupByCountry(...)`.
- Рендер через `Accordion` (страна = группа, развёрнуты группы с активными турнирами).
- Каждый турнир — `feed-tournament-item`: `Name`, регион, диапазон дат
  (`ValidFrom – ValidTo`), бейдж **«идёт сейчас»** для `isRunningNow`.
- Поле поиска (`Input`) фильтрует по `Name`/`Country`/`Region`.
- Клик по турниру → шаг 3 (выбор режима).

### 5.4 Шаг 3 — выбор режима + категория

Экран "mode": две кнопки —
**«Выбрать матч»** (→ шаг `match`) и **«Выбрать игроков»** (→ шаг `players`).

Оба под-шага сначала грузят данные турнира:
- `match`: `getMatches(tournament)` → `matchCategories(resp)`.
- `players`: `getTournamentPlayers(tournament)` → ключи-категории.

Категории показываются списком (как «под-турниры» в Android). Выбор категории раскрывает
содержимое.

### 5.5 Шаг 3a — `step-select-match.tsx`

- Список матчей выбранной категории. Каждая строка:
  `A.name vs B.name`, `time`, `court` (если есть и `date != 0001-01-01`).
- Клик по матчу:
  1. `splitSide(match.A)` и `splitSide(match.B)` → списки `{name, dyId}`.
  2. Для каждого — `ensureLocalPlayer(...)` (создаёт игрока или находит существующего).
  3. `format = (teamA.length === 2 || teamB.length === 2) ? "doubles" : "singles"`.
  4. `onPickMatch({ teamA, teamB, format, court, sourceMatchId: String(match.id),
     tournamentName: tournament.Name })`.
  5. Закрыть диалог.

### 5.6 Шаг 3b — `step-select-players.tsx`

- Категория → список игроков `{id,name}` с чекбоксами (`Checkbox`), кнопка «Выбрать все».
- Кнопка «Импортировать» → `importPlayers(selected.map(p => ({name:p.name, dyId:String(p.id)})))`
  → `onImportPlayers(result)` → toast «Добавлено N игроков».

---

## 6. Интеграция в `app/new-match/page.tsx`

1. Импортировать `ImportFromFeedDialog` и состояние `const [feedOpen, setFeedOpen] = useState(false)`.
2. В блоке «Игроки» (рядом с полем «Добавить игрока», ~строка 698) добавить кнопку:
   ```tsx
   <Button variant="outline" onClick={() => setFeedOpen(true)}>
     <Download className="mr-2 h-4 w-4" />
     {t("feedImport.importFromTournament")}
   </Button>
   ```
3. Обработчик `onPickMatch`:
   ```tsx
   const handlePickMatch = (d) => {
     setMatchFormat(d.format)
     setTeamAPlayer1(d.teamA[0]?.id ?? "")
     setTeamAPlayer2(d.teamA[1]?.id ?? "")
     setTeamBPlayer1(d.teamB[0]?.id ?? "")
     setTeamBPlayer2(d.teamB[1]?.id ?? "")
     if (d.round) setMatchRound(d.round)
     // перечитать пул игроков, чтобы PlayerSelector увидел новых
     getPlayers().then((list) => { setPlayers(list); playersRef.current = list })
     showNotification(t("feedImport.matchLoaded"))
   }
   ```
4. Обработчик `onImportPlayers` — просто перечитать `getPlayers()` и показать toast
   (новые игроки сразу доступны в `PlayerSelector`).
5. (Опционально) В `handleCreateMatch`, в объект `match`, добавить связь с источником:
   ```ts
   source: feedSource ? { provider: "double-yellow", matchId: feedSource } : undefined,
   ```
   где `feedSource` — сохранённый `sourceMatchId`. Это понадобится, если позже
   захотите отправлять результаты обратно.
6. `<ImportFromFeedDialog open={feedOpen} onOpenChange={setFeedOpen}
     onPickMatch={handlePickMatch} onImportPlayers={() => getPlayers().then(setPlayers)} />`
   разместить в конце JSX.

> Точка входа также может быть на главной (`app/page.tsx`) рядом с «Управление игроками» —
> кнопка «Импорт из турнира», открывающая тот же диалог в режиме только игроков.

---

## 7. Локализация (`lib/translations.ts`)

Добавить в тип `TranslationKeys` и во все три словаря (`ru`/`en`/`uk`) раздел:

```ts
feedImport: {
  importFromTournament: "Импорт из турнира" / "Import from tournament" / "Імпорт з турніру",
  selectPlatform: "Выберите платформу",
  selectTournament: "Выберите турнир",
  selectLeague: "Выберите лигу",
  selectMode: "Что импортировать?",
  modeMatch: "Выбрать матч",
  modePlayers: "Выбрать игроков",
  selectCategory: "Выберите категорию",
  selectMatch: "Выберите матч",
  runningNow: "Идёт сейчас",
  league: "Лига",
  noTournaments: "Нет актуальных турниров",
  noMatches: "Нет матчей в этой категории",
  matchLoaded: "Матч загружен из турнира",
  playersImported: "Добавлено игроков: {count}",
  loadError: "Не удалось загрузить данные фида",
  refresh: "Обновить",
  back: "Назад",
  search: "Поиск...",
}
```

---

## 8. Нюансы и крайние случаи (обязательно учесть)

1. **Парный разряд.** Имя со слешем (`"Pier Mario A/Maurizio V"`) и `id` вида `"id1/id2"` —
   `splitSide()` разбивает на 2 игрока. Если в одной стороне 2, а в другой 1 — режим всё
   равно `doubles`, недостающего игрока оставить пустым.
2. **Дата не назначена.** `date: "0001-01-01"` / `time: "00:00"` — не показывать как реальную
   дату; в строке матча показывать только имена и корт.
3. **Форматы дат под-фида** — `YYYY-MM-DD` (Rankedin) и `YYYYMMDD` (TournamentSoftware);
   `parseDyDate()` понимает оба.
4. **`config` — не категория.** Везде, где перебираем ключи матчей/турнира, исключать `config`.
5. **Лиги.** Для платформ с `league` в ключе фильтр по длительности отключён (турниры-лиги
   идут месяцами) — это уже учтено в `filterActiveTournaments`.
6. **Дедупликация игроков.** Один и тот же игрок может прийти из разных турниров — дедуп по
   `dyId`, затем по имени. Иначе пул игроков замусорится.
7. **CORS / SSRF.** Запросы только через `/api/dy`; прокси проверяет, что хост ==
   `tennispadel.double-yellow.be`.
8. **Кэш.** Прокси кэширует в памяти (5 мин). При перезапуске dev-сервера кэш сбрасывается —
   это нормально. Для прод можно вынести TTL: список турниров 60 мин, матчи 30 мин
   (значения `KeepInCacheFor_*` есть в `FeedMetaData`).
9. **Большой `feeds.php`** (~500 КБ) — грузится один раз на открытие мастера; держать в
   состоянии диалога, не перезапрашивать между шагами.
10. **Пустые категории игроков** (`[]`) — состав ещё не опубликован; показать «—».
11. **Неофициальный API.** Сторонний сервис может измениться/упасть. Вся логика изолирована
    в `lib/dy/*` — при поломке чинится в одном месте; UItolerantно показывает `Alert` + «Обновить».
12. **SSR.** Все компоненты мастера — `"use client"`. Прокси-роут — серверный.
13. **uuid** уже в зависимостях (используется в `new-match`).

---

## 9. Поэтапный план работ (чеклист)

**Этап 1 — данные и прокси (бэкенд)**
- [ ] `lib/dy/dy-config.ts`, `dy-types.ts`
- [ ] `app/api/dy/route.ts` (прокси)
- [ ] `lib/dy/dy-client.ts`, `dy-normalize.ts`
- [ ] Проверка: открыть `/api/dy?url=/feed/feeds.php` в браузере — приходит JSON

**Этап 2 — импорт игроков**
- [ ] (опц.) колонка `dy_id` в таблице `players` Supabase
- [ ] `lib/dy/dy-import.ts`
- [ ] лёгкое расширение модели игрока полем `dyId` (player-storage не ломать)

**Этап 3 — UI-мастер**
- [ ] `import-from-feed-dialog.tsx` (автомат шагов)
- [ ] `step-select-platform.tsx` + `feed-platform-card.tsx`
- [ ] `step-select-tournament.tsx` + `feed-tournament-item.tsx`
- [ ] `step-select-match.tsx`
- [ ] `step-select-players.tsx`

**Этап 4 — интеграция**
- [ ] кнопка + обработчики в `app/new-match/page.tsx`
- [ ] (опц.) кнопка импорта игроков на `app/page.tsx`
- [ ] ключи `feedImport.*` в `lib/translations.ts` (ru/en/uk)

**Этап 5 — проверка**
- [ ] Платформа «Rankedin - Tennis Tournaments» → турнир → категория → матч → форма
      заполнена правильными игроками (включая пары)
- [ ] Платформа TournamentSoftware (GUID) — то же
- [ ] Импорт игроков: повторный импорт не создаёт дублей
- [ ] Лига — фильтр по длительности не режет турниры
- [ ] Ошибка сети — `Alert` + «Обновить», приложение не падает
- [ ] Существующий ручной сценарий создания матча не сломан

---

## 10. Сценарий пользователя (итог — как в Android-приложении)

```
new-match → кнопка «Импорт из турнира»
  → [Шаг 1] Платформа: Rankedin Tennis / TournamentSoftware Padel / Sporty HQ / …
  → [Шаг 2] Турниры по странам (Италия ▸ «IMAGNIFICI CUP 26», 16–18 мая, • идёт сейчас)
  → [Шаг 3] «Выбрать матч» или «Выбрать игроков»
       ├─ Матч:   категория «Doppio Maschile» → матч «Pier Mario A/Maurizio V vs …»
       │          → форма new-match заполняется 4 игроками, формат = doubles
       └─ Игроки: категория «Singolare Maschile» → отметить нужных → «Импортировать»
                  → игроки добавлены в общий пул, видны в PlayerSelector
```

Существующий функционал (ручное добавление игрока, ручной выбор в `PlayerSelector`,
настройки матча, выбор корта) остаётся без изменений — импорт лишь **предзаполняет** форму.

---

## 11. На будущее (вне текущего объёма)

- Отправка результатов обратно (`PostResult` + формат JSON счёта) — см. раздел 11
  `TEST_FEED_claude_best.md`. Для этого мы уже сохраняем `source.matchId` в матче.
- Кэш фидов в Supabase/Redis вместо памяти процесса.
- Свой серверный скрапер Rankedin/TournamentSoftware — полная независимость от double-yellow.be.
