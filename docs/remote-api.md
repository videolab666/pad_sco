# Remote Control API — управление матчем по HTTP

Внешний «пульт» для матча: команды применяются **тем же движком**, что и клики
оператора на табло (инварианты тай-брейков, подачи, завершения и журнала
отмены соблюдаются автоматически). Результат применения мгновенно уходит на
все открытые страницы матча/табло через Supabase Realtime.

## Auth

Все мутирующие эндпоинты требуют заголовок с ключом из `.env.local`
(`SCOREBOARD_API_KEY`):

```
X-API-Key: <ключ>
```

Посмотреть ключ: `grep SCOREBOARD_API_KEY .env.local`

- `POST /api/match/[id]/command` — одна команда (ниже)
- `POST /api/match/[id]/commands` — **batch**: массив команд одной ревизией, атомарно
  (либо все применились, либо ничего; ошибка содержит индекс `batch[i]`;
  `{ operationId, commands: [{command, args}] }`, до 100 команд; идемпотентность — на уровне батча)
- `PUT  /api/match/[id]` — запись полного снапшота (тоже закрыт ключом)

Чтение (публичное, как раньше для vMix):

- `GET /api/match/[id]`, `/api/court/[n]`, `/api/vmix/[id]` — состояние матча
- `GET /api/matches?limit=20&court=5&active=true` — каталог матчей для драйвера:
  UUID, корт, статус, составы — чтобы не ходить в БД за идентификатором

Без ключа мутации — `401`.

## POST /api/match/[id]/command

`[id]` — **UUID матча** (не цифровой код: код живёт только в localStorage
создателя). UUID видно в истории/списке матчей или в таблице `matches`.

Тело:

```json
{ "operationId": "opc-0001", "command": "point", "args": { "team": "teamA" } }
```

- `operationId` (необязателен) — идемпотентность: повторный вызов с тем же id
  вернёт сохранённый результат, не применяя команду второй раз. Подходит любая
  строка ("point-17") — она детерминированно отображается в uuid журнала
  операций. Для тест-драйвера рекомендуется передавать всегда.
- Успех: `200 { status: "ok", idempotent: false, revision, match }` — `match`
  в camelCase, то же представление, что и в UI.
- Конфликт (параллельная запись): `409 { reason: "server_ahead", revision, match }` —
  в ответе авторитетный снапшот; драйвер ребейзится и повторяет команду.
- Ошибка команды: `400 { error, code }` (`invalid_args`, `match_completed`,
  `journal_diverged`, `nothing_to_undo`, `not_completed`, `unknown_command`…).
- `404` — матч не найден.

## Команды

| Команда | args | Что делает |
|---|---|---|
| `point` | `{ team: "teamA"\|"teamB" }` | очко (весь конвейер: гейм→сет→ТБ→завершение) |
| `undo-point` | — | отменить последнее действие (очко/правку/жребий) |
| `undo-game` | — | отменить текущий/предыдущий гейм целиком |
| `undo-set` | — | откат к незавершённому предыдущему сету |
| `adjust-game` | `{ teamA, teamB }`, значения `0..3` или `"Ad"` | точный счёт текущего гейма |
| `adjust-set` | `{ teamA, teamB }` — целые ≥0 | точный счёт геймов текущего сета |
| `set-server` | `{ team, playerIndex?: 0\|1 }` | кто подаёт |
| `set-set-scores` | `{ rows: [{ teamA, teamB }] }` | правка сетов (как карточка «Редактирование счета»); длина rows = завершённые сеты (+1, если матч жив) |
| `reopen-set` | `{ setIndex, score? }` | «Переиграть сет»: сет N (и всё позже) становится текущим с указанным счётом; 6-6 включает тай-брейк |
| `end-match` | `{ reason: "retired-injury"\|"conduct"\|"time-up", winner }` | досрочное завершение |
| `unlock-match` | — | разблокировать завершённый матч |
| `set-players` | `{ teamA?: { name?, players: string[] }, teamB?: … }` | имена/составы (id игроков стабильны по имени) |
| `set-rules` | `{ rules: { gamesPerSet?, tiebreakLength?, … } }` | патч правил (white-list ключей: sets, gamesPerSet, gamesPerSetOverrides, tiebreak*, finalSet*, scoringSystem, goldenPointFormat, goldenGame, windbreak, isSuperSet, superSet*, doublesServeSequence); живой счёт нормализуется, исход пересчитывается |
| `toss` | `{ winner, choice: "serve"\|"receive", teamOnLeft }` | жребий: подача и стороны |
| `assign-court` | `{ court: 1..50 \| null }` | назначить/снять корт |

## Примеры (curl)

```bash
BASE=http://localhost:3000/api/match/ID_МАТЧА
KEY=$(grep SCOREBOARD_API_KEY .env.local | cut -d= -f2)

# очко команде A
curl -s -X POST $BASE/command -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"operationId":"opc-1","command":"point","args":{"team":"teamA"}}'

# точный счёт текущего сета 5:5
curl -s -X POST $BASE/command -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"command":"adjust-set","args":{"teamA":5,"teamB":5}}'

# переиграть первый сет с исправленным счётом 6:6 (включит тай-брейк)
curl -s -X POST $BASE/command -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"command":"reopen-set","args":{"setIndex":0,"score":{"teamA":6,"teamB":6}}}'

# сменить состав
curl -s -X POST $BASE/command -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"command":"set-players","args":{"teamB":{"players":["Ivan Ivanov","Petr Petrov"]}}}'

# сверить результат (готовый JSON реального времени)
curl -s $BASE | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d)[0]))"
```

## Сценарий проверки подсчёта

1. Создайте матч (UI или через Supabase).
2. Драйвер шлёт последовательность команд (`point`, `adjust-*`, …) с уникальными `operationId`.
3. После каждой команды читайте `match` из ответа (или `GET /api/match/[id]`)
   и сверяйте ожидания — это e2e-проверка движка поверх HTTP.
4. При `409` — повторите команду с новым `operationId` (сервер отдал свежий снапшот).

Все команды попадают в журнал событий матча — панель истории в UI покажет их
как ручные операции, а `undo-*` может их отменить.

## Реклама на корте (media API)

Отдельный API для медиа-плейлистов (описание — `docs/media-ads.md`). Тот же
заголовок `X-API-Key`, база `…/api/media`:

```bash
# показать рекламу на корте 3 на 30 минут (например, игрок ушёл, корт простаивает)
curl -s -X POST $BASE_MEDIA/state -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"court":3,"action":"show","source":"remote","forcedUntilMin":30}'

# остановить показ
curl -s -X POST $BASE_MEDIA/state -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"court":3,"action":"hide"}'

# что сейчас на корте (публично, без ключа)
curl -s "$BASE_MEDIA/state?court=3"
```

`show` без `forcedUntilMin` держит показ до первого стоп-условия (очко, новый
матч — согласно настройкам триггеров клуба). Автотриггеры (простой, завершённый
матч, нет матча) сервер вычисляет сам на каждом публичном GET.
