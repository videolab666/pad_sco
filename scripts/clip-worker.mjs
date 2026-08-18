#!/usr/bin/env node
// Clip-воркер (plan-4 §141, Sprint D): маркер → клип.
//
// Забирает pending-заявки из платформы (X-API-Key), склеивает перекрывающие
// fMP4-сегменты записи через concat-демуксер и вырезает диапазон маркера
// БЕЗ перекодирования (-c copy, keyframe-aware), делает миниатюру.
// Работает рядом с venue gateway (доступ к каталогу recordings/).
//
//   node scripts/clip-worker.mjs --once          # обработать всё pending и выйти
//   node scripts/clip-worker.mjs --interval 15   # поллинг каждые 15с
//
// Диапазон (in/out) уже посчитан платформой из pre/post-roll маркера (§138).

import { spawn } from "node:child_process"
import { readFileSync, readdirSync, mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs"
import { join, basename, resolve } from "node:path"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const api = flag("api", "http://localhost:3000")
const recordingsDir = flag("recordings", "video/recordings")
const clipsDir = flag("clips", "video/clips")
const intervalSec = Number(flag("interval", "0"))
const once = !intervalSec || args.includes("--once")

// API key из .env.local (воркер — машина, §101)
const env = {}
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "")
}
const apiKey = env.SCOREBOARD_API_KEY
if (!apiKey) {
  console.error("clip-worker: SCOREBOARD_API_KEY не найден в .env.local")
  process.exit(1)
}

const authHeaders = { "X-API-Key": apiKey, "Content-Type": "application/json" }

async function apiGet(path) {
  const res = await fetch(api + path, { headers: { "X-API-Key": apiKey } })
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`)
  return res.json()
}
async function apiPost(path, body) {
  const res = await fetch(api + path, { method: "POST", headers: authHeaders, body: JSON.stringify(body) })
  if (!res.ok && res.status !== 409) throw new Error(`POST ${path}: ${res.status} ${await res.text()}`)
  return res.ok ? res.json() : null
}
async function apiPatch(path, body) {
  const res = await fetch(api + path, { method: "PATCH", headers: authHeaders, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`PATCH ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

function runFfmpeg(ffmpegArgs) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ffmpegArgs)
    let err = ""
    p.stderr.on("data", (d) => (err += d))
    p.on("error", reject)
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err || `exit ${code}`))))
  })
}

/** Старт сегмента (мс от начала записи): имя-локальное-время vs startedAt. */
function segmentStartMs(fileName, recordingStartedMs) {
  const m = fileName.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})[_-](\d{1,6})\.mp4$/)
  if (!m) return null
  const [, Y, Mo, D, H, Mi, S, micro] = m
  const segMs = new Date(+Y, +Mo - 1, +D, +H, +Mi, +S, Math.floor(+micro.padEnd(6, "0") / 1000)).getTime()
  return segMs - recordingStartedMs
}

async function processClip(clip) {
  if (!clip.streamKey) throw new Error("у записи нет источника (stream_key)")
  await apiPatch(`/api/video/clips/${clip.id}`, { status: "processing" })

  try {
    const dir = join(recordingsDir, clip.streamKey)
    if (!existsSync(dir)) throw new Error(`каталог записи не найден: ${dir}`)

    // startedAt записи приходит в обогащении заявки (lib/clip-registry)
    const startedAtMs = Date.parse(clip.recordingStartedAt ?? "")
    if (!Number.isFinite(startedAtMs)) throw new Error("неизвестно время старта записи")

    const segments = readdirSync(dir)
      .filter((f) => f.endsWith(".mp4"))
      .map((name) => ({ name, startMs: segmentStartMs(name, startedAtMs) }))
      .filter((s) => s.startMs !== null)
      .sort((a, b) => a.startMs - b.startMs)

    const needed = segments.filter(
      (s) => s.startMs <= clip.outMs && s.startMs + 31_000 >= clip.inMs,
    )
    if (needed.length === 0) throw new Error("сегменты за диапазоном клипа не найдены")

    mkdirSync(clipsDir, { recursive: true })
    const listPath = join(clipsDir, `${clip.id}.concat.txt`)
    // Абсолютные пути: concat-демуксер резолвит относительные от файла-листа
    writeFileSync(
      listPath,
      "ffconcat version 1.0\n" +
        needed.map((s) => `file '${resolve(dir, s.name).replace(/'/g, "'\\''")}'`).join("\n") +
        "\n",
    )

    const mp4Name = `${clip.id}.mp4`
    const thumbName = `${clip.id}.jpg`
    const mp4Path = join(clipsDir, mp4Name)
    const thumbPath = join(clipsDir, thumbName)

    // §143: wide — stream copy; vertical — центр-кроп 9:16 с re-encode
    const baseArgs = [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "concat", "-safe", "0",
      "-ss", (clip.inMs / 1000).toFixed(3),
      "-i", listPath,
      "-to", ((clip.outMs - clip.inMs) / 1000).toFixed(3),
    ]
    const encodeArgs =
      clip.variant === "vertical"
        ? ["-vf", "crop=ih*9/16:ih,scale=1080:1920", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "copy"]
        : ["-c", "copy"]
    await runFfmpeg([...baseArgs, ...encodeArgs, "-movflags", "+faststart", mp4Path])
    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", "0.5", "-i", mp4Path,
      "-frames:v", "1", "-vf", "scale=640:-2",
      thumbPath,
    ])
    unlinkSync(listPath)

    await apiPatch(`/api/video/clips/${clip.id}`, {
      status: "ready",
      fileName: mp4Name,
      thumbName,
      durationMs: clip.outMs - clip.inMs,
    })
    console.log(`✓ клип ${clip.id.slice(0, 8)} готов: ${mp4Name} (${needed.length} сегм., ${((clip.outMs - clip.inMs) / 1000).toFixed(1)}с)`)
  } catch (err) {
    await apiPatch(`/api/video/clips/${clip.id}`, { status: "failed", error: String(err.message ?? err) }).catch(() => {})
    console.error(`✗ клип ${clip.id.slice(0, 8)}: ${err.message}`)
  }
}

