// Diagnostic: run the exact server-match-storage queries via supabase-js.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createClient } from "@supabase/supabase-js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = {}
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

console.log("SUPABASE_URL set:", Boolean(env.SUPABASE_URL))
console.log("SUPABASE_SERVICE_ROLE_KEY set:", Boolean(env.SUPABASE_SERVICE_ROLE_KEY))
console.log("NEXT_PUBLIC_SUPABASE_URL set:", Boolean(env.NEXT_PUBLIC_SUPABASE_URL))

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const byId = await supabase
  .from("matches")
  .select("*")
  .eq("id", "e50b7ead-5c95-4183-93e2-b674d05e10e0")
  .single()
console.log("\n[by id] error:", byId.error?.message ?? "none", "| data:", byId.data ? "FOUND" : "null")

const byCourt = await supabase
  .from("matches")
  .select("*")
  .eq("court_number", 1)
  .eq("is_completed", false)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle()
console.log("[by court 1] error:", byCourt.error?.message ?? "none", "| data:", byCourt.data ? byCourt.data.id : "null")
