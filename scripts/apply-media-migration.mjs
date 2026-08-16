// One-off runner that applies the media (ads) migration to the Supabase
// Postgres database. Idempotent — safe to run more than once.
//
//   node scripts/apply-media-migration.mjs
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import pg from "pg"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

function loadEnv(file) {
  const env = {}
  let text
  try {
    text = readFileSync(join(root, file), "utf8")
  } catch {
    return env
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let value = m[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[m[1]] = value
  }
  return env
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") }
const connectionString = env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL
if (!connectionString) {
  console.error("✗ POSTGRES_URL_NON_POOLING / POSTGRES_URL не найдены в .env.local")
  process.exit(1)
}

const migrationFile = "supabase/migrations/20260816_media.sql"
const sql = readFileSync(join(root, migrationFile), "utf8")

const cleanConnectionString = connectionString.replace(/[?&]sslmode=[^&]*/i, "")

const client = new pg.Client({
  connectionString: cleanConnectionString,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log("• Подключение к базе установлено")

  await client.query(sql)
  console.log(`• Миграция применена: ${migrationFile}`)

  const tables = ["media_items", "media_playlists", "media_playlist_items", "media_state", "club_settings"]
  for (const t of tables) {
    const r = await client.query(`SELECT to_regclass('public.${t}') AS reg`)
    console.log(`  ${t.padEnd(24)}: ${r.rows[0]?.reg ? "✓ есть" : "✗ отсутствует"}`)
  }
  const bucket = await client.query(`SELECT id, public FROM storage.buckets WHERE id = 'media'`)
  console.log(`  storage bucket media    : ${bucket.rowCount === 1 ? "✓ есть (public=" + bucket.rows[0].public + ")" : "✗ отсутствует"}`)
  const pub = await client.query(
    `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename LIKE 'media%'`,
  )
  console.log(`  realtime media tables   : ${pub.rowCount} шт (${pub.rows.map((r) => r.tablename).join(", ")})`)
  const settings = await client.query(`SELECT value FROM club_settings WHERE key = 'media'`)
  console.log(`  club_settings.media     : ${settings.rowCount === 1 ? "✓ есть" : "✗ отсутствует"}`)
} catch (err) {
  console.error("✗ Ошибка применения миграции:", err.message)
  process.exit(1)
} finally {
  await client.end()
}
