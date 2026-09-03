# Padel Venue Gateway — видео-хаб клуба (Шаг «Video», plan-4 §126/§129+)

MediaMTX — один бинарник: принимает SRT-потоки с камер-телефонов
(Court Camera Agent, Sprint A), пишет запись сегментами на диск, раздаёт
HLS/WebRTC для просмотра и отдаёт VOD через playback API. Никакого
собственного медиасервера мы не пишем (§216: «media server — не писать»).

Пути потоков именуем по кортам: `court-3-main`, `court-centre-main`.

---

## A. Эта Windows-машина (разработка / PoC — Sprint A/B)

Нужен только бинарник (Docker не обязателен):

```bash
# 1) скачать (имя ассета содержит версию!):
#    https://github.com/bluenviron/mediamtx/releases
#    asset: mediamtx_v{ВЕРСИЯ}_windows_amd64.zip  (протестировано v1.20.0)
curl -L -o mediamtx.zip \
  https://github.com/bluenviron/mediamtx/releases/download/v1.20.0/mediamtx_v1.20.0_windows_amd64.zip
unzip mediamtx.zip mediamtx.exe

# 2) запустить с конфигом клуба
./mediamtx.exe video/mediamtx.yml
```

Проверка (из другого терминала):

```bash
curl http://localhost:9997/v3/paths/list   # API жив
```

Тестовый поток без камеры (FFmpeg уже установлен на этой машине):

```bash
ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=25 \
  -f lavfi -i sine=frequency=440 \
  -c:v libx264 -preset veryfast -b:v 2M -c:a aac \
  -f mpegts "srt://localhost:8890?streamid=publish:court-1-main"
```

- Просмотр HLS: http://localhost:8888/court-1-main
- Просмотр WebRTC: http://localhost:8889/court-1-main
- Запись: `video/recordings/court-1-main/*.mp4` (сегменты по 30 c)
- VOD-список: http://localhost:9996/list?path=court-1-main

С телефона (будущий Camera Agent / любое SRT-приложение, например Larix
Broadcaster): endpoint `srt://<IP-машины>:8890`, streamid
`publish:court-1-main`.

## B. VPS (прод: раздача зрителям, клипы, VOD)

```bash
# Oracle A1 (arm64) или любая Ubuntu; Docker + compose
docker compose -f video/docker-compose.yml up -d
```

Проверки те же, но с публичным IP. На VPS добавить в `mediamtx.yml`:
`webRTCAdditionalHosts: [<публичный IP или домен>]`.

### Выбор VPS

| Вариант | Пригодность |
|---|---|
| Oracle **Ampere A1** (Always Free: 4 OCPU, 24 ГБ) | ✅ рекомендуем: с запасом на все корты + FFmpeg-клипы (Sprint D) |
| Oracle **AMD Micro** (1/8 OCPU, 1 ГБ) | ⚠️ впритык: один прокси-поток 1080p переживёт, 4K-мастер и клипы — нет |
| Любой VPS 2 vCPU / 4 ГБ / 100 Мбит | ✅ достаточно для 4–6 кортов |

A1 бывает «Out of capacity» в популярных регионах — пробуйте соседний
регион или ловите слот. Все инструменты (MediaMTX, FFmpeg, Docker) имеют
arm64-сборки.

### Порты открыть ВЕЗДЕ (Security List облака + iptables самой VM)

Oracle-образы по умолчанию держат iptables закрытым — это частая ловушка:

```bash
sudo iptables -I INPUT -p udp --dport 8890 -j ACCEPT   # SRT с камер
sudo iptables -I INPUT -p tcp --dport 8888 -j ACCEPT   # HLS
sudo iptables -I INPUT -p tcp --dport 8889 -j ACCEPT   # WebRTC
sudo iptables -I INPUT -p udp --dport 8889 -j ACCEPT   # WebRTC ICE
sudo iptables -I INPUT -p tcp --dport 9996 -j ACCEPT   # playback
sudo iptables -I INPUT -p tcp --dport 9999 -j ACCEPT   # API (потом закроем)
```

Трафик: камера-мастер ~30–50 Мбит/с на корт (SRT). Входящий на VPS
бесплатный у Oracle (10 ТБ/мес исходящего — с запасом).

