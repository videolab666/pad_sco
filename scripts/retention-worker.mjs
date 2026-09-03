#!/usr/bin/env node
// Retention-воркер (plan 2026-09-02, Task 5) — чистильщик видео-контура.
//
// Работает рядом с venue gateway (или где есть доступ к каталогам):
//   1. expired: ready-записи старше ретенции тарифа → статус expired
//      (файлы MediaMTX уже удалил своим recordDeleteAfter — мы метим БД);
//   2. watchdog: зависшие active-записи (старт > MAX часов) → failed
//      + гасим override в MediaMTX;
//   3. orphan-override: MediaMTX пишет путь, а active-записи в БД нет
//      (платформа падала между start/stop) → выключаем;
//   4. clips: файлы клипов старше CLIP_DAYS (90) удаляем;
//   5. stats: лог адопшена — записей/день, ГБ по кортам.
//
//   node scripts/retention-worker.mjs --once
//   node scripts/retention-worker.mjs --interval 3600   # cron внутри
//
// Cron на VPS:  0 * * * *  cd /opt/padel && node scripts/retention-worker.mjs --once

import { createClient } from "@supabase/supabase-js"
import { readdirSync, statSync, unlinkSync, existsSync } from "node:fs"
import { join } from "node:path"
import { readFileSync } from "node:fs"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const env = {}
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "")
  }
}

const supabaseUrl = env.SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error("retention-worker: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не найдены (.env.local)")
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

const mtxBase = flag("mtx", env.MEDIAMTX_CONTROL_URL ?? "http://127.0.0.1:9997").replace(/\/$/, "")
const recordingsDir = flag("recordings", "video/recordings")
const clipsDir = flag("clips", "video/clips")
const maxRecordingHours = Number(flag("max-hours", "3"))
const clipDays = Number(flag("clip-days", "90"))
const fallbackRetentionDays = Number(flag("retention-days", "7"))
const intervalSec = Number(flag("interval", "0"))
const once = !intervalSec || args.includes("--once")

const ACTIVE_STATUSES = ["arming", "recording", "finalizing", "uploading"]

// ── MediaMTX Control API (глагольные сегменты, см. lib/mediamtx-client.ts) ──
async function mtxListRecordingPaths() {
  const res = await fetch(`${mtxBase}/v3/config/paths/list`)
  if (!res.ok) throw new Error(`paths/list: ${res.status}`)
  const body = await res.json()
  const items = Array.isArray(body) ? body : (body.items ?? [])
  return items.filter((p) => p.record === true).map((p) => String(p.name))
}

async function mtxDisableRecording(name) {
  const res = await fetch(`${mtxBase}/v3/config/paths/delete/${encodeURIComponent(name)}`, {
    method: "DELETE",
  })
  if (!res.ok && res.status !== 404) throw new Error(`paths/delete/${name}: ${res.status}`)
}

// ── 1. expired: ready → expired по ретенции тарифа ──────────────────────────
async function expireReadyRecordings() {
  const { data, error } = await supabase
    .from("recording_sessions")
    .select("id, ended_at, metadata")
    .eq("status", "ready")
    .not("ended_at", "is", null)
    .limit(500)
  if (error) throw new Error(`expired select: ${error.message}`)

  const now = Date.now()
  let expired = 0
  for (const rec of data ?? []) {
    const days = Number(rec.metadata?.retentionDays) || fallbackRetentionDays
    const deadline = Date.parse(rec.ended_at) + days * 86_400_000
    if (deadline < now) {
      const { error: upd } = await supabase
        .from("recording_sessions")
        .update({ status: "expired" })
        .eq("id", rec.id)
      if (upd) {
        console.warn(`retention-worker: expired ${rec.id}: ${upd.message}`)
        continue
      }
      expired++
    }
  }
  if (expired > 0) console.log(`retention-worker: expired → ${expired} запис(ей) по ретенции`)
  return expired
}