/** §144: highlight-reel — топ-N маркеров по важности → вертикальные клипы → concat. */
async function processReel(reel) {
  await apiPatch(`/api/video/reels/${reel.id}`, { status: "processing" })
  try {
    // 1. Маркеры записи
    const { markers } = await apiGet(`/api/video/markers?recording=${reel.recordingSessionId}`)
    if (!markers?.length) throw new Error("у записи нет маркеров")

    // 2. Топ-N по важности (при равенстве — раньше по времени)
    const top = [...markers]
      .sort((a, b) => (b.importance ?? 1) - (a.importance ?? 1) || (a.videoPositionMs ?? 0) - (b.videoPositionMs ?? 0))
      .slice(0, Math.max(1, reel.topN ?? 5))

    // 3. Готовые вертикальные клипы по маркерам; недостающие — создать и обработать
    const { clips: existing } = await apiGet(`/api/video/clips?recording=${reel.recordingSessionId}`)
    const readyByKey = new Map(
      (existing ?? []).filter((c) => c.status === "ready" && c.variant === "vertical").map((c) => [c.markerId, c]),
    )

    const verticalFiles = []
    for (const m of top) {
      let clip = readyByKey.get(m.id)
      if (!clip) {
        const created = await apiPost(`/api/video/clips`, { markerId: m.id, variant: "vertical" })
        if (created?.clip) {
          // fresh-заявка без обогащения — дочитываем полным списком
          const { clips: refreshed } = await apiGet(`/api/video/clips?status=pending&recording=${reel.recordingSessionId}`)
          const fresh = (refreshed ?? []).find((c) => c.id === created.clip.id)
          if (fresh) await processClip(fresh)
          const { clips: nowReady } = await apiGet(`/api/video/clips?recording=${reel.recordingSessionId}`)
          clip = (nowReady ?? []).find((c) => c.id === created.clip.id && c.status === "ready")
        }
      }
      if (!clip?.fileName) throw new Error(`не удалось получить вертикальный клип для маркера ${m.id}`)
      verticalFiles.push(resolve(clipsDir, clip.fileName))
    }

    // 4. concat вертикальных клипов (одинаковые параметры кодирования → copy)
    mkdirSync(clipsDir, { recursive: true })
    const listPath = join(clipsDir, `${reel.id}.concat.txt`)
    writeFileSync(
      listPath,
      "ffconcat version 1.0\n" + verticalFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n",
    )
    const mp4Name = `${reel.id}.mp4`
    const thumbName = `${reel.id}.jpg`
    const mp4Path = join(clipsDir, mp4Name)
    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "concat", "-safe", "0",
      "-i", listPath,
      "-c", "copy", "-movflags", "+faststart",
      mp4Path,
    ])
    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", "0.5", "-i", mp4Path,
      "-frames:v", "1", "-vf", "scale=640:-2",
      join(clipsDir, thumbName),
    ])
    unlinkSync(listPath)

    const totalMs = await ffprobeDurationMs(mp4Path)
    await apiPatch(`/api/video/reels/${reel.id}`, {
      status: "ready",
      fileName: mp4Name,
      thumbName,
      durationMs: totalMs ?? 0,
    })
    console.log(`✓ reel ${reel.id.slice(0, 8)} готов: ${verticalFiles.length} моментов, ${(totalMs / 1000 || 0).toFixed(1)}с`)
  } catch (err) {
    await apiPatch(`/api/video/reels/${reel.id}`, { status: "failed", error: String(err.message ?? err) }).catch(() => {})
    console.error(`✗ reel ${reel.id.slice(0, 8)}: ${err.message}`)
  }
}

function ffprobeDurationMs(file) {
  return new Promise((resolve) => {
    const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])
    let out = ""
    p.stdout.on("data", (d) => (out += d))
    p.on("error", () => resolve(null))
    p.on("close", () => {
      const sec = Number.parseFloat(out.trim())
      resolve(Number.isFinite(sec) ? Math.round(sec * 1000) : null)
    })
  })
}

async function tick() {
  const { clips } = await apiGet("/api/video/clips?status=pending")
  for (const clip of clips ?? []) {
    await processClip(clip)
  }
  const { reels } = await apiGet("/api/video/reels?status=pending")
  for (const reel of reels ?? []) {
    await processReel(reel)
  }
  return (clips ?? []).length + (reels ?? []).length
}

// Основной цикл
if (once) {
  const n = await tick()
  console.log(`clip-worker: обработано ${n} заявок (--once)`)
} else {
  console.log(`clip-worker: поллинг каждые ${intervalSec}с → ${api}`)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick()
    } catch (err) {
      console.error(`tick: ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, intervalSec * 1000))
  }
}