## C. Архитектура (куда это встраивается)

```text
OnePlus/OPPO Camera Agent (Sprint A) ──SRT──► MediaMTX (этот gateway)
                                              ├── сегменты на диск (§192)
                                              ├── HLS/WebRTC — просмотр
                                              └── playback API — VOD (§146)
Платформа (Supabase): video_sources / recording_sessions / video_markers
(миграция 20260818000000) — реестр камер, сессии записи и маркеры.
```

Бизнес-логика (Recording Session, markers, клипы) живёт в платформе и
подписывается на события матча; gateway — «глупый» транспорт (§128).

## D. QR-gated recording + ретенция (plan 2026-09-02)

Запись на диск стартует **только по решению платформы** (план
`docs/plans/2026-09-02-qr-gated-recording-retention-downloads.md`):
камера стримит всегда (live + heartbeat), но MediaMTX пишет только пока
активна `recording_session`. Платформа включает/выключает запись через
Control API (`lib/mediamtx-client.ts`, эндпоинты
`/v3/config/paths/{add|patch|delete|get}/{name}` — проверено на v1.20.0:
override применяется к активному стриму, pathDefaults наследуются).

Флоу игрока: QR `/c/{code}` → «Быстрая игра» (чекбокс «записать») или
кнопка на `/c/{code}/video` → `POST /api/v1/courts/{code}/recording`.
Автостоп — при завершении court-сессии. Скачивание —
`GET /api/v1/video/recordings/{id}/download` (прокси playback API,
`Content-Disposition: attachment`).

### Retention-воркер (cron на gateway-машине)

```bash
# раз в час: expired по ретенции тарифа, watchdog зависших (>3ч),
# orphan-override'ы в MediaMTX, клипы старше 90д, статистика диска
node scripts/retention-worker.mjs --once
# 0 * * * *  cd /opt/padel && node scripts/retention-worker.mjs --once
```

Файлы сегментов удаляет сам MediaMTX (`recordDeleteAfter` на override =
ретенции тарифа: Club 30д); воркер метит БД (`ready → expired`) и гасит
зависшее. Тариф клуба — `clubs.metadata.plan` (миграция
`20260902000000_add_clubs_metadata.sql`; v1 — руками, `club`/`pro`).

## E. Деплой на Storage VPS (DeluxHost STORAGE-3: 2 vCore / 4 ГБ / 2 ТБ HDD)

Железо: HDD справляется — вход 3 корта = 3 МБ/с последовательной записи,
fMP4-сегменты по 30 с; VOD-чтение ~1 МБ/с на зрителя. Порядок:

```bash
# 1) Домен: A-запись video.<club> → публичный IP VPS
# 2) На VPS (Ubuntu/Debian):
apt update && apt install -y docker.io docker-compose-plugin caddy || true
mkdir -p /opt/padel && cd /opt/padel
#    скопировать video/{mediamtx.yml,docker-compose.yml,Caddyfile} сюда
#    в Caddyfile заменить video.example.club на свой домен

# 3) HDD-том смонтирован (например, /mnt/storage) → каталог записей:
mkdir -p /mnt/storage/padel/recordings

# 4) Поднять gateway + Caddy (Let's Encrypt сам):
docker compose up -d

# 5) Firewall: наружу только 80/443 (TCP) и 8890/udp (SRT с камер);
#    всё остальное mediamtx слушает на 127.0.0.1 (см. docker-compose)
ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 8890/udp && ufw enable

# 6) Retention-воркер в cron (машина с доступом к Supabase и 9997):
#    0 * * * *  cd /opt/padel && node scripts/retention-worker.mjs --once
```

Env платформы для этого gateway:

```
GATEWAY_PUBLIC_URL=https://video.<club>     # HLS-ссылки для зрителей
PLAYBACK_PUBLIC_URL=https://video.<club>    # VOD через Caddy (443)
MEDIAMTX_CONTROL_URL=http://<vps-internal>:9997   # если платформа не на VPS
```

Камеры (Camera Agent): `gatewayHost = video.<club>` (или IP VPS), SRT-порт 8890.
Проверка: `curl https://video.<club>/court-XXX-main/index.m3u8` при живой камере.
