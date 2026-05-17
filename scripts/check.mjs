#!/usr/bin/env node
// Automated verification orchestrator.
//
// Runs the full pipeline — typecheck, then tests + coverage — streams every
// line to both the console and a timestamped log file, prints a summary, and
// exits non-zero on any failure (ready for a git hook or CI).
//
//   npm run check
//
// All steps run even if an earlier one fails, so a single run surfaces every
// problem at once.

import { spawn } from "node:child_process"
import { mkdirSync, createWriteStream } from "node:fs"
import { join } from "node:path"

const LOG_DIR = "logs"
mkdirSync(LOG_DIR, { recursive: true })

const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const logPath = join(LOG_DIR, `check-${stamp}.log`)
const log = createWriteStream(logPath, { flags: "w" })

function line(text = "") {
  process.stdout.write(text + "\n")
  log.write(text + "\n")
}

function run(name, cmd, args) {
  return new Promise((resolve) => {
    const start = Date.now()
    line("")
    line(`=== ${name} ===`)
    line(`$ ${cmd} ${args.join(" ")}`)
    // shell:true so `npx` resolves on Windows as well as POSIX.
    const child = spawn(cmd, args, { shell: true })
    child.stdout.on("data", (d) => {
      process.stdout.write(d)
      log.write(d)
    })
    child.stderr.on("data", (d) => {
      process.stderr.write(d)
      log.write(d)
    })
    child.on("close", (code) => {
      const secs = ((Date.now() - start) / 1000).toFixed(1)
      line(`--- ${name}: ${code === 0 ? "PASS" : "FAIL"} (${secs}s, exit ${code}) ---`)
      resolve({ name, ok: code === 0, secs })
    })
  })
}

const steps = [
  ["Typecheck (tsc --noEmit)", "npx", ["tsc", "--noEmit"]],
  ["Tests + coverage (vitest)", "npx", ["vitest", "run", "--coverage"]],
]

line(`Automated check started ${new Date().toISOString()}`)

const results = []
for (const [name, cmd, args] of steps) {
  results.push(await run(name, cmd, args))
}

line("")
line("========== SUMMARY ==========")
for (const r of results) {
  line(`  ${r.ok ? "[PASS]" : "[FAIL]"}  ${r.name}  (${r.secs}s)`)
}
const failed = results.filter((r) => !r.ok)
line("")
line(`Log saved to: ${logPath}`)
line(failed.length ? `RESULT: FAIL — ${failed.length} step(s) failed` : "RESULT: PASS — all checks green")

log.end(() => process.exit(failed.length ? 1 : 0))