// ── 2. watchdog: зависшие active-записи ─────────────────────────────────────
async function failStaleActive() {
  const deadline = new Date(Date.now() - maxRecordingHours * 3_600_000).toISOString()
  const { data, error } = await supabase
    .from("recording_sessions")
    .select("id, started_at, metadata")
    .in("status", ACTIVE_STATUSES)
    .lt("started_at", deadline)
    .limit(100)
  if (error) throw new Error(`watchdog select: ${error.message}`)

  let failed = 0
  for (const rec of data ?? []) {
    const streamKey = rec.metadata?.streamKey
    if (streamKey) {
      try {
        await mtxDisableRecording(streamKey)
      } catch (err) {
        console.warn(`retention-worker: watchdog override ${streamKey}: ${err.message}`)
      }
    }
    const { error: upd } = await supabase
      .from("recording_sessions")
      .update({ status: "failed", ended_at: new Date().toISOString() })
      .eq("id", rec.id)
    if (upd) console.warn(`retention-worker: watchdog ${rec.id}: ${upd.message}`)
    else failed++
  }
  if (failed > 0) console.log(`retention-worker: watchdog → ${failed} зависш(их) записей failed`)
  return failed
}

// ── 3. orphan-override: gateway пишет, БД не знает ──────────────────────────
async function disableOrphanOverrides() {
  const { data, error } = await supabase
    .from("recording_sessions")
    .select("metadata")
    .eq("status", "recording")
    .limit(200)
  if (error) throw new Error(`orphan select: ${error.message}`)

  const active = new Set(
    (data ?? [])
      .map((r) => r.metadata?.streamKey)
      .filter((k) => typeof k === "string"),
  )

  let disabled = 0
  try {
    for (const path of await mtxListRecordingPaths()) {
      if (!active.has(path)) {
        await mtxDisableRecording(path)
        disabled++
        console.log(`retention-worker: orphan override выключен: ${path}`)
      }
    }
  } catch (err) {
    console.warn(`retention-worker: MediaMTX недоступен (${err.message}) — orphan-проход пропущен`)
  }
  return disabled
}

// ── 4. clips: файлы старше clipDays ─────────────────────────────────────────
function cleanOldClips() {
  if (!existsSync(clipsDir)) return 0
  const deadline = Date.now() - clipDays * 86_400_000
  let removed = 0
  for (const entry of readdirSync(clipsDir)) {
    const full = join(clipsDir, entry)
    try {
      if (statSync(full).mtimeMs < deadline) {
        unlinkSync(full)
        removed++
      }
    } catch {
      /* гонка с clip-worker — пропускаем */
    }
  }
  if (removed > 0) console.log(`retention-worker: клипов удалено по возрасту: ${removed}`)
  return removed
}

// ── 5. stats: адопшен и диск ────────────────────────────────────────────────
async function logStats() {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await supabase
    .from("recording_sessions")
    .select("id", { count: "exact", head: true })
    .gte("started_at", dayAgo)
  const gbByCourt = []
  if (existsSync(recordingsDir)) {
    for (const court of readdirSync(recordingsDir)) {
      const dir = join(recordingsDir, court)
      try {
        let bytes = 0
        for (const f of readdirSync(dir)) bytes += statSync(join(dir, f)).size
        gbByCourt.push(`${court}=${(bytes / 1e9).toFixed(1)}GB`)
      } catch {
        /* пусто/гонка */
      }
    }
  }
  console.log(`retention-worker: за сутки записей=${count ?? "?"}; диск: ${gbByCourt.join(" ") || "—"}`)
}

async function runPass() {
  try {
    await expireReadyRecordings()
    await failStaleActive()
    await disableOrphanOverrides()
    cleanOldClips()
    await logStats()
  } catch (err) {
    console.error(`retention-worker: проход упал: ${err.message}`)
    if (once) process.exitCode = 1
  }
}

await runPass()
if (!once) {
  setInterval(() => void runPass(), intervalSec * 1000)
  console.log(`retention-worker: цикл каждые ${intervalSec}с (Ctrl+C — выход)`)
}
