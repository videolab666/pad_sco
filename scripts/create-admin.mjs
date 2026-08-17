#!/usr/bin/env node
// Создаёт учётную запись персонала клуба (Supabase Auth) и членство
// с ролью. Первый запуск — owner; дальше менеджер может выпускать
// приглашания из UI (пока — этим же скриптом).
//
//   node scripts/create-admin.mjs <email> <password> [role]
//   role: owner (по умолчанию) | manager | referee | coach | viewer
//
// Использует Admin API (service key) + REST для club_memberships.
// Первый созданный пользователь получает membership в default club.

import { readFileSync } from "node:fs"

const [email, password, roleArg] = process.argv.slice(2)
if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password> [owner|manager|referee|coach|viewer]")
  process.exit(1)
}
const role = roleArg ?? "owner"
if (!["owner", "manager", "referee", "coach", "viewer"].includes(role)) {
  console.error(`Неизвестная роль: ${role}`)
  process.exit(1)
}
if (password.length < 8) {
  console.error("Пароль должен быть не короче 8 символов")
  process.exit(1)
}

const env = {}
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "")
}
const base = (env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? "").replace(/\/+$/, "")
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!base || !serviceKey) {
  console.error("create-admin: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY не найдены в .env.local")
  process.exit(1)
}

const adminHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
}

// 1. Пользователь (email_confirm=true — вход сразу, без писем).
let userId = null
const existing = await fetch(`${base}/auth/v1/admin/users?per_page=1000`, {
  headers: adminHeaders,
}).then((r) => r.json())
const match = (existing?.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase())

if (match) {
  userId = match.id
  console.log(`create-admin: пользователь ${email} уже существует (${userId})`)
} else {
  const created = await fetch(`${base}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  }).then((r) => r.json())
  if (created?.id) {
    userId = created.id
    console.log(`create-admin: создан пользователь ${email} (${userId})`)
  } else {
    console.error("create-admin: ошибка создания пользователя:", created?.msg ?? created)
    process.exit(1)
  }
}

// 2. Default club.
const clubs = await fetch(`${base}/rest/v1/clubs?select=id&limit=1`, { headers: adminHeaders })
  .then((r) => r.json())
if (!Array.isArray(clubs) || clubs.length === 0) {
  console.error("create-admin: клубы не найдены — откройте /settings (создастся default club)")
  process.exit(1)
}
const clubId = clubs[0].id

// 3. Членство (upsert).
const membership = await fetch(`${base}/rest/v1/club_memberships?on_conflict=user_id,club_id`, {
  method: "POST",
  headers: { ...adminHeaders, Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify([{ user_id: userId, club_id: clubId, role }]),
}).then((r) => r.json())

if (Array.isArray(membership) && membership.length > 0) {
  console.log(`create-admin: готово — ${email} → role=${role}, club=${clubId}`)
  console.log("Вход: /login")
} else {
  console.error("create-admin: ошибка членства:", membership?.message ?? membership)
  process.exit(1)
}
