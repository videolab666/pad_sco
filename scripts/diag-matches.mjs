// Diagnostic: inspect matches in the database.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import pg from "pg"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = {}
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}
const cs = (env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL).replace(/[?&]sslmode=[^&]*/i, "")
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  const count = await client.query("SELECT count(*)::int AS n FROM matches")
  console.log(`Всего матчей: ${count.rows[0].n}`)

  const recent = await client.query(
    "SELECT id, court_number, is_completed, revision, created_at FROM matches ORDER BY created_at DESC LIMIT 10",
  )
  console.log("\nПоследние матчи:")
  for (const r of recent.rows) {
    console.log(`  ${r.id}  корт=${r.court_number}  завершён=${r.is_completed}  revision=${r.revision}`)
  }

  const target = await client.query(
    "SELECT id, court_number, is_completed, revision FROM matches WHERE id = $1",
    ["e50b7ead-5c95-4183-93e2-b674d05e10e0"],
  )
  console.log(`\nМатч e50b7ead-...: ${target.rowCount ? JSON.stringify(target.rows[0]) : "НЕ НАЙДЕН"}`)

  const court1 = await client.query("SELECT id, is_completed FROM matches WHERE court_number = 1")
  console.log(`Матчей на корте 1: ${court1.rowCount}`)
  for (const r of court1.rows) console.log(`  ${r.id}  завершён=${r.is_completed}`)

  const rls = await client.query(
    "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('matches','players','match_operations')",
  )
  console.log("\nRLS:")
  for (const r of rls.rows) console.log(`  ${r.relname}: rowsecurity=${r.relrowsecurity}`)
} catch (err) {
  console.error("Ошибка:", err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
