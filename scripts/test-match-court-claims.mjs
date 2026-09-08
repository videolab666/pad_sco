// Exercises the migration against isolated tables in a disposable schema.
// Production matches/courts are never read or mutated. POSTGRES_URL is read
// from the existing local environment; credentials are never printed.
import pg from "pg"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"

const env = { ...process.env }
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/)
  if (match) env[match[1]] = match[2].trim().replace(/^"|"$/g, "")
}
if (!env.POSTGRES_URL) throw new Error("POSTGRES_URL is required")
const url = new URL(env.POSTGRES_URL)
if (process.argv.includes("--session-port")) url.port = "5432"
url.searchParams.delete("sslmode")
const options = { connectionString: url.toString(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000, statement_timeout: 10000 }
const schema = "sync_test_" + randomUUID().replaceAll("-", "")
if (!/^sync_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Invalid test schema")
const clients = [new pg.Client(options), new pg.Client(options)]
const [a, b] = clients
let schemaCreated = false
try {
  await Promise.all(clients.map(c => c.connect()))
  await a.query(`CREATE SCHEMA ${schema}`)
  schemaCreated = true
  await a.query(`CREATE TABLE ${schema}.courts(id uuid PRIMARY KEY, legacy_number integer UNIQUE);
    CREATE TABLE ${schema}.matches(id uuid PRIMARY KEY, court_id uuid, court_number integer,
      is_completed boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now(), revision integer DEFAULT 0)`)
  const court = randomUUID(), first = randomUUID(), second = randomUUID(), third = randomUUID()
  const dupA = randomUUID(), dupB = randomUUID()
  await a.query(`INSERT INTO ${schema}.courts VALUES ($1, 1)`, [court])
  await a.query(`INSERT INTO ${schema}.matches(id,court_number) VALUES ($1,2),($2,2)`, [dupA, dupB])
  let sql = readFileSync("supabase/migrations/20260907000000_match_court_claims.sql", "utf8")
  sql = sql.replaceAll("public.", schema + ".").replace("SET search_path = public", "SET search_path = " + schema)
  await a.query(sql)
  await a.query(`UPDATE ${schema}.matches SET court_number=court_number, revision=revision+1 WHERE id=$1`, [dupA])
  await assert.rejects(a.query(`INSERT INTO ${schema}.matches(id,court_number) VALUES ($1,2)`, [randomUUID()]), /court_occupied/)

  await a.query("BEGIN")
  await a.query(`INSERT INTO ${schema}.matches(id,court_number) VALUES ($1,1)`, [first])
  await b.query("BEGIN")
  // Both transactions reach the trigger before either knows about the other.
  const competitor = b.query(`INSERT INTO ${schema}.matches(id,court_id) VALUES ($1,$2)`, [second, court])
    .then(() => null, error => error)
  await a.query("COMMIT")
  const conflict = await competitor
  assert.match(conflict?.message ?? "", /court_occupied/)
  await b.query("ROLLBACK")
  const active = await a.query(`SELECT * FROM ${schema}.matches WHERE court_number=1 AND NOT is_completed`)
  assert.equal(active.rows.length, 1)
  assert.equal(active.rows[0].court_id, court)

  await a.query(`UPDATE ${schema}.matches SET is_completed=true WHERE id=$1`, [first])
  await a.query(`INSERT INTO ${schema}.matches(id,court_id) VALUES ($1,$2)`, [third, court])
  await assert.rejects(a.query(`UPDATE ${schema}.matches SET is_completed=false WHERE id=$1`, [first]), /court_occupied/)
  await assert.rejects(a.query(`UPDATE ${schema}.matches SET court_number=1,court_id=$2 WHERE id=$1`, [dupA, court]), /court_occupied/)
  console.log("PASS: simultaneous numeric/UUID court claims; completion/reuse; unlock/assignment conflicts; legacy duplicate preservation")
} finally {
  await Promise.all(clients.map(c => c.query("ROLLBACK").catch(() => {})))
  if (schemaCreated) await a.query(`DROP SCHEMA ${schema} CASCADE`)
  await Promise.all(clients.map(c => c.end().catch(() => {})))
}
