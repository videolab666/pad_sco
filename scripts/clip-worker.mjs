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

    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "concat", "-safe", "0",
      "-ss", (clip.inMs / 1000).toFixed(3),
      "-i", listPath,
      "-to", ((clip.outMs - clip.inMs) / 1000).toFixed(3),
      "-c", "copy", "-movflags", "+faststart",
      mp4Path,
    ])
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

async function tick() {
  const { clips } = await apiGet("/api/video/clips?status=pending")
  for (const clip of clips ?? []) {
    await processClip(clip)
  }
  return (clips ?? []).length
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
