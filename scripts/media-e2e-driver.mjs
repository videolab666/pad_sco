// End-to-end driver for the media (ads) API: login, quota, presigned upload
// (real bytes to Storage), confirm, playlists with the bumper, trigger
// settings, manual show/hide and the public state endpoint the scoreboards
// poll. Cleans every row/object it created.
//
// Usage:  node scripts/media-e2e-driver.mjs   (server must be running on :3000)

import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

const env = {}
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "")
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const KEY = env.SCOREBOARD_API_KEY
const PASSWORD = env.SETTINGS_PASSWORD ?? "111"
const { createClient } = require("@supabase/supabase-js")
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const TEST_COURT = 9
let passed = 0
let failed = 0
const ok = (name, cond, extra = "") => {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name} ${extra}`)
  }
}

let cookie = ""
async function api(path, init = {}) {
  const headers = { "Content-Type": "application/json", ...(init.headers ?? {}) }
  if (cookie) headers.Cookie = cookie
  const r = await fetch(`${BASE}${path}`, { ...init, headers })
  const setCookie = r.headers.get("set-cookie")
  if (setCookie?.includes("settings_session=")) {
    cookie = setCookie.split(";")[0]
  }
  return { status: r.status, body: await r.json().catch(() => null) }
}
const authed = (extra = {}) => ({ "X-API-Key": KEY, ...extra })

// Tiny valid PNG (1x1 px) as a real upload payload.
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63f8cfc0f01f0005050201edb45cb60000000049454e44ae426082",
  "hex",
)

async function main() {
  console.log("== Setup: clean test rows ==")
  const oldItems = await sb.from("media_items").select("id, storage_path").like("title", "e2e-media-%")
  for (const it of oldItems.data ?? []) await sb.storage.from("media").remove([it.storage_path])
  await sb.from("media_items").delete().like("title", "e2e-media-%")
  await sb.from("media_playlists").delete().like("name", "e2e-playlist-%")
  await sb.from("media_state").delete().eq("court_number", TEST_COURT)

  console.log("== Auth ==")
  let r = await fetch(`${BASE}/api/media/library`)
  ok("library без авторизации → 401", r.status === 401)
  r = await api("/api/settings/login", { method: "POST", body: JSON.stringify({ password: "wrong" }) })
  ok("логин с неверным паролем → 401", r.status === 401)
  r = await api("/api/settings/login", { method: "POST", body: JSON.stringify({ password: PASSWORD }) })
  ok(`логин с паролем по умолчанию → 200 (cookie выдан)`, r.status === 200 && !!cookie)
  r = await api("/api/settings/login")
  ok("GET login распознал сессию", r.body?.authenticated === true)

  console.log("== Квота ==")
  const before = await api("/api/media/settings")
  ok("settings: триггеры и квота прочитаны", before.status === 200 && typeof before.body?.storageLimitBytes === "number")
  const triggersBefore = before.body.triggers

  console.log("== Upload flow (presigned) ==")
  r = await api("/api/media/upload-url", {
    method: "POST",
    body: JSON.stringify({ filename: "e2e-media-a.png", sizeBytes: PNG.length, mime: "image/png" }),
  })
  ok("upload-url выдал подписанный URL", r.status === 200 && !!r.body?.url, JSON.stringify(r.body))
  const { path: pathA, url: urlA } = r.body
  const put = await fetch(urlA, { method: "PUT", headers: { "Content-Type": "image/png" }, body: PNG })
  ok("PUT файла в Storage по подписи → 2xx", put.status >= 200 && put.status < 300, `status ${put.status}`)
  r = await api("/api/media/confirm", {
    method: "POST",
    body: JSON.stringify({
      path: pathA,
      title: "e2e-media-a",
      sizeBytes: PNG.length,
      mime: "image/png",
      durationSec: 7,
      width: 1,
      height: 1,
    }),
  })
  ok("confirm записал media_items", r.status === 200 && r.body?.item?.title === "e2e-media-a", JSON.stringify(r.body))
  const itemA = r.body.item
  ok("confirm вернул публичный URL", typeof itemA.url === "string" && itemA.url.includes("/object/public/media/"))
  const head = await fetch(itemA.url)
  ok("публичный URL отдаёт файл (bucket public)", head.status === 200)

  r = await api("/api/media/confirm", {
    method: "POST",
    body: JSON.stringify({ path: "ghost-file.png", sizeBytes: 1, mime: "image/png" }),
  })
  ok("confirm незагруженного пути → 400", r.status === 400)

  r = await api("/api/media/upload-url", {
    method: "POST",
    body: JSON.stringify({ filename: "bad.exe", sizeBytes: 10, mime: "application/octet-stream" }),
  })
  ok("upload-url с чужим mime → 400", r.status === 400)

  // Вторая картинка — для порядка в плейлисте.
  r = await api("/api/media/upload-url", {
    method: "POST",
    body: JSON.stringify({ filename: "e2e-media-b.png", sizeBytes: PNG.length, mime: "image/png" }),
  })
  await fetch(r.body.url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: PNG })
  r = await api("/api/media/confirm", {
    method: "POST",
    body: JSON.stringify({
      path: r.body.path,
      title: "e2e-media-b",
      sizeBytes: PNG.length,
      mime: "image/png",
      durationSec: null,
      width: 400,
      height: 800, // вертикальная
    }),
  })
  const itemB = r.body.item
  ok("второй файл загружен и помечен вертикальным", itemB?.id && itemB.height > itemB.width)

  console.log("== Items API ==")
  r = await api(`/api/media/items/${itemA.id}`, { method: "PATCH", body: JSON.stringify({ isActive: false }) })
  ok("PATCH deactivate", r.status === 200 && r.body.item.isActive === false)
  r = await api(`/api/media/items/${itemA.id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) })
  ok("PATCH activate обратно", r.status === 200 && r.body.item.isActive === true)

  console.log("== Плейлисты + виртуальный дубликат ==")
  r = await api("/api/media/playlists", { method: "POST", body: JSON.stringify({ name: "e2e-playlist-1" }) })
  ok("плейлист создан", r.status === 200 && !!r.body?.playlist?.id)
  const pl = r.body.playlist

  r = await api(`/api/media/playlists/${pl.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: "e2e-playlist-1",
      isDefault: false,
      bumper: { afterEveryN: 1, minIntervalSec: null, bumperItemId: itemB.id },
      items: [
        { itemId: itemA.id, durationSec: 5 },
        { itemId: itemB.id, durationSec: null },
      ],
    }),
  })
  ok("плейлист сохранён (items + bumper)", r.status === 200)

  r = await api("/api/media/playlists")
  const saved = r.body.playlists.find((p) => p.id === pl.id)
  ok("плейлист читается с порядком items", saved?.items?.length === 2 && saved.items[0].itemId === itemA.id)
  ok("bumper нормализован", saved?.bumper?.afterEveryN === 1 && saved?.bumper?.bumperItemId === itemB.id)

  console.log("== Триггеры (настройки) ==")
  r = await api("/api/media/settings", {
    method: "PATCH",
    body: JSON.stringify({
      triggers: { ...triggersBefore, noScoreMin: 1, perCourt: { [TEST_COURT]: { noScoreMin: 2 } } },
    }),
  })
  ok("PATCH triggers + perCourt", r.status === 200 && r.body.triggers.perCourt[String(TEST_COURT)]?.noScoreMin === 2)

  console.log("== Состояние корта (публичный GET + ручной show/hide) ==")
  r = await fetch(`${BASE}/api/media/state?court=${TEST_COURT}`)
  ok("публичный GET state работает без авторизации", r.status === 200)
  let state = await r.json()
  ok("state: триггеры корта разрешены с переопределением", state.triggers?.noScoreMin === 2)

  r = await api("/api/media/state", {
    method: "POST",
    headers: authed(),
    body: JSON.stringify({ court: TEST_COURT, action: "show", source: "remote", forcedUntilMin: 15 }),
  })
  ok("remote show → играем", r.status === 200 && r.body.isPlaying === true)

  r = await fetch(`${BASE}/api/media/state?court=${TEST_COURT}`)
  state = await r.json()
  ok("state: источник remote + forced_until", state.isPlaying === true && state.source === "remote" && !!state.forcedUntil)
  ok("state: плейлист не дефолтный → вся медиатека", Array.isArray(state.entries) && state.entries.length >= 2)

  r = await api("/api/media/state", { method: "POST", body: JSON.stringify({ court: TEST_COURT, action: "hide" }) })
  ok("cookie-сессии хватает для hide (без API-ключа)", r.status === 200)
  r = await fetch(`${BASE}/api/media/state?court=${TEST_COURT}`)
  state = await r.json()
  ok("state: скрыто, entries пустые", state.isPlaying === false && state.entries.length === 0)

  r = await fetch(`${BASE}/api/media/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ court: TEST_COURT, action: "show" }),
  })
  ok("POST state без авторизации → 401", r.status === 401)

  r = await api("/api/media/state", { method: "POST", body: JSON.stringify({ court: TEST_COURT, action: "show", playlistId: pl.id }) })
  ok("show с выбором плейлиста", r.status === 200)
  r = await fetch(`${BASE}/api/media/state?court=${TEST_COURT}`)
  state = await r.json()
  ok("state: играет выбранный плейлист c bumper-вставками", state.entries.length === 4 && state.entries.filter((e) => e.isBumper).length === 2)

  await api("/api/media/state", { method: "POST", body: JSON.stringify({ court: TEST_COURT, action: "hide" }) })

  console.log("== Расписание (ночные окна) ==")
  // always-окно на весь день (fromMin === toMin) с явным UTC — корт 9
  // держит завершённый матч → должен запуститься источник "schedule".
  // Кулдаун обнуляем, иначе предыдущий hide блокирует автостарт.
  r = await api("/api/media/settings", {
    method: "PATCH",
    body: JSON.stringify({
      triggers: {
        ...triggersBefore,
        cooldownAfterStopMin: 0,
        scheduleTzOffsetMin: 0,
        schedule: [{ name: "e2e-всегда", mode: "always", days: [], fromMin: 0, toMin: 0 }],
      },
    }),
  })
  ok("PATCH расписания (always, весь день, UTC)", r.status === 200 && r.body.triggers.schedule.length === 1)
  r = await fetch(`${BASE}/api/media/state?court=${TEST_COURT}`)
  state = await r.json()
  ok("always-окно само запустило показ (source=schedule)", state.isPlaying === true && state.source === "schedule" && state.entries.length >= 2)

  r = await api("/api/media/settings", {
    method: "PATCH",
    body: JSON.stringify({
      triggers: {
        ...triggersBefore,
        cooldownAfterStopMin: 0,
        scheduleTzOffsetMin: 0,
        schedule: [{ name: "e2e-запрет", mode: "deny", days: [], fromMin: 0, toMin: 0 }],
      },
    }),
  })
  r = await fetch(`${BASE}/api/media/state?court=${TEST_COURT}`)
  state = await r.json()
  ok("deny-окно погасило автосессию", state.isPlaying === false && state.entries.length === 0)

  console.log("== Фон-фото для вертикальных видео ==")
  r = await api(`/api/media/items/${itemB.id}`, { method: "PATCH", body: JSON.stringify({ bgItemId: itemA.id }) })
  ok("PATCH bgItemId назначил фон-фото", r.status === 200 && r.body.item.bgPath === itemA.storagePath)
  r = await api(`/api/media/items/${itemB.id}`, { method: "PATCH", body: JSON.stringify({ bgItemId: null }) })
  ok("PATCH bgItemId=null снял фон", r.status === 200 && r.body.item.bgPath === null)
  r = await api(`/api/media/items/${itemA.id}`, { method: "PATCH", body: JSON.stringify({ bgItemId: "00000000-0000-4000-8000-0000000000ff" }) })
  ok("несуществующий фон → 400", r.status === 400)

  console.log("== Восстановление настроек + очистка ==")
  await api("/api/media/settings", { method: "PATCH", body: JSON.stringify({ triggers: triggersBefore }) })
  await api(`/api/media/playlists/${pl.id}`, { method: "DELETE" })
  for (const id of [itemA.id, itemB.id]) await api(`/api/media/items/${id}`, { method: "DELETE" })
  await sb.from("media_state").delete().eq("court_number", TEST_COURT)
  r = await api("/api/media/library")
  const leftovers = (r.body.items ?? []).filter((i) => i.title.startsWith("e2e-media-"))
  ok("очистка: e2e-файлов не осталось", leftovers.length === 0)
  r = await api("/api/settings/login", { method: "DELETE" })
  ok("logout чистит cookie", r.status === 200)

  console.log(`\n== Итог: ${passed} passed, ${failed} failed ==`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error("driver crashed:", e)
  process.exit(1)
})
