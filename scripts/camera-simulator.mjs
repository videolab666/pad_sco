#!/usr/bin/env node
// Эмулятор Court Camera Agent (Sprint A без телефона, plan-4 §164+/§194).
//
// Ведёт себя как будущий агент на OnePlus/OPPO:
//   1. публикует видео по SRT на venue gateway (mediamtx) в поток
//      court-{код}-{роль};
//   2. каждые 10 секунд шлёт heartbeat платформе (/api/v1/video/heartbeat):
//      статус + «здоровье» (fps/bitrate/температура) — §152.
//
// Использование (gateway и приложение должны быть запущены):
//   node scripts/camera-simulator.mjs --court 7dkrYGs
//   node scripts/camera-simulator.mjs --court 7dkrYGs --minutes 5 --fps 25 --bitrate 2000
//
// Код корта берётся из /settings → «Корты» (кнопка /c/XXXXXXX) или
// GET /api/v1/courts.

import { spawn } from "node:child_process"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const court = flag("court", "")
const role = flag("role", "main")
const minutes = Number(flag("minutes", "2"))
const gateway = flag("gateway", "localhost:8890")
const platform = flag("platform", "http://localhost:3000")
const fps = Number(flag("fps", "25"))
const bitrateKbps = Number(flag("bitrate", "1500"))
const width = flag("width", "1280")
const height = flag("height", "720")

if (!court) {
  console.error("Usage: node scripts/camera-simulator.mjs --court <shortCode> [--minutes N] [--role main]")
  console.error("Код корта: /settings → «Корты» (кнопка /c/XXXXXXX)")
  process.exit(1)
}

const streamKey = `court-${court}-${role}`
const heartbeatUrl = `${platform}/api/v1/video/heartbeat`

async function heartbeat(status, extra = {}) {
  const payload = {
    streamKey,
    status,
    name: `Simulator ${streamKey}`,
    health: {
      simulated: true,
      fps,
      bitrateKbps,
      batteryTempC: Math.round((35 + Math.random() * 4) * 10) / 10,
      droppedFrames: 0,
      ...extra,
    },
  }
  try {
    const res = await fetch(heartbeatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message ?? res.status)
    console.log(`[hb] ${status} ok (source ${data.source?.id?.slice(0, 8)}…)`)
  } catch (err) {
    console.error(`[hb] ${status} FAILED: ${err.message}`)
  }
}

const ffmpegArgs = [
  "-hide_banner", "-loglevel", "error",
  // -re: читать входы в реальном времени. lavfi-источники (testsrc2/sine)
  // без этого рендерятся так быстро, как успевает кодировщик (~10x), и
  // контент-время убегает от wall-clock — gateway рвёт поток по дрейфу.
  "-re",
  "-f", "lavfi", "-i", `testsrc2=size=${width}x${height}:rate=${fps}`,
  "-re",
  "-f", "lavfi", "-i", "sine=frequency=440",
  "-c:v", "libx264", "-preset", "veryfast", "-b:v", `${bitrateKbps}k`,
  "-g", String(fps * 2), // IDR каждые 2с — HLS-сегментация
  "-c:a", "aac", "-b:a", "96k",
  "-t", String(minutes * 60),
  "-f", "mpegts",
  `srt://${gateway}?streamid=publish:${streamKey}`,
]

console.log(`Камера-симулятор: ${streamKey}`)
console.log(`  поток → srt://${gateway} (${width}x${height}@${fps}, ${bitrateKbps}kbps, ${minutes} мин)`)
console.log(`  heartbeat → ${heartbeatUrl}`)
console.log(`  смотреть: http://localhost:8888/${streamKey}  (gateway HLS)`)

await heartbeat("online")
const ffmpeg = spawn("ffmpeg", ffmpegArgs, { stdio: ["ignore", "pipe", "pipe"] })
ffmpeg.stderr.on("data", (d) => process.stderr.write(`[ffmpeg] ${d}`))

let publishing = true
const hbTimer = setInterval(() => {
  if (publishing) void heartbeat("recording", { publishing: true })
}, 10_000)

const shutdown = async (code, signal) => {
  publishing = false
  clearInterval(hbTimer)
  ffmpeg.kill()
  console.log(`[ffmpeg] закрыт: code=${code ?? "null"} signal=${signal ?? "null"}`)
  await heartbeat("offline")
  process.exit(typeof code === "number" ? code : 0)
}
ffmpeg.on("close", (code, signal) => void shutdown(code, signal))
ffmpeg.on("error", (err) => console.error(`[ffmpeg] spawn error: ${err.code ?? err.message}`))
process.on("SIGINT", () => void shutdown(0, "SIGINT"))
