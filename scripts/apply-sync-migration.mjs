// One-off runner that applies the Task 2 sync migration to the Supabase
// Postgres database. Idempotent — safe to run more than once.
//
//   node scripts/apply-sync-migration.mjs
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import pg from "pg"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

// ─── Load env (.env.local) ─────────────────────────────────────────────────────
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

const migrationFile = "supabase/migrations/20260516010000_add_match_revision_and_operations.sql"
const sql = readFileSync(join(root, migrationFile), "utf8")

// Strip any sslmode hint from the URL so our explicit ssl options take effect
// (Supabase serves a self-signed chain; we connect over TLS without verifying).
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

  // ─── Verification ────────────────────────────────────────────────────────────
  const col = await client.query(
    `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'matches' AND column_name = 'revision'`,
  )
  const tbl = await client.query(
    `SELECT to_regclass('public.match_operations') AS reg`,
  )
  const opIdx = await client.query(
    `SELECT indexname FROM pg_indexes WHERE indexname = 'match_operations_match_idx'`,
  )

  const okColumn = col.rowCount === 1
  const okTable = tbl.rows[0]?.reg !== null
  const okIndex = opIdx.rowCount === 1

  console.log(`  matches.revision         : ${okColumn ? "✓ есть (" + col.rows[0].data_type + ")" : "✗ отсутствует"}`)
  console.log(`  match_operations         : ${okTable ? "✓ есть" : "✗ отсутствует"}`)
  console.log(`  match_operations_idx     : ${okIndex ? "✓ есть" : "✗ отсутствует"}`)

  if (okColumn && okTable && okIndex) {
    console.log("✓ Миграция успешно применена и проверена")
  } else {
    console.error("✗ Проверка не пройдена — миграция применена не полностью")
    process.exit(1)
  }
} catch (err) {
  console.error("✗ Ошибка применения миграции:", err.message)
  process.exit(1)
} finally {
  await client.end()
}
