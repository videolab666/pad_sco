#!/usr/bin/env node
// Применяет SQL-файл из supabase/migrations напрямую к Postgres
// (POSTGRES_URL из .env.local). Supabase CLI здесь не используется —
// проект живёт без него, а exec_sql в БД нет.
//
//   node scripts/apply-migration.mjs supabase/migrations/<file>.sql
//
// Идемпотентен настолько, насколько идемпотентен сам SQL (наши миграции
// пишутся в CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

import pg from "pg"
import { readFileSync } from "node:fs"

const file = process.argv[2]
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <migration.sql>")
  process.exit(1)
}

// Читаем env вручную (без dotenv-зависимости).
const env = {}
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "")
}
const connectionString = env.POSTGRES_URL
if (!connectionString) {
  console.error("apply-migration: POSTGRES_URL не найден в .env.local")
  process.exit(1)
}

const sql = readFileSync(file, "utf8")
// sslmode=require в URL новые версии pg трактуют как verify-full — на
// машинах за корпоративным прокси цепочка не проходит. Для dev-скрипта
// убираем sslmode из строки и ослабляем проверку явно.
const parsedUrl = new URL(connectionString)
parsedUrl.searchParams.delete("sslmode")
const client = new pg.Client({
  connectionString: parsedUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log(`apply-migration: применяю ${file} …`)
  await client.query(sql)
  console.log("apply-migration: OK")
} catch (err) {
  console.error(`apply-migration: ошибка: ${err.message}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
