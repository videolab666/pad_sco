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
